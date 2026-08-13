import { apiRequest } from "@/services/api/client";

export type ManagedReservation = {
  id: string;
  guestName: string;
  guestEmail: string | null;
  message: string | null;
  quantity: number;
  status: "RESERVED" | "PURCHASED" | "CANCELLED" | "EXPIRED";
  createdAt: string;
  gift: { title: string };
};

export const reservationApi = {
  async forList(listId: string) {
    return (
      await apiRequest<{ reservations: ManagedReservation[] }>(`/lists/${listId}/reservations`)
    ).reservations;
  },
  cancel: (listId: string, reservationId: string) =>
    apiRequest<void>(`/lists/${listId}/reservations/${reservationId}`, {
      method: "DELETE",
      csrf: true,
    }),
};
