import { runtimeConfig } from "@/config/runtime";
import { apiRequest } from "@/services/api/client";

export type MemoryMessage = {
  id: string;
  guestName: string | null;
  text: string | null;
  approvedForMemory: boolean;
  createdAt: string;
  gift: { title: string } | null;
  media: Array<{
    id: string;
    kind: "AUDIO" | "VIDEO";
    scanStatus: string;
    transcodeStatus: string;
  }>;
};
export type SecondHandOffer = {
  id: string;
  proposerName: string;
  condition: string;
  comment: string | null;
  status: string;
  photoStorageKey: string | null;
  createdAt: string;
  gift: { title: string; secondHandPolicy: string };
};
export type ThankYouReservation = {
  id: string;
  guestName: string;
  guestEmail: string | null;
  gift: { title: string; status: string };
  thankYou: null | {
    receivedAt: string | null;
    thankedAt: string | null;
    draft: string | null;
    draftApprovedAt: string | null;
    cardTheme: string | null;
    cardMessage: string | null;
  };
};

export const memoryApi = {
  offers: async (listId: string) =>
    (await apiRequest<{ offers: SecondHandOffer[] }>(`/lists/${listId}/second-hand-offers`)).offers,
  reviewOffer: (listId: string, offerId: string, accept: boolean) =>
    apiRequest(`/lists/${listId}/second-hand-offers/${offerId}/review`, {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ accept }),
    }),
  offerPhoto: (listId: string, offerId: string) =>
    apiRequest<{ url: string }>(`/lists/${listId}/second-hand-offers/${offerId}/photo`, {
      method: "POST",
    }),
  messages: async (listId: string) =>
    (await apiRequest<{ messages: MemoryMessage[] }>(`/lists/${listId}/messages`)).messages,
  approveMessage: (listId: string, messageId: string, approved: boolean) =>
    apiRequest<void>(`/lists/${listId}/messages/${messageId}/memory-approval`, {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify({ approved }),
    }),
  mediaUrl: (listId: string, assetId: string) =>
    apiRequest<{ url: string }>(`/lists/${listId}/media/${assetId}/download`, { method: "POST" }),
  thankYous: async (listId: string, unthanked = false) =>
    (
      await apiRequest<{ reservations: ThankYouReservation[] }>(
        `/lists/${listId}/thank-yous?unthanked=${unthanked}`,
      )
    ).reservations,
  updateThankYou: (listId: string, reservationId: string, input: Record<string, unknown>) =>
    apiRequest(`/lists/${listId}/thank-yous/${reservationId}`, {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify(input),
    }),
  book: (listId: string) =>
    apiRequest<{
      book: {
        id: string;
        theme: string;
        title: string | null;
        introduction: string | null;
        retentionMonths: number;
      };
      items: Array<{ id: string; sourceType: string; sourceId: string }>;
      sources: {
        messages: MemoryMessage[];
        gifts: Array<{ id: string; title: string; status: string }>;
      };
    }>(`/lists/${listId}/memory-book`),
  updateBook: (listId: string, input: Record<string, unknown>) =>
    apiRequest(`/lists/${listId}/memory-book`, {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify(input),
    }),
  addItem: (listId: string, sourceType: "MESSAGE" | "GIFT", sourceId: string) =>
    apiRequest(`/lists/${listId}/memory-book/items`, {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ sourceType, sourceId }),
    }),
  removeItem: (listId: string, itemId: string) =>
    apiRequest<void>(`/lists/${listId}/memory-book/items/${itemId}`, {
      method: "DELETE",
      csrf: true,
    }),
  printUrl: (listId: string) => `${runtimeConfig.apiBaseUrl}/lists/${listId}/memory-book/print`,
  thankYouExportUrl: (listId: string) =>
    `${runtimeConfig.apiBaseUrl}/lists/${listId}/thank-yous/export`,
  cardUrl: (listId: string, reservationId: string) =>
    `${runtimeConfig.apiBaseUrl}/lists/${listId}/thank-yous/${reservationId}/card`,
};

export async function createReservationMemoryMessage(token: string, text: string, file?: File) {
  const { message } = await apiRequest<{ message: { id: string } }>(
    "/public/reservations/manage/messages",
    { method: "POST", body: JSON.stringify({ token, text }) },
  );
  if (!file) return message;
  const declaration = { token, mimeType: file.type, sizeBytes: file.size };
  const { upload } = await apiRequest<{
    upload: { key: string; uploadUrl: string; headers: Record<string, string> };
  }>(`/public/reservations/manage/messages/${message.id}/media/presign`, {
    method: "POST",
    body: JSON.stringify(declaration),
  });
  const sent = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file,
  });
  if (!sent.ok) throw new Error("Le stockage a refusé le média.");
  await apiRequest(`/public/reservations/manage/messages/${message.id}/media/verify`, {
    method: "POST",
    body: JSON.stringify({ ...declaration, key: upload.key }),
  });
  return message;
}

export async function createSecondHandOffer(input: {
  giftToken: string;
  proposerName: string;
  proposerEmail?: string;
  condition: "LIKE_NEW" | "VERY_GOOD" | "GOOD" | "FAIR";
  comment?: string;
  file?: File;
}) {
  const result = await apiRequest<{ managementToken: string; offer: { id: string } }>(
    "/public/second-hand-offers",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  if (input.file) {
    const declaration = {
      token: result.managementToken,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
    };
    const { upload } = await apiRequest<{
      upload: { key: string; uploadUrl: string; headers: Record<string, string> };
    }>("/public/second-hand-offers/manage/photo/presign", {
      method: "POST",
      body: JSON.stringify(declaration),
    });
    const sent = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.headers,
      body: input.file,
    });
    if (!sent.ok) throw new Error("Le stockage a refusé la photo.");
    await apiRequest("/public/second-hand-offers/manage/photo/verify", {
      method: "POST",
      body: JSON.stringify({ ...declaration, key: upload.key }),
    });
  }
  return result;
}
