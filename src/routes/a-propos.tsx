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
          "Pourquoi Mila rassemble les cadeaux de toutes les boutiques sur une liste de naissance simple, libre et transparente.",
      },
      { property: "og:title", content: "À propos de Mila" },
      {
        property: "og:description",
        content:
          "Une liste de naissance ne devrait pas enfermer les futurs parents dans une seule enseigne.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: buildPublicUrl("/a-propos") },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Pourquoi Mila existe" },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl("/a-propos") }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-12 px-4 py-16">
        <header className="max-w-3xl space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
            Pourquoi Mila existe
          </p>
          <h1 className="text-4xl text-balance-pretty sm:text-5xl">
            Une liste de naissance ne devrait pas vous enfermer dans une seule enseigne
          </h1>
          <p className="text-lg text-muted-foreground">
            Une chambre de bébé se prépare rarement dans un seul magasin : la poussette ici, le
            mobilier là, un doudou cousu à la main ailleurs. Pourtant, les parents doivent encore
            souvent choisir entre plusieurs listes difficiles à suivre.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl">Centraliser sans imposer</h2>
          <p className="text-muted-foreground">
            Mila est né de cette idée simple : laisser les parents choisir librement chaque cadeau,
            puis réunir leurs choix sur une page claire. Une grande enseigne, un commerce local, une
            création artisanale ou une idée sans boutique peuvent ainsi cohabiter.
          </p>
          <p className="text-muted-foreground">
            Les proches reçoivent un seul lien. Ils voient ce qui est disponible, réservent sans
            créer de compte, puis achètent auprès du marchand choisi par les parents. Mila facilite
            le partage et aide à éviter les doublons ; il n’impose pas un vendeur unique.
          </p>
        </section>

        <section className="grid gap-5 sm:grid-cols-2" aria-labelledby="principles-title">
          <h2 id="principles-title" className="sr-only">
            Les principes de Mila
          </h2>
          {[
            ["Liberté de choisir", "Des cadeaux de plusieurs boutiques sur une seule liste."],
            ["Simple à partager", "Une page unique, lisible sur mobile comme sur ordinateur."],
            ["Accessible aux proches", "Aucun compte obligatoire pour consulter ou réserver."],
            [
              "Confidentialité choisie",
              "Une liste publique, non répertoriée ou protégée par code.",
            ],
          ].map(([title, body]) => (
            <article key={title} className="surface-card p-6">
              <h3 className="text-lg">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </article>
          ))}
        </section>

        <section className="surface-card space-y-3 p-6 sm:p-8">
          <h2 className="text-2xl">Un modèle gratuit et transparent</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Créer une liste est gratuit. Lorsqu’un proche utilise certains liens marchands, Mila
            peut recevoir une commission d’un réseau d’affiliation. Cette possibilité n’implique pas
            que les enseignes citées sur le site soient des partenaires officiels.
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
          <p className="text-sm text-muted-foreground">
            Lorsqu’un cadeau est acheté auprès d’un marchand tiers, le prix, la livraison, les
            retours et le service après-vente relèvent de ce marchand.
          </p>
        </section>

        <div className="surface-card space-y-4 p-8 text-center">
          <h2 className="text-2xl">Construisez une liste qui vous ressemble</h2>
          <p className="text-sm text-muted-foreground">
            Commencez gratuitement ou parcourez la démonstration avant de vous lancer.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Créer ma liste</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/demo">Voir la démo</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Gratuit · Sans carte bancaire</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
