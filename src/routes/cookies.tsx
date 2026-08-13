import { createFileRoute } from "@tanstack/react-router";

import { buildPublicUrl } from "@/config/runtime";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookies et mesure d'audience — Mila" },
      {
        name: "description",
        content:
          "Quels cookies et quelles mesures Mila utilise : strictement nécessaires par défaut, mesure d'audience uniquement avec votre consentement.",
      },
      { property: "og:title", content: "Cookies et mesure d'audience — Mila" },
      {
        property: "og:description",
        content: "Mila n'active aucun traceur non essentiel sans votre consentement.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: buildPublicUrl("/cookies") },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl("/cookies") }],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-16">
        <h1 className="text-4xl">Cookies et mesure d'audience</h1>

        <section className="space-y-3">
          <h2 className="text-2xl">Strictement nécessaires</h2>
          <p className="text-sm text-muted-foreground">
            Nous conservons dans votre navigateur les éléments indispensables au service : votre
            session de connexion, le jeton qui vous permet de retrouver une réservation faite sans
            compte, et vos préférences d'affichage. Ces éléments ne servent pas à vous suivre sur
            d'autres sites.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl">Mesure d'audience</h2>
          <p className="text-sm text-muted-foreground">
            Nous mesurons des étapes agrégées du parcours (visite de la page d'accueil, création
            d'une liste, premier cadeau ajouté, partage) pour améliorer le service. Aucun traceur
            externe n'est chargé et aucun événement n'est transmis tant que vous n'avez pas donné
            votre consentement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl">Liens vers les boutiques</h2>
          <p className="text-sm text-muted-foreground">
            Lorsqu'un proche clique sur un cadeau, il est redirigé vers le site du marchand. Ce
            marchand applique alors sa propre politique de cookies, sur laquelle Mila n'a pas la
            main.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
