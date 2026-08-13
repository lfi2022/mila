import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount, exportMyData } from "@/lib/lists.functions";
import { formatCents } from "@/lib/money";
import { getMyReferral, refreshMyReferrals } from "@/lib/rewards.functions";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Mon profil — Mila" },
      { name: "description", content: "Gérez votre prénom, exportez vos données ou supprimez votre compte Mila." },
      { property: "og:title", content: "Mon profil — Mila" },
      { property: "og:description", content: "Vos informations et vos droits sur vos données." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const exportData = useServerFn(exportMyData);
  const deleteAccount = useServerFn(deleteMyAccount);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name ?? ""));
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <p className="mx-auto max-w-2xl px-4 py-20 text-sm text-muted-foreground">Chargement de votre profil…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-12">
        <header className="space-y-2">
          <h1 className="font-display text-3xl">Mon profil</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </header>

        <section className="surface-card space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="display-name">Prénom affiché</Label>
            <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
          </div>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const { error } = await supabase
                .from("profiles")
                .update({ display_name: displayName.trim() || null })
                .eq("id", user.id);
              setSaving(false);
              if (error) toast.error("Enregistrement impossible");
              else toast.success("Profil mis à jour");
            }}
          >
            Enregistrer
          </Button>
        </section>

        <section className="surface-card space-y-4 p-6">
          <div>
            <h2 className="text-lg">Vos données</h2>
            <p className="text-sm text-muted-foreground">
              Téléchargez une copie complète de vos listes, cadeaux, réservations et notifications.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const data = await exportData();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "mes-donnees-mila.json";
                link.click();
                URL.revokeObjectURL(url);
              } catch {
                toast.error("Export impossible pour le moment");
              }
            }}
          >
            Exporter mes données
          </Button>
        </section>

        <ReferralSection />

        <section className="surface-card space-y-4 border-destructive/40 p-6">
          <div>
            <h2 className="text-lg">Supprimer mon compte</h2>
            <p className="text-sm text-muted-foreground">
              Vos listes, cadeaux et réservations seront définitivement effacés. Cette action est irréversible.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={async () => {
              if (!window.confirm("Supprimer définitivement votre compte et vos listes ?")) return;
              try {
                await deleteAccount();
                await signOut();
                void navigate({ to: "/" });
              } catch {
                toast.error("Suppression impossible pour le moment");
              }
            }}
          >
            Supprimer définitivement
          </Button>
        </section>
      </main>
    </div>
  );
}

function ReferralSection() {
  const fetchReferral = useServerFn(getMyReferral);
  const refresh = useServerFn(refreshMyReferrals);
  const [state, setState] = useState<Awaited<ReturnType<typeof fetchReferral>> | null>(null);

  useEffect(() => {
    void fetchReferral()
      .then(setState)
      .catch(() => setState(null));
  }, [fetchReferral]);

  if (!state?.enabled || !state.code) return null;
  const link = `${window.location.origin}/auth?parrain=${state.code}`;

  return (
    <section className="surface-card space-y-4 p-6">
      <div>
        <h2 className="text-lg">Parrainage</h2>
        <p className="text-sm text-muted-foreground">
          Invitez d'autres parents. Dès qu'un parent créé sa liste et l'utilise vraiment,{" "}
          {formatCents(state.bonusCents)} sont ajoutés à vos Récompenses Mila. Les invitations non abouties ne
          rapportent rien.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Input readOnly value={link} className="max-w-md" />
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            toast.success("Lien de parrainage copié");
          }}
        >
          Copier
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            await refresh();
            setState(await fetchReferral());
            toast.success("Parrainages actualisés");
          }}
        >
          Actualiser
        </Button>
      </div>
      {state.referrals.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {state.referrals.map((referral) => (
            <li key={referral.id}>
              {new Date(referral.createdAt).toLocaleDateString("fr-BE")} —{" "}
              {referral.status === "REWARDED"
                ? "validé et récompensé"
                : referral.status === "QUALIFIED"
                  ? "validé, récompense en cours"
                  : referral.status === "CANCELLED"
                    ? "non éligible"
                    : "en attente"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
