import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { formatCents } from "@/lib/money";
import { getMyReferral, refreshMyReferrals } from "@/features/rewards/api";
import { authApi, type PrivacyRequest } from "@/features/auth/api";
import { openCookieManager } from "@/features/privacy/cookie-consent";

export const Route = createFileRoute("/profil")({
  head: () => ({
    meta: [
      { title: "Mon profil — Mila" },
      {
        name: "description",
        content: "Gérez votre prénom, exportez vos données ou supprimez votre compte Mila.",
      },
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
  const { user, loading, updateProfile, exportAccount, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <p className="mx-auto max-w-2xl px-4 py-20 text-sm text-muted-foreground">
          Chargement de votre profil…
        </p>
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
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
            />
          </div>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await updateProfile(displayName.trim() || null);
                toast.success("Profil mis à jour");
              } catch {
                toast.error("Enregistrement impossible");
              } finally {
                setSaving(false);
              }
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
                const data = await exportAccount();
                const blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                });
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

        <PrivacyControls />

        <ReferralSection />

        <section className="surface-card space-y-4 border-destructive/40 p-6">
          <div>
            <h2 className="text-lg">Supprimer mon compte</h2>
            <p className="text-sm text-muted-foreground">
              Le compte sera désactivé et anonymisé, et vos listes ne seront plus publiques. Les
              données soumises à une obligation légale peuvent être conservées pendant la durée
              strictement nécessaire.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={async () => {
              if (!window.confirm("Supprimer définitivement votre compte et vos listes ?")) return;
              try {
                await deleteAccount();
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

function PrivacyControls() {
  const [marketing, setMarketing] = useState(false);
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [type, setType] = useState<PrivacyRequest["type"]>("ACCESS");
  const [details, setDetails] = useState("");
  const reload = () => {
    void authApi
      .consents()
      .then(({ consents }) =>
        setMarketing(consents.find((entry) => entry.purpose === "marketing")?.granted ?? false),
      );
    void authApi.privacyRequests().then((value) => setRequests(value.requests));
  };
  useEffect(reload, []);
  return (
    <section className="surface-card space-y-6 p-6">
      <div>
        <h2 className="text-lg">Consentements et droits RGPD</h2>
        <p className="text-sm text-muted-foreground">
          Modifiez vos choix ou adressez une demande traçable à l’équipe Mila.
        </p>
      </div>
      <label className="flex items-start justify-between gap-4 text-sm">
        <span>
          Actualités et offres Mila par e-mail{" "}
          <span className="text-muted-foreground">(facultatif)</span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-primary"
          checked={marketing}
          onChange={async (event) => {
            const granted = event.target.checked;
            setMarketing(granted);
            try {
              await authApi.setMarketingConsent(granted);
              toast.success("Préférence enregistrée");
            } catch {
              setMarketing(!granted);
              toast.error("Enregistrement impossible");
            }
          }}
        />
      </label>
      <Button type="button" variant="outline" onClick={openCookieManager}>
        Gérer mes cookies
      </Button>
      <div className="space-y-3 border-t pt-5">
        <Label htmlFor="privacy-request-type">Nouvelle demande relative à mes données</Label>
        <select
          id="privacy-request-type"
          className="min-h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={type}
          onChange={(event) => setType(event.target.value as PrivacyRequest["type"])}
        >
          <option value="ACCESS">Accès</option>
          <option value="RECTIFICATION">Rectification</option>
          <option value="ERASURE">Effacement</option>
          <option value="RESTRICTION">Limitation</option>
          <option value="OBJECTION">Opposition</option>
          <option value="PORTABILITY">Portabilité</option>
          <option value="OTHER">Autre</option>
        </select>
        <textarea
          className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
          maxLength={2000}
          placeholder="Précisez votre demande (facultatif)"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
        <Button
          type="button"
          onClick={async () => {
            try {
              await authApi.createPrivacyRequest(type, details.trim() || undefined);
              setDetails("");
              reload();
              toast.success("Demande enregistrée");
            } catch {
              toast.error("Demande impossible");
            }
          }}
        >
          Envoyer la demande
        </Button>
      </div>
      {requests.length > 0 && (
        <ul className="space-y-2 border-t pt-5 text-sm">
          {requests.map((request) => (
            <li key={request.id} className="rounded-lg bg-muted/60 p-3">
              <strong>{request.type}</strong> — {request.status}
              <br />
              <span className="text-xs text-muted-foreground">
                Créée le {new Date(request.createdAt).toLocaleDateString("fr-BE")} · échéance{" "}
                {new Date(request.dueAt).toLocaleDateString("fr-BE")}
              </span>
              {request.resolution ? <p className="mt-1">{request.resolution}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReferralSection() {
  const [state, setState] = useState<Awaited<ReturnType<typeof getMyReferral>> | null>(null);

  useEffect(() => {
    void getMyReferral()
      .then(setState)
      .catch(() => setState(null));
  }, []);

  if (!state?.enabled || !state.code) return null;
  const link = `${window.location.origin}/auth?parrain=${state.code}`;

  return (
    <section className="surface-card space-y-4 p-6">
      <div>
        <h2 className="text-lg">Parrainage</h2>
        <p className="text-sm text-muted-foreground">
          Invitez d'autres parents. Dès qu'un parent créé sa liste et l'utilise vraiment,{" "}
          {formatCents(state.bonusCents)} sont ajoutés à vos Récompenses Mila. Les invitations non
          abouties ne rapportent rien.
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
            await refreshMyReferrals();
            setState(await getMyReferral());
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
