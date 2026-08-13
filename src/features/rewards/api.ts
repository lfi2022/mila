import { apiRequest } from "@/services/api/client";

export type RewardSummary = {
  programEnabled: boolean;
  redemptionEnabled: boolean;
  currency: string;
  availableCents: number;
  pendingCents: number;
  lifetimeEarnedCents: number;
  lifetimeUsedCents: number;
  minRedemptionCents: number;
  explainerText: string;
  transactions: Array<{
    id: string;
    type: string;
    status: string;
    amountCents: number;
    source: string | null;
    description: string | null;
    createdAt: string;
  }>;
  redemptions: Array<{
    id: string;
    type: string;
    status: string;
    amountCents: number;
    requestedAt: string;
  }>;
};

export type ReferralSummary = {
  enabled: boolean;
  code: string | null;
  bonusCents: number;
  referrals: Array<{ id: string; status: string; createdAt: string }>;
};

export const getListRewards = (listId: string) =>
  apiRequest<RewardSummary>(`/rewards/lists/${listId}`);

export const listRewardOffers = () =>
  apiRequest<{
    offers: Array<{
      id: string;
      title: string;
      description: string | null;
      costCents: number;
      type: string;
    }>;
  }>("/rewards/offers");

export const requestRewardRedemption = (listId: string, offerId?: string) =>
  apiRequest<{ id: string; label: string; amountCents: number; status: string }>(
    `/rewards/lists/${listId}/redemptions`,
    { method: "POST", csrf: true, body: JSON.stringify({ offerId }) },
  );

export const getMyReferral = () => apiRequest<ReferralSummary>("/rewards/referral");

export const registerReferral = (code: string) =>
  apiRequest<{ ok: boolean; reason: string }>("/rewards/referral/register", {
    method: "POST",
    csrf: true,
    body: JSON.stringify({ code }),
  });

export const refreshMyReferrals = () =>
  apiRequest<{ refreshed: number }>("/rewards/referral/refresh", {
    method: "POST",
    csrf: true,
  });

export type RewardAdminAnalytics = {
  confirmedRevenueCents: number;
  rewardsGrantedCents: number;
  netMarginCents: number;
  costRatio: number;
  flaggedWallets: number;
  negativeWallets: number;
  referralsToReview: number;
  pendingRedemptions: number;
};

export const getRewardAdminAnalytics = () =>
  apiRequest<RewardAdminAnalytics>("/admin/rewards/analytics");

export const getRewardReviewQueue = () =>
  apiRequest<{
    referrals: Array<{ id: string; code: string; createdAt: string; riskMetadata: unknown }>;
    redemptions: Array<{
      id: string;
      type: string;
      amountCents: number;
      currency: string;
      listId: string;
      createdAt: string;
    }>;
  }>("/admin/rewards/review-queue");

export const reviewRewardReferral = (referralId: string, approve: boolean, reason: string) =>
  apiRequest<{ status: string }>(`/admin/rewards/referrals/${referralId}/review`, {
    method: "POST",
    csrf: true,
    body: JSON.stringify({ approve, reason }),
  });

export const reviewRewardRedemption = (redemptionId: string, approve: boolean, reason: string) =>
  apiRequest<{ status: string }>(`/admin/rewards/redemptions/${redemptionId}/review`, {
    method: "POST",
    csrf: true,
    body: JSON.stringify({ approve, reason }),
  });

export const createRewardAdjustment = (input: {
  listId: string;
  amountCents: number;
  reason: string;
}) =>
  apiRequest<{ transaction: { id: string } }>("/admin/rewards/adjustments", {
    method: "POST",
    csrf: true,
    body: JSON.stringify(input),
  });
