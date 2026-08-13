import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import type { AppConfig } from "../src/config/env.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { analyticsRoutes, pseudonym } from "../src/modules/analytics/routes.js";

describe("product analytics", () => {
  it("stores only keyed pseudonyms after explicit consent", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const prisma = {
      productAnalyticsEvent: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          writes.push(data);
          return data;
        },
      },
    } as unknown as PrismaClient;
    const config = { AUTH_SECRET: "analytics-test-secret-at-least-32-characters" } as AppConfig;
    const app = Fastify({ logger: false });
    await app.register(analyticsRoutes(prisma, config), { prefix: "/api/v1" });

    const visitorId = "9edb4d7e-e4bf-4e91-9427-959f8e2a6862";
    const sessionId = "0c82842a-f74f-456f-a884-96c32f91b3e2";
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/analytics/events",
      payload: {
        consent: true,
        visitorId,
        sessionId,
        event: "list_created",
        path: "/dashboard",
        occurredAt: new Date().toISOString(),
        properties: { source: "onboarding" },
      },
    });

    expect(response.statusCode).toBe(202);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      subjectHash: pseudonym(config.AUTH_SECRET, visitorId),
      sessionHash: pseudonym(config.AUTH_SECRET, sessionId),
      event: "list_created",
    });
    expect(JSON.stringify(writes[0])).not.toContain(visitorId);
    expect(JSON.stringify(writes[0])).not.toContain(sessionId);
    await app.close();
  });

  it("rejects events without affirmative consent", async () => {
    const app = Fastify({ logger: false });
    let writes = 0;
    const prisma = {
      productAnalyticsEvent: {
        create: async () => {
          writes += 1;
          return undefined;
        },
      },
    } as unknown as PrismaClient;
    app.setErrorHandler((error, _request, reply) => {
      const name = error instanceof Error ? error.name : "UnknownError";
      return reply.status(name === "ZodError" ? 400 : 500).send({ error: name });
    });
    await app.register(
      analyticsRoutes(prisma, {
        AUTH_SECRET: "analytics-test-secret-at-least-32-characters",
      } as AppConfig),
      { prefix: "/api/v1" },
    );
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/analytics/events",
      payload: {
        consent: false,
        visitorId: crypto.randomUUID(),
        sessionId: crypto.randomUUID(),
        event: "homepage_view",
        occurredAt: new Date().toISOString(),
      },
    });
    expect(response.statusCode).toBe(400);
    expect(writes).toBe(0);
    await app.close();
  });
});
