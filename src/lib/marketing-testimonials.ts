export type MarketingTestimonial = {
  firstName: string;
  listType: string;
  context: string;
  quote: string;
  isDemo?: boolean;
};

export const DEMO_TESTIMONIALS: MarketingTestimonial[] = [
  {
    firstName: "Camille",
    listType: "Liste de naissance",
    context: "Exemple de présentation",
    quote:
      "Nous avons réuni les essentiels, quelques trouvailles locales et des idées sans boutique sur la même page.",
    isDemo: true,
  },
  {
    firstName: "Nora",
    listType: "Deuxième enfant",
    context: "Exemple de présentation",
    quote:
      "La famille voyait tout de suite ce qui nous manquait vraiment, sans devoir consulter plusieurs listes.",
    isDemo: true,
  },
  {
    firstName: "Thomas",
    listType: "Coparent",
    context: "Exemple de présentation",
    quote:
      "Nous pouvions compléter la liste ensemble et partager un seul lien avec tous nos proches.",
    isDemo: true,
  },
];
