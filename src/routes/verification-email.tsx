import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/services/api/client";

export const Route = createFileRoute("/verification-email")({
  validateSearch: z.object({ token: z.string().optional() }),
  component: VerificationEmailPage,
});

function VerificationEmailPage() {
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }
    void apiRequest<void>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-3xl">Vérification de l’adresse email</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {status === "loading"
            ? "Vérification en cours…"
            : status === "success"
              ? "Votre adresse est vérifiée. Vous pouvez maintenant vous connecter."
              : "Ce lien est invalide ou a expiré."}
        </p>
        {status !== "loading" && (
          <Button asChild className="mt-6">
            <Link to="/auth">Revenir à la connexion</Link>
          </Button>
        )}
      </main>
    </div>
  );
}
