import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { paymentApi } from "@/features/payments/api";
import { giftFundsApi } from "@/features/payments/gift-funds";
import { formatCents } from "@/lib/money";

export function PaymentsAdmin() {
  const queryClient = useQueryClient();
  const payments = useQuery({ queryKey: ["admin", "payments"], queryFn: paymentApi.adminList });
  const payouts = useQuery({
    queryKey: ["admin", "gift-payouts"],
    queryFn: giftFundsApi.adminList,
  });
  const [transferReference, setTransferReference] = useState<Record<string, string>>({});
  const payoutAction = useMutation({
    mutationFn: async (input: { id: string; action: "approve" | "reject" | "complete" }) => {
      if (input.action === "complete")
        return giftFundsApi.complete(input.id, transferReference[input.id] ?? "");
      return giftFundsApi.decide(input.id, input.action === "approve");
    },
    onSuccess: async () => {
      toast.success("Demande mise à jour");
      await queryClient.invalidateQueries({ queryKey: ["admin", "gift-payouts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const refund = useMutation({
    mutationFn: () =>
      paymentApi.refund(selected!, Math.round(Number(amount) * 100), reason, crypto.randomUUID()),
    onSuccess: async () => {
      toast.success("Remboursement transmis à Mollie");
      setSelected(null);
      setAmount("");
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const reconcile = useMutation({
    mutationFn: paymentApi.reconcile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
      toast.success("Paiement rapproché avec Mollie");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Virements manuels demandés par les parents</h2>
      {payouts.data?.payouts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune demande.</p>
      ) : null}
      {payouts.data?.payouts.map((payout) => (
        <section key={payout.id} className="rounded-xl border p-4">
          <p className="font-medium">
            {payout.listTitle} · {formatCents(payout.amountCents, payout.currency)} ·{" "}
            {payout.status}
          </p>
          <p className="text-sm">
            {payout.beneficiary ?? "Bénéficiaire absent"} · {payout.ibanMasked ?? "IBAN absent"}
          </p>
          {payout.status === "REQUESTED" ? (
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                disabled={payoutAction.isPending}
                onClick={() => payoutAction.mutate({ id: payout.id, action: "approve" })}
              >
                Valider
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={payoutAction.isPending}
                onClick={() => payoutAction.mutate({ id: payout.id, action: "reject" })}
              >
                Refuser
              </Button>
            </div>
          ) : null}
          {payout.status === "APPROVED" ? (
            <div className="mt-2 space-y-2">
              <p className="font-mono text-sm">IBAN : {payout.iban ?? "Indisponible"}</p>
              <Input
                placeholder="Référence du virement effectué"
                value={transferReference[payout.id] ?? ""}
                onChange={(event) =>
                  setTransferReference((current) => ({
                    ...current,
                    [payout.id]: event.target.value,
                  }))
                }
              />
              <Button
                size="sm"
                disabled={
                  payoutAction.isPending || (transferReference[payout.id] ?? "").trim().length < 3
                }
                onClick={() => payoutAction.mutate({ id: payout.id, action: "complete" })}
              >
                Marquer le virement effectué
              </Button>
            </div>
          ) : null}
          {payout.reference ? <p className="text-xs">Référence : {payout.reference}</p> : null}
        </section>
      ))}
      <p className="text-sm text-muted-foreground">
        Mode fournisseur : <strong>{payments.data?.mode ?? "…"}</strong>. Les remboursements
        partiels et complets sont idempotents et rapprochés depuis Mollie.
      </p>
      {payments.data?.payments.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun paiement interne.</p>
      )}
      {payments.data?.payments.map((payment) => (
        <section key={payment.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {payment.purpose} · {formatCents(payment.amountCents, payment.currency)}
              </p>
              <p className="text-xs text-muted-foreground">
                {payment.provider} · liste {payment.listId ?? "—"} ·{" "}
                {new Date(payment.createdAt).toLocaleString("fr-BE")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{payment.status}</Badge>
              {payment.refundedCents > 0 && (
                <Badge variant="secondary">
                  Remboursé {formatCents(payment.refundedCents, payment.currency)}
                </Badge>
              )}
              {payment.chargebackCents > 0 && (
                <Badge variant="destructive">
                  Chargeback {formatCents(payment.chargebackCents, payment.currency)}
                </Badge>
              )}
            </div>
          </div>
          {payment.provider === "MOLLIE" && payment.externalId && (
            <Button
              className="mt-3 mr-2"
              size="sm"
              variant="secondary"
              disabled={reconcile.isPending}
              onClick={() => reconcile.mutate(payment.id)}
            >
              Rapprocher
            </Button>
          )}
          {["PAID", "PARTIALLY_REFUNDED"].includes(payment.status) &&
            (selected === payment.id ? (
              <div className="mt-4 grid gap-2 md:grid-cols-[160px_1fr_auto]">
                <Input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Montant EUR"
                />
                <Input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Motif du remboursement"
                />
                <Button
                  disabled={!Number(amount) || reason.trim().length < 3 || refund.isPending}
                  onClick={() => refund.mutate()}
                >
                  Confirmer
                </Button>
              </div>
            ) : (
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                onClick={() => setSelected(payment.id)}
              >
                Rembourser
              </Button>
            ))}
        </section>
      ))}
    </div>
  );
}
