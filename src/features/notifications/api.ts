import { apiRequest } from "@/services/api/client";

export type Notification = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  listId: string | null;
};

export const notificationApi = {
  async list() {
    return (await apiRequest<{ notifications: Notification[] }>("/notifications")).notifications;
  },
  markRead: (id: string) =>
    apiRequest<void>(`/notifications/${id}/read`, { method: "POST", csrf: true }),
};
