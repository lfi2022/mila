import { apiRequest } from "@/services/api/client";
import type { PaymentStatus } from "./types";

export type PremiumStatus = {
  enabled: boolean;
  mollieEnabled: boolean;
  rewardsEnabled: boolean;
  priceCents: number;
  currency: string;
  plan: string;
  active: boolean;
};

export type MilaPayment = {
  id: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  checkoutUrl: string | null;
  purpose: string;
  createdAt: string;
};

export const paymentApi = {
  methods: () =>
    apiRequest<{
      enabled: boolean;
      mode: "test" | "live";
      methods: Array<{ id: string; description: string; image?: string }>;
    }>("/payments/methods"),
  premiumStatus: (listId: string) => apiRequest<PremiumStatus>(`/payments/premium/${listId}`),
  buyPremium: (listId: string, useRewards: boolean, idempotencyKey: string) =>
    apiRequest<MilaPayment>(`/payments/premium/${listId}`, {
      method: "POST",
      csrf: true,
      headers: { "x-idempotency-key": idempotencyKey },
      body: JSON.stringify({ useRewards }),
    }),
  get: (paymentId: string, reconcile = false) =>
    apiRequest<MilaPayment>(`/payments/${paymentId}?reconcile=${reconcile}`),
  adminList: () =>
    apiRequest<{
      mode: "test" | "live";
      payments: Array<
        MilaPayment & {
          listId: string | null;
          provider: string;
          externalId: string | null;
          entitlementPlan: string | null;
          refundedCents: number;
          chargebackCents: number;
        }
      >;
    }>("/admin/payments"),
  refund: (paymentId: string, amountCents: number, reason: string, idempotencyKey: string) =>
    apiRequest<{ refundId: string }>(`/admin/payments/${paymentId}/refunds`, {
      method: "POST",
      csrf: true,
      headers: { "x-idempotency-key": idempotencyKey },
      body: JSON.stringify({ amountCents, reason }),
    }),
  reconcile: (paymentId: string) =>
    apiRequest<{ reconciled: boolean }>(`/admin/payments/${paymentId}/reconcile`, {
      method: "POST",
      csrf: true,
    }),
};
