import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/services/api/client";

export const Route = createFileRoute("/mot-de-passe-oublie")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-20">
        <h1 className="font-display text-3xl">Mot de passe oublié</h1>
        <div className="surface-card mt-8 space-y-4 p-6">
          {sent ? (
            <p className="text-sm text-muted-foreground">
              Si cette adresse correspond à un compte actif, un lien vient d’être envoyé.
            </p>
          ) : (
            <>
              <Label htmlFor="reset-email">Adresse email</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Button
                className="w-full"
                onClick={async () => {
                  try {
                    await apiRequest("/auth/forgot-password", {
                      method: "POST",
                      body: JSON.stringify({ email }),
                    });
                    setSent(true);
                  } catch {
                    toast.error("Demande impossible pour le moment.");
                  }
                }}
              >
                Envoyer le lien
              </Button>
            </>
          )}
          <Button asChild variant="link" className="w-full">
            <Link to="/auth">Retour à la connexion</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
