import { createFileRoute } from "@tanstack/react-router";

import { buildPublicUrl } from "@/config/runtime";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Mila" },
      {
        name: "description",
        content:
          "Une question sur votre liste de naissance Mila, vos données ou vos récompenses ? Écrivez-nous.",
      },
      { property: "og:title", content: "Contact — Mila" },
      {
        property: "og:description",
        content: "Contactez l'équipe Mila pour toute question sur votre liste.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: buildPublicUrl("/contact") },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl("/contact") }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-4xl">Nous écrire</h1>
        <p className="mt-4 text-muted-foreground">
          Nous lisons chaque message. Pour une question sur une liste, précisez son lien : cela nous
          aide à répondre plus vite.
        </p>

        <div className="surface-card mt-8 space-y-4 p-6 text-sm">
          <div>
            <h2 className="font-semibold">Support parents</h2>
            <p className="text-muted-foreground">
              <a href="mailto:bonjour@mila-listes.fr" className="underline">
                bonjour@mila-listes.fr
              </a>
            </p>
          </div>
          <div>
            <h2 className="font-semibold">Données personnelles</h2>
            <p className="text-muted-foreground">
              <a href="mailto:privacy@mila-listes.fr" className="underline">
                privacy@mila-listes.fr
              </a>{" "}
              — accès, export ou suppression de votre compte.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Réponse sous quelques jours ouvrés. Ces adresses doivent être confirmées par l'éditeur
            du site avant la mise en ligne publique.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
