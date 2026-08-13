import { Link, createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { buildPublicUrl } from "@/config/runtime";

const path = "/guides/budget-cadeaux";

export const Route = createFileRoute("/guides/budget-cadeaux")({
  head: () => ({
    meta: [
      { title: "Cadeaux de naissance par budget : 20 €, 30 €, 50 € et plus — Mila" },
      {
        name: "description",
        content:
          "Construisez une liste de naissance accueillante avec des idées utiles pour chaque budget et des cadeaux groupés.",
      },
      { property: "og:type", content: "article" },
      { property: "og:title", content: "Répartir les cadeaux de naissance par budget" },
      { property: "og:url", content: buildPublicUrl(path) },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl(path) }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Cadeaux de naissance par budget",
          inLanguage: "fr-BE",
          mainEntityOfPage: buildPublicUrl(path),
          publisher: { "@type": "Organization", name: "Mila", url: buildPublicUrl("/") },
        }),
      },
    ],
  }),
  component: GiftBudgetGuide,
});

const budgets = [
  [
    "Moins de 20 €",
    "Un livre, un lange, un petit textile ou un accessoire consommable demandé par les parents.",
  ],
  [
    "Autour de 30 €",
    "Un lot utile, un jouet d’éveil adapté à l’âge ou une participation à un cadeau plus important.",
  ],
  [
    "Autour de 50 €",
    "Un article du quotidien plus durable, choisi dans la taille ou le modèle indiqué.",
  ],
  [
    "100 € et plus",
    "Un équipement important, idéalement réservé ou financé à plusieurs pour éviter les doublons.",
  ],
] as const;

function GiftBudgetGuide() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-16">
        <header className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground">Guide budget · 5 min</p>
          <h1 className="text-4xl">Des cadeaux accessibles à tous les budgets</h1>
          <p className="text-lg text-muted-foreground">
            Une liste agréable ne suppose jamais combien un proche souhaite dépenser. Elle propose
            des choix utiles à plusieurs prix et permet les cadeaux groupés.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {budgets.map(([title, body]) => (
            <section key={title} className="surface-card p-6">
              <h2 className="text-xl">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>

        <section className="space-y-3">
          <h2 className="text-2xl">Rendre la liste plus simple à parcourir</h2>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Conservez plusieurs articles disponibles dans chaque tranche de prix.</li>
            <li>Expliquez les variantes indispensables, sans surcharger chaque fiche.</li>
            <li>
              Activez une contribution uniquement si son fonctionnement et ses frais sont clairs.
            </li>
            <li>Mettez régulièrement à jour les articles indisponibles ou déjà reçus.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl">Prix, livraison et affiliation</h2>
          <p className="text-muted-foreground">
            Regardez le coût total, y compris la livraison, la disponibilité et le délai. Certains
            liens peuvent rémunérer Mila sans changer le prix payé ; cette affiliation doit être
            signalée et ne constitue pas à elle seule une recommandation.
          </p>
        </section>

        <p>
          <Link to="/guides/liste-naissance" className="font-medium underline">
            Revenir au guide complet de la liste de naissance
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
