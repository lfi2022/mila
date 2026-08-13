/**
 * Money helpers for the Mila rewards program.
 *
 * Rule applied everywhere: financial amounts are integers in cents. Floats are
 * never used for storage or arithmetic, only for display formatting.
 */

export const REWARD_CURRENCY = "EUR";

/** Basis points (1/100 of a percent). 3000 bps = 30 %. */
export type Bps = number;

export function isValidBps(bps: number): boolean {
  return Number.isInteger(bps) && bps >= 0 && bps <= 10_000;
}

/**
 * Share of a confirmed revenue that goes to the parents.
 * Rounded DOWN so a reward can never exceed the revenue actually received.
 */
export function computeShareCents(revenueCents: number, rateBps: Bps): number {
  if (!Number.isInteger(revenueCents) || revenueCents < 0) throw new Error("invalid_revenue");
  if (!isValidBps(rateBps)) throw new Error("invalid_rate");
  const share = Math.floor((revenueCents * rateBps) / 10_000);
  return Math.min(share, revenueCents);
}

/** Resolves the applicable rate: merchant override → global → none. */
export function resolveRewardRateBps(input: {
  globalEnabled: boolean;
  affiliateRewardsEnabled: boolean;
  globalRateBps: Bps;
  merchant?: { rewardEnabled: boolean; rewardShareRateBps: number | null } | null;
}): number {
  if (!input.globalEnabled || !input.affiliateRewardsEnabled) return 0;
  if (input.merchant) {
    if (!input.merchant.rewardEnabled) return 0;
    if (input.merchant.rewardShareRateBps !== null) return input.merchant.rewardShareRateBps;
  }
  return input.globalRateBps;
}

/** Applies the configurable caps in the same order as the database function. */
export function applyCaps(
  amountCents: number,
  caps: {
    perTransaction?: number | null;
    monthlyRemaining?: number | null;
    lifetimeRemaining?: number | null;
  },
): number {
  let amount = amountCents;
  if (caps.perTransaction != null) amount = Math.min(amount, caps.perTransaction);
  if (caps.monthlyRemaining != null) amount = Math.min(amount, Math.max(caps.monthlyRemaining, 0));
  if (caps.lifetimeRemaining != null)
    amount = Math.min(amount, Math.max(caps.lifetimeRemaining, 0));
  return Math.max(amount, 0);
}

/** "12,50" | "12.5" | 12.5 → 1250 cents. Never trusts float arithmetic. */
export function parseAmountToCents(input: string | number): number {
  const raw = String(input).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) throw new Error("invalid_amount");
  const negative = raw.startsWith("-");
  const [whole, fraction = ""] = raw.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return negative ? -cents : cents;
}

export function formatCents(cents: number | null | undefined, currency = REWARD_CURRENCY): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency }).format(value);
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)} %`;
}

/** Recomputes wallet balances from the ledger — mirrors the SQL function. */
export function summariseLedger(
  transactions: Array<{ amount_cents: number; status: string; type: string }>,
): { pending: number; available: number; lifetimeEarned: number; lifetimeRedeemed: number } {
  let pending = 0;
  let available = 0;
  let lifetimeEarned = 0;
  let lifetimeRedeemed = 0;
  for (const t of transactions) {
    if (t.status === "PENDING" && t.type !== "REDEMPTION") pending += t.amount_cents;
    if (t.status === "CONFIRMED") {
      available += t.amount_cents;
      if (t.amount_cents > 0) lifetimeEarned += t.amount_cents;
      if (t.type === "REDEMPTION") lifetimeRedeemed += -t.amount_cents;
    }
  }
  return { pending, available, lifetimeEarned, lifetimeRedeemed };
}

/** Health metric: reward cost divided by the revenue that generated it. */
export function rewardCostRatio(rewardCents: number, revenueCents: number): number | null {
  if (revenueCents <= 0) return null;
  return rewardCents / revenueCents;
}
