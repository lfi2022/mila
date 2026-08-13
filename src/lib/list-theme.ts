import type { CSSProperties } from "react";

/** Appearance options a parent can pick for their list (browser-safe, no server imports). */

export type ThemeId = "blush" | "sauge" | "terracotta" | "nuit" | "or" | "ciel";
export type HeroStyle = "soft" | "cover" | "minimal";
export type FontPair = "baloo" | "serif" | "moderne";
export type ListLayout = "grid" | "list" | "magazine";

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  description: string;
  swatches: [string, string, string];
  vars: Record<string, string>;
};

export const LIST_THEMES: ThemeDefinition[] = [
  {
    id: "blush",
    label: "Blush",
    description: "Rose poudré et encre marine — l'univers Mila.",
    swatches: ["#fdf3f1", "#f7b0a0", "#2e3a5c"],
    vars: {
      "--background": "#fffaf9",
      "--foreground": "#2e3a5c",
      "--card": "#ffffff",
      "--card-foreground": "#2e3a5c",
      "--primary": "#2e3a5c",
      "--primary-foreground": "#fffaf9",
      "--secondary": "#fdeae6",
      "--secondary-foreground": "#2e3a5c",
      "--muted": "#fdf3f1",
      "--muted-foreground": "#6f7590",
      "--accent": "#f7b0a0",
      "--accent-foreground": "#2e3a5c",
      "--border": "#f4ddd7",
      "--input": "#f4ddd7",
      "--ring": "#f7b0a0",
    },
  },
  {
    id: "sauge",
    label: "Sauge",
    description: "Vert doux et lin, très naturel.",
    swatches: ["#f4f7f2", "#a8c0a0", "#33463a"],
    vars: {
      "--background": "#f7faf6",
      "--foreground": "#2c3d33",
      "--card": "#ffffff",
      "--card-foreground": "#2c3d33",
      "--primary": "#4a6b53",
      "--primary-foreground": "#f7faf6",
      "--secondary": "#e6efe3",
      "--secondary-foreground": "#2c3d33",
      "--muted": "#eef4ec",
      "--muted-foreground": "#5f7266",
      "--accent": "#a8c0a0",
      "--accent-foreground": "#2c3d33",
      "--border": "#dde8d9",
      "--input": "#dde8d9",
      "--ring": "#a8c0a0",
    },
  },
  {
    id: "terracotta",
    label: "Terracotta",
    description: "Argile chaude et crème, chaleureux.",
    swatches: ["#faf4ee", "#c4654a", "#4a3229"],
    vars: {
      "--background": "#fdf8f3",
      "--foreground": "#4a3229",
      "--card": "#ffffff",
      "--card-foreground": "#4a3229",
      "--primary": "#b5643f",
      "--primary-foreground": "#fdf8f3",
      "--secondary": "#f6e7dc",
      "--secondary-foreground": "#4a3229",
      "--muted": "#f7efe7",
      "--muted-foreground": "#7c6255",
      "--accent": "#e0a887",
      "--accent-foreground": "#4a3229",
      "--border": "#eddfd3",
      "--input": "#eddfd3",
      "--ring": "#c4654a",
    },
  },
  {
    id: "nuit",
    label: "Nuit douce",
    description: "Fond profond, texte clair, très élégant.",
    swatches: ["#1c2237", "#f7b0a0", "#f4f6fb"],
    vars: {
      "--background": "#1b2134",
      "--foreground": "#f2f4fa",
      "--card": "#242b41",
      "--card-foreground": "#f2f4fa",
      "--primary": "#f7b0a0",
      "--primary-foreground": "#1b2134",
      "--secondary": "#2c3450",
      "--secondary-foreground": "#f2f4fa",
      "--muted": "#262e46",
      "--muted-foreground": "#aeb5cc",
      "--accent": "#f7b0a0",
      "--accent-foreground": "#1b2134",
      "--border": "#343d59",
      "--input": "#343d59",
      "--ring": "#f7b0a0",
    },
  },
  {
    id: "or",
    label: "Or & ivoire",
    description: "Ivoire et doré, pour une touche précieuse.",
    swatches: ["#fbf7ef", "#c9a84c", "#3a3427"],
    vars: {
      "--background": "#fdfaf3",
      "--foreground": "#3a3427",
      "--card": "#ffffff",
      "--card-foreground": "#3a3427",
      "--primary": "#8c7327",
      "--primary-foreground": "#fdfaf3",
      "--secondary": "#f6eeda",
      "--secondary-foreground": "#3a3427",
      "--muted": "#f8f2e5",
      "--muted-foreground": "#6f6650",
      "--accent": "#c9a84c",
      "--accent-foreground": "#3a3427",
      "--border": "#ece1c8",
      "--input": "#ece1c8",
      "--ring": "#c9a84c",
    },
  },
  {
    id: "ciel",
    label: "Ciel",
    description: "Bleu clair et blanc, frais et léger.",
    swatches: ["#f2f8fd", "#8ec5e8", "#1f3b52"],
    vars: {
      "--background": "#f6fbff",
      "--foreground": "#1f3b52",
      "--card": "#ffffff",
      "--card-foreground": "#1f3b52",
      "--primary": "#2e6b8a",
      "--primary-foreground": "#f6fbff",
      "--secondary": "#e2f0fa",
      "--secondary-foreground": "#1f3b52",
      "--muted": "#edf5fc",
      "--muted-foreground": "#54718a",
      "--accent": "#8ec5e8",
      "--accent-foreground": "#1f3b52",
      "--border": "#d8e8f4",
      "--input": "#d8e8f4",
      "--ring": "#8ec5e8",
    },
  },
];

export const HERO_STYLES: { id: HeroStyle; label: string; description: string }[] = [
  { id: "soft", label: "Douce", description: "Bandeau coloré avec la photo en médaillon." },
  { id: "cover", label: "Photo pleine largeur", description: "La photo occupe tout le haut de la page." },
  { id: "minimal", label: "Minimale", description: "Juste le titre, sans fond coloré." },
];

export const FONT_PAIRS: { id: FontPair; label: string; display: string; body: string }[] = [
  { id: "baloo", label: "Ronde & douce", display: '"Baloo 2", ui-serif, Georgia, serif', body: '"Manrope", system-ui, sans-serif' },
  { id: "serif", label: "Élégante", display: '"Fraunces", ui-serif, Georgia, serif', body: '"Manrope", system-ui, sans-serif' },
  { id: "moderne", label: "Moderne", display: '"Outfit", system-ui, sans-serif', body: '"Outfit", system-ui, sans-serif' },
];

export const LIST_LAYOUTS: { id: ListLayout; label: string; description: string }[] = [
  { id: "grid", label: "Grille", description: "Trois cadeaux par ligne, la vue classique." },
  { id: "list", label: "Liste", description: "Un cadeau par ligne, idéal sur mobile." },
  { id: "magazine", label: "Magazine", description: "Grandes cartes en deux colonnes." },
];

export type ListAppearance = {
  theme?: string | null;
  accent_color?: string | null;
  hero_style?: string | null;
  font_pair?: string | null;
  layout?: string | null;
  show_progress?: boolean | null;
};

export function getTheme(id?: string | null): ThemeDefinition {
  return LIST_THEMES.find((theme) => theme.id === id) ?? LIST_THEMES[0]!;
}

export function getFontPair(id?: string | null) {
  return FONT_PAIRS.find((pair) => pair.id === id) ?? FONT_PAIRS[0]!;
}

export function getLayout(id?: string | null): ListLayout {
  return (LIST_LAYOUTS.find((layout) => layout.id === id)?.id ?? "grid") as ListLayout;
}

export function getHeroStyle(id?: string | null): HeroStyle {
  return (HERO_STYLES.find((hero) => hero.id === id)?.id ?? "soft") as HeroStyle;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Inline CSS variables that re-theme any subtree using the design tokens. */
export function appearanceStyle(appearance: ListAppearance): CSSProperties {
  const theme = getTheme(appearance.theme);
  const font = getFontPair(appearance.font_pair);
  const vars: Record<string, string> = {
    ...theme.vars,
    "--font-display-family": font.display,
    "--font-sans-family": font.body,
  };
  if (appearance.accent_color && HEX.test(appearance.accent_color)) {
    vars["--accent"] = appearance.accent_color;
    vars["--ring"] = appearance.accent_color;
  }
  return vars as CSSProperties;
}

export const LAYOUT_CLASSES: Record<ListLayout, string> = {
  grid: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3",
  list: "grid gap-4",
  magazine: "grid gap-8 md:grid-cols-2",
};
