import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { getListRewards, listRewardOffers, requestRewardRedemption } from "@/features/rewards/api";

const TYPE_LABELS: Record<string, string> = {
  AFFILIATE_COMMISSION: "Achat depuis votre liste",
  REFERRAL: "Parrainage",
  PREMIUM_PURCHASE: "Bonus Premium",
  PARTNER_BONUS: "Bonus partenaire",
  PROMOTIONAL_BONUS: "Offre promotionnelle",
  ADJUSTMENT: "Ajustement Mila",
  REDEMPTION: "Utilisation de récompenses",
};

const STATUS_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  PENDING: { label: "En attente", variant: "secondary" },
  CONFIRMED: { label: "Disponible", variant: "default" },
  CANCELLED: { label: "Annulée", variant: "outline" },
  EXPIRED: { label: "Expirée", variant: "outline" },
};

export function RewardsPanel({ registryId }: { registryId: string }) {
  const queryClient = useQueryClient();
  const fetchRewards = useServerFn(getListRewards);
  const fetchOffers = useServerFn(listRewardOffers);
  const redeem = useServerFn(requestRewardRedemption);

  const rewards = useQuery({
    queryKey: ["rewards", registryId],
    queryFn: () => fetchRewards({ data: { registryId } }),
  });
  const offers = useQuery({ queryKey: ["reward-offers"], queryFn: () => fetchOffers() });

  const redeemMutation = useMutation({
    mutationFn: (offerId?: string) =>
      redeem({ data: { registryId, ...(offerId ? { offerId } : {}) } }),
    onSuccess: (result) => {
      toast.success(`Demande enregistrée : ${result.label} (${formatCents(result.amountCents)})`);
      void queryClient.invalidateQueries({ queryKey: ["rewards", registryId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (rewards.isLoading)
    return <p className="text-sm text-muted-foreground">Chargement de vos récompenses…</p>;
  const data = rewards.data;
  if (!data)
    return (
      <p className="text-sm text-muted-foreground">Récompenses indisponibles pour le moment.</p>
    );

  if (!data.programEnabled) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl">Récompenses Mila</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Le programme de récompenses n'est pas encore actif sur votre compte. Vous serez prévenus
          dès son ouverture.
        </p>
      </div>
    );
  }

  const canRedeem = data.redemptionEnabled && data.availableCents >= data.minRedemptionCents;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Disponible</p>
          <p className="mt-1 font-display text-3xl">
            {formatCents(data.availableCents, data.currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">En attente de confirmation</p>
          <p className="mt-1 font-display text-3xl">
            {formatCents(data.pendingCents, data.currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Cumul gagné</p>
          <p className="mt-1 font-display text-3xl">
            {formatCents(data.lifetimeEarnedCents, data.currency)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-secondary/40 p-5 text-sm leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Comment ça marche ?</p>
        <p className="mt-2 whitespace-pre-line">{data.explainerText}</p>
        <p className="mt-2">
          Une récompense reste « en attente » tant que le marchand n'a pas définitivement validé
          l'achat. Elle devient disponible ensuite, et peut être annulée en cas de retour ou
          d'annulation de commande.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg">Utiliser mes récompenses</h3>
            <p className="text-sm text-muted-foreground">
              {data.redemptionEnabled
                ? `À partir de ${formatCents(data.minRedemptionCents, data.currency)} de solde disponible.`
                : "L'utilisation des récompenses ouvrira prochainement."}
            </p>
          </div>
          {data.redemptionEnabled && (offers.data?.offers.length ?? 0) === 0 && (
            <Button
              disabled={!canRedeem || redeemMutation.isPending}
              onClick={() => redeemMutation.mutate(undefined)}
            >
              Convertir en crédit Mila
            </Button>
          )}
        </div>

        {data.redemptionEnabled && (offers.data?.offers.length ?? 0) > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {offers.data?.offers.map((offer) => (
              <div key={offer.id} className="rounded-xl border border-border p-4">
                <p className="font-medium">{offer.title}</p>
                {offer.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{offer.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm">{formatCents(offer.costCents, data.currency)}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={data.availableCents < offer.costCents || redeemMutation.isPending}
                    onClick={() => redeemMutation.mutate(offer.id)}
                  >
                    Choisir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-lg">Historique</h3>
        {data.transactions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Aucun mouvement pour l'instant. Vos récompenses arriveront quand vos proches achèteront
            des cadeaux depuis votre liste.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {data.transactions.map((txn) => {
              const status = STATUS_LABELS[txn.status] ?? {
                label: txn.status,
                variant: "outline" as const,
              };
              return (
                <li key={txn.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {TYPE_LABELS[txn.type] ?? txn.type}
                      {txn.source ? ` · ${txn.source}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(txn.createdAt).toLocaleDateString("fr-BE")}
                      {txn.description ? ` — ${txn.description}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <span
                      className={
                        txn.amountCents < 0
                          ? "text-sm text-muted-foreground"
                          : "text-sm font-medium"
                      }
                    >
                      {txn.amountCents > 0 ? "+" : ""}
                      {formatCents(txn.amountCents, data.currency)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {data.redemptions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-lg">Demandes d'utilisation</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {data.redemptions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span>
                  {formatCents(r.amountCents, data.currency)} —{" "}
                  {new Date(r.requestedAt).toLocaleDateString("fr-BE")}
                </span>
                <Badge variant="outline">{r.status}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
