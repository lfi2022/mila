import { Link, createFileRoute } from "@tanstack/react-router";

import { RewardsPanel } from "@/components/RewardsPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/recompenses/$registryId")({
  head: () => ({
    meta: [
      { title: "Récompenses Mila — vos cadeaux vous récompensent" },
      {
        name: "description",
        content:
          "Suivez les récompenses générées par votre liste Mila : solde disponible, montants en attente et historique détaillé.",
      },
      { property: "og:title", content: "Récompenses Mila" },
      {
        property: "og:description",
        content: "Solde, historique et utilisation de vos récompenses Mila.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RewardsPage,
});

function RewardsPage() {
  const { registryId } = Route.useParams();
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            ← Mes listes
          </Link>
          <h1 className="mt-3 font-display text-3xl">Récompenses Mila</h1>
          <p className="mt-2 text-muted-foreground">
            Quand vos proches achètent un cadeau via votre liste, Mila reçoit parfois une commission
            du marchand. Une partie vous revient — sans jamais rien changer au prix payé par vos
            invités.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !user ? (
          <p className="text-sm text-muted-foreground">
            Connectez-vous pour voir vos récompenses.{" "}
            <Link to="/auth" className="underline">
              Se connecter
            </Link>
          </p>
        ) : (
          <RewardsPanel registryId={registryId} />
        )}
      </main>
    </div>
  );
}
