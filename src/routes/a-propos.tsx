import { Link, createFileRoute } from "@tanstack/react-router";

import { buildPublicUrl } from "@/config/runtime";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { runtimeConfig } from "@/config/runtime";

export const Route = createFileRoute("/a-propos")({
  head: () => ({
    meta: [
      { title: "À propos de Mila — la liste de naissance universelle" },
      {
        name: "description",
        content:
          "Pourquoi nous avons créé Mila : une liste de naissance qui rassemble toutes les boutiques, sans obliger vos proches à créer un compte.",
      },
      { property: "og:title", content: "À propos de Mila" },
      {
        property: "og:description",
        content:
          "L'histoire de Mila : une liste de naissance douce, universelle et respectueuse de vos données.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: buildPublicUrl("/a-propos") },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl("/a-propos") }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-16">
        <h1 className="text-4xl">Mila, la liste qui vous ressemble</h1>
        <p className="text-lg text-muted-foreground">
          La plupart des listes de naissance obligent à choisir un seul magasin. Or une chambre de
          bébé se construit rarement dans une seule enseigne : la poussette ici, le mobilier là, un
          doudou cousu à la main ailleurs.
        </p>

        <section className="space-y-3">
          <h2 className="text-2xl">Ce que nous voulions</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>· Une seule page à partager, quelle que soit la boutique.</li>
            <li>· Aucune inscription imposée aux proches.</li>
            <li>· Une liste jolie, personnalisable, qui ressemble à la famille qui l'a créée.</li>
            <li>· Des réglages de confidentialité clairs, choisis par les parents.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl">Comment Mila se finance</h2>
          <p className="text-sm text-muted-foreground">
            Créer une liste est gratuit. Lorsqu'un proche passe par un lien de votre liste vers
            certaines boutiques partenaires des réseaux d'affiliation, Mila peut recevoir une
            commission — sans que le prix payé change.
            {runtimeConfig.rewardsPremiumUiEnabled ? (
              <>
                {" "}
                Une partie de cette commission peut être reversée aux parents via les{" "}
                <Link to="/recompenses" className="underline">
                  Récompenses Mila
                </Link>
                .
              </>
            ) : null}
          </p>
        </section>

        <div className="surface-card space-y-4 p-8 text-center">
          <h2 className="text-2xl">Envie d'essayer ? ❤️</h2>
          <Button asChild size="lg">
            <Link to="/auth">Créer ma liste gratuitement</Link>
          </Button>
          <p className="text-xs text-muted-foreground">Gratuit · Sans carte bancaire</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
