/** Shared FAQ copy used by the homepage and the dedicated /faq page. */
export type FaqEntry = { question: string; answer: string };

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: "Mila est-il gratuit ?",
    answer:
      "Oui. Créer, personnaliser et partager une liste est gratuit, sans carte bancaire. Si des options payantes sont proposées plus tard, leur prix sera indiqué avant toute commande.",
  },
  {
    question: "Est-ce que Mila vend les cadeaux ?",
    answer:
      "Non, pas pour les articles ajoutés depuis une boutique. Mila rassemble la liste et les réservations ; l'achat est conclu directement avec le magasin ou le site marchand concerné.",
  },
  {
    question: "Comment acheter un cadeau réservé ?",
    answer:
      "Après avoir réservé, le proche suit le lien du cadeau et finalise son achat auprès du marchand. Une réservation Mila signale son intention aux autres visiteurs, mais ne constitue pas elle-même un achat.",
  },
  {
    question: "Mila prend-il une commission ?",
    answer:
      "Créer et réserver une liste n'entraîne pas de commission facturée par Mila. Certains liens marchands peuvent être affiliés : Mila peut alors recevoir une commission du réseau concerné. Le prix et les conditions affichés par le marchand au moment de l'achat font foi.",
  },
  {
    question: "Puis-je ajouter des cadeaux provenant de plusieurs magasins ?",
    answer:
      "Oui, c'est le cœur de Mila. Collez les liens de différentes boutiques dans une seule liste, qu'il s'agisse de grandes enseignes, de magasins locaux ou d'autres sites.",
  },
  {
    question: "Puis-je ajouter une idée sans boutique particulière ?",
    answer:
      "Oui. Un cadeau peut être créé manuellement avec un titre, une description et, si utile, un prix indicatif. Aucun lien marchand n'est obligatoire.",
  },
  {
    question: "Mes proches doivent-ils créer un compte ?",
    answer:
      "Non. Consulter une liste et réserver un cadeau se fait sans compte. Un prénom suffit ; l'email facultatif permet notamment de retrouver et gérer la réservation.",
  },
  {
    question: "Comment Mila évite-t-il les doublons ?",
    answer:
      "Lorsqu'un proche réserve un cadeau, sa disponibilité est mise à jour pour les visiteurs suivants. Les quantités sont prises en compte afin d'empêcher plus de réservations que prévu.",
  },
  {
    question: "Que se passe-t-il si le prix d'un article change ?",
    answer:
      "Mila peut actualiser certains prix lorsque la boutique le permet, mais le prix et la disponibilité affichés par le marchand au moment de l'achat font toujours foi.",
  },
  {
    question: "Puis-je masquer les cadeaux réservés ?",
    answer:
      "Oui. Les parents peuvent laisser un cadeau visible comme réservé ou le masquer de la page publique. Ils choisissent aussi si le nom de la personne qui l'a réservé est affiché.",
  },
  {
    question: "Puis-je supprimer ma liste ou mon compte ?",
    answer:
      "Oui. Une liste peut être supprimée depuis son espace de gestion et le compte depuis le profil. Certaines données peuvent être conservées pendant la durée strictement nécessaire aux obligations décrites dans la politique de confidentialité.",
  },
  {
    question: "Est-ce que mes données personnelles sont revendues ?",
    answer:
      "Non. Mila ne vend pas les données personnelles de ses utilisateurs. Les traitements, prestataires nécessaires et droits d'accès, d'export ou d'effacement sont détaillés dans la politique de confidentialité.",
  },
  {
    question: "Comment fonctionnent les Récompenses Mila ?",
    answer:
      "Certains achats éligibles réalisés depuis votre liste peuvent générer une commission pour Mila, et une partie peut être ajoutée à vos Récompenses Mila. Elles apparaissent d'abord en attente, puis deviennent disponibles après confirmation. Rien n'est garanti : tout dépend de la boutique et de l'achat.",
  },
  {
    question: "Puis-je rendre ma liste privée ?",
    answer:
      "Oui. Votre liste peut être publique, non répertoriée (accessible uniquement via son lien) ou protégée par un code d'accès que vous partagez à vos proches. Vous pouvez changer d'avis à tout moment.",
  },
];

export function visibleFaqEntries(rewardsPremiumEnabled: boolean): FaqEntry[] {
  return rewardsPremiumEnabled
    ? FAQ_ENTRIES
    : FAQ_ENTRIES.filter((entry) => !entry.question.includes("Récompenses Mila"));
}
