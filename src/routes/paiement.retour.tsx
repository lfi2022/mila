import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SiteHeader } from "@/components/SiteHeader";
import { paymentApi } from "@/features/payments/api";

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
    queryFn: () => paymentApi.get(payment!, true),
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
            <p className="mt-4">Paiement confirmé. Premium est activé.</p>
          ) : ["OPEN", "PENDING", "AUTHORIZED", "CREATED"].includes(query.data?.status ?? "") ? (
            <p className="mt-4 text-muted-foreground">
              Le paiement est encore en cours de confirmation.
            </p>
          ) : (
            <p className="mt-4 text-muted-foreground">
              Le paiement n’a pas été confirmé ({query.data?.status ?? "indisponible"}).
            </p>
          )}
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
