import { apiRequest } from "@/services/api/client";

export type Gift = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  quantity: number;
  reservedQuantity: number;
  unitPriceMinor: string | null;
  status: string;
  secondHandPolicy: "NEW_ONLY" | "SECOND_HAND_ALLOWED" | "SECOND_HAND_PREFERRED";
  merchant: { name: string } | null;
  imageUrl: string;
  images: Array<{ originalUrl: string | null; storedObjectKey: string | null }>;
};

export const giftApi = {
  async list(listId: string) {
    return (await apiRequest<{ gifts: Gift[] }>(`/lists/${listId}/gifts`)).gifts;
  },
  async create(
    listId: string,
    input: {
      title: string;
      description?: string | null;
      url?: string | null;
      quantity: number;
      unitPriceMinor?: string | null;
      imageUrl?: string | null;
      secondHandPolicy?: "NEW_ONLY" | "SECOND_HAND_ALLOWED" | "SECOND_HAND_PREFERRED";
    },
  ) {
    return (
      await apiRequest<{ gift: Gift }>(`/lists/${listId}/gifts`, {
        method: "POST",
        csrf: true,
        body: JSON.stringify({
          title: input.title,
          description: input.description,
          url: input.url,
          quantity: input.quantity,
          unitPriceMinor: input.unitPriceMinor,
          kind: input.url ? "LINK" : "FREE_GIFT",
          secondHandPolicy: input.secondHandPolicy ?? "NEW_ONLY",
          ...(input.imageUrl
            ? { image: { url: input.imageUrl, source: "REMOTE_UNVERIFIED" } }
            : {}),
        }),
      })
    ).gift;
  },
  remove: (listId: string, giftId: string) =>
    apiRequest<void>(`/lists/${listId}/gifts/${giftId}`, { method: "DELETE", csrf: true }),
  attachUserMedia: (listId: string, giftId: string, storedObjectKey: string) =>
    apiRequest(`/lists/${listId}/gifts/${giftId}/media`, {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ storedObjectKey, rightsConfirmed: true }),
    }),
};
