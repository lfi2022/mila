import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function hasForbiddenCredentialName(file) {
  const envFile = file === ".env" || (file.startsWith(".env.") && !file.endsWith(".example"));
  return envFile || /\.(?:pem|key|p12|pfx)$/i.test(file);
}

const suspiciousValues = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\b(?:password|secret|token|api[_-]?key)\s*[:=]\s*["'][A-Za-z0-9_./+=-]{24,}["']/i,
];

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const findings = [];
for (const file of tracked) {
  if (hasForbiddenCredentialName(file)) {
    findings.push(`${file}: forbidden credential filename is tracked`);
    continue;
  }

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const pattern of suspiciousValues) {
    if (pattern.test(content)) {
      findings.push(`${file}: content matches ${pattern}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Potential secrets detected:\n" + findings.map((finding) => `- ${finding}`).join("\n"));
  process.exit(1);
}

console.log(`Secret scan passed for ${tracked.length} tracked files.`);
