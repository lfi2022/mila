import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const script = resolve("scripts/configure-env.mjs");

describe("environment configuration wizard", () => {
  it("generates a complete local file without leaking placeholders", () => {
    const directory = mkdtempSync(join(tmpdir(), "mila-config-"));
    const output = join(directory, ".env");
    try {
      execFileSync(
        process.execPath,
        [script, "--profile", "local", "--defaults", "--output", output],
        {
          cwd: resolve("."),
        },
      );
      const contents = readFileSync(output, "utf8");
      expect(contents).toContain("APP_ENV=development");
      expect(contents).toContain("DATABASE_HOST=mysql");
      expect(contents).toContain("REDIS_URL=redis://redis:6379/0");
      expect(contents).not.toContain("A_REMPLIR");
      expect(contents.match(/^AUTH_SECRET=(.+)$/m)?.[1].length).toBeGreaterThanOrEqual(32);
      expect(contents.match(/^SESSION_SECRET=(.+)$/m)?.[1]).not.toBe(
        contents.match(/^AUTH_SECRET=(.+)$/m)?.[1],
      );
      expect(() =>
        execFileSync(process.execPath, [script, "--check", "--output", output], {
          cwd: resolve("."),
        }),
      ).not.toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not overwrite an existing file without --force", () => {
    const directory = mkdtempSync(join(tmpdir(), "mila-config-"));
    const output = join(directory, ".env");
    try {
      writeFileSync(output, "KEEP_ME=true\n");
      execFileSync(
        process.execPath,
        [script, "--profile", "local", "--defaults", "--output", output],
        {
          cwd: resolve("."),
        },
      );
      expect(readFileSync(output, "utf8")).toBe("KEEP_ME=true\n");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("refuses non-interactive defaults for production", () => {
    expect(() =>
      execFileSync(process.execPath, [script, "--profile", "production", "--defaults"], {
        cwd: resolve("."),
        stdio: "pipe",
      }),
    ).toThrow();
  });
});
