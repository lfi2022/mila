import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orderApi, type OrderGroup, type OrderStatus } from "@/features/orders/api";
import { formatCents } from "@/lib/money";

export const Route = createFileRoute("/dashboard/orders")({
  head: () => ({ meta: [{ title: "À commander — Mila" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["orders"], queryFn: orderApi.center });
  const [destination, setDestination] = useState("Domicile");
  const [country, setCountry] = useState("BE");
  const [mode, setMode] = useState<"MANUAL_PARENT" | "ASSISTED_PARENT">("MANUAL_PARENT");
  const refresh = () => client.invalidateQueries({ queryKey: ["orders"] });
  const prepare = useMutation({
    mutationFn: (listId: string) =>
      orderApi.prepare(listId, {
        orderMode: mode,
        destination: { label: destination, country },
      }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });
  if (query.isLoading) return <main className="mx-auto max-w-6xl px-4 py-10">Chargement…</main>;
  const data = query.data;
  if (!data?.enabled)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">Le centre de commandes est désactivé.</main>
    );
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl">À commander</h1>
      <p className="mt-2 text-muted-foreground">
        Mila prépare et suit vos commandes. La validation et l’achat restent chez vous ou chez le
        marchand.
      </p>
      {data.candidates.length ? (
        <section className="mt-8 rounded-xl border p-5">
          <h2 className="text-xl">Préparer les cadeaux disponibles</h2>
          <div className="mt-4 grid max-w-3xl gap-3 sm:grid-cols-3">
            <div>
              <Label>Destination</Label>
              <Input value={destination} onChange={(event) => setDestination(event.target.value)} />
            </div>
            <div>
              <Label>Pays</Label>
              <Input
                value={country}
                maxLength={2}
                onChange={(event) => setCountry(event.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL_PARENT">Commande parent manuelle</SelectItem>
                  <SelectItem value="ASSISTED_PARENT">Checklist assistée Mila</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.lists
              .filter((list) => data.candidates.some((gift) => gift.listId === list.id))
              .map((list) => (
                <Button
                  key={list.id}
                  disabled={!destination || country.length !== 2 || prepare.isPending}
                  onClick={() => prepare.mutate(list.id)}
                >
                  Préparer {list.title}
                </Button>
              ))}
          </div>
        </section>
      ) : null}
      <OrderSection title="Prêtes / à valider" groups={data.sections.ready} onChanged={refresh} />
      <OrderSection
        title="En attente de financement"
        groups={data.sections.awaitingFunding}
        onChanged={refresh}
      />
      <OrderSection title="Commandées" groups={data.sections.ordered} onChanged={refresh} />
      <OrderSection title="Reçues" groups={data.sections.received} onChanged={refresh} />
      <OrderSection
        title="Problèmes / annulées"
        groups={data.sections.problems}
        onChanged={refresh}
      />
    </main>
  );
}

function OrderSection({
  title,
  groups,
  onChanged,
}: {
  title: string;
  groups: OrderGroup[];
  onChanged: () => void;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl">{title}</h2>
      {!groups.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Aucune commande.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map((group) => (
            <OrderCard key={group.id} group={group} onChanged={onChanged} />
          ))}
        </div>
      )}
    </section>
  );
}

function OrderCard({ group, onChanged }: { group: OrderGroup; onChanged: () => void }) {
  const [reference, setReference] = useState(group.externalOrderReference ?? "");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const transition = useMutation({
    mutationFn: (status: OrderStatus) =>
      orderApi.transition(group.id, {
        status,
        ...(status === "ORDERED" ? { externalOrderReference: reference } : {}),
        reason: "Action confirmée dans le centre de commandes",
      }),
    onSuccess: onChanged,
    onError: (error: Error) => toast.error(error.message),
  });
  const allocate = useMutation({
    mutationFn: ({ itemId, amount }: { itemId: string; amount: string }) =>
      orderApi.allocate(group.id, itemId, amount),
    onSuccess: onChanged,
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <article className="rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">
            {group.merchantName ?? "Marchand"} · {group.listTitle}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatCents(Number(group.totalMinor), group.currency)} · fonds planifiés{" "}
            {formatCents(Number(group.plannedContributionMinor), group.currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            Livraison : {destinationLabel(group.destination)}
            {group.deliveryMode ? ` · ${group.deliveryMode}` : ""}
          </p>
        </div>
        <Badge variant="outline">{group.status}</Badge>
      </div>
      <ul className="mt-4 space-y-3">
        {group.items
          .filter((item) => item.status !== "EXCLUDED")
          .map((item) => (
            <li key={item.id} className="rounded-lg bg-secondary p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <span>
                  {item.quantity} × {item.title}
                </span>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Ouvrir
                  </a>
                ) : null}
              </div>
              {!["ORDERED", "SHIPPED", "COMPLETED", "CANCELLED"].includes(group.status) ? (
                <div className="mt-2 flex gap-2">
                  <Input
                    className="max-w-36"
                    placeholder="Fonds en cents"
                    value={allocations[item.id] ?? item.contributionAmountMinor}
                    onChange={(event) =>
                      setAllocations({ ...allocations, [item.id]: event.target.value })
                    }
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      allocate.mutate({
                        itemId: item.id,
                        amount: allocations[item.id] ?? item.contributionAmountMinor,
                      })
                    }
                  >
                    Planifier
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {group.status === "READY" || group.status === "WAITING_PARENT" ? (
          <Button onClick={() => transition.mutate("SUBMITTED")}>Commande préparée</Button>
        ) : null}
        {group.status === "SUBMITTED" || group.status === "PARTIALLY_ORDERED" ? (
          <>
            <Input
              className="max-w-52"
              placeholder="Référence commande"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
            <Button disabled={!reference} onClick={() => transition.mutate("ORDERED")}>
              Marquer commandée
            </Button>
          </>
        ) : null}
        {group.status === "ORDERED" ? (
          <Button onClick={() => transition.mutate("SHIPPED")}>Marquer expédiée</Button>
        ) : null}
        {group.status === "ORDERED" || group.status === "SHIPPED" ? (
          <Button onClick={() => transition.mutate("COMPLETED")}>Marquer reçue</Button>
        ) : null}
        {["DRAFT", "READY", "WAITING_PARENT", "SUBMITTED", "PARTIALLY_ORDERED"].includes(
          group.status,
        ) ? (
          <Button variant="outline" onClick={() => transition.mutate("CANCELLED")}>
            Annuler
          </Button>
        ) : null}
      </div>
      {group.history.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Dernière étape : {group.history.at(-1)?.toStatus} ·{" "}
          {new Date(group.history.at(-1)!.createdAt).toLocaleString("fr-BE")}
        </p>
      ) : null}
    </article>
  );
}

function destinationLabel(value: unknown) {
  if (!value || typeof value !== "object") return "non précisée";
  const label = (value as Record<string, unknown>)["label"];
  return typeof label === "string" ? label : "non précisée";
}
