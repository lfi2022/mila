import { createFileRoute } from "@tanstack/react-router";
import source from "../../docs/politique-confidentialite.md?raw";
import { buildPublicUrl } from "@/config/runtime";
import { getLegalConfig } from "@/features/legal/api";
import { LegalDocument } from "@/features/legal/LegalDocument";

export const Route = createFileRoute("/confidentialite")({
  loader: getLegalConfig,
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — Mila" },
      {
        name: "description",
        content:
          "Données traitées par Mila, finalités, durées, destinataires et exercice de vos droits RGPD.",
      },
      { property: "og:title", content: "Politique de confidentialité — Mila" },
      { property: "og:type", content: "article" },
      { property: "og:url", content: buildPublicUrl("/confidentialite") },
    ],
    links: [{ rel: "canonical", href: buildPublicUrl("/confidentialite") }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalDocument markdown={source} config={Route.useLoaderData()} />;
}
