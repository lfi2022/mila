import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { giftFundsApi } from "@/features/payments/gift-funds";
import { formatCents } from "@/lib/money";

export function GiftFundsPanel({ listId }: { listId: string }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const funds = useQuery({
    queryKey: ["gift-funds", listId],
    queryFn: () => giftFundsApi.summary(listId),
  });
  const request = useMutation({
    mutationFn: () => giftFundsApi.request(listId, Math.round(Number(amount) * 100)),
    onSuccess: async () => {
      setAmount("");
      toast.success("Demande de virement envoyée");
      await queryClient.invalidateQueries({ queryKey: ["gift-funds", listId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const value = funds.data;
  return (
    <section className="mt-8 space-y-4 rounded-xl border p-5">
      <h2 className="font-display text-xl">Paiements des cadeaux</h2>
      <p className="text-sm text-muted-foreground">
        Code de suivi de cette liste : {value?.clientCode ?? "…"}. Le montant ci-dessous est
        attribué à votre liste dans Mila ; le virement sera traité manuellement après validation.
      </p>
      {value ? (
        <>
          <p>
            Montant attribué : <strong>{formatCents(value.allocatedCents, value.currency)}</strong>{" "}
            · Disponible pour demander :{" "}
            <strong>{formatCents(value.requestableCents, value.currency)}</strong>
          </p>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="payout-amount">Demander un virement (EUR)</Label>
            <Input
              id="payout-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <Button
              disabled={
                request.isPending ||
                !Number(amount) ||
                Math.round(Number(amount) * 100) > value.requestableCents
              }
              onClick={() => request.mutate()}
            >
              Envoyer la demande
            </Button>
          </div>
          <h3 className="font-medium">Transactions</h3>
          {value.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun paiement de cadeau.</p>
          ) : (
            <ul className="space-y-2">
              {value.payments.map((payment) => (
                <li key={payment.id} className="rounded-lg bg-secondary/50 p-3 text-sm">
                  <strong>{formatCents(payment.amountCents, payment.currency)}</strong> ·{" "}
                  {payment.status} ·{new Date(payment.createdAt).toLocaleDateString("fr-BE")}
                  <ul>
                    {payment.items.map((item, index) => (
                      <li key={index}>
                        {item.giftTitle} ·{formatCents(item.amountCents, payment.currency)} ·{" "}
                        {item.allocationStatus}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {value.payouts.length > 0 ? (
            <>
              <h3 className="font-medium">Demandes de virement</h3>
              <ul>
                {value.payouts.map((payout) => (
                  <li key={payout.id} className="text-sm">
                    {formatCents(payout.amountCents, payout.currency)} · {payout.status}
                    {payout.reference ? ` · Référence ${payout.reference}` : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
