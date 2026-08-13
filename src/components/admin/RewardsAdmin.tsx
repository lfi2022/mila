import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/money";
import {
  createRewardAdjustment,
  getRewardAdminAnalytics,
  getRewardReviewQueue,
  reviewRewardRedemption,
  reviewRewardReferral,
} from "@/features/rewards/api";

export function RewardsAdmin() {
  const queryClient = useQueryClient();
  const analytics = useQuery({
    queryKey: ["admin", "rewards", "analytics"],
    queryFn: getRewardAdminAnalytics,
  });
  const queue = useQuery({
    queryKey: ["admin", "rewards", "queue"],
    queryFn: getRewardReviewQueue,
  });
  const [listId, setListId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "rewards"] });
  };
  const reviewReferral = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewRewardReferral(
        id,
        approve,
        approve ? "Contrôle manuel approuvé" : "Contrôle manuel refusé",
      ),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const reviewRedemption = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      reviewRewardRedemption(id, approve, approve ? "Conversion approuvée" : "Conversion refusée"),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const adjustment = useMutation({
    mutationFn: () =>
      createRewardAdjustment({ listId, amountCents: Math.round(Number(amount) * 100), reason }),
    onSuccess: async () => {
      toast.success("Ajustement audité créé");
      setAmount("");
      setReason("");
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const stats = analytics.data;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric
          label="Revenu confirmé"
          value={stats ? formatCents(stats.confirmedRevenueCents) : "…"}
        />
        <Metric
          label="Récompenses accordées"
          value={stats ? formatCents(stats.rewardsGrantedCents) : "…"}
        />
        <Metric label="Marge nette" value={stats ? formatCents(stats.netMarginCents) : "…"} />
        <Metric label="Coût / revenu" value={stats ? `${stats.costRatio.toFixed(2)} %` : "…"} />
        <Metric label="Wallets signalés" value={stats ? String(stats.flaggedWallets) : "…"} />
        <Metric label="Soldes anormaux" value={stats ? String(stats.negativeWallets) : "…"} />
      </div>

      <section className="rounded-xl border p-4">
        <h3 className="font-medium">Ajustement manuel immuable</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Une correction crée une nouvelle écriture signée et un événement d’audit.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Input
            placeholder="ID de liste"
            value={listId}
            onChange={(event) => setListId(event.target.value)}
          />
          <Input
            placeholder="Montant en euros (ex. -5.00)"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Input
            placeholder="Motif obligatoire"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <Button
          className="mt-3"
          disabled={!listId || !Number(amount) || reason.trim().length < 3 || adjustment.isPending}
          onClick={() => adjustment.mutate()}
        >
          Enregistrer l’ajustement
        </Button>
      </section>

      <ReviewSection title="Parrainages à contrôler" empty="Aucun parrainage à contrôler.">
        {queue.data?.referrals.map((row) => (
          <ReviewRow
            key={row.id}
            label={`Code ${row.code} · ${new Date(row.createdAt).toLocaleDateString("fr-BE")}`}
            pending={reviewReferral.isPending}
            onApprove={() => reviewReferral.mutate({ id: row.id, approve: true })}
            onReject={() => reviewReferral.mutate({ id: row.id, approve: false })}
          />
        ))}
      </ReviewSection>

      <ReviewSection title="Conversions à contrôler" empty="Aucune conversion en attente.">
        {queue.data?.redemptions.map((row) => (
          <ReviewRow
            key={row.id}
            label={`${formatCents(row.amountCents, row.currency)} · liste ${row.listId}`}
            pending={reviewRedemption.isPending}
            onApprove={() => reviewRedemption.mutate({ id: row.id, approve: true })}
            onReject={() => reviewRedemption.mutate({ id: row.id, approve: false })}
          />
        ))}
      </ReviewSection>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ReviewSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="rounded-xl border p-4">
      <h3 className="font-medium">{title}</h3>
      <div className="mt-3 space-y-2">
        {hasChildren ? children : <p className="text-sm text-muted-foreground">{empty}</p>}
      </div>
    </section>
  );
}

function ReviewRow({
  label,
  pending,
  onApprove,
  onReject,
}: {
  label: string;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
      <span className="text-sm">{label}</span>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={onApprove}>
          Approuver
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={onReject}>
          Refuser
        </Button>
      </div>
    </div>
  );
}
