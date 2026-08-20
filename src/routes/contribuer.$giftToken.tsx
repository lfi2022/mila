import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contributionApi } from "@/features/contributions/api";
import { formatCents } from "@/lib/money";

export const Route = createFileRoute("/contribuer/$giftToken")({
  head: () => ({
    meta: [{ title: "Participer à un cadeau — Mila" }, { name: "robots", content: "noindex" }],
  }),
  component: ContributionPage,
});

function ContributionPage() {
  const { giftToken } = Route.useParams();
  const key = useRef(crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const status = useQuery({
    queryKey: ["contribution", giftToken],
    queryFn: () => contributionApi.status(giftToken),
  });
  const transfer = useMutation({
    mutationFn: () =>
      contributionApi.bankTransfer(
        giftToken,
        {
          amountCents: Math.round(Number(amount) * 100),
          ...(name ? { contributorName: name } : {}),
          ...(email ? { contributorEmail: email } : {}),
          anonymous,
          ...(message ? { message } : {}),
        },
        key.current,
      ),
    onError: (error: Error) => toast.error(error.message),
  });
  const value = status.data;
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 py-12">
        <section className="surface-card p-7">
          <h1 className="text-2xl">Participer à {value?.gift.title ?? "ce cadeau"}</h1>
          {!value?.enabled ? (
            <p className="mt-4 text-muted-foreground">Les contributions ne sont pas disponibles.</p>
          ) : transfer.data ? (
            <div className="mt-5 space-y-3">
              <p>Effectuez le virement avec exactement ces informations :</p>
              <dl className="rounded-xl bg-secondary p-4 text-sm">
                <dt>Bénéficiaire</dt>
                <dd className="font-medium">{transfer.data.beneficiary}</dd>
                <dt className="mt-2">IBAN</dt>
                <dd className="font-mono">{transfer.data.iban}</dd>
                <dt className="mt-2">Référence obligatoire</dt>
                <dd className="font-mono font-semibold">{transfer.data.reference}</dd>
                <dt className="mt-2">Montant</dt>
                <dd>{formatCents(transfer.data.amountCents, transfer.data.currency)}</dd>
              </dl>
              <p className="text-xs text-muted-foreground">
                Le virement arrive directement chez les parents. Votre participation restera en
                attente jusqu’à leur confirmation. Instructions valables jusqu’au{" "}
                {new Date(transfer.data.expiresAt).toLocaleDateString("fr-BE")}.
              </p>
            </div>
          ) : value.closed ? (
            <p className="mt-4">L’objectif est atteint.</p>
          ) : (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Déjà engagé : {formatCents(value.committedCents, value.currency)}
                {value.targetCents ? ` sur ${formatCents(value.targetCents, value.currency)}` : ""}.
                Mila ne prélève aucun frais et ne reçoit pas les fonds.
              </p>
              <div>
                <Label>Montant en euros</Label>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label>Votre nom</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Votre e-mail</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </div>
              <div>
                <Label>Message</Label>
                <Input value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                />{" "}
                Afficher ma participation anonymement
              </label>
              <p className="text-sm">
                À verser directement aux parents :{" "}
                {formatCents(Math.round(Number(amount || 0) * 100), value.currency)}
              </p>
              {!value.bankTransferEnabled ? (
                <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  Les parents n’ont pas encore configuré leur compte pour recevoir les virements.
                </p>
              ) : null}
              <Button
                disabled={!value.bankTransferEnabled || !Number(amount) || transfer.isPending}
                onClick={() => transfer.mutate()}
              >
                Recevoir les instructions de virement
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
