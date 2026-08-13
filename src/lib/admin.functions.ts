import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * Every admin server function re-checks the caller's role server-side.
 * Hiding the UI is never the security boundary.
 */
async function assertStaff(
  context: { supabase: SupabaseClient<Database>; userId: string },
  requireAdmin = false,
) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", {
    _user_id: context.userId,
  });
  if (!isStaff) throw new Error("Accès refusé.");
  if (requireAdmin) {
    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "ADMIN" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "SUPER_ADMIN" }),
    ]);
    if (!isAdmin && !isSuper) throw new Error("Accès réservé aux administrateurs.");
  }
}

async function audit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: metadata as never,
  });
}

export const getMyAdminRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role);
    return {
      roles,
      isStaff: roles.some((r) => r === "MODERATOR" || r === "ADMIN" || r === "SUPER_ADMIN"),
      isAdmin: roles.some((r) => r === "ADMIN" || r === "SUPER_ADMIN"),
    };
  });

/** Real numbers only — never invented revenue or conversions. */
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const [
      profiles,
      newProfiles,
      lists,
      items,
      reservations,
      clicks,
      recentClicks,
      entitlements,
      reports,
      merchants,
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since30),
      supabaseAdmin.from("registries").select("id, status, visibility, created_at"),
      supabaseAdmin.from("items").select("id, status"),
      supabaseAdmin.from("reservations").select("id, status, created_at"),
      supabaseAdmin.from("click_events").select("id, affiliate, merchant_id, created_at"),
      supabaseAdmin
        .from("click_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since7),
      supabaseAdmin.from("list_entitlements").select("plan"),
      supabaseAdmin.from("reports").select("id, status"),
      supabaseAdmin.from("merchants").select("id, name, enabled, affiliate_enabled"),
    ]);

    const listRows = lists.data ?? [];
    const itemRows = items.data ?? [];
    const clickRows = clicks.data ?? [];
    const merchantRows = merchants.data ?? [];

    const clicksByMerchant = merchantRows
      .map((m) => ({
        merchant: m.name,
        clicks: clickRows.filter((c) => c.merchant_id === m.id).length,
        affiliateClicks: clickRows.filter((c) => c.merchant_id === m.id && c.affiliate).length,
      }))
      .filter((row) => row.clicks > 0)
      .sort((a, b) => b.clicks - a.clicks);

    return {
      users: {
        total: profiles.count ?? 0,
        newLast30Days: newProfiles.count ?? 0,
        activeLast30Days: new Set(
          (reservations.data ?? []).filter((r) => r.created_at >= since30).map((r) => r.id),
        ).size,
      },
      lists: {
        total: listRows.length,
        active: listRows.filter((l) => l.status === "ACTIVE").length,
        archived: listRows.filter((l) => l.status === "ARCHIVED").length,
        suspended: listRows.filter((l) => l.status === "SUSPENDED").length,
        public: listRows.filter((l) => l.visibility === "PUBLIC").length,
        private: listRows.filter((l) => l.visibility !== "PUBLIC").length,
        premium: (entitlements.data ?? []).filter((e) => e.plan !== "FREE").length,
      },
      gifts: {
        total: itemRows.length,
        available: itemRows.filter((i) => i.status === "AVAILABLE").length,
        reserved: itemRows.filter((i) => i.status === "RESERVED").length,
        purchased: itemRows.filter((i) => i.status === "PURCHASED").length,
      },
      business: {
        merchantClicks: clickRows.length,
        affiliateClicks: clickRows.filter((c) => c.affiliate).length,
        clicksLast7Days: recentClicks.count ?? 0,
        clicksByMerchant,
        premiumLists: (entitlements.data ?? []).filter((e) => e.plan !== "FREE").length,
        premiumRevenue: null as number | null,
        estimatedCommissions: null as number | null,
      },
      moderation: {
        openReports: (reports.data ?? []).filter((r) => r.status === "OPEN").length,
        totalReports: (reports.data ?? []).length,
      },
    };
  });

export const adminListLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("registries")
      .select("id, title, slug, status, visibility, is_demo, created_at, view_count")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, display_name, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    return (profiles ?? []).map((profile) => ({
      ...profile,
      roles: (roles ?? []).filter((r) => r.user_id === profile.id).map((r) => r.role),
    }));
  });

export const adminListMerchants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("merchants").select("*").order("name");
    // The API key is never sent to the browser, only its presence.
    return (data ?? []).map(({ api_key, api_config, ...merchant }) => ({
      ...merchant,
      has_api_key: Boolean(api_key),
      api_config: JSON.stringify(api_config ?? {}),
    }));
  });

const merchantInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  domains: z.array(z.string().trim().min(3).max(190)).max(30),
  logoUrl: z.string().trim().max(1000).optional().or(z.literal("")),
  enabled: z.boolean(),
  affiliateEnabled: z.boolean(),
  affiliateNetwork: z.string().trim().max(80).optional().or(z.literal("")),
  affiliateId: z.string().trim().max(120).optional().or(z.literal("")),
  affiliateTemplate: z.string().trim().max(500).optional().or(z.literal("")),
  linkMode: z.enum(["NONE", "TEMPLATE", "API"]).default("TEMPLATE"),
  apiEndpoint: z.string().trim().max(1000).optional().or(z.literal("")),
  /** Empty string = keep the stored key, "-" = clear it. */
  apiKey: z.string().trim().max(500).optional(),
  apiConfig: z.string().trim().max(4000).optional(),
});

export const adminSaveMerchant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => merchantInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertStaff(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeDomain } = await import("./url-safety");

    let apiConfig: Record<string, unknown> = {};
    if (data.apiConfig) {
      try {
        const parsed = JSON.parse(data.apiConfig);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad");
        apiConfig = parsed as Record<string, unknown>;
      } catch {
        throw new Error("Les réglages API doivent être un objet JSON valide.");
      }
    }

    const payload: Record<string, unknown> = {
      name: data.name,
      domains: data.domains.map((d) => normalizeDomain(d)).filter(Boolean),
      logo_url: data.logoUrl || null,
      enabled: data.enabled,
      affiliate_enabled: data.affiliateEnabled,
      affiliate_network: data.affiliateNetwork || null,
      affiliate_id: data.affiliateId || null,
      affiliate_template: data.affiliateTemplate || null,
      link_mode: data.linkMode,
      api_endpoint: data.apiEndpoint || null,
      api_config: apiConfig,
    };

    if (data.apiKey === "-") payload["api_key"] = null;
    else if (data.apiKey) payload["api_key"] = data.apiKey;

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("merchants")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error("Le marchand n'a pas pu être mis à jour.");
      await audit(context.userId, "merchant.update", "merchant", data.id, {
        name: data.name,
        mode: data.linkMode,
      });
      return { id: data.id };
    }

    const { data: created, error } = await supabaseAdmin
      .from("merchants")
      .insert(payload as never)
      .select("id")
      .maybeSingle();
    if (error || !created) throw new Error("Le marchand n'a pas pu être créé.");
    await audit(context.userId, "merchant.create", "merchant", created.id, { name: data.name });
    return { id: created.id };
  });

/** Dry-run of the affiliate conversion, admin-only (secrets stay server-side). */
export const adminTestAffiliateLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ merchantId: z.string().uuid(), url: z.string().min(3).max(2048) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveOutgoingUrl } = await import("./affiliate.server");
    const { validateExternalUrl, domainMatches } = await import("./url-safety");

    const validated = validateExternalUrl(data.url);
    if (!validated.ok) return { ok: false as const, reason: validated.reason };

    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("*")
      .eq("id", data.merchantId)
      .maybeSingle();
    if (!merchant) return { ok: false as const, reason: "Marchand introuvable." };

    const matches = domainMatches(validated.hostname, merchant.domains);
    const result = await resolveOutgoingUrl(validated.url, merchant);
    return {
      ok: true as const,
      domainMatches: matches,
      affiliate: result.affiliate,
      url: result.url,
      via: result.via,
    };
  });

export const adminListReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const adminListAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const adminModerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        action: z.enum([
          "suspend_list",
          "restore_list",
          "hide_item",
          "show_item",
          "resolve_report",
          "dismiss_report",
        ]),
        targetId: z.string().uuid(),
        notes: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    switch (data.action) {
      case "suspend_list":
        await supabaseAdmin
          .from("registries")
          .update({ status: "SUSPENDED" })
          .eq("id", data.targetId);
        break;
      case "restore_list":
        await supabaseAdmin.from("registries").update({ status: "ACTIVE" }).eq("id", data.targetId);
        break;
      case "hide_item":
        await supabaseAdmin
          .from("items")
          .update({ hidden_by_moderator: true })
          .eq("id", data.targetId);
        break;
      case "show_item":
        await supabaseAdmin
          .from("items")
          .update({ hidden_by_moderator: false })
          .eq("id", data.targetId);
        break;
      case "resolve_report":
        await supabaseAdmin
          .from("reports")
          .update({ status: "RESOLVED", admin_notes: data.notes ?? null })
          .eq("id", data.targetId);
        break;
      case "dismiss_report":
        await supabaseAdmin
          .from("reports")
          .update({ status: "DISMISSED", admin_notes: data.notes ?? null })
          .eq("id", data.targetId);
        break;
    }

    await audit(context.userId, data.action, "moderation", data.targetId, {
      notes: data.notes ?? null,
    });
    return { ok: true };
  });
