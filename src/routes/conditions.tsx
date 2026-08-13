import { createFileRoute } from "@tanstack/react-router";
import source from "../../docs/conditions-generales.md?raw";
import { buildPublicUrl } from "@/config/runtime";
import { getLegalConfig } from "@/features/legal/api";
import { LegalDocument } from "@/features/legal/LegalDocument";

export const Route = createFileRoute("/conditions")({
  loader: getLegalConfig,
  head: () => ({
    meta: [
      { title: "Conditions générales d’utilisation et de vente — Mila" },
      {
        name: "description",
        content:
          "Conditions applicables aux comptes, listes, réservations, paiements et services Mila.",
      },
      { property: "og:title", content: "Conditions générales — Mila" },
      { property: "og:type", content: "article" },
      { property: "og:url", content: buildPublicUrl("/conditions") },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl("/conditions") }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return <LegalDocument markdown={source} config={Route.useLoaderData()} />;
}
