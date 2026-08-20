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
import { visibleFaqEntries } from "@/lib/faq-content";
import { runtimeConfig } from "@/config/runtime";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "Questions fréquentes — Mila" },
      {
        name: "description",
        content:
          "Réponses claires sur la liste de naissance Mila : achat, réservation, boutiques, prix, commission, confidentialité et suppression.",
      },
      { property: "og:title", content: "Questions fréquentes — Mila" },
      {
        property: "og:description",
        content:
          "Achat auprès des marchands, réservations sans compte, prix et confidentialité : toutes les réponses utiles.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: buildPublicUrl("/faq") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Questions fréquentes sur Mila" },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl("/faq") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: visibleFaqEntries(runtimeConfig.rewardsPremiumUiEnabled).map((entry) => ({
            "@type": "Question",
            name: entry.question,
            acceptedAnswer: { "@type": "Answer", text: entry.answer },
          })),
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl sm:text-5xl">Questions fréquentes</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Comment fonctionne une réservation ? Où le cadeau est-il acheté ? Retrouvez des réponses
          courtes sur le parcours Mila.
        </p>
        <p className="mt-4 text-muted-foreground">
          Une question qui n'est pas ici ? Écrivez-nous depuis la page{" "}
          <Link to="/contact" className="underline">
            contact
          </Link>
          .
        </p>

        <Accordion type="single" collapsible className="mt-10">
          {visibleFaqEntries(runtimeConfig.rewardsPremiumUiEnabled).map((entry) => (
            <AccordionItem key={entry.question} value={entry.question}>
              <AccordionTrigger className="text-left text-base">{entry.question}</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {entry.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="surface-card mt-12 space-y-4 p-8 text-center">
          <h2 className="text-2xl">Prêts à réunir toutes vos idées ?</h2>
          <Button asChild size="lg">
            <Link to="/auth">Créer ma liste</Link>
          </Button>
          <p className="text-xs text-muted-foreground">Gratuit · Sans carte bancaire</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
