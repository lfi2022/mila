import { apiRequest } from "@/services/api/client";

export type MilaUser = {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  roles: Array<"USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN">;
};

export const authApi = {
  me: async () => (await apiRequest<{ user: MilaUser }>("/auth/me")).user,
  login: async (email: string, password: string) =>
    (
      await apiRequest<{ user: MilaUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
    ).user,
  signup: async (email: string, password: string, displayName?: string) =>
    apiRequest<{ verificationRequired: boolean }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    }),
  refresh: async () =>
    (await apiRequest<{ user: MilaUser }>("/auth/refresh", { method: "POST", csrf: true })).user,
  logout: () => apiRequest<void>("/auth/logout", { method: "POST", csrf: true }),
  updateProfile: async (displayName: string | null) =>
    (
      await apiRequest<{ user: MilaUser }>("/auth/profile", {
        method: "PATCH",
        csrf: true,
        body: JSON.stringify({ displayName }),
      })
    ).user,
  exportAccount: () => apiRequest<unknown>("/auth/export"),
  deleteAccount: () =>
    apiRequest<void>("/auth/account", {
      method: "DELETE",
      csrf: true,
      body: JSON.stringify({ confirmation: "DELETE" }),
    }),
};
