import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Affiliate network webhook. Public URL, so the signature is the security
 * boundary: nothing is written before it is verified.
 *
 * Body (JSON):
 *  { network, external_id, commission_amount_cents, status?, order_amount_cents?,
 *    order_reference?, click_reference?, merchant_domain?, item_public_token? }
 *
 * Idempotent: replaying the same (network, external_id) never credits twice.
 */
const payloadSchema = z.object({
  network: z.string().trim().min(1).max(60),
  external_id: z.string().trim().min(1).max(200),
  commission_amount_cents: z.number().int().min(0).max(100_000_000),
  order_amount_cents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).optional(),
  order_reference: z.string().trim().max(200).nullable().optional(),
  click_reference: z.string().trim().max(200).nullable().optional(),
  merchant_domain: z.string().trim().max(200).nullable().optional(),
  item_public_token: z.string().trim().max(80).nullable().optional(),
  occurred_at: z.string().datetime().nullable().optional(),
});

async function verifySignature(secret: string, body: string, signature: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const provided = signature.trim().toLowerCase().replace(/^sha256=/, "");
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/affiliate-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["AFFILIATE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const body = await request.text();
        if (body.length > 100_000) return new Response("Payload too large", { status: 413 });
        const signature = request.headers.get("x-mila-signature") ?? "";
        if (!signature || !(await verifySignature(secret, body, signature))) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed: z.infer<typeof payloadSchema>;
        try {
          parsed = payloadSchema.parse(JSON.parse(body));
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        try {
          const { ingestAffiliateEvent } = await import("@/lib/rewards.server");
          const result = await ingestAffiliateEvent({
            network: parsed.network,
            externalId: parsed.external_id,
            commissionAmountCents: parsed.commission_amount_cents,
            orderAmountCents: parsed.order_amount_cents ?? null,
            currency: parsed.currency ?? "EUR",
            status: parsed.status ?? "PENDING",
            orderReference: parsed.order_reference ?? null,
            clickReference: parsed.click_reference ?? null,
            merchantDomain: parsed.merchant_domain ?? null,
            itemPublicToken: parsed.item_public_token ?? null,
            occurredAt: parsed.occurred_at ?? null,
            raw: JSON.parse(body),
          });
          return Response.json({ ok: true, commission_id: result.commissionId });
        } catch {
          return new Response("Processing error", { status: 500 });
        }
      },
    },
  },
});
