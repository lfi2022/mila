import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import readline from "node:readline";

const args = new Set(process.argv.slice(2));
const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const outputPath = resolve(valueAfter("--output") || ".env");

if (args.has("--help")) {
  printUsage();
} else if (args.has("--check")) {
  await checkFile(outputPath);
  process.exitCode = 0;
} else {
  await runWizard();
}

async function runWizard() {
  const defaultsMode = args.has("--defaults");
  const forcedProfile = valueAfter("--profile");
  const rl = defaultsMode ? null : createPrompt();
  try {
    printHeader();
    const profile = forcedProfile || (await chooseProfile(rl));
    if (!["local", "staging", "production"].includes(profile)) {
      throw new Error("Le profil doit être local, staging ou production.");
    }
    if (defaultsMode && profile !== "local") {
      throw new Error("--defaults est limité au profil local pour éviter une production fictive.");
    }

    const templatePath = resolve(
      profile === "local" ? ".env.local.example" : `.env.${profile}.example`,
    );
    const document = parseEnv(await readFile(templatePath, "utf8"));
    const values = document.values;
    const local = profile === "local";
    const environment = profile === "local" ? "development" : profile;
    const useDocker = local ? await confirm(rl, "Utiliser la stack Docker locale ?", true) : false;

    const defaultOrigin =
      profile === "local"
        ? "http://localhost"
        : profile === "staging"
          ? "https://dev06.lfinfo.be"
          : "";
    const origin = normalizeOrigin(
      await ask(rl, "URL publique de Mila", defaultOrigin, { required: true }),
      environment,
    );
    const domain = new URL(origin).hostname;

    set(values, {
      APP_ENV: environment,
      NODE_ENV: local ? "development" : "production",
      APP_URL: origin,
      PUBLIC_APP_URL: origin,
      VITE_PUBLIC_APP_URL: origin,
      APP_DOMAIN: domain,
      COOKIE_DOMAIN: local ? "" : domain,
      COOKIE_SECURE: String(!local),
      CORS_ALLOWED_ORIGINS: origin,
      TRUST_PROXY: String(!local),
      SEO_INDEXING_ENABLED: String(profile === "production"),
      VITE_SEO_INDEXING_ENABLED: String(profile === "production"),
      API_INTERNAL_URL: useDocker ? "http://backend:3000/api/v1" : `${origin}/api/v1`,
    });

    const database = useDocker
      ? {
          host: "mysql",
          port: "3306",
          name: "mila",
          user: "mila",
          password: secret(),
          sslMode: "disabled",
        }
      : {
          host: await ask(rl, "Hôte MySQL", "", { required: true }),
          port: await ask(rl, "Port MySQL", "3306", { required: true }),
          name: await ask(rl, "Base MySQL", "mila", { required: true }),
          user: await ask(rl, "Utilisateur MySQL", "mila", { required: true }),
          password: await askSecret(rl, "Mot de passe MySQL", { required: true }),
          sslMode: await choose(rl, "Mode TLS MySQL", ["required", "preferred", "disabled"], 0),
        };
    set(values, {
      DATABASE_HOST: database.host,
      DATABASE_PORT: database.port,
      DATABASE_NAME: database.name,
      DATABASE_USER: database.user,
      DATABASE_PASSWORD: database.password,
      DATABASE_URL: mysqlUrl(database),
      DATABASE_SSL_MODE: database.sslMode,
      AUTH_SECRET: secret(),
      SESSION_SECRET: secret(),
      REDIS_URL: useDocker
        ? "redis://redis:6379/0"
        : await ask(rl, "URL Redis", "", { required: true }),
    });

    const storage = useDocker
      ? {
          endpoint: "http://minio:9000",
          publicEndpoint: "http://storage.localhost",
          accessKey: "mila-local",
          secretKey: secret(),
        }
      : {
          endpoint: await ask(rl, "Endpoint privé S3/MinIO", "", {
            required: true,
          }),
          publicEndpoint: await ask(
            rl,
            "Endpoint public des uploads signés",
            `https://storage.${domain}`,
            { required: true },
          ),
          accessKey: await ask(rl, "Clé d’accès stockage", "", { required: true }),
          secretKey: await askSecret(rl, "Clé secrète stockage", { required: true }),
        };
    set(values, {
      STORAGE_ENDPOINT: storage.endpoint,
      STORAGE_PUBLIC_ENDPOINT: storage.publicEndpoint,
      STORAGE_ACCESS_KEY: storage.accessKey,
      STORAGE_SECRET_KEY: storage.secretKey,
    });

    const smtp = await confirm(rl, "Configurer l’envoi SMTP maintenant ?", false);
    if (smtp) {
      set(values, {
        EMAIL_PROVIDER: "smtp",
        EMAIL_FROM: await ask(rl, "Expéditeur email", `Mila <noreply@${domain}>`, {
          required: true,
        }),
        SMTP_HOST: await ask(rl, "Hôte SMTP", "", { required: true }),
        SMTP_PORT: await ask(rl, "Port SMTP", "587", { required: true }),
        SMTP_USER: await ask(rl, "Utilisateur SMTP", "mila", { required: true }),
        SMTP_PASSWORD: await askSecret(rl, "Mot de passe SMTP", { required: true }),
        SMTP_SECURE: String(await confirm(rl, "TLS SMTP implicite (souvent port 465) ?", false)),
      });
    } else {
      set(values, {
        EMAIL_PROVIDER: local ? "console" : "disabled",
        EMAIL_FROM: `Mila <noreply@${domain}>`,
        SMTP_HOST: "",
        SMTP_USER: "",
        SMTP_PASSWORD: "",
      });
    }

    const observability = await confirm(rl, "Activer l’endpoint Prometheus protégé ?", !local);
    set(values, {
      OBSERVABILITY_ENABLED: String(observability),
      OBSERVABILITY_TOKEN: secret(),
    });

    const mollie = await confirm(rl, "Activer les paiements Mollie ?", false);
    if (mollie) {
      const mollieMode = await choose(rl, "Mode Mollie", ["test", "live"], 0);
      set(values, {
        FEATURE_PREMIUM: "true",
        FEATURE_MOLLIE_PAYMENTS: "true",
        MOLLIE_MODE: mollieMode,
        MOLLIE_API_KEY: await askSecret(rl, `Clé Mollie (${mollieMode}_)`, { required: true }),
        MOLLIE_WEBHOOK_URL: `${origin}/api/v1/webhooks/mollie`,
        MOLLIE_REDIRECT_URL: `${origin}/paiement/retour`,
      });
    } else {
      set(values, {
        FEATURE_MOLLIE_PAYMENTS: "false",
        MOLLIE_API_KEY: "",
        MOLLIE_WEBHOOK_URL: `${origin}/api/v1/webhooks/mollie`,
        MOLLIE_REDIRECT_URL: `${origin}/paiement/retour`,
      });
    }

    clearDisabledPlaceholders(values);
    if (useDocker) {
      set(values, {
        MILA_ENV_FILE: ".env",
        HTTP_PORT: "80",
        MYSQL_ROOT_PASSWORD: secret(),
      });
    }

    const errors = validate(values);
    if (errors.length) throw new Error(`Configuration invalide :\n- ${errors.join("\n- ")}`);

    if (existsSync(outputPath) && !args.has("--force")) {
      const overwrite = await confirm(rl, `${outputPath} existe déjà. L’écraser ?`, false);
      if (!overwrite) {
        process.stdout.write("Aucun fichier modifié.\n");
        return;
      }
    }
    await atomicWrite(outputPath, renderEnv(document, values, profile));
    process.stdout.write(`\nConfiguration écrite dans ${outputPath}\n`);
    process.stdout.write("Les secrets ont été générés localement et ne sont pas affichés.\n");
    process.stdout.write("Vérification : npm run config:check\n");
    if (useDocker) {
      process.stdout.write(
        "Démarrage : docker compose --profile local-db --profile local-storage up --build -d\n",
      );
    }
  } finally {
    rl?.close();
  }
}

function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  rl.stdoutMuted = false;
  const original = rl._writeToOutput.bind(rl);
  rl._writeToOutput = function (text) {
    if (!this.stdoutMuted) return original(text);
    if (/\r|\n/.test(text)) return original(text);
    return original("*");
  };
  return rl;
}

function question(rl, label, secretInput = false) {
  if (!rl) return Promise.resolve("");
  if (secretInput) process.stdout.write(label);
  rl.stdoutMuted = secretInput;
  return new Promise((resolveQuestion) => {
    rl.question(secretInput ? "" : label, (answer) => {
      rl.stdoutMuted = false;
      if (secretInput) process.stdout.write("\n");
      resolveQuestion(answer);
    });
  });
}

async function ask(rl, label, defaultValue = "", options = {}) {
  if (!rl) return defaultValue;
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  while (true) {
    const answer = (await question(rl, `${label}${suffix} : `)).trim() || defaultValue;
    if (answer || !options.required) return safeValue(answer);
    process.stdout.write("Cette valeur est obligatoire.\n");
  }
}

async function askSecret(rl, label, options = {}) {
  if (!rl) return secret();
  while (true) {
    const answer = (await question(rl, `${label} (saisie masquée) : `, true)).trim();
    if (answer || !options.required) return safeValue(answer);
    process.stdout.write("Cette valeur est obligatoire.\n");
  }
}

async function confirm(rl, label, defaultValue) {
  if (!rl) return defaultValue;
  const answer = (await question(rl, `${label} ${defaultValue ? "[O/n]" : "[o/N]"} : `))
    .trim()
    .toLowerCase();
  if (!answer) return defaultValue;
  return ["o", "oui", "y", "yes"].includes(answer);
}

async function choose(rl, label, choices, defaultIndex = 0) {
  if (!rl) return choices[defaultIndex];
  process.stdout.write(`\n${label}\n`);
  choices.forEach((choice, index) => process.stdout.write(`  ${index + 1}. ${choice}\n`));
  while (true) {
    const answer = await question(rl, `Choix [${defaultIndex + 1}] : `);
    const index = answer.trim() ? Number(answer) - 1 : defaultIndex;
    if (choices[index]) return choices[index];
    process.stdout.write("Choix invalide.\n");
  }
}

const chooseProfile = (rl) =>
  choose(rl, "Environnement à configurer", ["local", "staging", "production"]);

function parseEnv(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const values = new Map();
  for (const line of lines) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) values.set(match[1], match[2]);
  }
  return { lines, values };
}

function renderEnv(document, values, profile) {
  const emitted = new Set();
  const lines = document.lines.map((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!match) return line;
    const key = match[1];
    emitted.add(key);
    return `${key}=${values.get(key) ?? ""}`;
  });
  const extras = [...values].filter(([key]) => !emitted.has(key));
  if (extras.length)
    lines.push("", "# Valeurs ajoutées par le wizard", ...extras.map(([k, v]) => `${k}=${v}`));
  return `# Généré par npm run config — profil ${profile}\n${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function set(values, entries) {
  for (const [key, value] of Object.entries(entries)) values.set(key, String(value));
}

function clearDisabledPlaceholders(values) {
  const optional = [
    "BANK_TRANSFER_BENEFICIARY",
    "BANK_TRANSFER_IBAN",
    "BANK_TRANSFER_IBAN_MASKED",
    "CAPTCHA_SECRET",
    "CAPTCHA_VERIFY_URL",
    "AFFILIATE_WEBHOOK_SECRET",
  ];
  optional.forEach((key) => {
    if ((values.get(key) || "").includes("A_REMPLIR")) values.set(key, "");
  });
}

function validate(values) {
  const errors = [];
  const required = [
    "APP_URL",
    "DATABASE_HOST",
    "DATABASE_NAME",
    "DATABASE_USER",
    "DATABASE_PASSWORD",
    "DATABASE_URL",
    "REDIS_URL",
    "AUTH_SECRET",
    "SESSION_SECRET",
    "STORAGE_ENDPOINT",
    "STORAGE_PUBLIC_ENDPOINT",
    "STORAGE_ACCESS_KEY",
    "STORAGE_SECRET_KEY",
  ];
  for (const key of required) if (!values.get(key)) errors.push(`${key} est obligatoire`);
  for (const [key, value] of values) {
    if (value.includes("A_REMPLIR")) errors.push(`${key} contient encore A_REMPLIR`);
    if (/\r|\n/.test(value)) errors.push(`${key} contient un retour à la ligne`);
  }
  for (const key of [
    "APP_URL",
    "DATABASE_URL",
    "REDIS_URL",
    "STORAGE_ENDPOINT",
    "STORAGE_PUBLIC_ENDPOINT",
  ]) {
    try {
      new URL(values.get(key));
    } catch {
      errors.push(`${key} n’est pas une URL valide`);
    }
  }
  if ((values.get("AUTH_SECRET") || "").length < 32)
    errors.push("AUTH_SECRET doit faire au moins 32 caractères");
  if ((values.get("SESSION_SECRET") || "").length < 32)
    errors.push("SESSION_SECRET doit faire au moins 32 caractères");
  if (values.get("AUTH_SECRET") === values.get("SESSION_SECRET"))
    errors.push("Les secrets auth/session doivent être distincts");
  if (
    values.get("OBSERVABILITY_ENABLED") === "true" &&
    (values.get("OBSERVABILITY_TOKEN") || "").length < 32
  ) {
    errors.push("OBSERVABILITY_TOKEN doit faire au moins 32 caractères");
  }
  if (values.get("EMAIL_PROVIDER") === "smtp") {
    for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"])
      if (!values.get(key)) errors.push(`${key} est requis pour SMTP`);
  }
  if (values.get("FEATURE_MOLLIE_PAYMENTS") === "true") {
    const prefix = values.get("MOLLIE_MODE") === "live" ? "live_" : "test_";
    if (!(values.get("MOLLIE_API_KEY") || "").startsWith(prefix))
      errors.push(`MOLLIE_API_KEY doit commencer par ${prefix}`);
  }
  return [...new Set(errors)];
}

async function checkFile(path) {
  if (!existsSync(path)) throw new Error(`${path} n’existe pas. Lancez npm run config.`);
  const { values } = parseEnv(await readFile(path, "utf8"));
  const errors = validate(values);
  if (errors.length) {
    process.stderr.write(`Configuration invalide :\n- ${errors.join("\n- ")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Configuration valide : ${path}\n`);
}

async function atomicWrite(path, contents) {
  const temporaryPath = `${path}.tmp-${process.pid}`;
  await writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporaryPath, path);
}

function mysqlUrl(database) {
  return `mysql://${encodeURIComponent(database.user)}:${encodeURIComponent(database.password)}@${database.host}:${database.port}/${encodeURIComponent(database.name)}`;
}

function normalizeOrigin(value, environment) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("L’URL publique doit utiliser HTTP(S).");
  if (environment !== "development" && url.protocol !== "https:")
    throw new Error("Staging et production exigent HTTPS.");
  return url.origin;
}

function safeValue(value) {
  if (/\r|\n/.test(value))
    throw new Error("Les retours à la ligne ne sont pas autorisés dans une valeur.");
  return value;
}

function secret() {
  return randomBytes(32).toString("base64url");
}

function printHeader() {
  process.stdout.write("\nMila — assistant de configuration\n");
  process.stdout.write("Aucune valeur sensible ne sera affichée ni envoyée sur le réseau.\n\n");
}

function printUsage() {
  process.stdout.write(`Mila — assistant de configuration

Usage:
  npm run config
  npm run config -- --profile local|staging|production
  npm run config -- --profile local --defaults [--force]
  npm run config -- --output .env.autre
  npm run config:check
  npm run config:check -- --output .env.autre

Options:
  --profile    Sélectionne directement le modèle.
  --output     Change le fichier cible (défaut : .env).
  --defaults   Génère sans interaction un environnement local Docker.
  --force      Autorise le remplacement du fichier cible.
  --check      Vérifie le fichier cible sans le modifier.
  --help       Affiche cette aide.
`);
}
