import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SiteHeader } from "@/components/SiteHeader";
import { paymentApi } from "@/features/payments/api";
import { ApiError } from "@/services/api/client";

export const Route = createFileRoute("/paiement/retour")({
  validateSearch: z.object({ payment: z.string().uuid().optional() }),
  head: () => ({
    meta: [{ title: "Retour de paiement — Mila" }, { name: "robots", content: "noindex" }],
  }),
  component: PaymentReturnPage,
});

const finalStatuses = new Set([
  "PAID",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
  "CHARGEDBACK",
]);

function PaymentReturnPage() {
  const { payment } = Route.useSearch();
  const query = useQuery({
    queryKey: ["payment", payment],
    queryFn: async () => {
      try {
        const gift = await paymentApi.giftCartStatus(payment!);
        return { ...gift, kind: "GIFT" as const };
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        return { ...(await paymentApi.get(payment!, true)), kind: "PREMIUM" as const };
      }
    },
    enabled: Boolean(payment),
    refetchInterval: (state) => (finalStatuses.has(state.state.data?.status ?? "") ? false : 2_000),
  });
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 py-16">
        <section className="surface-card p-7 text-center">
          <h1 className="text-2xl">État du paiement</h1>
          {!payment ? (
            <p className="mt-4 text-muted-foreground">Référence de paiement absente.</p>
          ) : query.isLoading ? (
            <p className="mt-4 text-muted-foreground">Vérification auprès de Mollie…</p>
          ) : query.data?.status === "PAID" ? (
            <p className="mt-4">
              {query.data.kind === "GIFT"
                ? "Paiement confirmé. Vos cadeaux et participations ont été enregistrés ; un récapitulatif vous sera envoyé par e-mail."
                : "Paiement confirmé. Premium est activé."}
            </p>
          ) : ["OPEN", "PENDING", "AUTHORIZED", "CREATED"].includes(query.data?.status ?? "") ? (
            <p className="mt-4 text-muted-foreground">
              Le paiement est encore en cours de confirmation.
            </p>
          ) : (
            <p className="mt-4 text-muted-foreground">
              Le paiement n’a pas été confirmé ({query.data?.status ?? "indisponible"}).
            </p>
          )}
          {query.data?.kind === "GIFT" ? (
            <ul className="mt-4 space-y-1 text-left text-sm">
              {query.data.items.map((item, index) => (
                <li key={index}>
                  {item.giftTitle} ·{" "}
                  {(item.amountCents / 100).toLocaleString("fr-BE", {
                    style: "currency",
                    currency: query.data!.currency,
                  })}
                </li>
              ))}
            </ul>
          ) : null}
          <ButtonLink />
        </section>
      </main>
    </div>
  );
}

function ButtonLink() {
  return (
    <Link
      to="/dashboard"
      className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
    >
      Retour à mes listes
    </Link>
  );
}
