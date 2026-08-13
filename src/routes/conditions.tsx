import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/conditions")({
  head: () => ({
    meta: [
      { title: "Conditions d'utilisation — Mila" },
      {
        name: "description",
        content: "Les règles d'utilisation de Mila : création de listes, réservations, contenus interdits et affiliation.",
      },
      { property: "og:title", content: "Conditions d'utilisation — Mila" },
      { property: "og:description", content: "Les règles du service Mila." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
        <h1 className="font-display text-4xl">Conditions d'utilisation</h1>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Le service</h2>
          <p className="text-muted-foreground">
            Mila permet de créer des listes de cadeaux et de les partager. Mila n'est ni un magasin ni un intermédiaire de
            paiement : les achats se font directement chez les marchands, sous leurs propres conditions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Votre compte</h2>
          <p className="text-muted-foreground">
            Vous êtes responsable du contenu de vos listes et des personnes que vous invitez à les gérer. Les comptes sont
            personnels et réservés aux personnes majeures.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Contenus interdits</h2>
          <p className="text-muted-foreground">
            Contenus illégaux, haineux, trompeurs, données personnelles de tiers, ou usage commercial détourné. Toute liste
            signalée peut être suspendue le temps d'une vérification.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Affiliation</h2>
          <p className="text-muted-foreground">
            Certains liens vers des magasins partenaires sont convertis en liens d'affiliation. Cela ne modifie jamais le
            prix payé par vos proches et n'influence pas les cadeaux que vous choisissez d'ajouter.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Disponibilité</h2>
          <p className="text-muted-foreground">
            Le service est fourni « tel quel », sans garantie de disponibilité permanente. Nous pouvons faire évoluer ces
            conditions ; la version en ligne fait foi.
          </p>
        </section>
      </main>
    </div>
  );
}
