import { apiRequest } from "@/services/api/client";

export type OrderStatus =
  | "DRAFT"
  | "READY"
  | "WAITING_PARENT"
  | "SUBMITTED"
  | "PARTIALLY_ORDERED"
  | "ORDERED"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELLED";

export type OrderGroup = {
  id: string;
  listId: string;
  listTitle: string | null;
  merchantId: string;
  merchantName: string | null;
  status: OrderStatus;
  orderMode: "MANUAL_PARENT" | "ASSISTED_PARENT" | "AUTOMATIC_PLATFORM";
  deliveryMode: string | null;
  destination: unknown;
  orderWindowStart: string | null;
  orderWindowEnd: string | null;
  currency: string;
  totalMinor: string;
  plannedContributionMinor: string;
  externalOrderReference: string | null;
  trackingUrl: string | null;
  items: Array<{
    id: string;
    giftId: string;
    title: string;
    url: string | null;
    quantity: number;
    unitPriceMinor: string;
    contributionAmountMinor: string;
    selectedVariant: unknown;
    status: string;
  }>;
  history: Array<{
    id: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    reason: string | null;
    createdAt: string;
  }>;
};

export type OrderCenter = {
  enabled: boolean;
  automaticOrdersEnabled: boolean;
  lists: Array<{ id: string; title: string; heldMinor: string; plannedMinor: string }>;
  candidates: Array<{
    id: string;
    listId: string;
    listTitle: string;
    merchantId: string;
    merchantName: string;
    title: string;
    quantity: number;
    unitPriceMinor: string;
    currency: string;
    status: string;
    selectedVariant: unknown;
  }>;
  sections: {
    ready: OrderGroup[];
    awaitingFunding: OrderGroup[];
    ordered: OrderGroup[];
    received: OrderGroup[];
    problems: OrderGroup[];
  };
};

export const orderApi = {
  center: () => apiRequest<OrderCenter>("/orders"),
  prepare: (
    listId: string,
    input: {
      giftIds?: string[];
      orderMode: "MANUAL_PARENT" | "ASSISTED_PARENT" | "AUTOMATIC_PLATFORM";
      deliveryMode?: string;
      destination: { label: string; country: string };
    },
  ) =>
    apiRequest<{ groups: OrderGroup[] }>(`/lists/${listId}/orders/prepare`, {
      method: "POST",
      csrf: true,
      body: JSON.stringify(input),
    }),
  updateItem: (
    groupId: string,
    itemId: string,
    input: {
      quantity?: number;
      selectedVariant?: Record<string, unknown> | null;
      included?: boolean;
      deliveryAmountMinor?: string;
    },
  ) =>
    apiRequest(`/orders/${groupId}/items/${itemId}`, {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify(input),
    }),
  allocate: (groupId: string, itemId: string, amountMinor: string) =>
    apiRequest(`/orders/${groupId}/items/${itemId}/contribution-allocation`, {
      method: "PUT",
      csrf: true,
      body: JSON.stringify({ amountMinor }),
    }),
  transition: (
    groupId: string,
    input: {
      status: OrderStatus;
      reason?: string;
      externalOrderReference?: string;
      trackingUrl?: string;
    },
  ) =>
    apiRequest<{ status: OrderStatus }>(`/orders/${groupId}/status`, {
      method: "POST",
      csrf: true,
      body: JSON.stringify(input),
    }),
};
