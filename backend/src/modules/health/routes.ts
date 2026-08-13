import type { FastifyPluginAsync } from "fastify";

export type ReadinessProbe = () => Promise<Record<string, "up" | "down">>;

export function healthRoutes(readinessProbe: ReadinessProbe): FastifyPluginAsync {
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
      const ready = Object.values(dependencies).every((status) => status === "up");
      return reply
        .status(ready ? 200 : 503)
        .send({ status: ready ? "ready" : "unavailable", dependencies });
    });
  };
}
