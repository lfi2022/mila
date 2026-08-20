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
  signup: async (
    email: string,
    password: string,
    displayName: string | undefined,
    termsVersion: string,
    marketingConsent: boolean,
  ) =>
    apiRequest<{ verificationRequired: boolean }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        ...(displayName?.trim() ? { displayName: displayName.trim() } : {}),
        termsAccepted: true,
        termsVersion,
        marketingConsent,
      }),
    }),
  refresh: async () =>
    (await apiRequest<{ user: MilaUser }>("/auth/refresh", { method: "POST", csrf: true })).user,
  logout: () => apiRequest<void>("/auth/logout", { method: "POST", csrf: true }),
  resendVerification: (email: string) =>
    apiRequest<{ accepted: true }>("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  updateProfile: async (displayName: string | null) =>
    (
      await apiRequest<{ user: MilaUser }>("/auth/profile", {
        method: "PATCH",
        csrf: true,
        body: JSON.stringify({ displayName }),
      })
    ).user,
  bankAccount: () => apiRequest<{ bankAccount: BankAccountSummary | null }>("/auth/bank-account"),
  saveBankAccount: (input: { beneficiary: string; iban: string; password: string }) =>
    apiRequest<{ bankAccount: BankAccountSummary }>("/auth/bank-account", {
      method: "PUT",
      csrf: true,
      body: JSON.stringify(input),
    }),
  deleteBankAccount: (password: string) =>
    apiRequest<void>("/auth/bank-account", {
      method: "DELETE",
      csrf: true,
      body: JSON.stringify({ password }),
    }),
  exportAccount: () => apiRequest<unknown>("/auth/export"),
  deleteAccount: () =>
    apiRequest<void>("/auth/account", {
      method: "DELETE",
      csrf: true,
      body: JSON.stringify({ confirmation: "DELETE" }),
    }),
  consents: () =>
    apiRequest<{
      consents: Array<{
        purpose: string;
        policyVersion: string;
        granted: boolean;
        source: string;
        createdAt: string;
      }>;
      currentTermsVersion: string;
    }>("/auth/consents"),
  setMarketingConsent: (granted: boolean) =>
    apiRequest<void>("/auth/consents/marketing", {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ granted }),
    }),
  privacyRequests: () => apiRequest<{ requests: PrivacyRequest[] }>("/auth/privacy-requests"),
  createPrivacyRequest: (type: PrivacyRequest["type"], details?: string) =>
    apiRequest<{ request: PrivacyRequest }>("/auth/privacy-requests", {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ type, details }),
    }),
};

export type BankAccountSummary = {
  beneficiary: string;
  ibanMasked: string;
  updatedAt: string;
};

export type PrivacyRequest = {
  id: string;
  type:
    "ACCESS" | "RECTIFICATION" | "ERASURE" | "RESTRICTION" | "OBJECTION" | "PORTABILITY" | "OTHER";
  status: string;
  details: string | null;
  resolution?: string | null;
  dueAt: string;
  createdAt: string;
};
