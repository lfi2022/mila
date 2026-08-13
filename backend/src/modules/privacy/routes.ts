import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { createHmac } from "node:crypto";
import { z } from "zod";

import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AppConfig } from "../../config/env.js";

const cookieConsent = z.object({
  consentId: z.string().uuid(),
  policyVersion: z.string().max(32),
  choices: z.object({ analytics: z.boolean(), marketing: z.boolean() }),
});

export function privacyRoutes(prisma: PrismaClient, config: AppConfig): FastifyPluginAsync {
  const hash = (value: string) =>
    createHmac("sha256", config.AUTH_SECRET).update(value).digest("hex");
  const evidence = (request: FastifyRequest) => ({
    requestId: request.id,
    ipHash: hash(request.ip),
    userAgentHash: hash(request.headers["user-agent"] ?? "unknown"),
  });

  return async (app) => {
    app.get("/legal/config", async () => ({
      operatorName: config.LEGAL_OPERATOR_NAME,
      businessName: config.LEGAL_BUSINESS_NAME,
      tradeName: config.LEGAL_TRADE_NAME,
      businessNumber: config.LEGAL_BUSINESS_NUMBER,
      registeredAddress: config.LEGAL_REGISTERED_ADDRESS,
      country: config.LEGAL_COUNTRY,
      generalEmail: config.LEGAL_GENERAL_EMAIL,
      privacyEmail: config.LEGAL_PRIVACY_EMAIL,
      supportEmail: config.LEGAL_SUPPORT_EMAIL,
      reportEmail: config.LEGAL_REPORT_EMAIL,
      hostingProvider: config.LEGAL_HOSTING_PROVIDER,
      publicationDirector: config.LEGAL_PUBLICATION_DIRECTOR,
      versions: {
        terms: config.LEGAL_TERMS_VERSION,
        privacy: config.LEGAL_PRIVACY_VERSION,
        cookies: config.LEGAL_COOKIE_POLICY_VERSION,
      },
    }));

    app.post(
      "/privacy/cookie-consents",
      { config: { rateLimit: { max: 20, timeWindow: 60_000 } } },
      async (request, reply) => {
        const input = cookieConsent.parse(request.body);
        if (input.policyVersion !== config.LEGAL_COOKIE_POLICY_VERSION) {
          return reply.status(409).send({
            error: { code: "POLICY_VERSION_CHANGED", message: "La politique a été mise à jour." },
          });
        }
        const subjectHash = hash(input.consentId);
        const proof = evidence(request);
        await prisma.privacyConsent.createMany({
          data: (["analytics", "marketing"] as const).map((category) => ({
            subjectHash,
            purpose: `cookies.${category}`,
            policyVersion: input.policyVersion,
            granted: input.choices[category],
            source: "cookie_manager",
            evidence: proof,
          })),
        });
        return reply.status(204).send();
      },
    );
  };
}
