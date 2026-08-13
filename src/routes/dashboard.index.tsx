import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";
import { listApi } from "@/features/lists/api";
import { notificationApi } from "@/features/notifications/api";
import { queryKeys } from "@/app/query";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Mes listes de cadeaux — Mila" },
      {
        name: "description",
        content:
          "Gérez vos listes de naissance et d'événements, vos cadeaux et les réservations de vos proches.",
      },
      { property: "og:title", content: "Mes listes de cadeaux — Mila" },
      {
        property: "og:description",
        content: "Tableau de bord parents : cadeaux, réservations et messages reçus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardHome,
});

const LIST_TYPES = [
  { value: "BIRTH", label: "Naissance" },
  { value: "BIRTHDAY", label: "Anniversaire" },
] as const;

const registrySchema = z.object({
  title: z.string().trim().min(2, "Le titre est trop court").max(120),
  babyName: z.string().trim().max(80),
  welcome: z.string().trim().max(600),
  dueDate: z.string().max(10),
  accessCode: z.string().max(128),
});

function slugify(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "liste"}-${Math.random().toString(36).slice(2, 7)}`;
}

function DashboardHome() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof LIST_TYPES)[number]["value"]>("BIRTH");
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED" | "PROTECTED">("UNLISTED");
  const [form, setForm] = useState({
    title: "",
    babyName: "",
    welcome: "",
    dueDate: "",
    accessCode: "",
  });

  const registries = useQuery({
    queryKey: queryKeys.lists(user?.id),
    queryFn: listApi.mine,
  });

  const notifications = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: notificationApi.list,
  });

  const createRegistry = useMutation({
    mutationFn: async () => {
      const parsed = registrySchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Champs invalides");
      return listApi.create({
        title: parsed.data.title,
        childName: parsed.data.babyName || null,
        welcomeMessage: parsed.data.welcome || null,
        dueDate: parsed.data.dueDate || null,
        slug: slugify(parsed.data.babyName || parsed.data.title),
        type,
        visibility,
        status: "ACTIVE",
        ...(visibility === "PROTECTED" ? { accessCode: parsed.data.accessCode } : {}),
      });
    },
    onSuccess: (created) => {
      track("list_created");
      toast.success("Liste créée");
      setForm({ title: "", babyName: "", welcome: "", dueDate: "", accessCode: "" });
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
      if (created)
        void navigate({ to: "/dashboard/$registryId", params: { registryId: created.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const markRead = useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Mes listes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Naissance, anniversaire, baptême… ajoutez des cadeaux de n'importe quelle boutique.
          </p>
        </div>
        <Button onClick={() => setOpen((value) => !value)}>
          {open ? "Annuler" : "Nouvelle liste"}
        </Button>
      </div>

      {open && (
        <div className="surface-card mt-6 space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Titre de la liste</Label>
              <Input
                id="title"
                placeholder="La liste de naissance de Léa"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            {visibility === "PROTECTED" ? (
              <div className="space-y-2">
                <Label htmlFor="access-code">Code d'accès</Label>
                <Input
                  id="access-code"
                  minLength={6}
                  value={form.accessCode}
                  onChange={(e) => setForm({ ...form, accessCode: e.target.value })}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="baby">Prénom / occasion (optionnel)</Label>
              <Input
                id="baby"
                value={form.babyName}
                onChange={(e) => setForm({ ...form, babyName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type de liste</Label>
              <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIST_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visibilité</Label>
              <Select
                value={visibility}
                onValueChange={(value) => setVisibility(value as typeof visibility)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNLISTED">Lien privé</SelectItem>
                  <SelectItem value="PUBLIC">Publique</SelectItem>
                  <SelectItem value="PROTECTED">Protégée par code</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due">Date prévue</Label>
              <Input
                id="due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="welcome">Message d'accueil pour vos proches</Label>
              <Textarea
                id="welcome"
                rows={3}
                value={form.welcome}
                onChange={(e) => setForm({ ...form, welcome: e.target.value })}
              />
            </div>
          </div>
          <Button disabled={createRegistry.isPending} onClick={() => createRegistry.mutate()}>
            Créer la liste
          </Button>
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-4">
          {registries.isLoading && (
            <p className="text-sm text-muted-foreground">Chargement des listes…</p>
          )}
          {registries.data?.length === 0 && (
            <div className="surface-card p-8 text-center">
              <p className="font-display text-lg">Aucune liste pour l'instant</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Créez votre première liste en une minute.
              </p>
            </div>
          )}
          {registries.data?.map((registry) => {
            const giftCount = registry._count?.gifts ?? 0;
            const reserved = registry._count?.reservations ?? 0;
            const typeLabel = LIST_TYPES.find((t) => t.value === registry.type)?.label ?? "Liste";
            return (
              <div key={registry.id} className="space-y-2">
                <Link
                  to="/dashboard/$registryId"
                  params={{ registryId: registry.id }}
                  className="surface-card block p-6 transition-shadow hover:shadow-lift"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl">{registry.title}</h2>
                    <div className="flex gap-2">
                      <Badge variant="outline">{typeLabel}</Badge>
                      <Badge variant={registry.visibility === "PUBLIC" ? "default" : "secondary"}>
                        {registry.status !== "ACTIVE"
                          ? registry.status === "ARCHIVED"
                            ? "Archivée"
                            : "Suspendue"
                          : registry.visibility === "PUBLIC"
                            ? "Publique"
                            : registry.visibility === "PROTECTED"
                              ? "Code d'accès"
                              : "Lien privé"}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {giftCount} cadeau{giftCount > 1 ? "x" : ""} · {reserved} réservé
                    {reserved > 1 ? "s" : ""}
                    {registry.dueDate
                      ? ` · prévu le ${new Date(registry.dueDate).toLocaleDateString("fr-FR")}`
                      : ""}
                  </p>
                </Link>
                <Link
                  to="/recompenses/$registryId"
                  params={{ registryId: registry.id }}
                  className="inline-flex text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Voir les Récompenses Mila de cette liste →
                </Link>
              </div>
            );
          })}
        </section>

        <aside className="surface-card h-fit p-6">
          <h2 className="font-display text-lg">Notifications</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Chaque réservation et message de vos proches apparaît ici.
          </p>
          <ul className="mt-4 space-y-3">
            {notifications.data?.length === 0 && (
              <li className="text-sm text-muted-foreground">Aucune notification.</li>
            )}
            {notifications.data?.map((notification) => (
              <li
                key={notification.id}
                className={`rounded-lg border border-border p-3 ${
                  notification.readAt ? "opacity-60" : "bg-secondary/50"
                }`}
              >
                <p className="text-sm font-medium">{notification.title}</p>
                {notification.body && (
                  <p className="mt-1 text-xs text-muted-foreground">{notification.body}</p>
                )}
                {!notification.readAt && (
                  <button
                    className="mt-2 text-xs text-primary underline"
                    onClick={() => markRead.mutate(notification.id)}
                  >
                    Marquer comme lu
                  </button>
                )}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
