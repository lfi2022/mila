import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationDirectory = resolve(root, "supabase", "migrations");
const files = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort();
const tables = new Set();
const digest = createHash("sha256");

for (const file of files) {
  const sql = await readFile(resolve(migrationDirectory, file), "utf8");
  digest.update(file).update("\0").update(sql);
  for (const match of sql.matchAll(
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?[`"]?([a-z0-9_]+)[`"]?/gi,
  )) {
    tables.add(match[1]);
  }
}

const report = {
  sourceMigrationCount: files.length,
  sourceSchemaSha256: digest.digest("hex"),
  sourceTables: [...tables].sort(),
  requiredChecks: [
    "row counts before and after",
    "foreign-key orphan count equals zero",
    "minor-unit monetary totals match by currency",
    "sampled users, lists, gifts and reservations match",
    "legacy sessions and plaintext tokens are not imported",
  ],
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
