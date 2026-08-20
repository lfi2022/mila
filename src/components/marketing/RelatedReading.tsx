import { Link } from "@tanstack/react-router";

const ARTICLES = [
  {
    path: "/guides/liste-naissance" as const,
    title: "Créer une liste de naissance vraiment utile",
    description: "Quand la commencer, quoi ajouter et comment la partager sereinement.",
  },
  {
    path: "/guides/budget-cadeaux" as const,
    title: "Des idées pour tous les budgets",
    description: "Construire une liste accueillante, des petits cadeaux aux achats groupés.",
  },
  {
    path: "/faq" as const,
    title: "Comprendre le parcours Mila",
    description: "Réservation, achat chez le marchand, prix, confidentialité et suppression.",
  },
];

export function RelatedReading({ currentPath }: { currentPath?: string }) {
  const articles = ARTICLES.filter((article) => article.path !== currentPath);

  return (
    <aside aria-labelledby="related-reading-title" className="border-t pt-8">
      <h2 id="related-reading-title" className="text-2xl">
        À lire ensuite
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {articles.map((article) => (
          <Link
            key={article.path}
            to={article.path}
            className="surface-card block p-5 transition-transform motion-safe:hover:-translate-y-0.5"
          >
            <span className="font-display text-lg">{article.title}</span>
            <span className="mt-2 block text-sm text-muted-foreground">{article.description}</span>
            <span className="mt-4 inline-block text-sm font-medium underline underline-offset-4">
              Lire le guide
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
