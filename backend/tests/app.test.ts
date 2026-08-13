import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

const config = loadConfig({
  APP_ENV: "test",
  NODE_ENV: "test",
  APP_URL: "https://test.example.com",
  API_PUBLIC_URL: "/api/v1",
  CORS_ALLOWED_ORIGINS: "https://test.example.com",
  SEO_INDEXING_ENABLED: "false",
});

describe("Mila API bootstrap", () => {
  it("exposes the versioned API and liveness endpoint", async () => {
    const app = await createApp({ config, logger: false });

    const version = await app.inject({ method: "GET", url: "/api/v1/" });
    expect(version.statusCode).toBe(200);
    expect(version.json()).toMatchObject({ name: "Mila", version: "v1" });

    const live = await app.inject({ method: "GET", url: "/api/v1/health/live" });
    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: "ok" });

    await app.close();
  });

  it("reports dependency readiness failures without crashing", async () => {
    const app = await createApp({
      config,
      logger: false,
      readinessProbe: async () => ({ database: "down", redis: "up" }),
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/health/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: "unavailable" });

    await app.close();
  });

  it("rejects unknown CORS origins", async () => {
    const app = await createApp({ config, logger: false });
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/",
      headers: { origin: "https://attacker.example", "access-control-request-method": "GET" },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    await app.close();
  });
});
