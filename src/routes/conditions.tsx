import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/conditions")({
  head: () => ({
    meta: [
      { title: "Conditions d'utilisation — Mila" },
      {
        name: "description",
        content:
          "Les règles d'utilisation de Mila : création de listes, réservations, contenus interdits et affiliation.",
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
        <p className="rounded-xl border border-dashed border-primary/50 bg-primary/5 p-4 text-sm">
          Projet de conditions, non validé juridiquement. Les clauses financières, fiscales,
          consommateurs et de droit applicable sont bloquées jusqu’à revue professionnelle.
        </p>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Le service</h2>
          <p className="text-muted-foreground">
            Mila permet de créer des listes de cadeaux et de les partager. Mila n'est ni un magasin
            ni un intermédiaire de paiement : les achats se font directement chez les marchands,
            sous leurs propres conditions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Premium, Récompenses et contributions</h2>
          <p className="text-muted-foreground">
            Les avantages, prix, taxes, règles d’expiration, frais, remboursements et chargebacks
            affichés dans l’application doivent correspondre aux conditions commerciales finales.
            Mila ne collectera ni ne versera de fonds pour compte de tiers tant que le modèle
            réglementaire, le prestataire autorisé et les obligations comptables ne sont pas
            validés.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Signalement, modération et recours</h2>
          <p className="text-muted-foreground">
            Les contenus de phishing, liens malveillants, spam, fraude, abus de parrainage ou
            atteinte aux droits peuvent être masqués et les comptes suspendus. Les décisions
            sensibles sont motivées et journalisées. La procédure de contestation et les délais
            définitifs restent à compléter avant lancement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Votre compte</h2>
          <p className="text-muted-foreground">
            Vous êtes responsable du contenu de vos listes et des personnes que vous invitez à les
            gérer. Les comptes sont personnels et réservés aux personnes majeures.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Contenus interdits</h2>
          <p className="text-muted-foreground">
            Contenus illégaux, haineux, trompeurs, données personnelles de tiers, ou usage
            commercial détourné. Toute liste signalée peut être suspendue le temps d'une
            vérification.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Affiliation</h2>
          <p className="text-muted-foreground">
            Certains liens vers des magasins partenaires sont convertis en liens d'affiliation. Cela
            ne modifie jamais le prix payé par vos proches et n'influence pas les cadeaux que vous
            choisissez d'ajouter.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Disponibilité</h2>
          <p className="text-muted-foreground">
            Le service est fourni « tel quel », sans garantie de disponibilité permanente. Nous
            pouvons faire évoluer ces conditions ; la version en ligne fait foi.
          </p>
        </section>
      </main>
    </div>
  );
}
