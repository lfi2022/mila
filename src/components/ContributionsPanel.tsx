import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { contributionApi } from "@/features/contributions/api";
import { formatCents } from "@/lib/money";

export function ContributionsPanel({ listId }: { listId: string }) {
  const query = useQuery({
    queryKey: ["contributions", listId],
    queryFn: () => contributionApi.list(listId),
  });
  if (query.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  const data = query.data;
  if (!data) return <p className="text-sm text-muted-foreground">Contributions indisponibles.</p>;
  return (
    <section className="space-y-4">
      <div className="rounded-xl border p-4">
        <p className="text-sm text-muted-foreground">Fonds de tiers confirmés et détenus</p>
        <p className="mt-1 text-2xl font-semibold">{formatCents(data.heldCents)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Ce montant est distinct du revenu Mila. Le versement parent reste{" "}
          {data.payoutEnabled ? "activé" : "désactivé en attente du cadre réglementé"}.
        </p>
      </div>
      {data.contributions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune contribution.</p>
      ) : (
        data.contributions.map((row) => (
          <div key={row.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {row.anonymous ? "Participation anonyme" : row.contributorName || "Participant"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString("fr-BE")}
                </p>
              </div>
              <Badge variant="outline">{row.status}</Badge>
            </div>
            <p className="mt-2 text-sm">
              Total {formatCents(row.amountCents, row.currency)} · frais{" "}
              {formatCents(row.feeCents, row.currency)} · part Mila{" "}
              {formatCents(row.platformShareCents, row.currency)} · parents{" "}
              {formatCents(row.netToParentsCents, row.currency)}
            </p>
            {row.message && <p className="mt-2 text-sm text-muted-foreground">{row.message}</p>}
          </div>
        ))
      )}
    </section>
  );
}
