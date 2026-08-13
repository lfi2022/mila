import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getReservationByToken, updateReservationByToken } from "@/lib/public.functions";

export const Route = createFileRoute("/r/$token")({
  loader: ({ params }) => getReservationByToken({ data: { token: params.token } }),
  head: () => ({
    meta: [
      { title: "Ma réservation — Mila" },
      {
        name: "description",
        content:
          "Gérez votre réservation de cadeau : confirmez l'achat, modifiez votre message ou annulez.",
      },
      { property: "og:title", content: "Ma réservation — Mila" },
      { property: "og:description", content: "Gérez votre réservation de cadeau en un clic." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  errorComponent: () => <Fallback title="Lien indisponible" />,
  notFoundComponent: () => <Fallback title="Réservation introuvable" />,
  component: ReservationPage,
});

function Fallback({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mt-3 text-muted-foreground">
        Ce lien de gestion n'est plus valide. Il expire après quelques mois ou après annulation.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Retour à l'accueil</Link>
      </Button>
    </div>
  );
}

function ReservationPage() {
  const data = Route.useLoaderData();
  const { token } = Route.useParams();
  const router = useRouter();
  const update = useServerFn(updateReservationByToken);
  const [message, setMessage] = useState(
    data.state === "ok" ? (data.reservation.message ?? "") : "",
  );
  const [busy, setBusy] = useState(false);

  if (data.state !== "ok") return <Fallback title="Réservation introuvable" />;

  const reservation = data.reservation;
  const purchased = reservation.status === "PURCHASED";

  const run = async (action: "message" | "purchased" | "cancel", successMessage: string) => {
    setBusy(true);
    try {
      await update({ data: { action, ...(action === "message" ? { message } : {}), token } });
      toast.success(successMessage);
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">Votre réservation</p>
      <h1 className="mt-2 font-display text-3xl">{reservation.item_title}</h1>
      <p className="mt-1 text-muted-foreground">
        Pour la liste « {reservation.registry_title} » · réservé par {reservation.guest_name}
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">
            {purchased ? "Cadeau marqué comme acheté 🎉" : "Cadeau réservé"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {reservation.item_image_url ? (
            <img
              src={reservation.item_image_url}
              alt={reservation.item_title}
              loading="lazy"
              className="h-40 w-full rounded-xl object-cover"
            />
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="guest-message">
              Votre message aux parents
            </label>
            <Textarea
              id="guest-message"
              value={message}
              maxLength={800}
              rows={4}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Un petit mot doux…"
            />
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => run("message", "Message mis à jour")}
            >
              Enregistrer le message
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 border-t pt-5">
            {!purchased ? (
              <Button
                disabled={busy}
                onClick={() => run("purchased", "Merci, les parents sont prévenus !")}
              >
                J'ai acheté ce cadeau
              </Button>
            ) : null}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => run("cancel", "Réservation annulée")}
            >
              Annuler ma réservation
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button asChild variant="link" className="mt-6 px-0">
        <Link to="/l/$slug" params={{ slug: reservation.registry_slug }}>
          Revenir à la liste
        </Link>
      </Button>
    </div>
  );
}
