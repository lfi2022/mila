import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { buildPublicUrl } from "@/config/runtime";
import { partnerApi } from "@/features/partners/api";
import { openCookieManager, readCookieConsent } from "@/features/privacy/cookie-consent";

export const Route = createFileRoute("/p/$slug")({
  validateSearch: z.object({
    campaign: z.string().max(64).optional(),
    channel: z.enum(["LINK", "QR"]).optional(),
  }),
  head: ({ params }) => ({
    meta: [
      { title: "Partenaire local — Mila" },
      { name: "description", content: "Découvrez une page partenaire Mila vérifiée." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex,follow" },
      { property: "og:url", content: buildPublicUrl(`/p/${params.slug}`) },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl(`/p/${params.slug}`) }],
  }),
  component: PartnerPage,
});

function PartnerPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const [qr, setQr] = useState<string>();
  const [isStarting, setIsStarting] = useState(false);
  const landing = useQuery({
    queryKey: ["partner-landing", slug, search.campaign, search.channel],
    queryFn: () => partnerApi.landing(slug, search.campaign),
    retry: false,
  });
  useEffect(() => {
    const code = landing.data?.campaign?.code;
    if (!code) return;
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("campaign", code);
    url.searchParams.set("channel", "QR");
    let cancelled = false;
    void import("qrcode").then((module) =>
      module.default.toDataURL(url.toString(), { width: 384, margin: 2 }).then((value) => {
        if (!cancelled) setQr(value);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [landing.data?.campaign?.code]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        {landing.isLoading ? <p className="text-muted-foreground">Chargement…</p> : null}
        {landing.isError ? (
          <div className="surface-card p-8 text-center">
            <h1 className="text-2xl">Page partenaire indisponible</h1>
            <p className="mt-2 text-muted-foreground">
              Cette page n’est pas active ou sa campagne est terminée.
            </p>
          </div>
        ) : null}
        {landing.data ? (
          <article className="space-y-8">
            <header className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                Partenaire Mila vérifié · {landing.data.partner.category}
              </p>
              <h1 className="text-4xl">
                {landing.data.partner.landingTitle || landing.data.partner.name}
              </h1>
              {landing.data.partner.region ? (
                <p className="text-sm text-muted-foreground">{landing.data.partner.region}</p>
              ) : null}
              <p className="text-lg text-muted-foreground">
                {landing.data.partner.landingBody || landing.data.partner.summary}
              </p>
            </header>
            {landing.data.campaign ? (
              <section className="surface-card space-y-3 p-7" aria-labelledby="partner-benefit">
                <h2 id="partner-benefit" className="text-2xl">
                  {landing.data.campaign.benefit.title || landing.data.campaign.name}
                </h2>
                <p className="text-muted-foreground">{landing.data.campaign.benefit.description}</p>
                <p className="text-xs text-muted-foreground">
                  Offre valable jusqu’au{" "}
                  {new Date(landing.data.campaign.endsAt).toLocaleDateString("fr-BE")}, selon
                  conditions et budget disponibles.
                </p>
              </section>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={isStarting}
                onClick={() => {
                  if (!readCookieConsent()?.choices.marketing) {
                    openCookieManager();
                    toast.info(
                      "Autorisez la catégorie marketing pour enregistrer l’attribution partenaire, puis réessayez.",
                    );
                    return;
                  }
                  setIsStarting(true);
                  void partnerApi
                    .startAttribution(slug, landing.data.campaign?.code, search.channel ?? "LINK")
                    .finally(() => window.location.assign("/auth"));
                }}
              >
                {isStarting ? "Ouverture…" : "Créer ma liste Mila"}
              </Button>
              {landing.data.partner.websiteUrl ? (
                <Button asChild variant="outline">
                  <a
                    href={landing.data.partner.websiteUrl}
                    target="_blank"
                    rel="sponsored noreferrer"
                  >
                    Visiter le partenaire
                  </a>
                </Button>
              ) : null}
            </div>
            {qr ? (
              <section className="max-w-xs rounded-xl border p-5 text-center">
                <h2 className="text-lg">Partager cette offre</h2>
                <img
                  src={qr}
                  width={384}
                  height={384}
                  loading="lazy"
                  alt={`QR code de la campagne ${landing.data.campaign?.name ?? landing.data.partner.name}`}
                  className="mt-3 h-auto w-full"
                />
              </section>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Mila n’affiche ici que des partenaires contractualisés et des campagnes activées. Une
              récompense éventuelle dépend des conditions et du budget de la campagne.
            </p>
            <p className="text-xs text-muted-foreground">
              En choisissant « Créer ma liste Mila », vous acceptez qu’un identifiant aléatoire de
              provenance soit conservé pendant 30 jours. Il ne contient aucune donnée personnelle et
              sert uniquement à attribuer l’avantage et mesurer cette campagne.
            </p>
          </article>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
