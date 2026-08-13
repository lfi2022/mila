import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatBps, formatCents, parseAmountToCents } from "@/lib/money";
import {
  adjustWallet,
  getRewardSettings,
  getRewardStats,
  listCommissions,
  listRedemptions,
  listReferralsForReview,
  listWallets,
  recordAffiliateCommission,
  reviewReferral,
  setCommissionStatus,
  setRedemptionStatus,
  setWalletFlag,
  simulateRewardShare,
  updateRewardSettings,
} from "@/lib/rewards-admin.functions";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function RewardsAdmin() {
  const queryClient = useQueryClient();
  const fetchStats = useServerFn(getRewardStats);
  const fetchSettings = useServerFn(getRewardSettings);
  const saveSettings = useServerFn(updateRewardSettings);
  const fetchWallets = useServerFn(listWallets);
  const fetchCommissions = useServerFn(listCommissions);
  const fetchRedemptions = useServerFn(listRedemptions);
  const fetchReferrals = useServerFn(listReferralsForReview);
  const simulate = useServerFn(simulateRewardShare);
  const record = useServerFn(recordAffiliateCommission);
  const setStatus = useServerFn(setCommissionStatus);
  const setRedemption = useServerFn(setRedemptionStatus);
  const flagWallet = useServerFn(setWalletFlag);
  const adjust = useServerFn(adjustWallet);
  const review = useServerFn(reviewReferral);

  const stats = useQuery({ queryKey: ["reward-stats"], queryFn: () => fetchStats() });
  const settings = useQuery({ queryKey: ["reward-settings"], queryFn: () => fetchSettings() });
  const wallets = useQuery({ queryKey: ["reward-wallets"], queryFn: () => fetchWallets() });
  const commissions = useQuery({
    queryKey: ["reward-commissions"],
    queryFn: () => fetchCommissions(),
  });
  const redemptions = useQuery({
    queryKey: ["reward-redemptions"],
    queryFn: () => fetchRedemptions(),
  });
  const referrals = useQuery({ queryKey: ["reward-referrals"], queryFn: () => fetchReferrals() });

  const invalidate = () => {
    for (const key of [
      "reward-stats",
      "reward-settings",
      "reward-wallets",
      "reward-commissions",
      "reward-redemptions",
      "reward-referrals",
    ])
      void queryClient.invalidateQueries({ queryKey: [key] });
  };

  const [form, setForm] = useState({
    sharePercent: "30",
    referralBonus: "5,00",
    minRedemption: "10,00",
    perTransactionCap: "",
    monthlyCap: "",
    lifetimeCap: "",
    referralCap: "",
    explainer: "",
    referralMinItems: "1",
  });

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    const toAmount = (cents: number | null) =>
      cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
    setForm({
      sharePercent: String(s.affiliate_share_rate_bps / 100),
      referralBonus: toAmount(s.referral_bonus_cents),
      minRedemption: toAmount(s.min_redemption_cents),
      perTransactionCap: toAmount(s.per_transaction_cap_cents),
      monthlyCap: toAmount(s.monthly_cap_cents_per_list),
      lifetimeCap: toAmount(s.lifetime_cap_cents_per_list),
      referralCap: toAmount(s.referral_cap_cents),
      explainer: s.explainer_text,
      referralMinItems: String(s.referral_min_items),
    });
  }, [settings.data]);

  const settingsMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => saveSettings({ data: payload as never }),
    onSuccess: () => {
      toast.success("Réglages enregistrés.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = (key: string, value: boolean) =>
    settingsMutation.mutate({ [key]: value } as never);

  const saveNumbers = () => {
    try {
      const optional = (value: string) => (value.trim() === "" ? null : parseAmountToCents(value));
      const percent = Number(form.sharePercent.replace(",", "."));
      if (!Number.isFinite(percent) || percent < 0 || percent > 100)
        throw new Error("Pourcentage invalide");
      settingsMutation.mutate({
        affiliate_share_rate_bps: Math.round(percent * 100),
        referral_bonus_cents: parseAmountToCents(form.referralBonus),
        min_redemption_cents: parseAmountToCents(form.minRedemption),
        per_transaction_cap_cents: optional(form.perTransactionCap),
        monthly_cap_cents_per_list: optional(form.monthlyCap),
        lifetime_cap_cents_per_list: optional(form.lifetimeCap),
        referral_cap_cents: optional(form.referralCap),
        referral_min_items: Number(form.referralMinItems) || 0,
        explainer_text: form.explainer,
      });
    } catch {
      toast.error("Vérifiez les montants (format 12,50).");
    }
  };

  const [sim, setSim] = useState({ amount: "5,00", result: "" });
  const [manual, setManual] = useState({ network: "", externalId: "", amount: "", token: "" });
  const [adjustment, setAdjustment] = useState({ registryId: "", amount: "", reason: "" });

  const s = stats.data;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-display text-xl">Économie réelle du programme</h3>
        <p className="text-sm text-muted-foreground">
          Chiffres calculés uniquement sur des commissions réellement enregistrées. Aucun montant
          simulé.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Revenus confirmés"
            value={formatCents(s?.confirmedRevenueCents ?? 0)}
            hint={`${s?.commissionsCount ?? 0} commissions`}
          />
          <Metric label="Revenus en attente" value={formatCents(s?.pendingRevenueCents ?? 0)} />
          <Metric
            label="Récompenses accordées"
            value={formatCents(s?.rewardsGrantedCents ?? 0)}
            hint={`En attente : ${formatCents(s?.rewardsPendingCents ?? 0)}`}
          />
          <Metric
            label="Marge nette Mila"
            value={formatCents(s?.netMarginCents ?? 0)}
            hint={
              s?.costRatio != null
                ? `Coût récompenses : ${(s.costRatio * 100).toFixed(1)} % des revenus`
                : "Pas encore de revenus"
            }
          />
          <Metric
            label="Engagement à honorer"
            value={formatCents(s?.outstandingLiabilityCents ?? 0)}
            hint={`${s?.walletsCount ?? 0} portefeuilles`}
          />
          <Metric
            label="30 derniers jours"
            value={formatCents(s?.revenue30Cents ?? 0)}
            hint={`Récompenses : ${formatCents(s?.rewards30Cents ?? 0)}`}
          />
          <Metric
            label="Demandes d'utilisation"
            value={String(s?.redemptionsRequested ?? 0)}
            hint={formatCents(s?.redemptionsValueCents ?? 0)}
          />
          <Metric
            label="Parrainages à vérifier"
            value={String(s?.referralsToReview ?? 0)}
            hint={`${s?.referralsTotal ?? 0} au total`}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-xl">Activation</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            ["enabled", "Programme de récompenses"],
            ["affiliate_rewards_enabled", "Récompenses sur commissions"],
            ["referral_rewards_enabled", "Récompenses de parrainage"],
            ["premium_rewards_enabled", "Bonus Premium"],
            ["partner_rewards_enabled", "Bonus partenaires"],
            ["promotional_rewards_enabled", "Bonus promotionnels"],
            ["redemption_enabled", "Utilisation des récompenses"],
            ["marketplace_enabled", "Catalogue d'avantages"],
            ["bank_payout_enabled", "Virement bancaire (désactivé par défaut)"],
            ["referral_requires_verified_email", "Parrainage : email vérifié requis"],
            ["referral_requires_list", "Parrainage : liste créée requise"],
          ].map((entry) => {
            const key = entry[0] as string;
            const label = entry[1] as string;
            return (
              <label
                key={key}
                className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3"
              >
                <span className="text-sm">{label}</span>
                <Switch
                  checked={Boolean((settings.data as Record<string, unknown> | undefined)?.[key])}
                  onCheckedChange={(value) => toggle(key, value)}
                />
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-xl">Taux, bonus et plafonds</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Part reversée aux parents (%)</Label>
            <Input
              value={form.sharePercent}
              onChange={(e) => setForm({ ...form, sharePercent: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Actuel : {settings.data ? formatBps(settings.data.affiliate_share_rate_bps) : "—"}
            </p>
          </div>
          <div>
            <Label>Bonus parrainage</Label>
            <Input
              value={form.referralBonus}
              onChange={(e) => setForm({ ...form, referralBonus: e.target.value })}
            />
          </div>
          <div>
            <Label>Seuil minimum d'utilisation</Label>
            <Input
              value={form.minRedemption}
              onChange={(e) => setForm({ ...form, minRedemption: e.target.value })}
            />
          </div>
          <div>
            <Label>Plafond par transaction (vide = aucun)</Label>
            <Input
              value={form.perTransactionCap}
              onChange={(e) => setForm({ ...form, perTransactionCap: e.target.value })}
            />
          </div>
          <div>
            <Label>Plafond mensuel par liste</Label>
            <Input
              value={form.monthlyCap}
              onChange={(e) => setForm({ ...form, monthlyCap: e.target.value })}
            />
          </div>
          <div>
            <Label>Plafond total par liste</Label>
            <Input
              value={form.lifetimeCap}
              onChange={(e) => setForm({ ...form, lifetimeCap: e.target.value })}
            />
          </div>
          <div>
            <Label>Plafond parrainage par parent</Label>
            <Input
              value={form.referralCap}
              onChange={(e) => setForm({ ...form, referralCap: e.target.value })}
            />
          </div>
          <div>
            <Label>Cadeaux minimum pour valider un parrainage</Label>
            <Input
              value={form.referralMinItems}
              onChange={(e) => setForm({ ...form, referralMinItems: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4">
          <Label>Texte pédagogique affiché aux parents</Label>
          <Textarea
            rows={4}
            value={form.explainer}
            onChange={(e) => setForm({ ...form, explainer: e.target.value })}
          />
        </div>
        <Button className="mt-4" onClick={saveNumbers} disabled={settingsMutation.isPending}>
          Enregistrer
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-xl">Simulateur (aucune écriture)</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <Label>Commission reçue</Label>
            <Input
              className="w-40"
              value={sim.amount}
              onChange={(e) => setSim({ ...sim, amount: e.target.value })}
            />
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const result = await simulate({
                  data: { commissionAmountCents: parseAmountToCents(sim.amount) },
                });
                setSim({
                  ...sim,
                  result: `Parents : ${formatCents(result.rewardCents)} (${formatBps(result.rateBps)}) · Mila : ${formatCents(result.milaCents)}`,
                });
              } catch {
                toast.error("Montant invalide.");
              }
            }}
          >
            Calculer
          </Button>
          {sim.result && <p className="text-sm text-muted-foreground">{sim.result}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-xl">Enregistrer une commission</h3>
        <p className="text-sm text-muted-foreground">
          Import manuel ou réconciliation. Idempotent : le même identifiant externe ne crédite
          jamais deux fois.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Input
            placeholder="Réseau (ex. awin)"
            value={manual.network}
            onChange={(e) => setManual({ ...manual, network: e.target.value })}
          />
          <Input
            placeholder="ID externe"
            value={manual.externalId}
            onChange={(e) => setManual({ ...manual, externalId: e.target.value })}
          />
          <Input
            placeholder="Commission (12,50)"
            value={manual.amount}
            onChange={(e) => setManual({ ...manual, amount: e.target.value })}
          />
          <Input
            placeholder="Jeton cadeau (optionnel)"
            value={manual.token}
            onChange={(e) => setManual({ ...manual, token: e.target.value })}
          />
        </div>
        <Button
          className="mt-3"
          onClick={async () => {
            try {
              await record({
                data: {
                  network: manual.network,
                  externalId: manual.externalId,
                  commissionAmountCents: parseAmountToCents(manual.amount),
                  itemPublicToken: manual.token || null,
                  status: "PENDING",
                },
              });
              toast.success("Commission enregistrée.");
              setManual({ network: "", externalId: "", amount: "", token: "" });
              invalidate();
            } catch (error) {
              toast.error((error as Error).message);
            }
          }}
        >
          Enregistrer
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-xl">Commissions</h3>
        <div className="mt-4 space-y-2">
          {(commissions.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune commission enregistrée.</p>
          )}
          {(commissions.data ?? []).map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {c.network} · {formatCents(c.commission_amount_cents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.external_id} — {new Date(c.occurred_at).toLocaleDateString("fr-BE")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    c.status === "CONFIRMED"
                      ? "default"
                      : c.status === "CANCELLED"
                        ? "outline"
                        : "secondary"
                  }
                >
                  {c.status}
                </Badge>
                {c.status !== "CONFIRMED" && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      await setStatus({ data: { commissionId: c.id, status: "CONFIRMED" } });
                      toast.success("Commission confirmée.");
                      invalidate();
                    }}
                  >
                    Confirmer
                  </Button>
                )}
                {c.status !== "CANCELLED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await setStatus({ data: { commissionId: c.id, status: "CANCELLED" } });
                      toast.success("Commission annulée.");
                      invalidate();
                    }}
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-xl">Portefeuilles</h3>
        <div className="mt-4 space-y-2">
          {(wallets.data ?? []).map((w) => (
            <div
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{w.title}</p>
                <p className="text-xs text-muted-foreground">
                  Disponible {formatCents(w.availableCents)} · En attente{" "}
                  {formatCents(w.pendingCents)} · Cumul {formatCents(w.lifetimeEarnedCents)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {w.flagged && <Badge variant="destructive">Signalé</Badge>}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await flagWallet({ data: { walletId: w.id, flagged: !w.flagged } });
                    invalidate();
                  }}
                >
                  {w.flagged ? "Retirer le signalement" : "Signaler"}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Input
            placeholder="ID de liste"
            value={adjustment.registryId}
            onChange={(e) => setAdjustment({ ...adjustment, registryId: e.target.value })}
          />
          <Input
            placeholder="Montant (12,50 ou -12,50)"
            value={adjustment.amount}
            onChange={(e) => setAdjustment({ ...adjustment, amount: e.target.value })}
          />
          <Input
            placeholder="Motif"
            value={adjustment.reason}
            onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })}
          />
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await adjust({
                  data: {
                    registryId: adjustment.registryId,
                    amountCents: parseAmountToCents(adjustment.amount),
                    reason: adjustment.reason,
                    type: "ADJUSTMENT",
                  },
                });
                toast.success("Ajustement enregistré.");
                setAdjustment({ registryId: "", amount: "", reason: "" });
                invalidate();
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            Ajuster
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-xl">Demandes d'utilisation</h3>
        <div className="mt-4 space-y-2">
          {(redemptions.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune demande.</p>
          )}
          {(redemptions.data ?? []).map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {r.type} · {formatCents(r.amount_cents)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.requested_at).toLocaleDateString("fr-BE")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{r.status}</Badge>
                {r.status === "REQUESTED" && (
                  <>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await setRedemption({ data: { redemptionId: r.id, status: "PROCESSED" } });
                        toast.success("Demande traitée.");
                        invalidate();
                      }}
                    >
                      Traiter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await setRedemption({ data: { redemptionId: r.id, status: "REJECTED" } });
                        toast.success("Demande refusée, solde restitué.");
                        invalidate();
                      }}
                    >
                      Refuser
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-xl">Parrainages</h3>
        <div className="mt-4 space-y-2">
          {(referrals.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun parrainage.</p>
          )}
          {(referrals.data ?? []).map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">Code {r.code}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("fr-BE")} · signaux :{" "}
                  {Array.isArray(r.risk_signals) && r.risk_signals.length
                    ? r.risk_signals.join(", ")
                    : "aucun"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={r.needs_review ? "destructive" : "outline"}>
                  {r.needs_review ? "À vérifier" : r.status}
                </Badge>
                {r.needs_review && (
                  <>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await review({ data: { referralId: r.id, approve: true } });
                        toast.success("Parrainage validé.");
                        invalidate();
                      }}
                    >
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await review({ data: { referralId: r.id, approve: false } });
                        toast.success("Parrainage refusé.");
                        invalidate();
                      }}
                    >
                      Refuser
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
