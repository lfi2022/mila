import { apiRequest } from "@/services/api/client";

export type PriceTrackingGift = {
  id: string;
  title: string;
  currency: string;
  merchant: string | null;
  offerPreference: "FIXED_MERCHANT" | "SUGGEST_BEST" | "AUTO_BEST";
  priceAtCreationMinor: string | null;
  currentPriceMinor: string | null;
  differenceMinor: string | null;
  comparisonReliable: boolean;
  availability: string | null;
  linkHealthy: boolean | null;
  lastCheckedAt: string | null;
  nextRefreshAt: string | null;
  priceAlertsEnabled: boolean;
  availabilityAlertsEnabled: boolean;
  deadLinkAlertsEnabled: boolean;
  bestOffer: {
    id: string;
    totalMinor: string;
    available: boolean | null;
    deliveryEtaDays: number | null;
  } | null;
  switchHistory: Array<{
    id: string;
    fromPriceMinor: string;
    toTotalMinor: string;
    savingsMinor: string;
    reason: string;
    createdAt: string;
  }>;
};

export const priceApi = {
  suggestion: (giftToken: string) =>
    apiRequest<{
      enabled: boolean;
      suggestion: {
        merchant: string;
        totalMinor: string;
        currency: string;
        deliveryEtaDays: number | null;
        automatic: boolean;
      } | null;
    }>(`/public/prices/${giftToken}`),
  list: (listId: string) =>
    apiRequest<{
      enabled: boolean;
      comparisonEnabled: boolean;
      autoSwitchMinSavingsBps: number;
      settings: {
        productAutoRefresh: boolean;
        autoUpdatePrice: boolean;
        autoSuggestBetterOffer: boolean;
        autoSwitchBetterOffer: boolean;
      };
      gifts: PriceTrackingGift[];
    }>(`/lists/${listId}/price-tracking`),
  updateSettings: (
    listId: string,
    input: Partial<{
      productAutoRefresh: boolean;
      autoUpdatePrice: boolean;
      autoSuggestBetterOffer: boolean;
      autoSwitchBetterOffer: boolean;
    }>,
  ) =>
    apiRequest(`/lists/${listId}/price-settings`, {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify(input),
    }),
  update: (
    listId: string,
    giftId: string,
    input: Partial<
      Pick<
        PriceTrackingGift,
        | "priceAlertsEnabled"
        | "availabilityAlertsEnabled"
        | "deadLinkAlertsEnabled"
        | "offerPreference"
      >
    >,
  ) =>
    apiRequest(`/lists/${listId}/gifts/${giftId}/price-tracking`, {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify(input),
    }),
};
