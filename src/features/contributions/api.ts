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
        reference: string | null;
        transferDestination: {
          userId: string;
          beneficiary: string;
          ibanMasked: string;
        } | null;
        createdAt: string;
      }>;
      receivedCents: number;
      destination: {
        userId: string;
        displayName: string | null;
        email: string;
        beneficiary: string;
        ibanMasked: string;
      } | null;
      recipientUserId: string | null;
      recipients: Array<{
        userId: string;
        displayName: string | null;
        email: string;
        role: "OWNER" | "CO_OWNER";
        beneficiary: string | null;
        ibanMasked: string | null;
        hasBankAccount: boolean;
      }>;
      canConfirm: boolean;
      canManageDestination: boolean;
    }>(`/lists/${listId}/contributions`),
  setRecipient: (listId: string, recipientUserId: string) =>
    apiRequest<{ recipientUserId: string; ibanMasked: string }>(
      `/lists/${listId}/contributions/recipient`,
      {
        method: "PUT",
        csrf: true,
        body: JSON.stringify({ recipientUserId }),
      },
    ),
  confirm: (listId: string, contributionId: string) =>
    apiRequest<{ status: string }>(`/lists/${listId}/contributions/${contributionId}/confirm`, {
      method: "POST",
      csrf: true,
    }),
  cancel: (listId: string, contributionId: string) =>
    apiRequest<{ status: string }>(`/lists/${listId}/contributions/${contributionId}/cancel`, {
      method: "POST",
      csrf: true,
    }),
};
