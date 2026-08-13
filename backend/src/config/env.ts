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
    FEATURE_AFFILIATION: booleanString,
    FEATURE_REWARDS: booleanString,
    FEATURE_AFFILIATE_REWARDS: booleanString,
    FEATURE_REFERRAL_REWARDS: booleanString,
    FEATURE_PARTNER_REWARDS: booleanString,
    FEATURE_PREMIUM_REWARDS: booleanString,
    FEATURE_REWARD_REDEMPTION: booleanString,
    FEATURE_REWARD_MARKETPLACE: booleanString,
    FEATURE_BANK_PAYOUT: booleanString,
    FEATURE_MOLLIE_PAYMENTS: booleanString,
    FEATURE_MOLLIE_CONNECT: booleanString,
    FEATURE_CONTRIBUTIONS: booleanString,
    FEATURE_BANK_TRANSFERS: booleanString,
    FEATURE_PARENT_PAYOUTS: booleanString,
    FEATURE_PRICE_TRACKING: booleanString,
    FEATURE_PRICE_ALERTS: booleanString,
    FEATURE_PRICE_COMPARISON: booleanString,
    FEATURE_ORDER_FULFILMENT: booleanString,
    FEATURE_AUTOMATIC_ORDERS: booleanString,
    FEATURE_SECOND_HAND_OFFERS: booleanString,
    FEATURE_MEDIA_MESSAGES: booleanString,
    FEATURE_THANK_YOUS: booleanString,
    FEATURE_MEMORY_BOOK: booleanString,
    FEATURE_MEDIA_TRANSCODING: booleanString,
    FEATURE_PREMIUM: booleanString,
    MOLLIE_MODE: z.enum(["test", "live"]).default("test"),
    MOLLIE_API_KEY: z.string().optional().default(""),
    MOLLIE_API_URL: z.string().url().default("https://api.mollie.com/v2"),
    MOLLIE_WEBHOOK_URL: z.string().url().optional().or(z.literal("")).default(""),
    MOLLIE_REDIRECT_URL: z.string().url().optional().or(z.literal("")).default(""),
    MOLLIE_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(8_000),
    PREMIUM_PRICE_MINOR: z.coerce.number().int().min(100).max(1_000_000).default(2_999),
    PREMIUM_CURRENCY: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("EUR"),
    CONTRIBUTION_FEE_RATE_BPS: z.coerce.number().int().min(0).max(10_000).default(0),
    CONTRIBUTION_PLATFORM_SHARE_RATE_BPS: z.coerce.number().int().min(0).max(10_000).default(0),
    CONTRIBUTION_MIN_MINOR: z.coerce.number().int().min(1).default(100),
    BANK_TRANSFER_BENEFICIARY: z.string().trim().optional().default(""),
    BANK_TRANSFER_IBAN_MASKED: z.string().trim().optional().default(""),
    BANK_TRANSFER_IBAN: z.string().trim().optional().default(""),
    PRICE_SCHEDULER_INTERVAL_MS: z.coerce.number().int().min(60_000).default(300_000),
    PRICE_REFRESH_BATCH_SIZE: z.coerce.number().int().min(1).max(1_000).default(100),
    PRICE_REFRESH_PER_MERCHANT_BATCH: z.coerce.number().int().min(1).max(100).default(5),
    PRICE_REFRESH_MIN_HOURS: z.coerce.number().int().min(1).max(168).default(6),
    PRICE_REFRESH_MAX_HOURS: z.coerce.number().int().min(6).max(720).default(72),
    PRICE_AUTO_SWITCH_MIN_SAVINGS_BPS: z.coerce.number().int().min(100).max(5_000).default(500),
    ORDER_PREPARATION_MAX_ITEMS: z.coerce.number().int().min(1).max(1_000).default(100),
    MEDIA_AUDIO_MAX_BYTES: z.coerce.number().int().min(1_024).max(52_428_800).default(15_728_640),
    MEDIA_VIDEO_MAX_BYTES: z.coerce.number().int().min(1_024).max(104_857_600).default(52_428_800),
    MEDIA_RETENTION_DAYS: z.coerce.number().int().min(1).max(3_650).default(730),
    REWARD_DEFAULT_SHARE_RATE_BPS: z.coerce.number().int().min(0).max(10_000).default(2_500),
    REWARD_MIN_REDEMPTION_MINOR: z.coerce.number().int().min(1).default(1_000),
    REFERRAL_REWARD_MINOR: z.coerce.number().int().min(0).default(500),
    REFERRAL_MAX_PER_USER: z.coerce.number().int().min(1).max(1_000).default(20),
    AFFILIATE_WEBHOOK_SECRET: z.string().optional().default(""),
    PRODUCT_FETCH_USER_AGENT: z.string().trim().min(1).default("MilaBot/1.0"),
    PRODUCT_FETCH_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(8_000),
    PRODUCT_FETCH_MAX_BYTES: z.coerce.number().int().min(1_024).max(2_097_152).default(524_288),
    PRODUCT_FETCH_MAX_REDIRECTS: z.coerce.number().int().min(0).max(5).default(3),
    STORAGE_ENDPOINT: z.string().url(),
    STORAGE_PUBLIC_ENDPOINT: z.string().url(),
    STORAGE_REGION: z.string().trim().min(1).default("us-east-1"),
    STORAGE_ACCESS_KEY: z.string().min(1),
    STORAGE_SECRET_KEY: z.string().min(8),
    STORAGE_FORCE_PATH_STYLE: booleanString,
    STORAGE_BUCKET_PRODUCT_IMAGES: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
    STORAGE_BUCKET_LIST_COVERS: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
    STORAGE_BUCKET_USER_UPLOADS: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
    STORAGE_BUCKET_MEDIA_MESSAGES: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
    STORAGE_BUCKET_EXPORTS: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
    STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
    STORAGE_MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(104_857_600)
      .default(10_485_760),
    EMAIL_PROVIDER: z.enum(["console", "smtp", "disabled"]).default("console"),
    EMAIL_FROM: z.string().trim().min(3),
    SMTP_HOST: z.string().trim().optional().default(""),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_USER: z.string().trim().optional().default(""),
    SMTP_PASSWORD: z.string().optional().default(""),
    SMTP_SECURE: booleanString,
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),
    WORKER_QUEUES: z
      .string()
      .trim()
      .min(1)
      .default("notifications,product-refresh,media-scan,cleanup"),
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
    if (env.EMAIL_PROVIDER === "smtp" && (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD)) {
      context.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "SMTP host, user and password are required when EMAIL_PROVIDER is smtp",
      });
    }
    if (env.FEATURE_AFFILIATION && env.AFFILIATE_WEBHOOK_SECRET.length < 32) {
      context.addIssue({
        code: "custom",
        path: ["AFFILIATE_WEBHOOK_SECRET"],
        message:
          "AFFILIATE_WEBHOOK_SECRET must contain at least 32 characters when affiliation is enabled",
      });
    }
    if (env.FEATURE_MOLLIE_PAYMENTS) {
      const expectedPrefix = env.MOLLIE_MODE === "live" ? "live_" : "test_";
      if (!env.MOLLIE_API_KEY.startsWith(expectedPrefix)) {
        context.addIssue({
          code: "custom",
          path: ["MOLLIE_API_KEY"],
          message: `MOLLIE_API_KEY must start with ${expectedPrefix} when Mollie is enabled`,
        });
      }
      if (!env.MOLLIE_WEBHOOK_URL || !env.MOLLIE_REDIRECT_URL) {
        context.addIssue({
          code: "custom",
          path: ["MOLLIE_WEBHOOK_URL"],
          message: "Mollie webhook and redirect URLs are required when Mollie is enabled",
        });
      }
      if (new URL(env.MOLLIE_API_URL).origin !== "https://api.mollie.com") {
        context.addIssue({
          code: "custom",
          path: ["MOLLIE_API_URL"],
          message: "MOLLIE_API_URL must use the official Mollie API origin",
        });
      }
      if (
        env.MOLLIE_REDIRECT_URL &&
        new URL(env.MOLLIE_REDIRECT_URL).origin !== new URL(env.APP_URL).origin
      ) {
        context.addIssue({
          code: "custom",
          path: ["MOLLIE_REDIRECT_URL"],
          message: "MOLLIE_REDIRECT_URL must use the application origin",
        });
      }
    }
    if (env.FEATURE_BANK_TRANSFERS) {
      if (!env.FEATURE_CONTRIBUTIONS) {
        context.addIssue({
          code: "custom",
          path: ["FEATURE_CONTRIBUTIONS"],
          message: "FEATURE_CONTRIBUTIONS must be enabled with bank transfers",
        });
      }
      if (!env.BANK_TRANSFER_BENEFICIARY || !env.BANK_TRANSFER_IBAN) {
        context.addIssue({
          code: "custom",
          path: ["BANK_TRANSFER_IBAN"],
          message: "Bank beneficiary and IBAN are required when bank transfers are enabled",
        });
      }
    }
    if (env.FEATURE_PARENT_PAYOUTS && !env.FEATURE_MOLLIE_CONNECT) {
      context.addIssue({
        code: "custom",
        path: ["FEATURE_MOLLIE_CONNECT"],
        message: "Mollie Connect is required before parent payouts can be enabled",
      });
    }
    if (env.CONTRIBUTION_FEE_RATE_BPS + env.CONTRIBUTION_PLATFORM_SHARE_RATE_BPS >= 10_000) {
      context.addIssue({
        code: "custom",
        path: ["CONTRIBUTION_FEE_RATE_BPS"],
        message: "Contribution fee and platform share must total less than 100%",
      });
    }
    if ((env.FEATURE_PRICE_ALERTS || env.FEATURE_PRICE_COMPARISON) && !env.FEATURE_PRICE_TRACKING) {
      context.addIssue({
        code: "custom",
        path: ["FEATURE_PRICE_TRACKING"],
        message: "Price tracking is required for price alerts and comparison",
      });
    }
    if (env.PRICE_REFRESH_MIN_HOURS > env.PRICE_REFRESH_MAX_HOURS) {
      context.addIssue({
        code: "custom",
        path: ["PRICE_REFRESH_MIN_HOURS"],
        message: "Minimum price refresh interval cannot exceed maximum",
      });
    }
    if (env.FEATURE_AUTOMATIC_ORDERS && !env.FEATURE_ORDER_FULFILMENT) {
      context.addIssue({
        code: "custom",
        path: ["FEATURE_ORDER_FULFILMENT"],
        message: "Order fulfilment must be enabled before automatic orders",
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
