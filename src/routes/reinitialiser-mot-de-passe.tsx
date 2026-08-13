import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/services/api/client";

export const Route = createFileRoute("/reinitialiser-mot-de-passe")({
  validateSearch: z.object({ token: z.string().optional() }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-20">
        <h1 className="font-display text-3xl">Nouveau mot de passe</h1>
        <div className="surface-card mt-8 space-y-4 p-6">
          <Label htmlFor="new-password">12 caractères minimum</Label>
          <Input
            id="new-password"
            type="password"
            minLength={12}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button
            className="w-full"
            disabled={!token || password.length < 12}
            onClick={async () => {
              try {
                await apiRequest("/auth/reset-password", {
                  method: "POST",
                  body: JSON.stringify({ token, password }),
                });
                toast.success("Mot de passe modifié. Vous pouvez vous connecter.");
                void navigate({ to: "/auth" });
              } catch {
                toast.error("Ce lien est invalide ou a expiré.");
              }
            }}
          >
            Modifier le mot de passe
          </Button>
        </div>
      </main>
    </div>
  );
}
