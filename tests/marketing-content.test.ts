import { describe, expect, it } from "vitest";

import { FAQ_ENTRIES, visibleFaqEntries } from "../src/lib/faq-content";
import { DEMO_TESTIMONIALS } from "../src/lib/marketing-testimonials";

describe("public marketing content", () => {
  it("covers the concrete purchase and privacy questions", () => {
    const questions = FAQ_ENTRIES.map((entry) => entry.question);

    expect(questions).toContain("Est-ce que Mila vend les cadeaux ?");
    expect(questions).toContain("Comment acheter un cadeau réservé ?");
    expect(questions).toContain("Que se passe-t-il si le prix d'un article change ?");
    expect(questions).toContain("Est-ce que mes données personnelles sont revendues ?");
  });

  it("hides reward copy when its interface is disabled", () => {
    expect(
      visibleFaqEntries(false).some((entry) => entry.question.includes("Récompenses Mila")),
    ).toBe(false);
  });

  it("marks every placeholder testimonial as fictional", () => {
    expect(DEMO_TESTIMONIALS.length).toBeGreaterThan(0);
    expect(DEMO_TESTIMONIALS.every((testimonial) => testimonial.isDemo)).toBe(true);
  });
});
