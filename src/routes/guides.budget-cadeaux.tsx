import { Link, createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { RelatedReading } from "@/components/marketing/RelatedReading";
import { Button } from "@/components/ui/button";
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
      {
        property: "og:description",
        content:
          "Des idées de cadeaux de naissance utiles à moins de 20 €, autour de 30 €, 50 € et plus.",
      },
      { property: "og:url", content: buildPublicUrl(path) },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Cadeaux de naissance pour tous les budgets" },
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
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Accueil", item: buildPublicUrl("/") },
            {
              "@type": "ListItem",
              position: 2,
              name: "Guide des budgets cadeaux",
              item: buildPublicUrl(path),
            },
          ],
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
          <h1 className="text-4xl sm:text-5xl">Des cadeaux accessibles à tous les budgets</h1>
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

        <div className="surface-card space-y-4 p-7 text-center">
          <h2 className="text-2xl">Réunissez toutes ces idées sur une seule liste</h2>
          <p className="text-sm text-muted-foreground">
            Ajoutez des cadeaux de plusieurs boutiques et laissez à chacun le choix de son budget.
          </p>
          <Button asChild size="lg">
            <Link to="/auth">Créer ma liste</Link>
          </Button>
          <p className="text-xs text-muted-foreground">Gratuit · Sans carte bancaire</p>
        </div>

        <RelatedReading currentPath={path} />
      </main>
      <SiteFooter />
    </div>
  );
}
