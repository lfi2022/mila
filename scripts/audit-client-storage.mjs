import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "src", "backend/src", "public"],
  { encoding: "utf8" },
)
  .split(/\r?\n/)
  .filter((file) => /\.(?:ts|tsx|js)$/.test(file));
const findings = [];
const patterns = [
  ["cookie", /(?:setCookie|clearCookie)\(\s*["'`]([^"'`$]+)["'`]/g],
  ["localStorage", /localStorage\.(?:getItem|setItem|removeItem)\(\s*["'`]([^"'`$]+)["'`]/g],
  ["cache", /caches\.(?:open|delete)\(\s*["'`]([^"'`$]+)["'`]/g],
];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const constants = new Map(
    [...source.matchAll(/const\s+([A-Z][A-Z0-9_]*)\s*=\s*["'`]([^"'`]+)["'`]/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  for (const [kind, pattern] of patterns) {
    for (const match of source.matchAll(pattern)) findings.push({ kind, name: match[1], file });
  }
  for (const match of source.matchAll(
    /localStorage\.(?:getItem|setItem|removeItem)\(\s*([A-Z][A-Z0-9_]*)/g,
  )) {
    if (constants.has(match[1]))
      findings.push({ kind: "localStorage", name: constants.get(match[1]), file });
  }
  for (const match of source.matchAll(/document\.cookie\s*=\s*`\$\{([A-Z][A-Z0-9_]*)\}/g)) {
    if (constants.has(match[1]))
      findings.push({ kind: "cookie", name: constants.get(match[1]), file });
  }
  for (const match of source.matchAll(/caches\.(?:open|delete)\(\s*([A-Z][A-Z0-9_]*)/g)) {
    if (constants.has(match[1]))
      findings.push({ kind: "cache", name: constants.get(match[1]), file });
  }
}
const unique = [
  ...new Map(findings.map((item) => [`${item.kind}:${item.name}:${item.file}`, item])).values(),
];
process.stdout.write(
  `${JSON.stringify({ generatedAt: new Date().toISOString(), findings: unique }, null, 2)}\n`,
);
