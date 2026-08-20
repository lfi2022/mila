import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listApi } from "@/features/lists/api";
import { memoryApi } from "@/features/memories/api";
import { memoriesUiEnabled, runtimeConfig } from "@/config/runtime";

export const Route = createFileRoute("/dashboard/memories")({
  beforeLoad: () => {
    if (!memoriesUiEnabled) throw redirect({ to: "/dashboard" });
  },
  head: () => ({ meta: [{ title: "Messages et souvenirs — Mila" }] }),
  component: MemoriesPage,
});

function MemoriesPage() {
  const client = useQueryClient();
  const lists = useQuery({ queryKey: ["lists", "memories"], queryFn: listApi.mine });
  const [listId, setListId] = useState("");
  const selected = listId || lists.data?.[0]?.id || "";
  const offers = useQuery({
    queryKey: ["second-hand", selected],
    queryFn: () => memoryApi.offers(selected),
    enabled: Boolean(selected) && runtimeConfig.secondHandOffersEnabled,
    retry: false,
  });
  const messages = useQuery({
    queryKey: ["memory-messages", selected],
    queryFn: () => memoryApi.messages(selected),
    enabled: Boolean(selected) && runtimeConfig.mediaMessagesEnabled,
    retry: false,
  });
  const thanks = useQuery({
    queryKey: ["thank-yous", selected],
    queryFn: () => memoryApi.thankYous(selected),
    enabled: Boolean(selected) && runtimeConfig.thankYousEnabled,
    retry: false,
  });
  const book = useQuery({
    queryKey: ["memory-book", selected],
    queryFn: () => memoryApi.book(selected),
    enabled: Boolean(selected) && runtimeConfig.memoryBookEnabled,
    retry: false,
  });
  const refresh = () =>
    client.invalidateQueries({ predicate: (query) => query.queryKey.includes(selected) });
  const action = useMutation({
    mutationFn: async (run: () => Promise<unknown>) => run(),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [introduction, setIntroduction] = useState("");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl">Messages, remerciements et souvenirs</h1>
      <p className="mt-2 text-muted-foreground">
        Chaque média reste privé et chaque contenu du livre doit être approuvé par un parent.
      </p>
      <div className="mt-6 max-w-md">
        <Label>Liste</Label>
        <select
          className="h-10 w-full rounded-md border bg-background px-3"
          value={selected}
          onChange={(event) => setListId(event.target.value)}
        >
          {lists.data?.map((list) => (
            <option key={list.id} value={list.id}>
              {list.title}
            </option>
          ))}
        </select>
      </div>

      {runtimeConfig.secondHandOffersEnabled ? (
        <Section title="Propositions d’occasion">
          {offers.data?.map((offer) => (
            <article key={offer.id} className="rounded-lg border p-4">
              <strong>{offer.gift.title}</strong> · {offer.proposerName} · {offer.condition}
              <p className="text-sm text-muted-foreground">{offer.comment}</p>
              <div className="mt-3 flex gap-2">
                {offer.photoStorageKey ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      action.mutate(async () => {
                        const { url } = await memoryApi.offerPhoto(selected, offer.id);
                        window.open(url, "_blank", "noopener");
                      })
                    }
                  >
                    Voir la photo scannée
                  </Button>
                ) : null}
                {offer.status === "PENDING" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        action.mutate(() => memoryApi.reviewOffer(selected, offer.id, true))
                      }
                    >
                      Accepter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        action.mutate(() => memoryApi.reviewOffer(selected, offer.id, false))
                      }
                    >
                      Refuser
                    </Button>
                  </>
                ) : (
                  <span className="text-sm">{offer.status}</span>
                )}
              </div>
            </article>
          ))}
          {!offers.data?.length ? <Empty /> : null}
        </Section>
      ) : null}

      {runtimeConfig.mediaMessagesEnabled ? (
        <Section title="Messages privés">
          {messages.data?.map((message) => (
            <article key={message.id} className="rounded-lg border p-4">
              <strong>{message.guestName ?? "Un proche"}</strong>
              {message.gift ? ` · ${message.gift.title}` : ""}
              <p className="mt-1 whitespace-pre-wrap">{message.text}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {message.media.map((asset) => (
                  <Button
                    key={asset.id}
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      action.mutate(async () => {
                        const { url } = await memoryApi.mediaUrl(selected, asset.id);
                        window.open(url, "_blank", "noopener");
                      })
                    }
                  >
                    {asset.kind} · {asset.scanStatus === "CLEAN" ? "analysé" : "vérifier l’analyse"}
                  </Button>
                ))}
                {runtimeConfig.memoryBookEnabled ? (
                  <Button
                    size="sm"
                    variant={message.approvedForMemory ? "secondary" : "outline"}
                    onClick={() =>
                      action.mutate(() =>
                        memoryApi.approveMessage(selected, message.id, !message.approvedForMemory),
                      )
                    }
                  >
                    {message.approvedForMemory ? "Retirer du livre" : "Autoriser pour le livre"}
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
          {!messages.data?.length ? <Empty /> : null}
        </Section>
      ) : null}

      {runtimeConfig.thankYousEnabled ? (
        <Section title="Remerciements">
          <Button asChild size="sm" variant="outline">
            <a href={memoryApi.thankYouExportUrl(selected)}>Exporter le suivi CSV</a>
          </Button>
          {thanks.data?.map((reservation) => {
            const value =
              drafts[reservation.id] ??
              reservation.thankYou?.draft ??
              `Merci ${reservation.guestName} pour ${reservation.gift.title} !`;
            return (
              <article key={reservation.id} className="rounded-lg border p-4">
                <strong>{reservation.guestName}</strong> · {reservation.gift.title}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      action.mutate(() =>
                        memoryApi.updateThankYou(selected, reservation.id, {
                          received: !reservation.thankYou?.receivedAt,
                        }),
                      )
                    }
                  >
                    {reservation.thankYou?.receivedAt ? "Reçu ✓" : "Marquer reçu"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      action.mutate(() =>
                        memoryApi.updateThankYou(selected, reservation.id, {
                          thanked: !reservation.thankYou?.thankedAt,
                        }),
                      )
                    }
                  >
                    {reservation.thankYou?.thankedAt ? "Remercié ✓" : "Marquer remercié"}
                  </Button>
                  {reservation.thankYou?.draftApprovedAt ? (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={memoryApi.cardUrl(selected, reservation.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Voir la carte
                      </a>
                    </Button>
                  ) : null}
                </div>
                <Textarea
                  className="mt-3"
                  value={value}
                  onChange={(event) =>
                    setDrafts({ ...drafts, [reservation.id]: event.target.value })
                  }
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      action.mutate(() =>
                        memoryApi.updateThankYou(selected, reservation.id, { draft: value }),
                      )
                    }
                  >
                    Enregistrer le brouillon
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      action.mutate(() =>
                        memoryApi.updateThankYou(selected, reservation.id, {
                          draft: value,
                          approveDraft: true,
                          cardTheme: "soft",
                          cardMessage: value,
                        }),
                      )
                    }
                  >
                    Approuver et créer la carte
                  </Button>
                </div>
              </article>
            );
          })}
          {!thanks.data?.length ? <Empty /> : null}
        </Section>
      ) : null}

      {runtimeConfig.memoryBookEnabled ? (
        <Section title="Livre souvenir">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Titre</Label>
              <Input
                value={title || book.data?.book.title || ""}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div>
              <Label>Conservation des médias (mois)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                defaultValue={book.data?.book.retentionMonths ?? 24}
                id="retention"
              />
            </div>
          </div>
          <Label className="mt-3 block">Introduction</Label>
          <Textarea
            value={introduction || book.data?.book.introduction || ""}
            onChange={(event) => setIntroduction(event.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() =>
                action.mutate(() =>
                  memoryApi.updateBook(selected, {
                    title,
                    introduction,
                    retentionMonths: Number(
                      (document.getElementById("retention") as HTMLInputElement)?.value || 24,
                    ),
                  }),
                )
              }
            >
              Enregistrer
            </Button>
            <Button asChild variant="outline">
              <a href={memoryApi.printUrl(selected)} target="_blank" rel="noreferrer">
                Exporter / imprimer en PDF
              </a>
            </Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {book.data?.sources.messages.map((source) => (
              <Source
                key={source.id}
                label={`Message de ${source.guestName ?? "un proche"}`}
                selected={book.data.items.some(
                  (item) => item.sourceType === "MESSAGE" && item.sourceId === source.id,
                )}
                onToggle={() => {
                  const item = book.data.items.find(
                    (candidate) =>
                      candidate.sourceType === "MESSAGE" && candidate.sourceId === source.id,
                  );
                  action.mutate(() =>
                    item
                      ? memoryApi.removeItem(selected, item.id)
                      : memoryApi.addItem(selected, "MESSAGE", source.id),
                  );
                }}
              />
            ))}
            {book.data?.sources.gifts.map((source) => (
              <Source
                key={source.id}
                label={source.title}
                selected={book.data.items.some(
                  (item) => item.sourceType === "GIFT" && item.sourceId === source.id,
                )}
                onToggle={() => {
                  const item = book.data.items.find(
                    (candidate) =>
                      candidate.sourceType === "GIFT" && candidate.sourceId === source.id,
                  );
                  action.mutate(() =>
                    item
                      ? memoryApi.removeItem(selected, item.id)
                      : memoryApi.addItem(selected, "GIFT", source.id),
                  );
                }}
              />
            ))}
          </div>
        </Section>
      ) : null}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}
function Empty() {
  return <p className="text-sm text-muted-foreground">Aucun élément pour le moment.</p>;
}
function Source({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button className="rounded-lg border p-3 text-left" onClick={onToggle}>
      <span className="font-medium">
        {selected ? "✓ " : "+ "}
        {label}
      </span>
      <span className="block text-xs text-muted-foreground">
        {selected ? "Inclus avec autorisation parentale" : "Ajouter au livre"}
      </span>
    </button>
  );
}
