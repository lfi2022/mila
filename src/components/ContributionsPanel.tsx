import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { contributionApi } from "@/features/contributions/api";
import { formatCents } from "@/lib/money";
import { toast } from "sonner";

export function ContributionsPanel({ listId }: { listId: string }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["contributions", listId],
    queryFn: () => contributionApi.list(listId),
  });
  const action = useMutation({
    mutationFn: ({ id, confirm }: { id: string; confirm: boolean }) =>
      confirm ? contributionApi.confirm(listId, id) : contributionApi.cancel(listId, id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["contributions", listId] });
      toast.success("Participation mise à jour");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const recipientAction = useMutation({
    mutationFn: (recipientUserId: string) => contributionApi.setRecipient(listId, recipientUserId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["contributions", listId] });
      toast.success("Compte destinataire mis à jour");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  const data = query.data;
  if (!data) return <p className="text-sm text-muted-foreground">Contributions indisponibles.</p>;
  return (
    <section className="space-y-4">
      <div className="rounded-xl border p-4">
        <p className="text-sm text-muted-foreground">Virements confirmés comme reçus</p>
        <p className="mt-1 text-2xl font-semibold">{formatCents(data.receivedCents)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Les virements arrivent directement sur votre compte
          {data.destination ? ` ${data.destination.ibanMasked}` : ""}. Mila ne détient pas ces
          fonds.
        </p>
      </div>
      {data.canManageDestination ? (
        <div className="rounded-xl border p-4">
          <label htmlFor="contribution-recipient" className="text-sm font-medium">
            Parent qui reçoit les prochains virements
          </label>
          <select
            id="contribution-recipient"
            className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={data.recipientUserId ?? ""}
            disabled={recipientAction.isPending}
            onChange={(event) => {
              const recipientUserId = event.target.value;
              if (!recipientUserId || recipientUserId === data.recipientUserId) return;
              if (
                window.confirm(
                  "Utiliser le compte de ce parent pour toutes les prochaines participations ? Les instructions déjà créées ne seront pas modifiées.",
                )
              )
                recipientAction.mutate(recipientUserId);
            }}
          >
            <option value="" disabled>
              Choisir un parent
            </option>
            {data.recipients.map((recipient) => (
              <option
                key={recipient.userId}
                value={recipient.userId}
                disabled={!recipient.hasBankAccount}
              >
                {recipient.displayName || recipient.email} ·{" "}
                {recipient.role === "OWNER" ? "Parent principal" : "Coparent"}
                {recipient.hasBankAccount
                  ? ` · ${recipient.ibanMasked}`
                  : " · aucun compte configuré"}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            Chaque parent configure son propre IBAN dans son profil. Un changement ne concerne que
            les nouvelles instructions de virement.
          </p>
        </div>
      ) : null}
      {data.contributions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune contribution.</p>
      ) : (
        data.contributions.map((row) => (
          <div key={row.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {row.contributorName || "Participant"}
                  {row.anonymous ? " · affichage public anonyme" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString("fr-BE")}
                </p>
              </div>
              <Badge variant="outline">{row.status}</Badge>
            </div>
            <p className="mt-2 text-sm">
              Montant attendu : {formatCents(row.amountCents, row.currency)}
            </p>
            {row.reference ? (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Communication : {row.reference}
              </p>
            ) : null}
            {row.transferDestination ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Destinataire : {row.transferDestination.beneficiary} ·{" "}
                {row.transferDestination.ibanMasked}
              </p>
            ) : null}
            {row.message && <p className="mt-2 text-sm text-muted-foreground">{row.message}</p>}
            {row.status === "PENDING" && data.canConfirm ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={action.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Confirmez-vous avoir reçu ce montant sur votre compte bancaire ?",
                      )
                    )
                      action.mutate({ id: row.id, confirm: true });
                  }}
                >
                  Confirmer la réception
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={action.isPending}
                  onClick={() => {
                    if (window.confirm("Annuler cette intention de participation ?"))
                      action.mutate({ id: row.id, confirm: false });
                  }}
                >
                  Annuler l’intention
                </Button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </section>
  );
}
