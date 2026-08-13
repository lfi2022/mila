import { createFileRoute } from "@tanstack/react-router";
import source from "../../docs/politique-cookies.md?raw";
import { Button } from "@/components/ui/button";
import { buildPublicUrl } from "@/config/runtime";
import { getLegalConfig } from "@/features/legal/api";
import { LegalDocument } from "@/features/legal/LegalDocument";
import { openCookieManager } from "@/features/privacy/cookie-consent";

export const Route = createFileRoute("/cookies")({
  loader: getLegalConfig,
  head: () => ({
    meta: [
      { title: "Politique relative aux cookies — Mila" },
      {
        name: "description",
        content:
          "Inventaire des cookies et traceurs Mila, leurs finalités et la gestion de votre consentement.",
      },
      { property: "og:title", content: "Politique relative aux cookies — Mila" },
      { property: "og:type", content: "article" },
      { property: "og:url", content: buildPublicUrl("/cookies") },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl("/cookies") }],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  const config = Route.useLoaderData();
  return (
    <>
      <LegalDocument markdown={source} config={config} />
      <div className="fixed bottom-4 left-4 z-40">
        <Button onClick={openCookieManager}>Gérer mes cookies</Button>
      </div>
    </>
  );
}
