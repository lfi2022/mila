import { Link, createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { RelatedReading } from "@/components/marketing/RelatedReading";
import { Button } from "@/components/ui/button";
import { buildPublicUrl } from "@/config/runtime";

const path = "/guides/liste-naissance";

export const Route = createFileRoute("/guides/liste-naissance")({
  head: () => ({
    meta: [
      { title: "Liste de naissance : le guide pratique et gratuit — Mila" },
      {
        name: "description",
        content:
          "Quand créer et partager une liste de naissance, quoi y mettre et comment choisir une liste gratuite et multi-enseignes.",
      },
      { property: "og:type", content: "article" },
      { property: "og:title", content: "Le guide pratique de la liste de naissance" },
      {
        property: "og:description",
        content:
          "Quand créer sa liste de naissance, quoi y mettre et comment proposer des cadeaux adaptés à tous les budgets.",
      },
      { property: "og:url", content: buildPublicUrl(path) },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Le guide pratique de la liste de naissance" },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl(path) }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Liste de naissance : le guide pratique",
          description:
            "Un guide concret pour préparer, organiser et partager une liste de naissance.",
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
              name: "Guide liste de naissance",
              item: buildPublicUrl(path),
            },
          ],
        }),
      },
    ],
  }),
  component: BirthListGuide,
});

function BirthListGuide() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-16">
        <header className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground">Guide pratique · 8 min</p>
          <h1 className="text-4xl sm:text-5xl">Créer une liste de naissance vraiment utile</h1>
          <p className="text-lg text-muted-foreground">
            Une bonne liste aide les proches sans dicter leurs cadeaux. Elle rassemble les besoins,
            évite les doublons et laisse plusieurs budgets possibles.
          </p>
        </header>

        <nav className="surface-card p-6" aria-labelledby="guide-summary">
          <h2 id="guide-summary" className="text-lg">
            Dans ce guide
          </h2>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <li>
              <a href="#quand-creer" className="underline underline-offset-4">
                Quand créer et partager la liste
              </a>
            </li>
            <li>
              <a href="#quoi-mettre" className="underline underline-offset-4">
                Quoi mettre sur la liste
              </a>
            </li>
            <li>
              <a href="#deuxieme-enfant" className="underline underline-offset-4">
                Préparer une liste pour un deuxième enfant
              </a>
            </li>
            <li>
              <a href="#choisir-service" className="underline underline-offset-4">
                Choisir le bon type de liste
              </a>
            </li>
          </ul>
        </nav>

        <section id="quand-creer" className="scroll-mt-24 space-y-3">
          <h2 className="text-2xl">Quand la créer et la partager ?</h2>
          <p className="text-muted-foreground">
            Commencez dès que vos besoins deviennent clairs, puis partagez-la lorsque vous êtes à
            l’aise — souvent quelques mois avant la naissance. Il n’existe pas de date obligatoire.
            Gardez la liste modifiable : les besoins évoluent après les premières semaines.
          </p>
        </section>

        <section id="quoi-mettre" className="scroll-mt-24 space-y-3">
          <h2 className="text-2xl">Que mettre sur la liste ?</h2>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Le quotidien : langes, textiles, soin et petits accessoires.</li>
            <li>Le sommeil : linge adapté et équipement conforme à vos choix.</li>
            <li>Les sorties : portage, poussette et accessoires réellement compatibles.</li>
            <li>Des cadeaux durables : livres, souvenirs et objets pour les mois suivants.</li>
            <li>Quelques envies à moins de 20 €, 30 € et 50 €, plus des cadeaux groupés.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Pour les produits de sécurité, vérifiez toujours les instructions du fabricant, les
            normes applicables et la compatibilité avec votre usage. Un guide général ne remplace
            pas un conseil professionnel.
          </p>
        </section>

        <section id="deuxieme-enfant" className="scroll-mt-24 space-y-3">
          <h2 className="text-2xl">Et pour un deuxième enfant ?</h2>
          <p className="text-muted-foreground">
            Commencez par ce que vous possédez encore, puis listez uniquement les besoins nouveaux :
            consommables, équipement usé, couchage supplémentaire ou articles adaptés à une autre
            saison. Une liste courte et précise aide les proches à offrir quelque chose de vraiment
            utile, sans recréer artificiellement une première liste.
          </p>
        </section>

        <section id="choisir-service" className="scroll-mt-24 space-y-3">
          <h2 className="text-2xl">Gratuite, universelle ou liée à une enseigne ?</h2>
          <p className="text-muted-foreground">
            Une liste multi-enseignes permet de choisir chaque article là où il vous convient et de
            réunir les liens sur une seule page. Comparez aussi la confidentialité, la simplicité de
            réservation, la possibilité d’ajouter de la seconde main et les éventuels frais.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl">Un exemple de liste équilibrée</h2>
          <p className="text-muted-foreground">
            Visez plusieurs catégories et prix, indiquez les quantités utiles et ajoutez une courte
            note seulement quand une taille, une couleur ou un modèle compte vraiment. Relisez la
            liste sur mobile et faites tester le parcours de réservation à un proche.
          </p>
          <Link to="/guides/budget-cadeaux" className="font-medium underline">
            Voir comment répartir les cadeaux par budget
          </Link>
        </section>

        <aside className="surface-card space-y-4 p-7" aria-labelledby="affiliate-disclosure">
          <h2 id="affiliate-disclosure" className="text-xl">
            Transparence des liens
          </h2>
          <p className="text-sm text-muted-foreground">
            Certains liens marchands peuvent être affiliés. Mila peut alors recevoir une commission,
            sans modifier le prix payé. Le classement et les conseils ne doivent jamais dépendre de
            la seule commission.
          </p>
        </aside>

        <div className="text-center">
          <Button asChild size="lg">
            <Link to="/auth">Créer ma liste</Link>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Gratuit · Sans carte bancaire · Réservation sans compte
          </p>
        </div>

        <RelatedReading currentPath={path} />
      </main>
      <SiteFooter />
    </div>
  );
}
