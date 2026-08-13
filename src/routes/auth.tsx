import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";
import { registerReferral } from "@/features/rewards/api";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion parents — Mila" },
      {
        name: "description",
        content: "Connectez-vous pour créer et gérer votre liste de naissance sur Mila.",
      },
      { property: "og:title", content: "Connexion parents — Mila" },
      {
        property: "og:description",
        content:
          "Créez votre compte parent et publiez votre liste de naissance en quelques minutes.",
      },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email("Adresse email invalide").max(255),
  password: z.string().min(12, "12 caractères minimum").max(128),
  name: z.string().trim().max(80).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading, signIn: authenticate, signUp: register } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);

  // A referral code arriving as ?parrain=CODE is kept until the account exists,
  // then registered server-side. It never credits anything by itself.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("parrain");
    if (code) window.localStorage.setItem("mila_referral", code.trim().toUpperCase().slice(0, 16));
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    const code = window.localStorage.getItem("mila_referral");
    const go = () => navigate({ to: "/dashboard" });
    if (!code) {
      go();
      return;
    }
    void registerReferral(code)
      .catch(() => undefined)
      .finally(() => {
        window.localStorage.removeItem("mila_referral");
        go();
      });
  }, [loading, user, navigate]);

  const validate = (withName: boolean) => {
    const parsed = credentials.safeParse({ email, password, name: withName ? name : undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Champs invalides");
      return null;
    }
    return parsed.data;
  };

  const signIn = async () => {
    const data = validate(false);
    if (!data) return;
    setBusy(true);
    try {
      await authenticate(data.email, data.password);
    } catch {
      toast.error("Connexion impossible : identifiants incorrects.");
      return;
    } finally {
      setBusy(false);
    }
    navigate({ to: "/dashboard" });
  };

  const signUp = async () => {
    track("signup_started");
    const data = validate(true);
    if (!data) return;
    setBusy(true);
    try {
      await register(data.email, data.password, data.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Inscription impossible.");
      return;
    } finally {
      setBusy(false);
    }
    setSent(true);
    track("signup_completed");
    toast.success("Vérifiez votre boîte mail pour confirmer votre compte.");
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col px-4 py-16">
        <h1 className="text-center text-3xl">Espace parents</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Créez votre liste de naissance et suivez les réservations de vos proches.
        </p>

        <div className="surface-card mt-8 p-6">
          {sent ? (
            <p className="text-sm text-muted-foreground">
              Un email de confirmation vous a été envoyé. Cliquez sur le lien pour activer votre
              compte, puis revenez vous connecter.
            </p>
          ) : (
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6 space-y-4">
                <Field id="email" label="Email" value={email} onChange={setEmail} type="email" />
                <Field
                  id="password"
                  label="Mot de passe"
                  value={password}
                  onChange={setPassword}
                  type="password"
                />
                <Button className="w-full" disabled={busy} onClick={signIn}>
                  Se connecter
                </Button>
                <Button asChild variant="link" className="w-full">
                  <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
                </Button>
              </TabsContent>

              <TabsContent value="signup" className="mt-6 space-y-4">
                <Field id="name" label="Votre prénom" value={name} onChange={setName} />
                <Field id="email-up" label="Email" value={email} onChange={setEmail} type="email" />
                <Field
                  id="password-up"
                  label="Mot de passe"
                  value={password}
                  onChange={setPassword}
                  type="password"
                />
                <Button className="w-full" disabled={busy} onClick={signUp}>
                  Créer mon compte
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
