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
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

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
  { value: "CHRISTENING", label: "Baptême" },
  { value: "WEDDING", label: "Mariage" },
  { value: "CHRISTMAS", label: "Noël" },
  { value: "OTHER", label: "Autre occasion" },
] as const;

const registrySchema = z.object({
  title: z.string().trim().min(2, "Le titre est trop court").max(120),
  babyName: z.string().trim().max(80),
  welcome: z.string().trim().max(600),
  dueDate: z.string().max(10),
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
  const [form, setForm] = useState({ title: "", babyName: "", welcome: "", dueDate: "" });

  const registries = useQuery({
    queryKey: ["registries", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registries")
        .select(
          "id, title, baby_name, slug, visibility, status, type, due_date, view_count, surprise_mode, items(id, quantity, reserved_qty)",
        )
        .eq("is_demo", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const notifications = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  const createRegistry = useMutation({
    mutationFn: async () => {
      const parsed = registrySchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Champs invalides");
      const payload: TablesInsert<"registries"> = {
        owner_id: user!.id,
        title: parsed.data.title,
        baby_name: parsed.data.babyName || null,
        welcome_message: parsed.data.welcome || null,
        due_date: parsed.data.dueDate || null,
        slug: slugify(parsed.data.babyName || parsed.data.title),
        type,
        visibility,
        is_public: visibility === "PUBLIC",
      };
      const { data, error } = await supabase
        .from("registries")
        .insert(payload)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (created) => {
      track("list_created");
      toast.success("Liste créée");
      setForm({ title: "", babyName: "", welcome: "", dueDate: "" });
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["registries"] });
      if (created)
        void navigate({ to: "/dashboard/$registryId", params: { registryId: created.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
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
            const items = registry.items ?? [];
            const reserved = items.filter((item) => item.reserved_qty >= item.quantity).length;
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
                    {items.length} cadeau{items.length > 1 ? "x" : ""} · {reserved} réservé
                    {reserved > 1 ? "s" : ""} · {registry.view_count} visite
                    {registry.view_count > 1 ? "s" : ""}
                    {registry.due_date
                      ? ` · prévu le ${new Date(registry.due_date).toLocaleDateString("fr-FR")}`
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
                  notification.read_at ? "opacity-60" : "bg-secondary/50"
                }`}
              >
                <p className="text-sm font-medium">{notification.title}</p>
                {notification.body && (
                  <p className="mt-1 text-xs text-muted-foreground">{notification.body}</p>
                )}
                {!notification.read_at && (
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
