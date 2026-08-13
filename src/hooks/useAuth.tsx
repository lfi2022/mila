import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { apiRequest } from "@/services/api/client";

export type MilaUser = {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  roles: Array<"USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN">;
};

type AuthContextValue = {
  user: MilaUser | null;
  session: { user: MilaUser } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (displayName: string | null) => Promise<void>;
  exportAccount: () => Promise<unknown>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MilaUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void apiRequest<{ user: MilaUser }>("/auth/me")
      .then(({ user: current }) => {
        if (active) setUser(current);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session: user ? { user } : null,
      loading,
      async signIn(email, password) {
        const response = await apiRequest<{ user: MilaUser }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setUser(response.user);
      },
      async signUp(email, password, displayName) {
        const response = await apiRequest<{ verificationRequired: boolean }>("/auth/signup", {
          method: "POST",
          body: JSON.stringify({ email, password, displayName }),
        });
        return response.verificationRequired;
      },
      async signOut() {
        await apiRequest<void>("/auth/logout", { method: "POST", csrf: true });
        setUser(null);
      },
      async refresh() {
        const response = await apiRequest<{ user: MilaUser }>("/auth/refresh", {
          method: "POST",
          csrf: true,
        });
        setUser(response.user);
      },
      async updateProfile(displayName) {
        const response = await apiRequest<{ user: MilaUser }>("/auth/profile", {
          method: "PATCH",
          csrf: true,
          body: JSON.stringify({ displayName }),
        });
        setUser(response.user);
      },
      async exportAccount() {
        return apiRequest<unknown>("/auth/export");
      },
      async deleteAccount() {
        await apiRequest<void>("/auth/account", {
          method: "DELETE",
          csrf: true,
          body: JSON.stringify({ confirmation: "DELETE" }),
        });
        setUser(null);
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
