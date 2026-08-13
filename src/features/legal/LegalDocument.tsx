import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { LegalConfig } from "./api";

export function LegalDocument({ markdown, config }: { markdown: string; config: LegalConfig }) {
  const resolved = resolveLegalMarkdown(markdown, config);
  const headings = [...resolved.matchAll(/^##\s+(.+)$/gm)].map((match) => ({
    title: match[1] ?? "",
    id: slugify(match[1] ?? ""),
  }));
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-16">
        {headings.length > 5 && (
          <aside>
            <details className="surface-card p-4 lg:sticky lg:top-24 lg:block" open>
              <summary className="cursor-pointer font-semibold">Sommaire</summary>
              <nav className="mt-3" aria-label="Sommaire du document">
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <a className="hover:text-foreground" href={`#${heading.id}`}>
                        {heading.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </details>
          </aside>
        )}
        <article className="min-w-0 rounded-2xl border bg-card px-5 py-8 shadow-sm sm:px-10 lg:px-12">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="font-display break-words text-3xl sm:text-4xl">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2
                  id={slugify(String(children))}
                  className="font-display mt-10 scroll-mt-24 text-2xl"
                >
                  {children}
                </h2>
              ),
              h3: ({ children }) => <h3 className="mt-7 text-xl font-semibold">{children}</h3>,
              p: ({ children }) => (
                <p className="mt-4 break-words leading-7 text-muted-foreground">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="mt-4 list-disc space-y-2 pl-6 text-muted-foreground">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="mt-4 list-decimal space-y-2 pl-6 text-muted-foreground">
                  {children}
                </ol>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  className="break-all font-medium text-primary underline underline-offset-4"
                >
                  {children}
                </a>
              ),
              table: ({ children }) => (
                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-[42rem] border-collapse text-left text-sm">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border bg-muted p-3 font-semibold">{children}</th>
              ),
              td: ({ children }) => (
                <td className="border p-3 align-top text-muted-foreground">{children}</td>
              ),
              blockquote: ({ children }) => (
                <blockquote className="mt-5 border-l-4 border-primary/40 pl-4 italic">
                  {children}
                </blockquote>
              ),
            }}
          >
            {resolved}
          </ReactMarkdown>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

export function resolveLegalMarkdown(source: string, config: LegalConfig) {
  const missing = "À COMPLÉTER DANS LA CONFIGURATION";
  const value = (entry: string) => entry || missing;
  let output = source
    .replace(/Lambert Florian Informatique – LFINFO/g, value(config.businessName))
    .replace(/Lambert Florian/g, value(config.operatorName))
    .replace(/Nom commercial : Mila \/ Avec Mila/g, `Nom commercial : ${value(config.tradeName)}`)
    .replace(
      /Le responsable de la publication est Florian Lambert\./g,
      `Le responsable de la publication est ${value(config.publicationDirector)}.`,
    )
    .replace(
      /Numéro d'entreprise \/ TVA : \*\*À REPRENDRE DE LFINFO\*\*/g,
      `Numéro d'entreprise / TVA : **${value(config.businessNumber)}**`,
    )
    .replace(
      /Adresse du siège : \*\*À REPRENDRE DES MENTIONS LÉGALES LFINFO\*\*/g,
      `Adresse du siège : **${value(config.registeredAddress)}**`,
    )
    .replace(
      /Numéro BCE\/TVA : \*\*À COMPLÉTER\*\*/g,
      `Numéro BCE/TVA : **${value(config.businessNumber)}**`,
    )
    .replace(/Adresse : \*\*À COMPLÉTER\*\*/g, `Adresse : **${value(config.registeredAddress)}**`)
    .replace(
      /E-mail général : \*\*À COMPLÉTER[^*]*\*\*/g,
      `E-mail général : **${value(config.generalEmail)}**`,
    )
    .replace(
      /E-mail relatif à la vie privée : \*\*À COMPLÉTER[^*]*\*\*/g,
      `E-mail relatif à la vie privée : **${value(config.privacyEmail)}**`,
    )
    .replace(
      /\*\*À COMPLÉTER – ex\. privacy@avecmila\.be\*\*/g,
      `**${value(config.privacyEmail)}**`,
    )
    .replace(
      /\*\*À COMPLÉTER – ex\. support@avecmila\.be\*\*/g,
      `**${value(config.supportEmail)}**`,
    )
    .replace(/\*\*À COMPLÉTER – ex\. legal@avecmila\.be\*\*/g, `**${value(config.reportEmail)}**`)
    .replace(
      /Hébergeur physique \/ fournisseur d'infrastructure :\s*\n\*\*À COMPLÉTER\*\*/g,
      `Hébergeur physique / fournisseur d'infrastructure :\n**${value(config.hostingProvider)}**`,
    );
  if (source.includes("# Politique relative aux cookies")) {
    output = output.replace(
      /\| Cookie\s+\| Fournisseur[\s\S]*?(?=\r?\n\r?\nCette liste)/,
      cookieInventory(),
    );
  }
  return output;
}

function cookieInventory() {
  return [
    "| Cookie / stockage | Fournisseur | Finalité | Durée | Catégorie |",
    "|---|---|---|---|---|",
    "| `mila_session` (nom configurable) | Mila | Session authentifiée, HttpOnly | Durée de session configurée | Nécessaire |",
    "| `mila_session_csrf` (nom configurable) | Mila | Protection contre les requêtes frauduleuses | Durée de session configurée | Nécessaire |",
    "| `mila_list_access` | Mila | Accès temporaire à une liste protégée | 1 heure | Nécessaire |",
    "| `sidebar_state` | Mila | Préférence d'affichage demandée | 7 jours | Fonctionnel |",
    "| `mila_partner_attribution` | Mila | Attribution partenaire explicitement acceptée | 30 jours | Marketing |",
    "| `mila.cookie-consent` (stockage local) | Mila | Conserver et prouver vos choix | Jusqu'au retrait ou changement de politique | Nécessaire |",
    "| `mila.analytics-visitor` (stockage local) | Mila | Mesure d'audience interne pseudonyme | Jusqu'au retrait du consentement | Statistiques |",
    "| Cache du service worker | Mila | Fonctionnement hors ligne et performance | Selon version de l'application | Nécessaire |",
  ].join("\n");
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
