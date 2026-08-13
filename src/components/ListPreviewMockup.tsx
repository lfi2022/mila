import { Badge } from "@/components/ui/badge";

type MockGift = {
  title: string;
  price: string;
  store: string;
  state: "available" | "reserved";
  image: string;
};

const GIFTS: MockGift[] = [
  {
    title: "Poussette Cybex",
    price: "499 €",
    store: "Amazon",
    state: "available",
    image: "/generic-images/stroller.webp",
  },
  {
    title: "Doudou lapin",
    price: "24,90 €",
    store: "Petite boutique",
    state: "available",
    image: "/generic-images/plush-rabbit.webp",
  },
  {
    title: "Transat bébé",
    price: "89 €",
    store: "Vertbaudet",
    state: "reserved",
    image: "/generic-images/baby-bouncer.webp",
  },
  {
    title: "Lit évolutif en hêtre",
    price: "149 €",
    store: "IKEA",
    state: "available",
    image: "/generic-images/baby-crib.webp",
  },
];

/**
 * Decorative preview of what relatives receive. Purely illustrative: no data is
 * fetched and nothing here is reservable.
 */
export function ListPreviewMockup() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-accent/25 blur-2xl" />

      <div className="rounded-[2.25rem] border border-border bg-card p-3 shadow-lift">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-border" />

        <div className="overflow-hidden rounded-[1.75rem] bg-background">
          <div className="bg-secondary/70 px-5 py-5 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-primary/70">
              Liste de naissance
            </p>

            <p className="font-display mt-1 text-xl">Liste de naissance de Mila</p>

            <p className="mt-1 text-xs text-muted-foreground">Arrivée prévue en novembre ❤️</p>
          </div>

          <ul className="space-y-2 p-3">
            {GIFTS.map((gift, index) => (
              <li
                key={gift.title}
                className={`surface-card flex items-center gap-3 p-3 transition-opacity motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 ${
                  gift.state === "reserved" ? "opacity-70" : ""
                }`}
                style={{
                  animationDelay: `${index * 90}ms`,
                  animationDuration: "600ms",
                }}
              >
                {/* Image produit */}
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-accent/30">
                  <img
                    src={gift.image}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{gift.title}</p>

                  <p className="text-xs text-muted-foreground">
                    {gift.price} · {gift.store}
                  </p>
                </div>

                {gift.state === "reserved" ? (
                  <Badge variant="secondary" className="shrink-0 text-[11px]">
                    🎁 Déjà réservé
                  </Badge>
                ) : (
                  <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground">
                    Réserver
                  </span>
                )}
              </li>
            ))}
          </ul>

          <p className="px-4 pb-4 text-center text-[11px] text-muted-foreground">
            1 cadeaux sur 4 ont déjà été réservés ❤️
          </p>
        </div>
      </div>
    </div>
  );
}
