import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { DEMO_TESTIMONIALS, type MarketingTestimonial } from "@/lib/marketing-testimonials";

export function TestimonialsSection({
  testimonials = DEMO_TESTIMONIALS,
}: {
  testimonials?: MarketingTestimonial[];
}) {
  const containsDemo = testimonials.some((testimonial) => testimonial.isDemo);

  return (
    <section aria-labelledby="testimonials-title" className="mx-auto max-w-6xl px-4 py-16">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
          Aperçu des futurs retours
        </p>
        <h2 id="testimonials-title" className="mt-3 text-3xl">
          Une place prête pour leurs histoires
        </h2>
        {containsDemo ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Mila débute : les cartes ci-dessous illustrent le format prévu et ne sont pas des avis
            clients réels. Aucun chiffre ni témoignage n’est inventé.
          </p>
        ) : null}
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {testimonials.map((testimonial) => (
          <figure key={testimonial.firstName + testimonial.listType} className="surface-card p-6">
            {testimonial.isDemo ? <Badge variant="secondary">Exemple fictif</Badge> : null}
            <blockquote className="mt-4 text-sm leading-6 text-muted-foreground">
              « {testimonial.quote} »
            </blockquote>
            <figcaption className="mt-5 border-t pt-4 text-sm">
              <span className="font-medium">{testimonial.firstName}</span>
              <span className="block text-xs text-muted-foreground">
                {testimonial.listType} · {testimonial.context}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      {containsDemo ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Vous utilisez déjà Mila ? Vous pourrez nous raconter votre expérience depuis la page{" "}
          <Link to="/contact" className="font-medium text-foreground underline underline-offset-4">
            contact
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}
