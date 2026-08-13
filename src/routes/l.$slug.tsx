import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { priceApi } from "@/features/prices/api";
import { createSecondHandOffer } from "@/features/memories/api";
import { apiRequest } from "@/services/api/client";
import { track } from "@/lib/analytics";

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
        <ReportList listId={list.id} />
      </main>
    </div>
  );
}

function ReportList({ listId }: { listId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("OTHER");
  const [details, setDetails] = useState("");
  const [startedAt, setStartedAt] = useState(Date.now());
  return (
    <div className="mt-12 border-t pt-6 text-center">
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setStartedAt(Date.now());
        }}
      >
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Signaler cette liste
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signaler un contenu</DialogTitle>
            <DialogDescription>
              Utilisez ce formulaire pour le phishing, un lien malveillant, le spam, la fraude, un
              abus ou une atteinte à la vie privée.
            </DialogDescription>
          </DialogHeader>
          <Label>Motif</Label>
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <option value="PHISHING">Phishing</option>
            <option value="MALICIOUS_LINK">Lien malveillant</option>
            <option value="SPAM">Spam</option>
            <option value="FRAUD">Fraude</option>
            <option value="REFERRAL_ABUSE">Abus de parrainage</option>
            <option value="ILLEGAL_CONTENT">Contenu illégal</option>
            <option value="PRIVACY">Vie privée</option>
            <option value="OTHER">Autre</option>
          </select>
          <Label>Détails</Label>
          <Textarea
            maxLength={1000}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
          <input
            aria-hidden="true"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            name="website"
          />
          <DialogFooter>
            <Button
              onClick={async () => {
                try {
                  await apiRequest("/public/reports", {
                    method: "POST",
                    body: JSON.stringify({
                      targetType: "list",
                      targetId: listId,
                      reason,
                      details,
                      elapsedMs: Date.now() - startedAt,
                    }),
                  });
                  toast.success("Signalement transmis pour revue");
                  setOpen(false);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Signalement impossible");
                }
              }}
            >
              Envoyer le signalement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerFile, setOfferFile] = useState<File | undefined>();
  const [offer, setOffer] = useState({
    proposerName: "",
    proposerEmail: "",
    condition: "VERY_GOOD" as "LIKE_NEW" | "VERY_GOOD" | "GOOD" | "FAIR",
    comment: "",
  });

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
      track("first_reservation");
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
          {gift.has_link ? <PriceSuggestion giftToken={gift.public_token} /> : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          {gift.kind === "CONTRIBUTION" ? (
            <Button asChild size="sm" className="min-h-10">
              <Link to="/contribuer/$giftToken" params={{ giftToken: gift.public_token }}>
                Participer
              </Link>
            </Button>
          ) : null}
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
          {!gift.is_reserved && !isDemo ? (
            <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
              <Button
                variant="outline"
                size="sm"
                className="min-h-10"
                onClick={() => setOfferOpen(true)}
              >
                Proposer d’occasion
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Proposer « {gift.title} » d’occasion</DialogTitle>
                  <DialogDescription>
                    Les parents vérifieront l’état, la photo et votre commentaire avant toute
                    acceptation.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Label>Votre prénom</Label>
                  <Input
                    value={offer.proposerName}
                    onChange={(event) => setOffer({ ...offer, proposerName: event.target.value })}
                  />
                  <Label>Email (optionnel)</Label>
                  <Input
                    type="email"
                    value={offer.proposerEmail}
                    onChange={(event) => setOffer({ ...offer, proposerEmail: event.target.value })}
                  />
                  <Label>État</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    value={offer.condition}
                    onChange={(event) =>
                      setOffer({
                        ...offer,
                        condition: event.target.value as typeof offer.condition,
                      })
                    }
                  >
                    <option value="LIKE_NEW">Comme neuf</option>
                    <option value="VERY_GOOD">Très bon état</option>
                    <option value="GOOD">Bon état</option>
                    <option value="FAIR">État correct</option>
                  </select>
                  <Label>Commentaire</Label>
                  <Textarea
                    value={offer.comment}
                    onChange={(event) => setOffer({ ...offer, comment: event.target.value })}
                  />
                  <Label>Photo privée (8 Mo max)</Label>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setOfferFile(event.target.files?.[0])}
                  />
                </div>
                <DialogFooter>
                  <Button
                    disabled={busy || !offer.proposerName.trim()}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await createSecondHandOffer({
                          giftToken: gift.public_token,
                          ...offer,
                          ...(offerFile ? { file: offerFile } : {}),
                        });
                        toast.success("Proposition transmise aux parents");
                        setOfferOpen(false);
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Proposition impossible",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Transmettre la proposition
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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

function PriceSuggestion({ giftToken }: { giftToken: string }) {
  const query = useQuery({
    queryKey: ["public-price-suggestion", giftToken],
    queryFn: () => priceApi.suggestion(giftToken),
    staleTime: 30 * 60_000,
  });
  const suggestion = query.data?.suggestion;
  if (!suggestion) return null;
  return (
    <p className="rounded-lg bg-secondary p-2 text-xs">
      Meilleure offre détectée : {suggestion.merchant} ·{" "}
      {new Intl.NumberFormat("fr-BE", {
        style: "currency",
        currency: suggestion.currency,
      }).format(Number(suggestion.totalMinor) / 100)}
    </p>
  );
}
