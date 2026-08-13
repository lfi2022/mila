import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { AffiliationService } from "./service.js";

const commission = z.object({
  network: z.string().trim().min(1).max(120),
  externalId: z.string().trim().min(1).max(255),
  campaignId: z.string().trim().min(1).max(255).optional(),
  clickToken: z.string().length(64).optional(),
  orderReference: z.string().max(255).optional(),
  orderAmountMinor: z.string().regex(/^\d+$/).optional(),
  commissionMinor: z.string().regex(/^\d+$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]),
  occurredAt: z.string().datetime(),
});

export function affiliationRoutes(service: AffiliationService): FastifyPluginAsync {
  return async (app) => {
    app.get("/public/go/:token", async (request, reply) => {
      const { token } = z.object({ token: z.string().length(64) }).parse(request.params);
      const result = await service.redirect(
        token,
        request.ip,
        request.headers["x-mila-source"] as string | undefined,
      );
      return reply
        .header("cache-control", "no-store")
        .header("referrer-policy", "no-referrer")
        .redirect(result.url, 302);
    });
    app.post("/webhooks/affiliation", async (request, reply) => {
      const timestamp = z.string().parse(request.headers["x-mila-timestamp"]);
      const signature = z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(request.headers["x-mila-signature"]);
      service.verifySignature(timestamp, signature, request.body);
      await service.ingest(commission.parse(request.body));
      return reply.status(202).send({ accepted: true });
    });
  };
}
