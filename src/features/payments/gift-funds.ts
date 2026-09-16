import { apiRequest } from "@/services/api/client";

export type GiftFundsSummary = {
  clientCode: string;
  currency: string;
  allocatedCents: number;
  committedPayoutCents: number;
  requestableCents: number;
  payments: Array<{
    id: string;
    mollieId: string | null;
    status: string;
    amountCents: number;
    currency: string;
    createdAt: string;
    items: Array<{
      giftId: string | null;
      giftTitle: string | null;
      contributorName: string | null;
      allocationStatus: string;
      amountCents: number;
    }>;
  }>;
  payouts: Array<{
    id: string;
    status: string;
    amountCents: number;
    currency: string;
    reference: string | null;
    createdAt: string;
  }>;
};

export type ManualPayout = {
  id: string;
  listId: string;
  listTitle: string;
  status: string;
  amountCents: number;
  currency: string;
  beneficiary: string | null;
  ibanMasked: string | null;
  iban: string | null;
  reference: string | null;
  createdAt: string;
};

export const giftFundsApi = {
  summary: (listId: string) => apiRequest<GiftFundsSummary>(`/lists/${listId}/gift-funds`),
  request: (listId: string, amountCents: number) =>
    apiRequest<{ id: string }>(`/lists/${listId}/gift-funds/payouts`, {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ amountCents }),
    }),
  adminList: () => apiRequest<{ payouts: ManualPayout[] }>("/admin/gift-funds/payouts"),
  decide: (payoutId: string, approve: boolean) =>
    apiRequest(`/admin/gift-funds/payouts/${payoutId}/decision`, {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ approve }),
    }),
  complete: (payoutId: string, reference: string) =>
    apiRequest(`/admin/gift-funds/payouts/${payoutId}/complete`, {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ reference }),
    }),
};
