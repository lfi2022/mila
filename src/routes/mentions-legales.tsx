import { createFileRoute } from "@tanstack/react-router";

import { buildPublicUrl } from "@/config/runtime";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — Mila" },
      {
        name: "description",
        content: "Éditeur, hébergement et responsabilités du service de listes de naissance Mila.",
      },
      { property: "og:title", content: "Mentions légales — Mila" },
      {
        property: "og:description",
        content: "Informations légales du service de listes de naissance Mila.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: buildPublicUrl("/mentions-legales") },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl("/mentions-legales") }],
  }),
  component: LegalPage,
});

function LegalPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-16">
        <h1 className="text-4xl">Mentions légales</h1>
        <p className="rounded-xl border border-dashed border-primary/50 bg-primary/5 p-4 text-sm">
          Certaines informations ci-dessous doivent être complétées par l'éditeur du site avant une
          mise en ligne commerciale (raison sociale, adresse, numéro d'immatriculation).
        </p>

        <section className="space-y-3">
          <h2 className="text-2xl">Éditeur</h2>
          <p className="text-sm text-muted-foreground">
            Mila — service de listes de naissance en ligne. Coordonnées de l'éditeur à compléter.
            Contact : bonjour@mila-listes.fr
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl">Hébergement</h2>
          <p className="text-sm text-muted-foreground">
            Le site est hébergé sur une infrastructure cloud opérée par des prestataires situés dans
            l'Union européenne pour les données de listes et de comptes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl">Propriété intellectuelle</h2>
          <p className="text-sm text-muted-foreground">
            Le nom Mila, son logo et l'interface du site sont protégés. Les marques citées sur le
            site (Amazon, IKEA, Vertbaudet…) appartiennent à leurs titulaires respectifs et sont
            mentionnées à titre d'exemple, sans relation de partenariat.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl">Responsabilité</h2>
          <p className="text-sm text-muted-foreground">
            Les achats sont réalisés directement auprès des marchands, sous leur seule
            responsabilité (prix, disponibilité, livraison, retours). Mila ne vend aucun produit.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
