/** Shared FAQ copy used by the homepage and the dedicated /faq page. */
export type FaqEntry = { question: string; answer: string };

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: "Mila est-il gratuit ?",
    answer:
      "Oui. Créer une liste, ajouter autant de cadeaux que vous voulez, personnaliser votre page et la partager est gratuit, sans carte bancaire. Des options supplémentaires pourront être proposées plus tard, mais l'usage décrit ici reste gratuit.",
  },
  {
    question: "Puis-je ajouter des cadeaux provenant de plusieurs magasins ?",
    answer:
      "Oui, c'est le cœur de Mila. Vous collez le lien d'un produit de n'importe quelle boutique, et vous pouvez aussi créer un cadeau à la main (une idée, un cadeau artisanal, un service…).",
  },
  {
    question: "Mes proches doivent-ils créer un compte ?",
    answer:
      "Non. Consulter votre liste et réserver un cadeau se fait sans compte : un prénom et, si la personne le souhaite, un email pour retrouver sa réservation.",
  },
  {
    question: "Que se passe-t-il lorsqu'un cadeau est réservé ?",
    answer:
      "Par défaut le cadeau reste visible sur votre liste, marqué « Déjà réservé », et il ne peut plus être réservé par quelqu'un d'autre. Vous, côté parents, voyez qui a réservé et son message.",
  },
  {
    question: "Puis-je masquer les cadeaux réservés ?",
    answer:
      "Oui. Dans les réglages de votre liste, l'option « Lorsqu'un cadeau est réservé » vous laisse choisir entre l'afficher comme réservé (par défaut) ou le masquer complètement de la page publique.",
  },
  {
    question: "Comment fonctionnent les Récompenses Mila ?",
    answer:
      "Certains achats éligibles réalisés depuis votre liste peuvent générer une commission pour Mila, et une partie peut être ajoutée à vos Récompenses Mila. Elles apparaissent d'abord en attente, puis deviennent disponibles après confirmation. Rien n'est garanti : tout dépend de la boutique et de l'achat.",
  },
  {
    question: "Mila augmente-t-il le prix des produits ?",
    answer:
      "Non. Vos proches achètent directement auprès du marchand, aux conditions du marchand. Mila ne modifie jamais le prix.",
  },
  {
    question: "Puis-je rendre ma liste privée ?",
    answer:
      "Oui. Votre liste peut être publique, non répertoriée (accessible uniquement via son lien) ou protégée par un code d'accès que vous partagez à vos proches. Vous pouvez changer d'avis à tout moment.",
  },
];
