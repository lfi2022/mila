import { describe, expect, it } from "vitest";
import cookieSource from "../docs/politique-cookies.md?raw";
import mentionsSource from "../docs/mentions-legales.md?raw";
import termsSource from "../docs/conditions-generales.md?raw";
import privacySource from "../docs/politique-confidentialite.md?raw";

import type { LegalConfig } from "@/features/legal/api";
import { resolveLegalMarkdown } from "@/features/legal/LegalDocument";

const config: LegalConfig = {
  operatorName: "Opérateur Test",
  businessName: "Entreprise Test",
  tradeName: "Mila",
  businessNumber: "BE0000000000",
  registeredAddress: "Adresse Test",
  country: "Belgique",
  generalEmail: "contact@example.test",
  privacyEmail: "privacy@example.test",
  supportEmail: "support@example.test",
  reportEmail: "legal@example.test",
  hostingProvider: "Hébergeur Test",
  publicationDirector: "Direction Test",
  versions: { terms: "2026-08-13", privacy: "2026-08-13", cookies: "2026-08-13" },
};

describe("legal document resolver", () => {
  it("injects configured publication values without inventing them", () => {
    const output = resolveLegalMarkdown(mentionsSource, config);
    expect(output).toContain("BE0000000000");
    expect(output).toContain("privacy@example.test");
    expect(output).toContain("Hébergeur Test");
    expect(output).not.toContain("À REPRENDRE");
  });

  it("replaces the cookie placeholder table with the detected inventory", () => {
    const output = resolveLegalMarkdown(cookieSource, config);
    expect(output).toContain("`mila.analytics-visitor`");
    expect(output).toContain("`mila_partner_attribution`");
    expect(output).not.toContain("À générer automatiquement");
  });

  it("resolves every source placeholder from the central legal configuration", () => {
    for (const source of [mentionsSource, termsSource, privacySource, cookieSource]) {
      expect(resolveLegalMarkdown(source, config)).not.toMatch(/À (?:COMPLÉTER|REPRENDRE)/);
    }
  });
});
