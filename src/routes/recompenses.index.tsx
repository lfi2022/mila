import { Link, createFileRoute } from "@tanstack/react-router";

import { buildPublicUrl } from "@/config/runtime";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/recompenses/")({
  head: () => ({
    meta: [
      { title: "Récompenses Mila — comment ça fonctionne" },
      {
        name: "description",
        content:
          "Certains achats éligibles réalisés depuis votre liste de naissance peuvent générer des Récompenses Mila. Explication transparente du fonctionnement.",
      },
      { property: "og:title", content: "Récompenses Mila — comment ça fonctionne" },
      {
        property: "og:description",
        content:
          "Vos cadeaux peuvent aussi vous faire des cadeaux : comment les commissions d'affiliation peuvent être partagées avec les parents.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: buildPublicUrl("/recompenses") },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl("/recompenses") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: REWARD_FAQ.map((entry) => ({
            "@type": "Question",
            name: entry.question,
            acceptedAnswer: { "@type": "Answer", text: entry.answer },
          })),
        }),
      },
    ],
  }),
  component: RewardsInfoPage,
});

const STEPS = [
  {
    title: "Vous ajoutez vos cadeaux",
    body: "Vous collez les liens de vos boutiques préférées sur votre liste Mila.",
  },
  {
    title: "Vos proches passent par votre liste",
    body: "En cliquant sur un cadeau, ils sont redirigés vers la boutique du marchand.",
  },
  {
    title: "Certains achats peuvent générer une commission",
    body: "Lorsque la boutique fait partie d'un programme d'affiliation, Mila peut recevoir une commission sur un achat éligible.",
  },
  {
    title: "Mila peut en partager une partie",
    body: "Une part de cette commission peut être ajoutée à vos Récompenses Mila.",
  },
  {
    title: "En attente, puis disponible",
    body: "La récompense apparaît d'abord en attente le temps que la boutique confirme l'achat, puis devient disponible.",
  },
];

export const REWARD_FAQ = [
  {
    question: "Mes proches paient-ils plus cher ?",
    answer:
      "Non. Les proches ne paient jamais plus cher à cause de Mila : ils achètent directement chez le marchand, au prix du marchand.",
  },
  {
    question: "Chaque achat génère-t-il une récompense ?",
    answer:
      "Non. Seuls certains achats, dans certaines boutiques et sous certaines conditions, sont éligibles. Rien n'est garanti et les montants varient.",
  },
  {
    question: "Qu'est-ce qu'un lien affilié ?",
    answer:
      "C'est un lien qui indique à la boutique que la visite vient de Mila. Il ne change ni le prix, ni les conditions de vente. Nous l'utilisons uniquement pour permettre le suivi d'un achat éventuel.",
  },
  {
    question: "Pourquoi ma récompense est-elle « en attente » ?",
    answer:
      "Les boutiques confirment les commandes après leurs délais de retour. Tant que l'achat n'est pas confirmé, la récompense reste en attente et peut être annulée (retour, annulation).",
  },
  {
    question: "Comment récupérer mes récompenses ?",
    answer:
      "Depuis l'espace Récompenses de votre liste, une fois le montant disponible et le seuil atteint, vous pouvez demander leur utilisation. Nous vous guidons à ce moment-là.",
  },
];

function RewardsInfoPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Récompenses Mila</p>
          <h1 className="mt-5 text-4xl text-balance-pretty">
            Vos cadeaux peuvent aussi vous faire des cadeaux. ❤️
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance-pretty text-muted-foreground">
            Certains achats éligibles réalisés depuis votre liste peuvent générer des Récompenses
            Mila. Lorsque Mila reçoit une commission sur un achat éligible, une partie peut être
            ajoutée à vos récompenses.
          </p>
        </section>

        <section className="border-y border-border/70 bg-cream/60">
          <div className="mx-auto max-w-4xl px-4 py-16">
            <h2 className="text-3xl">Comment ça fonctionne</h2>
            <ol className="mt-8 space-y-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="surface-card flex gap-4 p-5">
                  <span className="font-display text-2xl text-accent">0{index + 1}</span>
                  <div>
                    <h3 className="text-lg">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-3xl">Questions fréquentes</h2>
          <Accordion type="single" collapsible className="mt-6">
            {REWARD_FAQ.map((entry) => (
              <AccordionItem key={entry.question} value={entry.question}>
                <AccordionTrigger className="text-left text-base">
                  {entry.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {entry.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="surface-card mt-12 space-y-4 p-8 text-center">
            <h2 className="text-2xl">Commencez par votre liste</h2>
            <p className="text-sm text-muted-foreground">
              Les récompenses sont un bonus : le cœur de Mila reste votre liste, libre et
              multi-boutiques.
            </p>
            <Button asChild size="lg">
              <Link to="/auth">Créer ma liste gratuitement</Link>
            </Button>
            <p className="text-xs text-muted-foreground">Gratuit · Sans carte bancaire</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
