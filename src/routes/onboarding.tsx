import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Créer ma liste en 4 étapes — Mila" },
      { name: "description", content: "Quatre étapes courtes pour préparer votre liste de naissance Mila." },
      { property: "og:title", content: "Créer ma liste en 4 étapes — Mila" },
      { property: "og:description", content: "Prénom, date, message : votre liste est prête en deux minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OnboardingPage,
});

const STEPS = ["Vous", "Bébé", "Message", "C'est prêt"] as const;

function slugify(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "liste"
  );
}

function OnboardingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [babyName, setBabyName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [welcome, setWelcome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <p className="mx-auto max-w-xl px-4 py-20 text-sm text-muted-foreground">Un instant…</p>
      </div>
    );
  }

  const finish = async () => {
    setBusy(true);
    try {
      if (displayName.trim()) {
        await supabase.from("profiles").update({ display_name: displayName.trim() }).eq("id", user.id);
      }
      const slug = `${slugify(babyName || displayName || "notre-liste")}-${Math.random().toString(36).slice(2, 7)}`;
      const { data, error } = await supabase
        .from("registries")
        .insert({
          owner_id: user.id,
          slug,
          title: babyName.trim() ? `La liste de ${babyName.trim()}` : "Notre liste de naissance",
          baby_name: babyName.trim() || null,
          due_date: dueDate || null,
          welcome_message: welcome.trim() || null,
          type: "BIRTH",
          visibility: "UNLISTED",
        })
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("creation");
      await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
      toast.success("Votre liste est créée !");
      void navigate({ to: "/dashboard/$registryId", params: { registryId: data.id } });
    } catch {
      toast.error("La liste n'a pas pu être créée.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-xl space-y-8 px-4 py-12">
        <div className="space-y-3">
          <Progress value={((step + 1) / STEPS.length) * 100} />
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Étape {step + 1} / {STEPS.length} · {STEPS[step]}
          </p>
        </div>

        <section className="surface-card space-y-5 p-6">
          {step === 0 ? (
            <>
              <h1 className="font-display text-2xl">Bienvenue sur Mila</h1>
              <div className="space-y-2">
                <Label htmlFor="ob-name">Comment vous appelez-vous ?</Label>
                <Input id="ob-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h1 className="font-display text-2xl">Parlez-nous de bébé</h1>
              <div className="space-y-2">
                <Label htmlFor="ob-baby">Prénom (ou surnom) de bébé</Label>
                <Input id="ob-baby" value={babyName} onChange={(e) => setBabyName(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ob-date">Date prévue</Label>
                <Input id="ob-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h1 className="font-display text-2xl">Un mot pour vos proches</h1>
              <div className="space-y-2">
                <Label htmlFor="ob-welcome">Message d'accueil</Label>
                <Textarea
                  id="ob-welcome"
                  rows={4}
                  value={welcome}
                  onChange={(e) => setWelcome(e.target.value)}
                  maxLength={800}
                  placeholder="Merci d'être là pour l'arrivée de notre bébé…"
                />
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h1 className="font-display text-2xl">Tout est prêt</h1>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>1. Nous créons votre liste (visible par lien uniquement).</li>
                <li>2. Ajoutez vos cadeaux en collant le lien d'un magasin.</li>
                <li>3. Partagez le lien ou le QR code à vos proches.</li>
                <li>4. Invitez le second parent quand vous le souhaitez.</li>
              </ul>
            </>
          ) : null}

          <div className="flex justify-between gap-3 pt-2">
            <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
              Retour
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Continuer</Button>
            ) : (
              <Button disabled={busy} onClick={() => void finish()}>
                Créer ma liste
              </Button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
