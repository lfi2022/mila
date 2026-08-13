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
        <p className="rounded-xl border border-dashed border-primary/50 bg-primary/5 p-4 text-sm">
          Version produit à faire valider avant lancement par le responsable juridique/DPO. Les
          coordonnées du responsable de traitement et les durées légales définitives restent à
          compléter.
        </p>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Ce que nous collectons</h2>
          <p className="text-muted-foreground">
            Pour les parents : votre email, votre prénom affiché et le contenu de vos listes. Pour
            les visiteurs qui réservent un cadeau : le prénom saisi, un email facultatif (pour vous
            envoyer votre lien de gestion) et le message laissé aux parents.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Finalités, destinataires et sécurité</h2>
          <p className="text-muted-foreground">
            Nous utilisons les données nécessaires pour fournir et sécuriser les listes,
            réservations, contributions, paiements, messages et récompenses. L’équipe habilitée et
            les sous-traitants strictement nécessaires y accèdent selon leur rôle. Les médias sont
            privés, analysés, transmis par URL temporaire et ne rejoignent un livre souvenir
            qu’après validation parentale.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Données relatives aux enfants</h2>
          <p className="text-muted-foreground">
            Le prénom, la date prévue et les photos sont facultatifs. N’ajoutez pas de données de
            santé, d’identité, d’adresse ou d’autres informations sensibles. Les règles définitives
            d’autorité parentale et de conservation des médias doivent encore être validées.
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
            demander la correction et supprimer votre compte. Les éléments publics sont retirés et
            les sessions révoquées immédiatement ; les écritures financières ou de sécurité peuvent
            devoir être conservées pendant une durée légale à confirmer.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl">Conservation</h2>
          <p className="text-muted-foreground">
            Les liens de gestion expirent automatiquement. Les médias ont une échéance configurable.
            Le calendrier exact par catégorie, les sous-traitants actifs, les transferts éventuels
            et le contact de réclamation doivent être finalisés avant production.
          </p>
        </section>
      </main>
    </div>
  );
}
