import { apiRequest } from "@/services/api/client";

export type ContributionStatus = {
  enabled: boolean;
  bankTransferEnabled: boolean;
  gift: { id: string; title: string };
  targetCents: number | null;
  committedCents: number;
  remainingCents: number | null;
  closed: boolean;
  currency: string;
  minimumCents: number;
  feeRateBps: number;
  platformShareRateBps: number;
};

export const contributionApi = {
  status: (giftToken: string) =>
    apiRequest<ContributionStatus>(`/public/contributions/${giftToken}`),
  bankTransfer: (
    giftToken: string,
    input: {
      amountCents: number;
      contributorName?: string;
      contributorEmail?: string;
      anonymous: boolean;
      message?: string;
    },
    idempotencyKey: string,
  ) =>
    apiRequest<{
      transferId: string;
      beneficiary: string;
      iban: string;
      ibanMasked: string;
      reference: string;
      amountCents: number;
      currency: string;
      expiresAt: string;
    }>(`/public/contributions/${giftToken}/bank-transfer`, {
      method: "POST",
      headers: { "x-idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    }),
  list: (listId: string) =>
    apiRequest<{
      contributions: Array<{
        id: string;
        giftId: string | null;
        contributorName: string | null;
        anonymous: boolean;
        message: string | null;
        amountCents: number;
        feeCents: number;
        platformShareCents: number;
        netToParentsCents: number;
        currency: string;
        status: string;
        transferStatus: string | null;
        createdAt: string;
      }>;
      heldCents: number;
      payoutEnabled: boolean;
    }>(`/lists/${listId}/contributions`),
  reconcile: (input: {
    reference: string;
    receivedCents: number;
    payerName: string;
    approve: boolean;
  }) =>
    apiRequest<{ status: string }>("/admin/bank-transfers/reconcile", {
      method: "POST",
      csrf: true,
      body: JSON.stringify(input),
    }),
  refund: (contributionId: string, reason: string) =>
    apiRequest<{ status: string }>(`/admin/contributions/${contributionId}/refund`, {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ reason }),
    }),
};
