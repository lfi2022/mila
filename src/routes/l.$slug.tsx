import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import markAsset from "@/assets/mila-mark.png.asset.json";
import { buildPublicUrl, runtimeConfig } from "@/config/runtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LAYOUT_CLASSES, appearanceStyle, getHeroStyle, getLayout } from "@/lib/list-theme";
import { getPublicList, reserveGift, type PublicGift } from "@/lib/public.functions";

const searchSchema = z.object({ code: z.string().max(64).optional() });

export const Route = createFileRoute("/l/$slug")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ code: search.code }),
  loader: ({ params, deps }) =>
    getPublicList({ data: { slug: params.slug, ...(deps.code ? { code: deps.code } : {}) } }),
  head: ({ loaderData }) => {
    if (!loaderData || loaderData.state !== "ok") {
      return {
        meta: [
          { title: "Liste indisponible — Mila" },
          { name: "description", content: "Cette liste de naissance n'est pas accessible." },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { list } = loaderData;
    const title = `${list.title} — liste de naissance`;
    const description =
      list.description ??
      list.welcome_message ??
      `Découvrez la liste de naissance de ${list.baby_name ?? list.title} et réservez un cadeau en quelques secondes.`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description.slice(0, 155) },
      { property: "og:title", content: title },
      { property: "og:description", content: description.slice(0, 155) },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (list.cover_image_url?.startsWith("https://")) {
      meta.push({ property: "og:image", content: list.cover_image_url });
      meta.push({ name: "twitter:image", content: list.cover_image_url });
    } else {
      const fallback = buildPublicUrl(markAsset.url);
      meta.push({ property: "og:image", content: fallback });
      meta.push({ name: "twitter:image", content: fallback });
    }
    meta.push({ property: "og:url", content: buildPublicUrl(`/l/${list.slug}`) });

    if (!runtimeConfig.seoIndexingEnabled || !list.allow_indexing || list.visibility !== "PUBLIC") {
      meta.push({ name: "robots", content: "noindex, nofollow" });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: buildPublicUrl(`/l/${list.slug}`) }],
    };
  },
  errorComponent: () => <Unavailable />,
  notFoundComponent: () => <Unavailable />,
  component: PublicListPage,
});

function Unavailable() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl">Liste introuvable</h1>
      <p className="mt-3 text-muted-foreground">
        Le lien est peut-être erroné, ou la liste a été archivée par les parents.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Découvrir Mila</Link>
      </Button>
    </div>
  );
}

function PublicListPage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  if (data.state === "not_found") return <Unavailable />;

  if (data.state === "locked") {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <h1 className="font-display text-3xl">{data.title}</h1>
        <p className="mt-2 text-muted-foreground">
          Cette liste est privée. Saisissez le code partagé par les parents pour y accéder.
        </p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            navigate({ to: "/l/$slug", params: { slug }, search: { code } });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="access-code">Code d'accès</Label>
            <Input
              id="access-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ex. bebe2026"
              autoComplete="off"
            />
          </div>
          {data.wrongCode ? (
            <p className="text-sm text-destructive">Code incorrect, réessayez.</p>
          ) : null}
          <Button type="submit" className="w-full">
            Accéder à la liste
          </Button>
        </form>
      </div>
    );
  }

  const { list, gifts, totals } = data;
  const heroStyle = getHeroStyle(list.hero_style);
  const layout = getLayout(list.layout);
  const progress = totals.items > 0 ? Math.round((totals.taken / totals.items) * 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground" style={appearanceStyle(list)}>
      {heroStyle === "cover" && list.cover_image_url ? (
        <img
          src={list.cover_image_url}
          alt={`Couverture de la liste ${list.title}`}
          className="h-56 w-full object-cover sm:h-72"
        />
      ) : null}

      <header className={heroStyle === "minimal" ? "border-b" : "border-b bg-secondary/40"}>
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-14 sm:flex-row sm:items-center">
          {heroStyle === "soft" && list.cover_image_url ? (
            <img
              src={list.cover_image_url}
              alt={`Couverture de la liste ${list.title}`}
              className="h-28 w-28 shrink-0 rounded-full border-4 border-card object-cover shadow-soft sm:h-36 sm:w-36"
            />
          ) : null}
          <div>
            {list.is_demo ? <Badge variant="secondary">Liste de démonstration</Badge> : null}
            <h1 className="mt-3 font-display text-4xl leading-tight">{list.title}</h1>
            {list.baby_name ? (
              <p className="mt-2 text-lg text-muted-foreground">
                Pour l'arrivée de {list.baby_name}
              </p>
            ) : null}
            {list.welcome_message ? (
              <p className="mt-5 max-w-2xl whitespace-pre-line text-muted-foreground">
                {list.welcome_message}
              </p>
            ) : null}
            {list.surprise_mode ? (
              <p className="mt-6 text-sm text-muted-foreground">
                Les parents ont choisi la surprise : ils découvriront les cadeaux plus tard.
              </p>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                {totals.items > 0
                  ? `${totals.taken} cadeau${totals.taken > 1 ? "x" : ""} sur ${totals.items} ${
                      totals.taken > 1 ? "ont" : "a"
                    } déjà trouvé quelqu'un ❤️`
                  : "Les cadeaux arrivent très bientôt."}
              </p>
            )}
            {list.show_progress !== false && !list.surprise_mode && totals.items > 0 ? (
              <div
                className="mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Cadeaux déjà réservés"
              >
                <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        {list.is_demo ? (
          <div className="mb-8 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-4 text-sm">
            <strong>Liste de démonstration Mila.</strong> Les cadeaux sont fictifs : vous pouvez
            ouvrir le formulaire de réservation pour voir comment ça se passe, aucune réservation ne
            sera enregistrée.{" "}
            <Link to="/auth" className="underline">
              Créer ma vraie liste
            </Link>
            .
          </div>
        ) : null}

        {gifts.length === 0 ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            Tous les cadeaux ont trouvé preneur. Merci pour les futurs parents !
          </p>
        ) : (
          <ul className={LAYOUT_CLASSES[layout]}>
            {gifts.map((gift) => (
              <li key={gift.id}>
                <GiftCard gift={gift} horizontal={layout === "list"} isDemo={list.is_demo} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function GiftCard({
  gift,
  horizontal = false,
  isDemo = false,
}: {
  gift: PublicGift;
  horizontal?: boolean;
  isDemo?: boolean;
}) {
  const router = useRouter();
  const reserve = useServerFn(reserveGift);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manageLink, setManageLink] = useState<string | null>(null);
  const [form, setForm] = useState({ guestName: "", guestEmail: "", message: "" });

  const submit = async (intent: "reserve" | "order") => {
    setBusy(true);
    try {
      const result = await reserve({
        data: {
          itemId: gift.id,
          guestName: form.guestName,
          guestEmail: form.guestEmail,
          message: form.message,
          quantity: 1,
          intent,
        },
      });
      setManageLink(result.manageLink);
      toast.success("Cadeau réservé, merci !");
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Réservation impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      className={`${
        horizontal
          ? "grid overflow-hidden sm:grid-cols-[200px_1fr]"
          : "flex h-full flex-col overflow-hidden"
      }${gift.is_reserved ? " bg-muted/40" : ""}`}
    >
      {gift.image_url ? (
        <img
          src={gift.image_url}
          alt={gift.title}
          loading="lazy"
          decoding="async"
          className={`${horizontal ? "h-full max-h-52 w-full object-cover" : "h-44 w-full object-cover"}${
            gift.is_reserved ? " opacity-60" : ""
          }`}
        />
      ) : null}
      <div className={horizontal ? "flex flex-col" : "contents"}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{gift.title}</CardTitle>
            {gift.is_reserved ? (
              <Badge variant="secondary" className="shrink-0 whitespace-nowrap">
                🎁 Déjà réservé
              </Badge>
            ) : null}
          </div>
          {gift.store_name ? (
            <p className="text-xs text-muted-foreground">{gift.store_name}</p>
          ) : null}
        </CardHeader>
        <CardContent className="flex-1 space-y-2">
          {gift.description ? (
            <p className="line-clamp-3 text-sm text-muted-foreground">{gift.description}</p>
          ) : null}
          {gift.price != null ? (
            <p className="font-medium">
              {gift.price.toLocaleString("fr-FR", {
                style: "currency",
                currency: gift.currency || "EUR",
              })}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {gift.has_link ? (
            <Button asChild variant="outline" size="sm" className="min-h-10">
              <a
                href={`/go/${gift.public_token}`}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                Voir en boutique
              </a>
            </Button>
          ) : null}
          {gift.is_reserved ? (
            <Button size="sm" className="min-h-10" disabled>
              Déjà réservé
            </Button>
          ) : (
            <Dialog open={open} onOpenChange={setOpen}>
              <Button size="sm" className="min-h-10" onClick={() => setOpen(true)}>
                Réserver
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {manageLink ? "C'est réservé !" : `Réserver « ${gift.title} »`}
                  </DialogTitle>
                  <DialogDescription>
                    {manageLink
                      ? "Conservez ce lien pour modifier ou annuler votre réservation."
                      : isDemo
                        ? "Liste de démonstration : le formulaire fonctionne, mais rien ne sera enregistré."
                        : "Le cadeau restera visible sur la liste, marqué comme déjà réservé."}
                  </DialogDescription>
                </DialogHeader>

                {manageLink ? (
                  <div className="space-y-3">
                    <Input readOnly value={manageLink} onFocus={(event) => event.target.select()} />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        void navigator.clipboard.writeText(manageLink);
                        toast.success("Lien copié");
                      }}
                    >
                      Copier le lien
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`name-${gift.id}`}>Votre prénom *</Label>
                      <Input
                        id={`name-${gift.id}`}
                        value={form.guestName}
                        onChange={(event) =>
                          setForm((f) => ({ ...f, guestName: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`email-${gift.id}`}>
                        Email (pour retrouver votre réservation)
                      </Label>
                      <Input
                        id={`email-${gift.id}`}
                        type="email"
                        value={form.guestEmail}
                        onChange={(event) =>
                          setForm((f) => ({ ...f, guestEmail: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`msg-${gift.id}`}>Un mot pour les parents</Label>
                      <Textarea
                        id={`msg-${gift.id}`}
                        rows={3}
                        value={form.message}
                        onChange={(event) =>
                          setForm((f) => ({ ...f, message: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                )}

                {!manageLink ? (
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void submit("reserve")}
                    >
                      Je réserve
                    </Button>
                    <Button disabled={busy} onClick={() => void submit("order")}>
                      Je réserve et je commande
                    </Button>
                  </DialogFooter>
                ) : null}
              </DialogContent>
            </Dialog>
          )}
        </CardFooter>
      </div>
    </Card>
  );
}
