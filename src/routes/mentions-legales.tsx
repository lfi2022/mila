import { createFileRoute } from "@tanstack/react-router";
import source from "../../docs/mentions-legales.md?raw";
import { buildPublicUrl } from "@/config/runtime";
import { getLegalConfig } from "@/features/legal/api";
import { LegalDocument } from "@/features/legal/LegalDocument";

export const Route = createFileRoute("/mentions-legales")({
  loader: getLegalConfig,
  head: () => ({
    meta: [
      { title: "Mentions légales — Mila" },
      {
        name: "description",
        content:
          "Éditeur, hébergement, propriété intellectuelle et responsabilités du service Mila.",
      },
      { property: "og:title", content: "Mentions légales — Mila" },
      { property: "og:type", content: "article" },
      { property: "og:url", content: buildPublicUrl("/mentions-legales") },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl("/mentions-legales") }],
  }),
  component: LegalPage,
});

function LegalPage() {
  return <LegalDocument markdown={source} config={Route.useLoaderData()} />;
}
