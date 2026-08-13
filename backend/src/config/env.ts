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
    DATABASE_HOST: z.string().trim().min(1),
    DATABASE_PORT: z.coerce.number().int().min(1).max(65_535).default(3306),
    DATABASE_NAME: z.string().trim().min(1),
    DATABASE_USER: z.string().trim().min(1),
    DATABASE_PASSWORD: z.string().min(1),
    DATABASE_URL: z.string().url().startsWith("mysql://"),
    DATABASE_SSL_MODE: z.enum(["disabled", "preferred", "required"]).default("required"),
    DATABASE_POOL_MIN: z.coerce.number().int().min(0).default(2),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    AUTH_SECRET: z.string().min(32),
    SESSION_SECRET: z.string().min(32),
    SESSION_TTL_SECONDS: z.coerce.number().int().min(300).default(2_592_000),
    EMAIL_VERIFICATION_TTL_SECONDS: z.coerce.number().int().min(300).default(86_400),
    PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().min(300).default(3_600),
    COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .default("mila_session"),
    COOKIE_DOMAIN: z.string().trim().optional().default(""),
    COOKIE_SECURE: booleanString,
    COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("lax"),
    REDIS_URL: z
      .string()
      .url()
      .refine((value) => ["redis:", "rediss:"].includes(new URL(value).protocol), {
        message: "REDIS_URL must use redis:// or rediss://",
      }),
    QUEUE_PREFIX: z.string().trim().min(1).default("mila"),
    FEATURE_OAUTH: booleanString,
    PRODUCT_FETCH_USER_AGENT: z.string().trim().min(1).default("MilaBot/1.0"),
    PRODUCT_FETCH_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(8_000),
    PRODUCT_FETCH_MAX_BYTES: z.coerce.number().int().min(1_024).max(2_097_152).default(524_288),
    PRODUCT_FETCH_MAX_REDIRECTS: z.coerce.number().int().min(0).max(5).default(3),
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
    if (env.DATABASE_POOL_MIN > env.DATABASE_POOL_MAX) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_POOL_MIN"],
        message: "DATABASE_POOL_MIN cannot exceed DATABASE_POOL_MAX",
      });
    }
    if (env.COOKIE_SAME_SITE === "none" && !env.COOKIE_SECURE) {
      context.addIssue({
        code: "custom",
        path: ["COOKIE_SECURE"],
        message: "COOKIE_SECURE must be true when COOKIE_SAME_SITE is none",
      });
    }
    if (env.APP_ENV === "production" && !env.COOKIE_SECURE) {
      context.addIssue({
        code: "custom",
        path: ["COOKIE_SECURE"],
        message: "COOKIE_SECURE must be true in production",
      });
    }
    if (env.AUTH_SECRET === env.SESSION_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["SESSION_SECRET"],
        message: "SESSION_SECRET must be distinct from AUTH_SECRET",
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
