import { useMutation } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/services/api/client";

export const Route = createFileRoute("/invitation/$token")({
  head: () => ({
    meta: [
      { title: "Invitation co-parent — Mila" },
      {
        name: "description",
        content: "Rejoignez la liste de naissance à laquelle vous avez été invité.",
      },
      { property: "og:title", content: "Invitation co-parent — Mila" },
      { property: "og:description", content: "Rejoignez une liste et gérez-la à deux." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InvitationPage,
});

function InvitationPage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest<{ listId: string }>("/invitations/accept", {
        method: "POST",
        csrf: true,
        body: JSON.stringify({ invitationToken: token }),
      }),
    onSuccess: (result) => {
      toast.success("Vous gérez maintenant cette liste.");
      void navigate({ to: "/dashboard/$registryId", params: { registryId: result.listId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!loading && user && mutation.isIdle) mutation.mutate();
  }, [loading, user, mutation]);

  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="font-display text-3xl">Invitation à co-gérer une liste</h1>
      {loading ? (
        <p className="mt-4 text-muted-foreground">Vérification de votre session…</p>
      ) : !user ? (
        <>
          <p className="mt-4 text-muted-foreground">
            Connectez-vous ou créez un compte avec l'email invité pour rejoindre la liste.
          </p>
          <Button asChild className="mt-6">
            <Link to="/auth" search={{ redirect: `/invitation/${token}` }}>
              Se connecter
            </Link>
          </Button>
        </>
      ) : mutation.isPending || mutation.isIdle ? (
        <p className="mt-4 text-muted-foreground">Traitement de l'invitation…</p>
      ) : (
        <>
          <p className="mt-4 text-muted-foreground">
            L'invitation n'a pas pu être acceptée. Demandez un nouveau lien au parent qui vous a
            invité.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/dashboard">Aller à mon tableau de bord</Link>
          </Button>
        </>
      )}
    </main>
  );
}
