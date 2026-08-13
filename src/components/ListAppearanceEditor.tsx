import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { uploadListCover } from "@/features/storage/api";
import {
  FONT_PAIRS,
  HERO_STYLES,
  LIST_LAYOUTS,
  LIST_THEMES,
  appearanceStyle,
  getFontPair,
  getHeroStyle,
  getTheme,
  type FontPair,
  type HeroStyle,
  type ListLayout,
  type ListAppearance,
  type ThemeId,
} from "@/lib/list-theme";

export type AppearancePatch = {
  theme?: ThemeId;
  accent_color?: string | null;
  hero_style?: HeroStyle;
  font_pair?: FontPair;
  layout?: ListLayout;
  show_progress?: boolean;
  cover_image_url?: string | null;
};

type Props = {
  registryId: string;
  list: ListAppearance & {
    title: string;
    baby_name: string | null;
    cover_image_url: string | null;
  };
  onChange: (patch: AppearancePatch) => void;
  onCoverUploaded: () => void;
};

export function ListAppearanceEditor({ registryId, list, onChange, onCoverUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [customColor, setCustomColor] = useState(
    list.accent_color ?? getTheme(list.theme).swatches[1],
  );

  const heroStyle = getHeroStyle(list.hero_style);

  const pickFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (5 Mo maximum).");
      return;
    }
    setBusy(true);
    try {
      await uploadListCover(registryId, file);
      toast.success("Photo envoyée, analyse de sécurité en cours");
      onCoverUploaded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi impossible");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-8">
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-xl">Photo de couverture</h2>
            <p className="text-sm text-muted-foreground">
              Une échographie, une photo de la chambre, un faire-part… JPEG, PNG ou WebP, 5 Mo max.
            </p>
          </div>
          {list.cover_image_url ? (
            <img
              src={list.cover_image_url}
              alt="Couverture de la liste"
              className="h-40 w-full rounded-xl border object-cover"
            />
          ) : (
            <div className="flex h-40 w-full items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              Aucune photo pour l'instant
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void pickFile(file);
              }}
            />
            <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? "Envoi…" : list.cover_image_url ? "Changer la photo" : "Ajouter une photo"}
            </Button>
            {list.cover_image_url ? (
              <Button variant="ghost" onClick={() => onChange({ cover_image_url: null })}>
                Retirer
              </Button>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="font-display text-xl">Thème de couleurs</h2>
            <p className="text-sm text-muted-foreground">Il habille toute votre page publique.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {LIST_THEMES.map((theme) => {
              const active = getTheme(list.theme).id === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onChange({ theme: theme.id })}
                  className={`rounded-xl border p-3 text-left transition ${
                    active ? "border-primary ring-2 ring-ring/60" : "hover:border-primary/40"
                  }`}
                >
                  <span className="flex gap-1">
                    {theme.swatches.map((color) => (
                      <span
                        key={color}
                        className="h-6 w-6 rounded-full border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  <span className="mt-2 block text-sm font-medium">{theme.label}</span>
                  <span className="block text-xs text-muted-foreground">{theme.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="font-display text-xl">Couleur d'accent personnalisée</h2>
            <p className="text-sm text-muted-foreground">
              Optionnel : remplacez la couleur d'accent du thème par la vôtre.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="accent">Couleur</Label>
              <Input
                id="accent"
                type="color"
                value={customColor}
                onChange={(event) => {
                  setCustomColor(event.target.value);
                  onChange({ accent_color: event.target.value });
                }}
                className="h-10 w-20 p-1"
              />
            </div>
            <Button variant="secondary" onClick={() => onChange({ accent_color: customColor })}>
              Appliquer
            </Button>
            {list.accent_color ? (
              <Button variant="ghost" onClick={() => onChange({ accent_color: null })}>
                Revenir au thème
              </Button>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <h2 className="font-display text-xl">Style du bandeau</h2>
            {HERO_STYLES.map((hero) => (
              <button
                key={hero.id}
                type="button"
                onClick={() => onChange({ hero_style: hero.id })}
                className={`block w-full rounded-xl border p-3 text-left text-sm transition ${
                  heroStyle === hero.id
                    ? "border-primary ring-2 ring-ring/60"
                    : "hover:border-primary/40"
                }`}
              >
                <span className="font-medium">{hero.label}</span>
                <span className="block text-xs text-muted-foreground">{hero.description}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-xl">Mise en page des cadeaux</h2>
            {LIST_LAYOUTS.map((layout) => (
              <button
                key={layout.id}
                type="button"
                onClick={() => onChange({ layout: layout.id })}
                className={`block w-full rounded-xl border p-3 text-left text-sm transition ${
                  (list.layout ?? "grid") === layout.id
                    ? "border-primary ring-2 ring-ring/60"
                    : "hover:border-primary/40"
                }`}
              >
                <span className="font-medium">{layout.label}</span>
                <span className="block text-xs text-muted-foreground">{layout.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl">Typographie</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {FONT_PAIRS.map((pair) => (
              <button
                key={pair.id}
                type="button"
                onClick={() => onChange({ font_pair: pair.id })}
                className={`rounded-xl border p-3 text-left transition ${
                  getFontPair(list.font_pair).id === pair.id
                    ? "border-primary ring-2 ring-ring/60"
                    : "hover:border-primary/40"
                }`}
              >
                <span className="block text-lg" style={{ fontFamily: pair.display }}>
                  Bébé
                </span>
                <span className="block text-xs text-muted-foreground">{pair.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="font-medium">Afficher la progression</p>
            <p className="text-sm text-muted-foreground">
              Montrer aux proches combien de cadeaux ont déjà été réservés.
            </p>
          </div>
          <Switch
            checked={list.show_progress !== false}
            onCheckedChange={(checked) => onChange({ show_progress: checked })}
          />
        </section>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-3 text-sm font-medium text-muted-foreground">Aperçu en direct</p>
        <div
          className="overflow-hidden rounded-2xl border shadow-soft"
          style={appearanceStyle(list)}
        >
          <div style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}>
            {heroStyle === "cover" && list.cover_image_url ? (
              <img src={list.cover_image_url} alt="" className="h-32 w-full object-cover" />
            ) : null}
            <div
              className="px-5 py-6"
              style={
                heroStyle === "minimal"
                  ? undefined
                  : { backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }
              }
            >
              <div className="flex items-center gap-3">
                {heroStyle === "soft" && list.cover_image_url ? (
                  <img
                    src={list.cover_image_url}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-full border object-cover"
                  />
                ) : null}
                <div>
                  <p className="text-xl" style={{ fontFamily: "var(--font-display-family)" }}>
                    {list.title}
                  </p>
                  {list.baby_name ? (
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      Pour l'arrivée de {list.baby_name}
                    </p>
                  ) : null}
                </div>
              </div>
              {list.show_progress !== false ? (
                <div
                  className="mt-4 h-2 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: "var(--muted)" }}
                >
                  <div
                    className="h-full w-2/5 rounded-full"
                    style={{ backgroundColor: "var(--accent)" }}
                  />
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 p-5" style={{ fontFamily: "var(--font-sans-family)" }}>
              {[0, 1].map((index) => (
                <div
                  key={index}
                  className="rounded-xl border p-3 text-sm"
                  style={{
                    backgroundColor: "var(--card)",
                    color: "var(--card-foreground)",
                    borderColor: "var(--border)",
                  }}
                >
                  <p style={{ fontFamily: "var(--font-display-family)" }}>Gigoteuse en lin</p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    39,90 €
                  </p>
                  <span
                    className="mt-2 inline-block rounded-lg px-3 py-1 text-xs"
                    style={{
                      backgroundColor: "var(--primary)",
                      color: "var(--primary-foreground)",
                    }}
                  >
                    Réserver
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
