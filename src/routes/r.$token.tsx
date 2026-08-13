import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/services/api/client";
import { createReservationMemoryMessage } from "@/features/memories/api";

type Reservation = {
  id: string;
  guestName: string;
  message: string | null;
  quantity: number;
  status: string;
  giftTitle: string;
  listTitle: string;
};

export const Route = createFileRoute("/r/$token")({
  head: () => ({
    meta: [
      { title: "Ma réservation — Mila" },
      { name: "description", content: "Gérez votre réservation de cadeau Mila." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ReservationPage,
});

function ReservationPage() {
  const { token } = Route.useParams();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [memoryMessage, setMemoryMessage] = useState("");
  const [media, setMedia] = useState<File | undefined>();

  const load = useCallback(async () => {
    const result = await apiRequest<{ reservation: Reservation }>("/public/reservations/manage", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    setReservation(result.reservation);
    setMessage(result.reservation.message ?? "");
  }, [token]);
  useEffect(() => {
    void load()
      .catch(() => setReservation(null))
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) return <Fallback title="Chargement de la réservation…" />;
  if (!reservation) return <Fallback title="Réservation introuvable" />;
  const purchased = reservation.status === "PURCHASED";

  const run = async (action: "message" | "purchased" | "cancel", success: string) => {
    setBusy(true);
    try {
      await apiRequest<void>(
        action === "message"
          ? "/public/reservations/manage/message"
          : `/public/reservations/manage/${action}`,
        {
          method: action === "message" ? "PATCH" : "POST",
          body: JSON.stringify({ token, message }),
        },
      );
      toast.success(success);
      if (action === "cancel") setReservation({ ...reservation, status: "CANCELLED" });
      else await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">Votre réservation</p>
      <h1 className="mt-2 font-display text-3xl">{reservation.giftTitle}</h1>
      <p className="mt-1 text-muted-foreground">
        Pour « {reservation.listTitle} » · {reservation.quantity} réservé par{" "}
        {reservation.guestName}
      </p>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>
            {purchased
              ? "Cadeau marqué comme acheté 🎉"
              : reservation.status === "CANCELLED"
                ? "Réservation annulée"
                : "Cadeau réservé"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Textarea
            value={message}
            maxLength={800}
            rows={4}
            disabled={reservation.status === "CANCELLED"}
            onChange={(event) => setMessage(event.target.value)}
          />
          <Button
            variant="secondary"
            disabled={busy || reservation.status === "CANCELLED"}
            onClick={() => run("message", "Message mis à jour")}
          >
            Enregistrer le message
          </Button>
          <div className="space-y-3 border-t pt-5">
            <h2 className="font-medium">Ajouter un message souvenir privé</h2>
            <p className="text-sm text-muted-foreground">
              Audio jusqu’à 15 Mo, vidéo jusqu’à 50 Mo. Le média ne sera visible qu’après analyse de
              sécurité et ne rejoindra le livre qu’avec l’accord des parents.
            </p>
            <Textarea
              value={memoryMessage}
              maxLength={5000}
              placeholder="Votre message pour les parents"
              onChange={(event) => setMemoryMessage(event.target.value)}
            />
            <input
              type="file"
              accept="audio/mpeg,audio/mp4,audio/ogg,audio/webm,video/mp4,video/webm"
              onChange={(event) => setMedia(event.target.files?.[0])}
            />
            <Button
              variant="secondary"
              disabled={busy || !memoryMessage.trim() || reservation.status === "CANCELLED"}
              onClick={async () => {
                setBusy(true);
                try {
                  await createReservationMemoryMessage(token, memoryMessage, media);
                  setMemoryMessage("");
                  setMedia(undefined);
                  toast.success("Message souvenir transmis aux parents");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Envoi impossible");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Envoyer pour validation
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 border-t pt-5">
            {!purchased && reservation.status !== "CANCELLED" && (
              <Button
                disabled={busy}
                onClick={() => run("purchased", "Merci, les parents sont prévenus !")}
              >
                J’ai acheté ce cadeau
              </Button>
            )}
            {reservation.status !== "CANCELLED" && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => run("cancel", "Réservation annulée")}
              >
                Annuler ma réservation
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Fallback({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl">{title}</h1>
      <p className="mt-3 text-muted-foreground">Ce lien peut avoir expiré ou avoir été révoqué.</p>
      <Button asChild className="mt-6">
        <Link to="/">Retour à l’accueil</Link>
      </Button>
    </div>
  );
}
