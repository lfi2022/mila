import type { FastifyPluginAsync } from "fastify";

import type { AppConfig } from "../../config/env.js";
import {
  MetricsRegistry,
  observabilityAuthorized,
  type OperationalMetrics,
} from "../../common/observability/metrics.js";

export type ReadinessProbe = () => Promise<Record<string, "up" | "down">>;

export function healthRoutes(
  readinessProbe: ReadinessProbe,
  config: AppConfig,
  metrics: MetricsRegistry,
  operationalMetrics: OperationalMetrics,
): FastifyPluginAsync {
  return async (app) => {
    app.get(
      "/live",
      {
        schema: {
          tags: ["health"],
          response: { 200: { type: "object", properties: { status: { type: "string" } } } },
        },
      },
      async () => ({ status: "ok" }),
    );

    app.get("/ready", { schema: { tags: ["health"] } }, async (_request, reply) => {
      const dependencies = await readinessProbe();
      metrics.setDependencies(dependencies);
      const ready = Object.values(dependencies).every((status) => status === "up");
      return reply
        .status(ready ? 200 : 503)
        .send({ status: ready ? "ready" : "unavailable", dependencies });
    });

    app.get("/metrics", { schema: { tags: ["health"] } }, async (request, reply) => {
      if (
        !config.OBSERVABILITY_ENABLED ||
        !observabilityAuthorized(request, config.OBSERVABILITY_TOKEN)
      )
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } });
      reply.header("content-type", "text/plain; version=0.0.4; charset=utf-8");
      reply.header("cache-control", "no-store");
      return `${metrics.render()}${await operationalMetrics.render()}`;
    });
  };
}
