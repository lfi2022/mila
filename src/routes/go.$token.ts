import { createFileRoute } from "@tanstack/react-router";

/**
 * Internal merchant redirector: /go/:publicToken
 * Keeps affiliate parameters and API credentials server-side, records an
 * anonymous click, then 302s to the converted merchant link.
 */
export const Route = createFileRoute("/go/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = params.token;
        if (!/^[a-zA-Z0-9_-]{8,64}$/.test(token)) {
          return new Response("Lien invalide", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { validateExternalUrl } = await import("@/lib/url-safety");
        const { findMerchantForUrl } = await import("@/lib/affiliate");
        const { resolveOutgoingUrl } = await import("@/lib/affiliate.server");

        const { data: item } = await supabaseAdmin
          .from("items")
          .select("id, url, registry_id, hidden_by_moderator, registries(status)")
          .eq("public_token", token)
          .maybeSingle();

        const registry = item?.registries as { status: string } | null;
        if (!item?.url || item.hidden_by_moderator || registry?.status !== "ACTIVE") {
          return new Response("Lien introuvable", { status: 404 });
        }

        const validated = validateExternalUrl(item.url);
        if (!validated.ok) return new Response("Lien invalide", { status: 400 });

        const { data: merchants } = await supabaseAdmin
          .from("merchants")
          .select(
            "id, name, domains, enabled, affiliate_enabled, affiliate_network, affiliate_id, affiliate_template, link_mode, api_endpoint, api_key, api_config",
          )
          .eq("enabled", true);

        const merchant = findMerchantForUrl(validated.url, merchants ?? []);
        const outgoing = await resolveOutgoingUrl(validated.url, merchant);

        await supabaseAdmin.from("click_events").insert({
          item_id: item.id,
          registry_id: item.registry_id,
          merchant_id: merchant?.id ?? null,
          click_type: "MERCHANT",
          affiliate: outgoing.affiliate,
        });

        return new Response(null, {
          status: 302,
          headers: {
            Location: outgoing.url || validated.url,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          },
        });
      },
    },
  },
});
