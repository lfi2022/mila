import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { priceApi, type PriceTrackingGift } from "@/features/prices/api";
import { formatCents } from "@/lib/money";

export function PriceTrackingPanel({ listId }: { listId: string }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["price-tracking", listId],
    queryFn: () => priceApi.list(listId),
  });
  const update = useMutation({
    mutationFn: ({
      giftId,
      patch,
    }: {
      giftId: string;
      patch: Parameters<typeof priceApi.update>[2];
    }) => priceApi.update(listId, giftId, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: ["price-tracking", listId] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const updateSettings = useMutation({
    mutationFn: (patch: Parameters<typeof priceApi.updateSettings>[1]) =>
      priceApi.updateSettings(listId, patch),
    onSuccess: () => client.invalidateQueries({ queryKey: ["price-tracking", listId] }),
    onError: (error: Error) => toast.error(error.message),
  });
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!query.data?.enabled)
    return <p className="text-sm text-muted-foreground">Le suivi de prix est désactivé.</p>;
  if (!query.data.gifts.length)
    return <p className="text-sm text-muted-foreground">Aucun cadeau lié à suivre.</p>;
  return (
    <section className="space-y-4">
      <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
        <Preference
          label="Rafraîchir automatiquement les produits"
          checked={query.data.settings.productAutoRefresh}
          onChange={(value) => updateSettings.mutate({ productAutoRefresh: value })}
        />
        <Preference
          label="Mettre à jour le prix affiché"
          checked={query.data.settings.autoUpdatePrice}
          onChange={(value) => updateSettings.mutate({ autoUpdatePrice: value })}
        />
        <Preference
          label="Suggérer une meilleure offre"
          checked={query.data.settings.autoSuggestBetterOffer}
          onChange={(value) => updateSettings.mutate({ autoSuggestBetterOffer: value })}
        />
        <Preference
          label="Autoriser la bascule automatique gardée"
          checked={query.data.settings.autoSwitchBetterOffer}
          onChange={(value) => updateSettings.mutate({ autoSwitchBetterOffer: value })}
        />
        <p className="text-xs text-muted-foreground md:col-span-2">
          Une bascule exige aussi le mode automatique du cadeau, une correspondance produit forte,
          un marchand fiable, une disponibilité confirmée et au moins{" "}
          {query.data.autoSwitchMinSavingsBps / 100} % d’économie. Elle ne s’applique jamais à un
          cadeau réservé.
        </p>
      </div>
      {query.data.gifts.map((gift) => (
        <article key={gift.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-medium">{gift.title}</h3>
              <p className="text-sm text-muted-foreground">
                Ajout {money(gift.priceAtCreationMinor, gift.currency)} · actuel{" "}
                {money(gift.currentPriceMinor, gift.currency)}
                {gift.comparisonReliable && gift.differenceMinor
                  ? ` · écart ${money(gift.differenceMinor, gift.currency)}`
                  : " · variation non comparable"}
              </p>
            </div>
            <Badge variant={gift.linkHealthy === false ? "destructive" : "outline"}>
              {gift.linkHealthy === false ? "Lien à vérifier" : gift.availability || "État inconnu"}
            </Badge>
          </div>
          {gift.bestOffer ? (
            <p className="mt-3 rounded-lg bg-secondary p-3 text-sm">
              Meilleure offre fiable : {money(gift.bestOffer.totalMinor, gift.currency)}
              {gift.bestOffer.deliveryEtaDays !== null
                ? ` · ${gift.bestOffer.deliveryEtaDays} j`
                : ""}
            </p>
          ) : null}
          {gift.switchHistory[0] ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Dernier changement automatique : économie de{" "}
              {money(gift.switchHistory[0].savingsMinor, gift.currency)} le{" "}
              {new Date(gift.switchHistory[0].createdAt).toLocaleDateString("fr-BE")}.
            </p>
          ) : null}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Preference
              label="Alerte baisse de prix"
              checked={gift.priceAlertsEnabled}
              onChange={(value) =>
                update.mutate({ giftId: gift.id, patch: { priceAlertsEnabled: value } })
              }
            />
            <Preference
              label="Alerte indisponibilité"
              checked={gift.availabilityAlertsEnabled}
              onChange={(value) =>
                update.mutate({ giftId: gift.id, patch: { availabilityAlertsEnabled: value } })
              }
            />
            <Preference
              label="Alerte lien mort"
              checked={gift.deadLinkAlertsEnabled}
              onChange={(value) =>
                update.mutate({ giftId: gift.id, patch: { deadLinkAlertsEnabled: value } })
              }
            />
            <Select
              value={gift.offerPreference}
              onValueChange={(value) =>
                update.mutate({
                  giftId: gift.id,
                  patch: { offerPreference: value as PriceTrackingGift["offerPreference"] },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED_MERCHANT">Magasin imposé</SelectItem>
                <SelectItem value="SUGGEST_BEST">Meilleure offre suggérée</SelectItem>
                <SelectItem value="AUTO_BEST" disabled={!query.data.comparisonEnabled}>
                  Changement automatique gardé
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </article>
      ))}
    </section>
  );
}

function Preference({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function money(value: string | null, currency: string) {
  return value === null ? "indisponible" : formatCents(Number(value), currency);
}
