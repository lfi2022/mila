import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Program status + explainer text for the parent UI. No amounts here. */
export const getRewardProgramStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { loadSettings, isFlagEnabled } = await import("./rewards.server");
    const settings = await loadSettings();
    return {
      enabled: settings.enabled && (await isFlagEnabled("rewards")),
      affiliateRewards: settings.affiliate_rewards_enabled,
      referralRewards:
        settings.referral_rewards_enabled && (await isFlagEnabled("referralRewards")),
      redemptionEnabled: settings.redemption_enabled && (await isFlagEnabled("rewardRedemption")),
      marketplaceEnabled:
        settings.marketplace_enabled && (await isFlagEnabled("rewardMarketplace")),
      bankPayoutEnabled: settings.bank_payout_enabled && (await isFlagEnabled("bankPayout")),
      minRedemptionCents: settings.min_redemption_cents,
      currency: settings.currency,
      explainerText: settings.explainer_text,
      expiryDays: settings.expiry_days,
    };
  });

/** Wallet + ledger of one list. Members only, verified server-side. */
export const getListRewards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ registryId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { admin, assertListMember, ensureWallet, loadSettings, isFlagEnabled } =
      await import("./rewards.server");
    const { summariseLedger } = await import("./money");
    await assertListMember(context.supabase as never, data.registryId, context.userId);

    const settings = await loadSettings();
    const programEnabled = settings.enabled && (await isFlagEnabled("rewards"));
    const db = await admin();

    const walletId = await ensureWallet(data.registryId);
    const { data: wallet } = await db
      .from("reward_wallets")
      .select("*")
      .eq("id", walletId)
      .maybeSingle();
    const { data: transactions } = await db
      .from("reward_transactions")
      .select(
        "id, type, amount_cents, status, description, merchant_id, created_at, confirmed_at, expires_at, metadata",
      )
      .eq("wallet_id", walletId)
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: merchants } = await db.from("merchants").select("id, name");
    const merchantName = new Map((merchants ?? []).map((m) => [m.id, m.name]));

    const { data: redemptions } = await db
      .from("reward_redemptions")
      .select("id, type, amount_cents, status, requested_at, processed_at")
      .eq("wallet_id", walletId)
      .order("requested_at", { ascending: false })
      .limit(50);

    const rows = (transactions ?? []).map((t) => ({
      id: t.id,
      type: t.type,
      amountCents: t.amount_cents,
      status: t.status,
      description: t.description,
      source: t.merchant_id ? (merchantName.get(t.merchant_id) ?? "Marchand") : null,
      createdAt: t.created_at,
      expiresAt: t.expires_at,
    }));

    // Balances are recomputed from the ledger and compared with the stored ones.
    const recomputed = summariseLedger(
      (transactions ?? []).map((t) => ({
        amount_cents: t.amount_cents,
        status: t.status,
        type: t.type,
      })),
    );

    return {
      programEnabled,
      currency: wallet?.currency ?? settings.currency,
      pendingCents: recomputed.pending,
      availableCents: recomputed.available,
      lifetimeEarnedCents: recomputed.lifetimeEarned,
      lifetimeRedeemedCents: recomputed.lifetimeRedeemed,
      minRedemptionCents: settings.min_redemption_cents,
      redemptionEnabled: settings.redemption_enabled && (await isFlagEnabled("rewardRedemption")),
      explainerText: settings.explainer_text,
      transactions: rows,
      redemptions: (redemptions ?? []).map((r) => ({
        id: r.id,
        type: r.type,
        amountCents: r.amount_cents,
        status: r.status,
        requestedAt: r.requested_at,
        processedAt: r.processed_at,
      })),
    };
  });

/** Marketplace offers — returns an empty list until real partners exist. */
export const listRewardOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { admin, loadSettings, isFlagEnabled } = await import("./rewards.server");
    const settings = await loadSettings();
    if (!settings.marketplace_enabled || !(await isFlagEnabled("rewardMarketplace")))
      return { enabled: false, offers: [] };
    const db = await admin();
    const { data } = await db
      .from("reward_offers")
      .select("id, title, description, type, cost_cents, image_url, stock")
      .eq("active", true)
      .order("cost_cents", { ascending: true });
    return {
      enabled: true,
      offers: (data ?? []).map((o) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        type: o.type,
        costCents: o.cost_cents,
        imageUrl: o.image_url,
        stock: o.stock,
      })),
    };
  });

/** Redemption request. The amount is always taken from the offer/server side. */
export const requestRewardRedemption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        registryId: z.string().uuid(),
        offerId: z.string().uuid().optional(),
        type: z
          .enum(["MILA_CREDIT", "PREMIUM", "PARTNER_VOUCHER", "GIFT_CARD", "BANK_PAYOUT"])
          .default("MILA_CREDIT"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { admin, assertListMember, isFlagEnabled, loadSettings } =
      await import("./rewards.server");
    const { formatCents } = await import("./money");
    await assertListMember(context.supabase as never, data.registryId, context.userId);

    const settings = await loadSettings();
    if (
      !settings.enabled ||
      !settings.redemption_enabled ||
      !(await isFlagEnabled("rewardRedemption"))
    ) {
      throw new Error("L'utilisation des récompenses n'est pas encore disponible.");
    }
    if (
      data.type === "BANK_PAYOUT" &&
      (!settings.bank_payout_enabled || !(await isFlagEnabled("bankPayout")))
    ) {
      throw new Error("Le virement bancaire n'est pas encore disponible.");
    }

    const db = await admin();
    let amountCents = settings.min_redemption_cents;
    let label = "Crédit Mila";
    let type: "MILA_CREDIT" | "PREMIUM" | "PARTNER_VOUCHER" | "GIFT_CARD" | "BANK_PAYOUT" =
      data.type;
    if (data.offerId) {
      const { data: offer } = await db
        .from("reward_offers")
        .select("id, title, cost_cents, type, active, stock")
        .eq("id", data.offerId)
        .maybeSingle();
      if (!offer || !offer.active) throw new Error("Cet avantage n'est plus disponible.");
      if (offer.stock !== null && offer.stock <= 0)
        throw new Error("Cet avantage n'est plus disponible.");
      amountCents = offer.cost_cents;
      label = offer.title;
      type = offer.type;
    }

    const { data: redemptionId, error } = await db.rpc("reward_redeem", {
      _registry_id: data.registryId,
      _type: type,
      _amount_cents: amountCents,
      ...(data.offerId ? { _offer_id: data.offerId } : {}),
      _user_id: context.userId,
    });
    if (error) {
      const map: Record<string, string> = {
        insufficient_balance: "Votre solde disponible est insuffisant.",
        below_minimum: `Minimum requis : ${formatCents(settings.min_redemption_cents)}.`,
        redemption_disabled: "L'utilisation des récompenses n'est pas encore disponible.",
        bank_payout_disabled: "Le virement bancaire n'est pas encore disponible.",
      };
      const key = Object.keys(map).find((k) => error.message.includes(k));
      throw new Error(key ? map[key]! : "La demande n'a pas pu être enregistrée.");
    }

    return { ok: true, redemptionId, amountCents, label };
  });

/** Referral code + funnel of the signed-in parent. */
export const getMyReferral = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, ensureReferralCode, loadSettings, isFlagEnabled } =
      await import("./rewards.server");
    const settings = await loadSettings();
    const enabled =
      settings.enabled &&
      settings.referral_rewards_enabled &&
      (await isFlagEnabled("referralRewards"));
    if (!enabled)
      return {
        enabled: false,
        code: null,
        bonusCents: settings.referral_bonus_cents,
        referrals: [],
      };

    const code = await ensureReferralCode(context.userId);
    const db = await admin();
    const { data } = await db
      .from("referrals")
      .select("id, status, created_at, qualified_at, rewarded_at, needs_review")
      .eq("referrer_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    return {
      enabled: true,
      code,
      bonusCents: settings.referral_bonus_cents,
      referrals: (data ?? []).map((r) => ({
        id: r.id,
        status: r.needs_review ? "PENDING" : r.status,
        createdAt: r.created_at,
      })),
    };
  });

/** Called once after sign-up with a referral code. Never credits immediately. */
export const registerReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(4).max(16) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { admin, loadSettings, referralRiskSignals, evaluateReferral } =
      await import("./rewards.server");
    const { appOrigin, rateLimit, clientFingerprint } = await import("./server-utils.server");
    if (!rateLimit(`referral:${clientFingerprint()}`, 10, 3_600_000))
      throw new Error("Trop de tentatives.");

    const settings = await loadSettings();
    if (!settings.enabled || !settings.referral_rewards_enabled)
      return { ok: false, reason: "disabled" };

    const db = await admin();
    const code = data.code.toUpperCase();
    const { data: referrer } = await db
      .from("profiles")
      .select("id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!referrer) return { ok: false, reason: "unknown_code" };
    if (referrer.id === context.userId) return { ok: false, reason: "self_referral" };

    const { data: existing } = await db
      .from("referrals")
      .select("id")
      .eq("referred_user_id", context.userId)
      .maybeSingle();
    if (existing) return { ok: true, reason: "already_registered" };

    const { data: me } = await db.auth.admin.getUserById(context.userId);
    const signals = await referralRiskSignals(referrer.id, context.userId, me?.user?.email ?? null);
    const threshold = Number(
      (settings.anti_fraud_rules as Record<string, unknown> | null)?.["manual_review_threshold"] ??
        3,
    );
    const blocking = signals.includes("self_referral") || signals.includes("same_email");
    if (blocking) return { ok: false, reason: "not_eligible" };

    const { data: created } = await db
      .from("referrals")
      .insert({
        code,
        referrer_user_id: referrer.id,
        referred_user_id: context.userId,
        risk_signals: signals as never,
        needs_review: signals.length >= threshold,
      })
      .select("id")
      .maybeSingle();

    if (created) await evaluateReferral(created.id, appOrigin());
    return { ok: true, reason: "registered" };
  });

/** Re-checks the qualification criteria of the parent's own referrals. */
export const refreshMyReferrals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, evaluateReferral } = await import("./rewards.server");
    const { appOrigin } = await import("./server-utils.server");
    const db = await admin();
    const { data } = await db
      .from("referrals")
      .select("id")
      .eq("referrer_user_id", context.userId)
      .in("status", ["PENDING", "QUALIFIED"]);
    for (const row of data ?? []) await evaluateReferral(row.id, appOrigin());
    return { ok: true, checked: (data ?? []).length };
  });
