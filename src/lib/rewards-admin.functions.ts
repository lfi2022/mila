import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Role is always re-verified server-side; hiding the UI is not a boundary. */
async function assertStaff(context: { supabase: unknown; userId: string }, requireAdmin = false) {
  const client = context.supabase as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  };
  const rpc = (fn: string, args: Record<string, unknown>) => client.rpc(fn, args);
  const { data: isStaff } = await rpc("is_staff", { _user_id: context.userId });
  if (!isStaff) throw new Error("Accès refusé.");
  if (requireAdmin) {
    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
      rpc("has_role", { _user_id: context.userId, _role: "ADMIN" }),
      rpc("has_role", { _user_id: context.userId, _role: "SUPER_ADMIN" }),
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

const bps = z.number().int().min(0).max(10_000);
const cents = z.number().int().min(0).max(100_000_000);

export const getRewardSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { loadSettings } = await import("./rewards.server");
    return await loadSettings();
  });

export const updateRewardSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        enabled: z.boolean().optional(),
        affiliate_rewards_enabled: z.boolean().optional(),
        referral_rewards_enabled: z.boolean().optional(),
        premium_rewards_enabled: z.boolean().optional(),
        partner_rewards_enabled: z.boolean().optional(),
        promotional_rewards_enabled: z.boolean().optional(),
        redemption_enabled: z.boolean().optional(),
        marketplace_enabled: z.boolean().optional(),
        bank_payout_enabled: z.boolean().optional(),
        affiliate_share_rate_bps: bps.optional(),
        referral_bonus_cents: cents.optional(),
        premium_bonus_cents: cents.optional(),
        min_redemption_cents: cents.optional(),
        per_transaction_cap_cents: cents.nullable().optional(),
        monthly_cap_cents_per_list: cents.nullable().optional(),
        lifetime_cap_cents_per_list: cents.nullable().optional(),
        referral_cap_cents: cents.nullable().optional(),
        promotional_cap_cents: cents.nullable().optional(),
        referral_requires_verified_email: z.boolean().optional(),
        referral_requires_list: z.boolean().optional(),
        referral_min_items: z.number().int().min(0).max(50).optional(),
        expiry_days: z.number().int().min(0).max(3650).nullable().optional(),
        explainer_text: z.string().trim().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("reward_settings")
      .update(data as never)
      .eq("id", true);
    if (error) throw new Error("Réglages non enregistrés.");
    await audit(context.userId, "reward_settings_updated", "reward_settings", null, data);
    return { ok: true };
  });

/** Per-merchant reward activation and share rate. */
export const updateMerchantRewardConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        merchantId: z.string().uuid(),
        rewardEnabled: z.boolean(),
        rewardShareRateBps: bps.nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("merchants")
      .update({
        reward_enabled: data.rewardEnabled,
        reward_share_rate_bps: data.rewardShareRateBps,
      })
      .eq("id", data.merchantId);
    if (error) throw new Error("Marchand non mis à jour.");
    await audit(context.userId, "merchant_reward_updated", "merchant", data.merchantId, data);
    return { ok: true };
  });

/** Real economics: revenue in, rewards out, per period. Nothing simulated. */
export const getRewardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { rewardCostRatio } = await import("./money");

    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [commissions, transactions, wallets, redemptions, referrals] = await Promise.all([
      supabaseAdmin
        .from("affiliate_commissions")
        .select("commission_amount_cents, status, occurred_at, network, merchant_id"),
      supabaseAdmin.from("reward_transactions").select("amount_cents, status, type, created_at"),
      supabaseAdmin
        .from("reward_wallets")
        .select("pending_balance_cents, available_balance_cents, flagged"),
      supabaseAdmin.from("reward_redemptions").select("amount_cents, status, type, requested_at"),
      supabaseAdmin.from("referrals").select("status, needs_review"),
    ]);

    const c = commissions.data ?? [];
    const t = transactions.data ?? [];
    const w = wallets.data ?? [];
    const r = redemptions.data ?? [];

    const confirmedRevenue = c
      .filter((x) => x.status === "CONFIRMED")
      .reduce((s, x) => s + x.commission_amount_cents, 0);
    const pendingRevenue = c
      .filter((x) => x.status === "PENDING")
      .reduce((s, x) => s + x.commission_amount_cents, 0);
    const cancelledRevenue = c
      .filter((x) => x.status === "CANCELLED")
      .reduce((s, x) => s + x.commission_amount_cents, 0);
    const revenue30 = c
      .filter((x) => x.status === "CONFIRMED" && x.occurred_at >= since30)
      .reduce((s, x) => s + x.commission_amount_cents, 0);

    const rewardsGranted = t
      .filter((x) => x.status === "CONFIRMED" && x.amount_cents > 0)
      .reduce((s, x) => s + x.amount_cents, 0);
    const rewardsPending = t
      .filter((x) => x.status === "PENDING")
      .reduce((s, x) => s + x.amount_cents, 0);
    const rewards30 = t
      .filter((x) => x.status === "CONFIRMED" && x.amount_cents > 0 && x.created_at >= since30)
      .reduce((s, x) => s + x.amount_cents, 0);
    const byType = t.reduce<Record<string, number>>((acc, x) => {
      if (x.status !== "CANCELLED" && x.amount_cents > 0)
        acc[x.type] = (acc[x.type] ?? 0) + x.amount_cents;
      return acc;
    }, {});

    return {
      confirmedRevenueCents: confirmedRevenue,
      pendingRevenueCents: pendingRevenue,
      cancelledRevenueCents: cancelledRevenue,
      revenue30Cents: revenue30,
      rewardsGrantedCents: rewardsGranted,
      rewardsPendingCents: rewardsPending,
      rewards30Cents: rewards30,
      netMarginCents: confirmedRevenue - rewardsGranted,
      costRatio: rewardCostRatio(rewardsGranted, confirmedRevenue),
      costRatio30: rewardCostRatio(rewards30, revenue30),
      rewardsByType: byType,
      walletsCount: w.length,
      flaggedWallets: w.filter((x) => x.flagged).length,
      outstandingLiabilityCents: w.reduce(
        (s, x) => s + x.available_balance_cents + x.pending_balance_cents,
        0,
      ),
      redemptionsRequested: r.filter((x) => x.status === "REQUESTED").length,
      redemptionsValueCents: r
        .filter((x) => x.status !== "CANCELLED")
        .reduce((s, x) => s + x.amount_cents, 0),
      referralsTotal: (referrals.data ?? []).length,
      referralsToReview: (referrals.data ?? []).filter((x) => x.needs_review).length,
      commissionsCount: c.length,
    };
  });

/** Manual commission entry / import — the only way to inject revenue by hand. */
export const recordAffiliateCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        network: z.string().trim().min(1).max(60),
        externalId: z.string().trim().min(1).max(200),
        merchantId: z.string().uuid().nullable().optional(),
        registryId: z.string().uuid().nullable().optional(),
        itemPublicToken: z.string().trim().max(80).nullable().optional(),
        orderReference: z.string().trim().max(200).nullable().optional(),
        orderAmountCents: z.number().int().min(0).nullable().optional(),
        commissionAmountCents: z.number().int().min(0).max(100_000_000),
        status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).default("PENDING"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, true);
    const { ingestAffiliateEvent } = await import("./rewards.server");
    const result = await ingestAffiliateEvent({
      network: data.network,
      externalId: data.externalId,
      merchantId: data.merchantId ?? null,
      registryId: data.registryId ?? null,
      itemPublicToken: data.itemPublicToken ?? null,
      orderReference: data.orderReference ?? null,
      orderAmountCents: data.orderAmountCents ?? null,
      commissionAmountCents: data.commissionAmountCents,
      status: data.status,
      raw: { source: "admin_manual", actor: context.userId },
    });
    await audit(
      context.userId,
      "affiliate_commission_recorded",
      "affiliate_commission",
      result.commissionId,
      data,
    );
    return result;
  });

/** Confirm / cancel a commission — the reward follows the same status. */
export const setCommissionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        commissionId: z.string().uuid(),
        status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyCommissionReward } = await import("./rewards.server");

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("affiliate_commissions")
      .update({
        status: data.status,
        confirmed_at: data.status === "CONFIRMED" ? now : null,
        cancelled_at: data.status === "CANCELLED" ? now : null,
      })
      .eq("id", data.commissionId);
    if (error) throw new Error("Commission non mise à jour.");

    await supabaseAdmin.rpc("reward_set_status", {
      _source_type: "AFFILIATE_COMMISSION",
      _source_reference: data.commissionId,
      _status:
        data.status === "CONFIRMED"
          ? "CONFIRMED"
          : data.status === "CANCELLED"
            ? "CANCELLED"
            : "PENDING",
    });
    if (data.status !== "CANCELLED") await applyCommissionReward(data.commissionId);

    await audit(
      context.userId,
      "commission_status_changed",
      "affiliate_commission",
      data.commissionId,
      data,
    );
    return { ok: true };
  });

export const listCommissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("affiliate_commissions")
      .select(
        "id, network, external_id, status, commission_amount_cents, order_amount_cents, occurred_at, merchant_id, registry_id",
      )
      .order("occurred_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

/** Dry-run: what a given commission would produce, without writing anything. */
export const simulateRewardShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ commissionAmountCents: cents, merchantId: z.string().uuid().nullable().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { previewCommissionReward } = await import("./rewards.server");
    return await previewCommissionReward(data.commissionAmountCents, data.merchantId ?? null);
  });

/** Manual adjustment (goodwill, correction, promo) — always audited. */
export const adjustWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        registryId: z.string().uuid(),
        amountCents: z.number().int().min(-100_000_000).max(100_000_000),
        reason: z.string().trim().min(3).max(300),
        type: z
          .enum(["ADJUSTMENT", "PROMOTIONAL_BONUS", "PARTNER_BONUS", "PREMIUM_PURCHASE"])
          .default("ADJUSTMENT"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: txnId, error } = await supabaseAdmin.rpc("reward_credit", {
      _registry_id: data.registryId,
      _type: data.type,
      _amount_cents: data.amountCents,
      _status: "CONFIRMED",
      _source_type: "ADMIN_ADJUSTMENT",
      _source_reference: `${context.userId}:${Date.now()}`,
      _description: data.reason,
      _created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    await audit(context.userId, "wallet_adjusted", "registry", data.registryId, data);
    return { ok: true, transactionId: txnId };
  });

export const listWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("reward_wallets")
      .select(
        "id, registry_id, pending_balance_cents, available_balance_cents, lifetime_earned_cents, lifetime_redeemed_cents, flagged, registries(title, slug)",
      )
      .order("lifetime_earned_cents", { ascending: false })
      .limit(100);
    return (data ?? []).map((w) => ({
      id: w.id,
      registryId: w.registry_id,
      title: (w.registries as { title?: string } | null)?.title ?? "Liste",
      pendingCents: w.pending_balance_cents,
      availableCents: w.available_balance_cents,
      lifetimeEarnedCents: w.lifetime_earned_cents,
      lifetimeRedeemedCents: w.lifetime_redeemed_cents,
      flagged: w.flagged,
    }));
  });

export const setWalletFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ walletId: z.string().uuid(), flagged: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("reward_wallets")
      .update({ flagged: data.flagged })
      .eq("id", data.walletId);
    await audit(context.userId, "wallet_flag_changed", "reward_wallet", data.walletId, data);
    return { ok: true };
  });

export const listRedemptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("reward_redemptions")
      .select(
        "id, wallet_id, type, amount_cents, status, requested_at, processed_at, external_reference",
      )
      .order("requested_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const setRedemptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        redemptionId: z.string().uuid(),
        status: z.enum(["APPROVED", "PROCESSED", "REJECTED", "CANCELLED"]),
        externalReference: z.string().trim().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: redemption } = await supabaseAdmin
      .from("reward_redemptions")
      .select("id, transaction_id, amount_cents, status")
      .eq("id", data.redemptionId)
      .maybeSingle();
    if (!redemption) throw new Error("Demande introuvable.");

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("reward_redemptions")
      .update({
        status: data.status,
        processed_at: data.status === "PROCESSED" ? now : null,
        cancelled_at: data.status === "REJECTED" || data.status === "CANCELLED" ? now : null,
        ...(data.externalReference ? { external_reference: data.externalReference } : {}),
      })
      .eq("id", data.redemptionId);

    // Rejecting or cancelling gives the parents their balance back.
    if ((data.status === "REJECTED" || data.status === "CANCELLED") && redemption.transaction_id) {
      await supabaseAdmin
        .from("reward_transactions")
        .update({ status: "CANCELLED", cancelled_at: now })
        .eq("id", redemption.transaction_id);
    }
    await audit(
      context.userId,
      "redemption_status_changed",
      "reward_redemption",
      data.redemptionId,
      data,
    );
    return { ok: true };
  });

export const listReferralsForReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("referrals")
      .select(
        "id, code, status, needs_review, risk_signals, created_at, referrer_user_id, referred_user_id",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const reviewReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ referralId: z.string().uuid(), approve: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { evaluateReferral } = await import("./rewards.server");
    const { appOrigin } = await import("./server-utils.server");

    if (!data.approve) {
      await supabaseAdmin
        .from("referrals")
        .update({
          status: "CANCELLED",
          needs_review: false,
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", data.referralId);
    } else {
      await supabaseAdmin
        .from("referrals")
        .update({ needs_review: false })
        .eq("id", data.referralId);
      await evaluateReferral(data.referralId, appOrigin());
    }
    await audit(context.userId, "referral_reviewed", "referral", data.referralId, data);
    return { ok: true };
  });

/* --------------------------- Rewards marketplace -------------------------- */

export const listOffersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("reward_offers")
      .select("*")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const upsertOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(120),
        description: z.string().trim().max(600).nullable().optional(),
        type: z.enum(["MILA_CREDIT", "PREMIUM", "PARTNER_VOUCHER", "GIFT_CARD", "BANK_PAYOUT"]),
        costCents: cents,
        imageUrl: z.string().trim().url().max(500).nullable().optional(),
        stock: z.number().int().min(0).nullable().optional(),
        active: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      cost_cents: data.costCents,
      image_url: data.imageUrl ?? null,
      stock: data.stock ?? null,
      active: data.active,
    };
    const { error } = data.id
      ? await supabaseAdmin.from("reward_offers").update(payload).eq("id", data.id)
      : await supabaseAdmin.from("reward_offers").insert(payload);
    if (error) throw new Error("Avantage non enregistré.");
    await audit(
      context.userId,
      data.id ? "offer_updated" : "offer_created",
      "reward_offer",
      data.id ?? null,
      data,
    );
    return { ok: true };
  });
