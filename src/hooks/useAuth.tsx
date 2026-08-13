import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { authApi, type MilaUser } from "@/features/auth/api";

export type { MilaUser } from "@/features/auth/api";

type AuthContextValue = {
  user: MilaUser | null;
  session: { user: MilaUser } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string | undefined,
    termsVersion: string,
    marketingConsent: boolean,
  ) => Promise<boolean>;
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
    void authApi
      .me()
      .then((current) => {
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

  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener("mila:session-expired", expire);
    return () => window.removeEventListener("mila:session-expired", expire);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session: user ? { user } : null,
      loading,
      async signIn(email, password) {
        setUser(await authApi.login(email, password));
      },
      async signUp(email, password, displayName, termsVersion, marketingConsent) {
        const response = await authApi.signup(
          email,
          password,
          displayName,
          termsVersion,
          marketingConsent,
        );
        return response.verificationRequired;
      },
      async signOut() {
        await authApi.logout();
        setUser(null);
      },
      async refresh() {
        setUser(await authApi.refresh());
      },
      async updateProfile(displayName) {
        setUser(await authApi.updateProfile(displayName));
      },
      async exportAccount() {
        return authApi.exportAccount();
      },
      async deleteAccount() {
        await authApi.deleteAccount();
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
