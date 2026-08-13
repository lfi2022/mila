import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: "Confidentialité — Mila" },
      {
        name: "description",
        content:
          "Quelles données Mila collecte pour vos listes de naissance, pourquoi, et comment les supprimer.",
      },
      { property: "og:title", content: "Confidentialité — Mila" },
      { property: "og:description", content: "Notre politique de confidentialité, en clair." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
        <h1 className="font-display text-4xl">Confidentialité</h1>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Ce que nous collectons</h2>
          <p className="text-muted-foreground">
            Pour les parents : votre email, votre prénom affiché et le contenu de vos listes. Pour
            les visiteurs qui réservent un cadeau : le prénom saisi, un email facultatif (pour vous
            envoyer votre lien de gestion) et le message laissé aux parents.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Statistiques et liens marchands</h2>
          <p className="text-muted-foreground">
            Quand un visiteur ouvre un cadeau, nous enregistrons un clic anonyme (cadeau, liste,
            marchand, date) sans aucune donnée personnelle ni cookie publicitaire. Certains liens
            vers des magasins partenaires sont des liens d'affiliation : le prix reste identique
            pour vous et nous percevons éventuellement une petite commission.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Vos droits</h2>
          <p className="text-muted-foreground">
            Depuis votre profil, vous pouvez exporter l'ensemble de vos données au format JSON et
            supprimer votre compte ainsi que vos listes, immédiatement et définitivement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Conservation</h2>
          <p className="text-muted-foreground">
            Vos listes sont conservées tant que votre compte existe. Les liens de gestion envoyés
            aux visiteurs expirent automatiquement au bout d'un an.
          </p>
        </section>
      </main>
    </div>
  );
}
