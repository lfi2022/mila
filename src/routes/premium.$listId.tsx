import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { paymentApi } from "@/features/payments/api";
import { formatCents } from "@/lib/money";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/premium/$listId")({
  head: () => ({ meta: [{ title: "Mila Premium" }, { name: "robots", content: "noindex" }] }),
  component: PremiumPage,
});

function PremiumPage() {
  const { listId } = Route.useParams();
  const queryClient = useQueryClient();
  const requestKey = useRef(crypto.randomUUID());
  const activationTracked = useRef(false);
  const premium = useQuery({
    queryKey: ["premium", listId],
    queryFn: () => paymentApi.premiumStatus(listId),
  });
  const methods = useQuery({ queryKey: ["payment-methods"], queryFn: paymentApi.methods });
  const purchase = useMutation({
    mutationFn: (useRewards: boolean) =>
      paymentApi.buyPremium(listId, useRewards, requestKey.current),
    onSuccess: async (payment) => {
      if (payment.checkoutUrl) {
        window.location.assign(payment.checkoutUrl);
        return;
      }
      requestKey.current = crypto.randomUUID();
      await queryClient.invalidateQueries({ queryKey: ["premium", listId] });
      track("premium_activated");
      toast.success("Mila Premium est activé pour cette liste.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const value = premium.data;
  useEffect(() => {
    if (value?.active && !activationTracked.current) {
      activationTracked.current = true;
      track("premium_activated");
    }
  }, [value?.active]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <Link
          to="/dashboard/$registryId"
          params={{ registryId: listId }}
          className="text-sm text-muted-foreground"
        >
          ← Retour à la liste
        </Link>
        <section className="surface-card mt-4 p-7">
          <h1 className="text-3xl">Mila Premium</h1>
          {premium.isLoading ? (
            <p className="mt-4 text-muted-foreground">Chargement…</p>
          ) : !value?.enabled ? (
            <p className="mt-4 text-muted-foreground">Premium n’est pas encore disponible.</p>
          ) : value.active ? (
            <p className="mt-4 rounded-xl bg-secondary p-4">
              Premium est actif pour cet événement.
            </p>
          ) : (
            <>
              <p className="mt-4 text-muted-foreground">
                Un achat unique par événement, sans abonnement. L’activation intervient uniquement
                après confirmation serveur du paiement.
              </p>
              <p className="mt-5 text-3xl font-semibold">
                {formatCents(value.priceCents, value.currency)}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  disabled={!value.mollieEnabled || purchase.isPending}
                  onClick={() => {
                    track("premium_checkout_started", { method: "mollie" });
                    purchase.mutate(false);
                  }}
                >
                  Payer avec Mollie
                </Button>
                {value.rewardsEnabled && (
                  <Button
                    variant="secondary"
                    disabled={purchase.isPending}
                    onClick={() => {
                      track("premium_checkout_started", { method: "rewards" });
                      purchase.mutate(true);
                    }}
                  >
                    Utiliser mes Récompenses Mila
                  </Button>
                )}
              </div>
              {!value.mollieEnabled && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Le paiement en ligne est désactivé dans cet environnement.
                </p>
              )}
              {methods.data?.enabled && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Moyens proposés dynamiquement :{" "}
                  {methods.data.methods.map((method) => method.description).join(", ") ||
                    "aucun moyen disponible"}
                  . Mode {methods.data.mode}.
                </p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
