import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z
  .object({
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_NAME: z.string().trim().min(1).default("Mila"),
    APP_URL: z.string().url(),
    API_PUBLIC_URL: z.string().trim().min(1).default("/api/v1"),
    ASSET_PUBLIC_URL: z.string().trim().min(1).default("/assets"),
    HOST: z.string().trim().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    TRUST_PROXY: booleanString,
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    CORS_ALLOWED_ORIGINS: z.string().trim().min(1),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    REQUEST_BODY_LIMIT_BYTES: z.coerce.number().int().min(1_024).max(5_242_880).default(1_048_576),
    SEO_INDEXING_ENABLED: booleanString,
  })
  .superRefine((env, context) => {
    if (env.APP_ENV !== "development" && !env.APP_URL.startsWith("https://")) {
      context.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "APP_URL must use HTTPS outside development",
      });
    }
    if (env.APP_ENV !== "production" && env.SEO_INDEXING_ENABLED) {
      context.addIssue({
        code: "custom",
        path: ["SEO_INDEXING_ENABLED"],
        message: "SEO indexing can only be enabled in production",
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;

  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export function allowedOrigins(config: AppConfig): Set<string> {
  return new Set(
    config.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
}
