import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { paymentApi } from "@/features/payments/api";
import { contributionApi } from "@/features/contributions/api";
import { formatCents } from "@/lib/money";

export function PaymentsAdmin() {
  const queryClient = useQueryClient();
  const payments = useQuery({ queryKey: ["admin", "payments"], queryFn: paymentApi.adminList });
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [received, setReceived] = useState("");
  const [payer, setPayer] = useState("");
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
  const reconcileTransfer = useMutation({
    mutationFn: () =>
      contributionApi.reconcile({
        reference,
        receivedCents: Math.round(Number(received) * 100),
        payerName: payer,
        approve: true,
      }),
    onSuccess: () => {
      toast.success("Virement rapproché");
      setReference("");
      setReceived("");
      setPayer("");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-4">
      <section className="rounded-xl border p-4">
        <h3 className="font-medium">Rapprochement de virement</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Une référence ou un montant divergent passe automatiquement en revue manuelle.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_160px_1fr_auto]">
          <Input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Référence MILA-…"
          />
          <Input
            value={received}
            onChange={(event) => setReceived(event.target.value)}
            placeholder="Montant EUR"
          />
          <Input
            value={payer}
            onChange={(event) => setPayer(event.target.value)}
            placeholder="Nom du payeur"
          />
          <Button
            disabled={!reference || !Number(received) || !payer || reconcileTransfer.isPending}
            onClick={() => reconcileTransfer.mutate()}
          >
            Rapprocher
          </Button>
        </div>
      </section>
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
