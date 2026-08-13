import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import heroImage from "@/assets/hero-nursery.jpg";
import { ListPreviewMockup } from "@/components/ListPreviewMockup";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";
import { FAQ_ENTRIES } from "@/lib/faq-content";
import { buildPublicUrl } from "@/config/runtime";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mila — liste de naissance en ligne, gratuite et multi-magasins" },
      {
        name: "description",
        content:
          "Créez une liste de naissance universelle et gratuite : ajoutez les cadeaux de tous vos magasins, partagez un seul lien et évitez les doublons.",
      },
      {
        property: "og:title",
        content: "Mila — liste de naissance en ligne, gratuite et multi-magasins",
      },
      {
        property: "og:description",
        content:
          "Tous les magasins. Une seule liste. Vos proches réservent en un clic, sans créer de compte.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: buildPublicUrl("/") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl("/") }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_ENTRIES.slice(0, 6).map((entry) => ({
            "@type": "Question",
            name: entry.question,
            acceptedAnswer: { "@type": "Answer", text: entry.answer },
          })),
        }),
      },
    ],
  }),
  component: Index,
});

const STEPS = [
  {
    icon: "✨",
    title: "Créez votre liste",
    body: "Personnalisez votre liste en quelques minutes : photo, couleurs, mot d'accueil.",
  },
  {
    icon: "🔗",
    title: "Ajoutez toutes vos envies",
    body: "Collez les liens de vos magasins préférés. Mila rassemble tout au même endroit.",
  },
  {
    icon: "💌",
    title: "Partagez avec vos proches",
    body: "Un seul lien à envoyer. Aucun compte nécessaire pour consulter ou réserver.",
  },
];

const ADVANTAGES = [
  { icon: "🛍️", title: "Tous vos magasins", body: "Ne soyez plus limité à une seule enseigne." },
  {
    icon: "🎁",
    title: "Fini les doublons",
    body: "Les cadeaux réservés sont immédiatement indiqués.",
  },
  {
    icon: "👨‍👩‍👧",
    title: "Simple pour toute la famille",
    body: "Vos proches n'ont pas besoin de créer un compte.",
  },
  {
    icon: "❤️",
    title: "Des récompenses pour les parents",
    body: "Certains achats éligibles peuvent alimenter vos Récompenses Mila.",
  },
];

const TRUST = [
  { icon: "🔒", title: "Contrôlez la confidentialité de votre liste" },
  { icon: "👨‍👩‍👧", title: "Aucun compte obligatoire pour vos proches" },
  { icon: "🛍️", title: "Choisissez librement vos magasins" },
  { icon: "🇪🇺", title: "Une plateforme pensée pour la vie privée en Europe" },
];

function Index() {
  const { user } = useAuth();

  useEffect(() => {
    track("homepage_view");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        {/* 1 — Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">
              Liste de naissance en ligne
            </p>
            <h1 className="mt-5 text-5xl leading-[1.05] text-balance-pretty">
              Tous les magasins. Une seule liste. Pour un moment unique. ❤️
            </h1>
            <p className="mt-6 max-w-lg text-balance-pretty text-lg text-muted-foreground">
              Ajoutez les cadeaux de vos magasins préférés, partagez une seule liste avec vos
              proches et évitez les cadeaux en double.
            </p>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground">
              Amazon, IKEA, Vertbaudet, petites boutiques… Mila rassemble tout au même endroit.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="min-h-12"
                onClick={() => track("signup_cta_clicked", { location: "hero" })}
              >
                <Link to={user ? "/dashboard" : "/auth"}>
                  {user ? "Voir mes listes" : "Créer ma liste gratuitement"}
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-12"
                onClick={() => track("demo_clicked", { location: "hero" })}
              >
                <Link to="/demo">Voir une liste de démonstration</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Gratuit · Sans carte bancaire · Vos proches n'ont pas besoin de compte
            </p>
          </div>

          {/* 2 — Aperçu d'une vraie liste */}
          <ListPreviewMockup />
        </section>

        {/* 3 — Comment ça marche */}
        <section
          id="comment-ca-marche"
          className="scroll-mt-20 border-y border-border/70 bg-cream/60"
        >
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-3xl">Comment ça marche</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Trois étapes, quelques minutes, et votre liste est prête à circuler dans la famille.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <article key={step.title} className="surface-card p-6">
                  <span aria-hidden="true" className="text-2xl">
                    {step.icon}
                  </span>
                  <p className="font-display mt-2 text-sm text-accent">Étape {index + 1}</p>
                  <h3 className="mt-1 text-xl">{step.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
                </article>
              ))}
            </div>
            <p className="mt-8 max-w-2xl text-sm text-muted-foreground">
              Collez simplement le lien d'un produit. Mila s'occupe du reste.{" "}
              <span className="text-xs">
                Lorsque c'est possible, Mila récupère automatiquement le nom, l'image et le prix du
                produit. Vous pouvez ensuite tout modifier.
              </span>
            </p>
          </div>
        </section>

        {/* 4 — Liste universelle */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl">Une liste vraiment universelle</h2>
              <p className="mt-5 text-muted-foreground text-balance-pretty">
                La poussette chez Amazon, le mobilier chez IKEA, un doudou dans une petite boutique
                et une création artisanale ailleurs ? Aucun problème. Tout peut vivre dans la même
                liste Mila.
              </p>
              <p className="font-display mt-6 text-2xl text-accent">Un lien. Tous vos cadeaux.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  "Amazon",
                  "IKEA",
                  "Vertbaudet",
                  "H&M",
                  "Petites boutiques",
                  "Cadeau fait main",
                ].map((store) => (
                  <Badge key={store} variant="secondary" className="text-xs">
                    {store}
                  </Badge>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Marques citées à titre d'exemple : Mila n'est pas affilié officiellement à ces
                enseignes.
              </p>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-accent/20 blur-2xl" />
              <img
                src={heroImage}
                alt="Chambre de bébé aux tons crème et terracotta avec berceau en lin"
                width={1600}
                height={1200}
                loading="lazy"
                decoding="async"
                className="w-full rounded-3xl border border-border object-cover shadow-lift"
              />
            </div>
          </div>
        </section>

        {/* 5 — Pourquoi Mila */}
        <section className="border-y border-border/70 bg-cream/60">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-3xl">Pourquoi Mila ?</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {ADVANTAGES.map((item) => (
                <article key={item.title} className="surface-card flex gap-4 p-6">
                  <span aria-hidden="true" className="text-2xl">
                    {item.icon}
                  </span>
                  <div>
                    <h3 className="text-lg">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 6 — Récompenses Mila */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl text-balance-pretty">
                Vos cadeaux peuvent aussi vous faire des cadeaux. ❤️
              </h2>
              <p className="mt-5 text-muted-foreground">
                Certains achats éligibles réalisés depuis votre liste peuvent générer des
                Récompenses Mila. Lorsque Mila reçoit une commission sur un achat éligible, une
                partie peut être ajoutée à vos récompenses.
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-6 min-h-11"
                onClick={() => track("rewards_learn_more_clicked", { location: "homepage" })}
              >
                <Link to="/recompenses">Comment fonctionnent les Récompenses Mila ?</Link>
              </Button>
            </div>

            <div aria-hidden="true" className="surface-card p-6">
              <p className="text-sm text-muted-foreground">Vos Récompenses Mila</p>
              <p className="font-display mt-1 text-4xl">16,70 €</p>
              <p className="text-sm text-muted-foreground">disponibles · +4,20 € en attente</p>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
                  <span>Achat éligible</span>
                  <span className="font-medium">+1,50 €</span>
                </li>
                <li className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
                  <span>Parrainage</span>
                  <span className="font-medium">+3,00 €</span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Exemple visuel — montants fictifs.
              </p>
            </div>
          </div>
        </section>

        {/* 7 — Confiance */}
        <section className="border-y border-border/70 bg-cream/60">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-3xl">Votre liste. Votre famille. Vos données. ❤️</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST.map((item) => (
                <div key={item.title} className="surface-card p-5">
                  <span aria-hidden="true" className="text-2xl">
                    {item.icon}
                  </span>
                  <p className="mt-2 text-sm">{item.title}</p>
                </div>
              ))}
            </div>
            <div className="surface-card mt-8 p-6">
              <h3 className="text-lg">Vous choisissez qui peut voir votre liste</h3>
              <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <li>· Liste publique</li>
                <li>· Liste non répertoriée (lien uniquement)</li>
                <li>· Liste protégée par un code d'accès</li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Pensé avec la protection de vos données dès la conception.{" "}
                <Link to="/confidentialite" className="underline">
                  Voir la politique de confidentialité
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* 8 — FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-3xl">Questions fréquentes</h2>
          <Accordion type="single" collapsible className="mt-6">
            {FAQ_ENTRIES.slice(0, 6).map((entry) => (
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
          <p className="mt-6 text-sm">
            <Link to="/faq" className="underline">
              Voir toutes les questions
            </Link>
          </p>
        </section>

        {/* 9 — CTA final */}
        <section className="border-t border-border/70 bg-secondary/40">
          <div className="mx-auto max-w-2xl px-4 py-20 text-center">
            <h2 className="text-4xl text-balance-pretty">Prêts à créer votre liste ? ❤️</h2>
            <p className="mt-4 text-muted-foreground">
              Quelques minutes suffisent pour réunir toutes vos envies au même endroit.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-8 min-h-12"
              onClick={() => track("signup_cta_clicked", { location: "final_cta" })}
            >
              <Link to={user ? "/dashboard" : "/auth"}>
                {user ? "Voir mes listes" : "Créer ma liste gratuitement"}
              </Link>
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">Gratuit · Sans carte bancaire</p>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
