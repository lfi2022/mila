/**
 * Server-only rewards services.
 *
 * All money is handled in integer cents. Every credit goes through the
 * `reward_credit` database function (idempotent, capped, service-role only), so
 * no amount coming from the frontend or from an external provider is trusted.
 */
import { emailTemplates } from "./email/templates";
import { sendEmail } from "./email/provider.server";
import { computeShareCents, formatCents, resolveRewardRateBps } from "./money";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadSettings() {
  const db = await admin();
  const { data, error } = await db.from("reward_settings").select("*").eq("id", true).maybeSingle();
  if (error || !data) throw new Error("Réglages des récompenses indisponibles.");
  return data;
}

export async function isFlagEnabled(key: string): Promise<boolean> {
  const db = await admin();
  const { data } = await db.from("feature_flags").select("enabled").eq("key", key).maybeSingle();
  return Boolean(data?.enabled);
}

/** Rewards are visible only to members of the list that owns the wallet. */
export async function assertListMember(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  registryId: string,
  userId: string,
) {
  const { data } = await supabase.rpc("is_list_member", {
    _registry_id: registryId,
    _user_id: userId,
  });
  if (!data) throw new Error("Accès refusé à ce portefeuille.");
}

export async function ensureWallet(registryId: string): Promise<string> {
  const db = await admin();
  const { data, error } = await db.rpc("ensure_reward_wallet", { _registry_id: registryId });
  if (error || !data) throw new Error("Portefeuille indisponible.");
  return data as unknown as string;
}

/** Grouped, non-spammy notification: one row per list member per credit batch. */
export async function notifyReward(
  registryId: string,
  amountCents: number,
  status: "PENDING" | "CONFIRMED",
  label: string,
) {
  const db = await admin();
  const { data: members } = await db
    .from("list_members")
    .select("user_id")
    .eq("registry_id", registryId);
  if (!members?.length) return;

  const recent = new Date(Date.now() - 6 * 3_600_000).toISOString();
  const title =
    status === "CONFIRMED"
      ? `${formatCents(amountCents)} viennent d'être ajoutés à vos Récompenses Mila 🎁`
      : `Une récompense de ${formatCents(amountCents)} est en attente de confirmation.`;

  for (const member of members) {
    const { count } = await db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", member.user_id)
      .eq("registry_id", registryId)
      .gte("created_at", recent)
      .ilike("title", "%Récompenses Mila%");
    if ((count ?? 0) >= 1 && status === "PENDING") continue;

    await db.from("notifications").insert({
      user_id: member.user_id,
      registry_id: registryId,
      title,
      body: label,
    });
  }
}

export async function emailRewardCredited(params: {
  registryId: string;
  amountCents: number;
  status: "PENDING" | "CONFIRMED";
  appUrl: string;
}) {
  const settings = await loadSettings();
  const rules = (settings.validation_rules ?? {}) as Record<string, unknown>;
  if (rules["emails_reward_credited"] === false) return;

  const db = await admin();
  const { data: members } = await db
    .from("list_members")
    .select("user_id")
    .eq("registry_id", params.registryId);
  if (!members?.length) return;

  for (const member of members) {
    const { data: authUser } = await db.auth.admin.getUserById(member.user_id);
    const email = authUser?.user?.email;
    if (!email) continue;
    await sendEmail({
      to: email,
      template: emailTemplates.rewardCredited({
        amount: formatCents(params.amountCents),
        pending: params.status === "PENDING",
        appUrl: params.appUrl,
        registryId: params.registryId,
      }),
    });
  }
}

export type AffiliateEventInput = {
  network: string;
  externalId: string;
  clickReference?: string | null;
  orderReference?: string | null;
  merchantId?: string | null;
  merchantDomain?: string | null;
  registryId?: string | null;
  itemPublicToken?: string | null;
  orderAmountCents?: number | null;
  commissionAmountCents: number;
  currency?: string;
  status?: "PENDING" | "CONFIRMED" | "CANCELLED";
  occurredAt?: string | null;
  raw?: unknown;
};

/**
 * Single ingestion path for every affiliate provider (webhook, CSV import, API
 * sync). Idempotent on (network, external_id): replaying an event never creates
 * a second commission nor a second reward.
 */
export async function ingestAffiliateEvent(input: AffiliateEventInput) {
  const db = await admin();

  const { data: event } = await db
    .from("affiliate_events")
    .upsert(
      {
        network: input.network,
        external_id: input.externalId,
        payload: (input.raw ?? {}) as never,
      },
      { onConflict: "network,external_id" },
    )
    .select("id")
    .maybeSingle();

  let merchantId = input.merchantId ?? null;
  let registryId = input.registryId ?? null;
  let itemId: string | null = null;

  if (!merchantId && input.merchantDomain) {
    const { data: merchants } = await db.from("merchants").select("id, domains");
    const domain = input.merchantDomain.toLowerCase().replace(/^www\./, "");
    merchantId =
      merchants?.find((m) =>
        (m.domains ?? []).some((d) => domain === d || domain.endsWith(`.${d}`)),
      )?.id ?? null;
  }

  if (input.itemPublicToken) {
    const { data: item } = await db
      .from("items")
      .select("id, registry_id, merchant_id")
      .eq("public_token", input.itemPublicToken)
      .maybeSingle();
    if (item) {
      itemId = item.id;
      registryId = registryId ?? item.registry_id;
      merchantId = merchantId ?? item.merchant_id;
    }
  }

  const status = input.status ?? "PENDING";
  const { data: commission, error } = await db
    .from("affiliate_commissions")
    .upsert(
      {
        network: input.network,
        external_id: input.externalId,
        event_id: event?.id ?? null,
        merchant_id: merchantId,
        registry_id: registryId,
        item_id: itemId,
        click_reference: input.clickReference ?? null,
        order_reference: input.orderReference ?? null,
        order_amount_cents: input.orderAmountCents ?? null,
        commission_amount_cents: input.commissionAmountCents,
        currency: input.currency ?? "EUR",
        status,
        occurred_at: input.occurredAt ?? new Date().toISOString(),
        confirmed_at: status === "CONFIRMED" ? new Date().toISOString() : null,
        cancelled_at: status === "CANCELLED" ? new Date().toISOString() : null,
      },
      { onConflict: "network,external_id" },
    )
    .select("*")
    .maybeSingle();

  if (error || !commission) throw new Error("Commission non enregistrée.");

  const applied = await applyCommissionReward(commission.id);
  await db
    .from("affiliate_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", event?.id ?? "");

  return {
    commissionId: commission.id,
    rewardTransactionId: applied.transactionId,
    reward: applied,
  };
}

/**
 * Converts a confirmed/pending commission into a reward. The actual arithmetic
 * lives in SQL (single transaction, idempotent, capped); the preview below is
 * only used for logging and admin dry-runs.
 */
export async function applyCommissionReward(commissionId: string) {
  const db = await admin();
  const { data, error } = await db.rpc("reward_apply_commission", { _commission_id: commissionId });
  if (error) {
    if (/rewards_disabled/.test(error.message))
      return { transactionId: null as string | null, skipped: "disabled" };
    throw new Error(error.message);
  }
  const transactionId = (data as unknown as string | null) ?? null;
  if (!transactionId) return { transactionId: null as string | null, skipped: "not_eligible" };

  const { data: txn } = await db
    .from("reward_transactions")
    .select("amount_cents, status, wallet_id")
    .eq("id", transactionId)
    .maybeSingle();
  const { data: wallet } = txn
    ? await db.from("reward_wallets").select("registry_id").eq("id", txn.wallet_id).maybeSingle()
    : { data: null };

  if (txn && wallet) {
    await notifyReward(
      wallet.registry_id,
      txn.amount_cents,
      txn.status === "CONFIRMED" ? "CONFIRMED" : "PENDING",
      "Commission sur un achat effectué depuis votre liste.",
    );
  }
  return { transactionId, skipped: null as string | null };
}

/** Preview of what a commission would produce — used by the admin dry-run. */
export async function previewCommissionReward(commissionCents: number, merchantId: string | null) {
  const settings = await loadSettings();
  const db = await admin();
  const merchant = merchantId
    ? (
        await db
          .from("merchants")
          .select("reward_enabled, reward_share_rate_bps")
          .eq("id", merchantId)
          .maybeSingle()
      ).data
    : null;

  const rateBps = resolveRewardRateBps({
    globalEnabled: settings.enabled,
    affiliateRewardsEnabled: settings.affiliate_rewards_enabled,
    globalRateBps: settings.affiliate_share_rate_bps,
    merchant: merchant
      ? {
          rewardEnabled: merchant.reward_enabled,
          rewardShareRateBps: merchant.reward_share_rate_bps,
        }
      : null,
  });
  const rewardCents = rateBps > 0 ? computeShareCents(commissionCents, rateBps) : 0;
  return { rateBps, rewardCents, milaCents: commissionCents - rewardCents };
}

/* ------------------------------- Referrals ------------------------------- */

export function referralCodeFrom(userId: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new TextEncoder().encode(userId);
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    const source = (bytes[i % bytes.length] ?? 0) + i * 31;
    out += alphabet[source % alphabet.length];
  }
  return out;
}

export async function ensureReferralCode(userId: string): Promise<string> {
  const db = await admin();
  const { data } = await db.from("profiles").select("referral_code").eq("id", userId).maybeSingle();
  if (data?.referral_code) return data.referral_code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = referralCodeFrom(userId + (attempt ? String(attempt) : ""));
    const { error } = await db.from("profiles").update({ referral_code: code }).eq("id", userId);
    if (!error) return code;
  }
  throw new Error("Code de parrainage indisponible.");
}

/** Risk signals only — never an automatic ban, and never IP-only blocking. */
export async function referralRiskSignals(
  referrerId: string,
  referredId: string,
  email: string | null,
) {
  const db = await admin();
  const signals: string[] = [];

  if (referrerId === referredId) signals.push("self_referral");

  const { data: referrerUser } = await db.auth.admin.getUserById(referrerId);
  const referrerEmail = referrerUser?.user?.email ?? null;
  if (email && referrerEmail && email.toLowerCase() === referrerEmail.toLowerCase())
    signals.push("same_email");
  if (email && referrerEmail) {
    const normalise = (value: string) =>
      value.split("@")[0]?.replace(/\./g, "").split("+")[0]?.toLowerCase();
    if (normalise(email) === normalise(referrerEmail)) signals.push("email_alias");
  }

  const { count } = await db
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_user_id", referrerId)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= 5) signals.push("burst_signups");

  return signals;
}

/** Qualification rules are configurable; nothing is credited before they pass. */
export async function evaluateReferral(referralId: string, appUrl: string) {
  const db = await admin();
  const settings = await loadSettings();
  const { data: referral } = await db
    .from("referrals")
    .select("*")
    .eq("id", referralId)
    .maybeSingle();
  if (!referral || referral.status === "REWARDED" || referral.status === "CANCELLED")
    return { changed: false };
  if (!settings.enabled || !settings.referral_rewards_enabled) return { changed: false };
  if (referral.needs_review) return { changed: false, reason: "manual_review" };

  const { data: user } = await db.auth.admin.getUserById(referral.referred_user_id);
  if (!user?.user) {
    await db
      .from("referrals")
      .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
      .eq("id", referralId);
    return { changed: true, status: "CANCELLED" };
  }
  if (settings.referral_requires_verified_email && !user.user.email_confirmed_at) {
    return { changed: false, reason: "email_not_verified" };
  }

  const { data: lists } = await db
    .from("registries")
    .select("id")
    .eq("owner_id", referral.referred_user_id);
  if (settings.referral_requires_list && !lists?.length)
    return { changed: false, reason: "no_list" };

  if (settings.referral_min_items > 0) {
    const ids = (lists ?? []).map((l) => l.id);
    if (!ids.length) return { changed: false, reason: "no_list" };
    const { count } = await db
      .from("items")
      .select("id", { count: "exact", head: true })
      .in("registry_id", ids);
    if ((count ?? 0) < settings.referral_min_items)
      return { changed: false, reason: "not_enough_items" };
  }

  // Referral cap, computed from the ledger (never from a stored balance).
  if (settings.referral_cap_cents != null) {
    const { data: wallets } = await db
      .from("reward_wallets")
      .select("id, registry_id, registries!inner(owner_id)")
      .eq("registries.owner_id", referral.referrer_user_id);
    const walletIds = (wallets ?? []).map((w) => w.id);
    if (walletIds.length) {
      const { data: earned } = await db
        .from("reward_transactions")
        .select("amount_cents")
        .in("wallet_id", walletIds)
        .eq("type", "REFERRAL")
        .neq("status", "CANCELLED");
      const total = (earned ?? []).reduce((sum, row) => sum + row.amount_cents, 0);
      if (total >= settings.referral_cap_cents)
        return { changed: false, reason: "referral_cap_reached" };
    }
  }

  const { data: referrerList } = await db
    .from("registries")
    .select("id")
    .eq("owner_id", referral.referrer_user_id)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!referrerList) return { changed: false, reason: "referrer_has_no_list" };

  await db
    .from("referrals")
    .update({ status: "QUALIFIED", qualified_at: new Date().toISOString() })
    .eq("id", referralId);

  const { data: txnId, error } = await db.rpc("reward_credit", {
    _registry_id: referrerList.id,
    _type: "REFERRAL",
    _amount_cents: settings.referral_bonus_cents,
    _status: "CONFIRMED",
    _source_type: "REFERRAL",
    _source_reference: referralId,
    _description: "Parrainage validé",
    _metadata: {} as never,
  });
  if (error) return { changed: false, reason: error.message };

  await db
    .from("referrals")
    .update({ status: "REWARDED", rewarded_at: new Date().toISOString() })
    .eq("id", referralId);
  if (txnId) {
    await notifyReward(
      referrerList.id,
      settings.referral_bonus_cents,
      "CONFIRMED",
      "Un parrainage vient d'être validé.",
    );
    void appUrl;
  }
  return { changed: true, status: "REWARDED" };
}
