import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import type { TablesUpdate } from "@/integrations/supabase/types";

import { ListAppearanceEditor, type AppearancePatch } from "@/components/ListAppearanceEditor";
import { ShareCard } from "@/components/ShareCard";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { inviteCoParent, setListAccessCode } from "@/lib/lists.functions";
import { previewProductUrl } from "@/lib/products.functions";

export const Route = createFileRoute("/dashboard/$registryId")({
  head: () => ({
    meta: [
      { title: "Gérer ma liste — Mila" },
      {
        name: "description",
        content:
          "Ajoutez des cadeaux depuis n'importe quelle boutique, partagez votre liste et suivez les réservations.",
      },
      { property: "og:title", content: "Gérer ma liste — Mila" },
      {
        property: "og:description",
        content: "Cadeaux, partage, co-parents et réglages de confidentialité.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegistryDetail,
});

const LIST_TYPES = [
  { value: "BIRTH", label: "Naissance" },
  { value: "BIRTHDAY", label: "Anniversaire" },
  { value: "CHRISTENING", label: "Baptême" },
  { value: "WEDDING", label: "Mariage" },
  { value: "CHRISTMAS", label: "Noël" },
  { value: "OTHER", label: "Autre" },
] as const;

const itemSchema = z.object({
  title: z.string().trim().min(2, "Le nom du cadeau est trop court").max(140),
  store: z.string().trim().max(60),
  url: z.string().trim().max(2000),
  price: z.string().max(12),
  quantity: z.number().int().min(1).max(50),
  description: z.string().trim().max(400),
  imageUrl: z.string().trim().max(2000),
});

const emptyItem = {
  title: "",
  store: "",
  url: "",
  price: "",
  quantity: 1,
  description: "",
  imageUrl: "",
};

function RegistryDetail() {
  const { registryId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [item, setItem] = useState(emptyItem);
  const [accessCode, setAccessCode] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const preview = useServerFn(previewProductUrl);
  const invite = useServerFn(inviteCoParent);
  const saveCode = useServerFn(setListAccessCode);

  const registry = useQuery({
    queryKey: ["registry", registryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registries")
        .select("*")
        .eq("id", registryId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const items = useQuery({
    queryKey: ["items", registryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("registry_id", registryId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const reservations = useQuery({
    queryKey: ["reservations", registryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, items(title)")
        .eq("registry_id", registryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const members = useQuery({
    queryKey: ["members", registryId],
    queryFn: async () => {
      const [{ data: rows, error }, { data: invitations }] = await Promise.all([
        supabase
          .from("list_members")
          .select("id, user_id, role, created_at")
          .eq("registry_id", registryId),
        supabase
          .from("list_invitations")
          .select("id, email, role, accepted_at, expires_at")
          .eq("registry_id", registryId)
          .order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      const ids = (rows ?? []).map((row) => row.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, display_name").in("id", ids)
        : { data: [] };
      return {
        members: (rows ?? []).map((row) => ({
          ...row,
          displayName: (profiles ?? []).find((p) => p.id === row.user_id)?.display_name ?? "Parent",
        })),
        invitations: invitations ?? [],
      };
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["items", registryId] });
    void queryClient.invalidateQueries({ queryKey: ["reservations", registryId] });
    void queryClient.invalidateQueries({ queryKey: ["registry", registryId] });
    void queryClient.invalidateQueries({ queryKey: ["members", registryId] });
  };

  const fetchPreview = useMutation({
    mutationFn: async () => {
      if (!item.url.trim()) throw new Error("Collez d'abord un lien produit");
      return preview({ data: { url: item.url.trim() } });
    },
    onSuccess: (result) => {
      setItem((current) => ({
        ...current,
        title: current.title || (result.title ?? ""),
        store: current.store || (result.storeName ?? ""),
        price: current.price || (result.price != null ? String(result.price) : ""),
        imageUrl: result.imageUrl ?? current.imageUrl,
        description: current.description || (result.description ?? ""),
        url: result.url,
      }));
      toast.success("Informations du produit récupérées");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const parsed = itemSchema.safeParse(item);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Champs invalides");
      const { error } = await supabase.from("items").insert({
        registry_id: registryId,
        title: parsed.data.title,
        store_name: parsed.data.store || null,
        url: parsed.data.url || null,
        image_url: parsed.data.imageUrl || null,
        price: parsed.data.price ? Number(parsed.data.price.replace(",", ".")) : null,
        quantity: parsed.data.quantity,
        description: parsed.data.description || null,
        kind: parsed.data.url ? "LINK" : "MANUAL",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setItem(emptyItem);
      if ((items.data?.length ?? 0) === 0) track("first_gift_added");
      toast.success("Cadeau ajouté");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cadeau supprimé");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const releaseReservation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reservations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Réservation annulée, le cadeau redevient visible.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateRegistry = useMutation({
    mutationFn: async (patch: TablesUpdate<"registries">) => {
      const { error } = await supabase.from("registries").update(patch).eq("id", registryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Réglages enregistrés");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitCode = useMutation({
    mutationFn: () => saveCode({ data: { registryId, code: accessCode } }),
    onSuccess: (result) => {
      setAccessCode("");
      toast.success(result.hasCode ? "Code d'accès enregistré" : "Code d'accès supprimé");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendInvite = useMutation({
    mutationFn: () => invite({ data: { registryId, email: inviteEmail, role: "CO_OWNER" } }),
    onSuccess: (result) => {
      setInviteEmail("");
      toast.success(
        result.emailed ? "Invitation envoyée par email" : "Invitation créée, partagez le lien",
      );
      if (!result.emailed) void navigator.clipboard.writeText(result.link);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("list_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Accès retiré");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (registry.isLoading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12 text-sm text-muted-foreground">
        Chargement…
      </main>
    );
  }

  const list = registry.data;
  if (!list) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-sm text-muted-foreground">
          Cette liste n'existe pas ou vous n'y avez plus accès.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/dashboard">Retour à mes listes</Link>
        </Button>
      </main>
    );
  }

  const giftRows = items.data ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        ← Mes listes
      </Link>

      <div className="surface-card mt-4 flex flex-wrap items-center justify-between gap-6 p-6">
        <div>
          <h1 className="text-3xl">{list.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {list.baby_name ? `Pour ${list.baby_name} · ` : ""}
            {giftRows.length} cadeau{giftRows.length > 1 ? "x" : ""} · {list.view_count} visite
            {list.view_count > 1 ? "s" : ""}
          </p>
        </div>
        <Badge variant={list.status === "ACTIVE" ? "default" : "secondary"}>
          {list.status === "ACTIVE"
            ? list.visibility === "PUBLIC"
              ? "Publique"
              : list.visibility === "PROTECTED"
                ? "Protégée par code"
                : "Lien privé"
            : list.status === "ARCHIVED"
              ? "Archivée"
              : "Suspendue"}
        </Badge>
      </div>

      <Tabs defaultValue="gifts" className="mt-8">
        <TabsList>
          <TabsTrigger value="gifts">Cadeaux</TabsTrigger>
          <TabsTrigger value="appearance">Apparence</TabsTrigger>
          <TabsTrigger value="share">Partage</TabsTrigger>
          <TabsTrigger value="parents">Parents</TabsTrigger>
          <TabsTrigger value="settings">Réglages</TabsTrigger>
        </TabsList>

        <TabsContent value="gifts" className="mt-6 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="text-xl">Ajouter un cadeau</h2>
            <div className="surface-card mt-4 space-y-4 p-6">
              <div className="space-y-2">
                <Label htmlFor="item-url">Lien du produit (n'importe quelle boutique)</Label>
                <div className="flex gap-2">
                  <Input
                    id="item-url"
                    placeholder="https://www.amazon.fr/…"
                    value={item.url}
                    onChange={(e) => setItem({ ...item, url: e.target.value })}
                  />
                  <Button
                    variant="secondary"
                    disabled={fetchPreview.isPending}
                    onClick={() => fetchPreview.mutate()}
                  >
                    Remplir
                  </Button>
                </div>
                <p className="text-sm">
                  Collez simplement le lien d'un produit. Mila s'occupe du reste.
                </p>
                <p className="text-xs text-muted-foreground">
                  Lorsque c'est possible, Mila récupère automatiquement le nom, l'image et le prix
                  du produit. Vous pouvez ensuite tout modifier.
                </p>
              </div>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="h-32 w-32 rounded-lg object-cover" />
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="item-title">Nom du cadeau</Label>
                <Input
                  id="item-title"
                  value={item.title}
                  onChange={(e) => setItem({ ...item, title: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="item-store">Magasin</Label>
                  <Input
                    id="item-store"
                    value={item.store}
                    onChange={(e) => setItem({ ...item, store: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-price">Prix (€)</Label>
                  <Input
                    id="item-price"
                    value={item.price}
                    onChange={(e) => setItem({ ...item, price: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
                <div className="space-y-2">
                  <Label htmlFor="item-qty">Quantité</Label>
                  <Input
                    id="item-qty"
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => setItem({ ...item, quantity: Number(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-desc">Note pour vos proches</Label>
                  <Input
                    id="item-desc"
                    value={item.description}
                    onChange={(e) => setItem({ ...item, description: e.target.value })}
                  />
                </div>
              </div>
              <Button disabled={addItem.isPending} onClick={() => addItem.mutate()}>
                Ajouter à la liste
              </Button>
            </div>

            <h2 className="mt-10 text-xl">Cadeaux ({giftRows.length})</h2>
            <ul className="mt-4 space-y-3">
              {giftRows.map((gift) => {
                const fullyReserved = gift.reserved_qty >= gift.quantity;
                return (
                  <li
                    key={gift.id}
                    className="surface-card flex items-start justify-between gap-4 p-4"
                  >
                    <div>
                      <p className="font-medium">{gift.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {gift.store_name ?? "Magasin non précisé"}
                        {gift.price ? ` · ${gift.price} €` : ""} · {gift.reserved_qty}/
                        {gift.quantity} réservé
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={fullyReserved ? "default" : "secondary"}>
                        {fullyReserved ? "Masqué (réservé)" : "Visible"}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => deleteItem.mutate(gift.id)}>
                        Supprimer
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="text-xl">Réservations reçues</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {list.surprise_mode
                ? "Mode surprise activé : vos proches ne voient rien, mais vous gardez le détail ici."
                : "Visible uniquement par les parents de la liste."}
            </p>
            <ul className="mt-4 space-y-3">
              {reservations.data?.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Aucune réservation pour le moment.
                </li>
              )}
              {reservations.data?.map((reservation) => (
                <li key={reservation.id} className="surface-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{reservation.items?.title}</p>
                    <Badge variant="secondary">
                      {reservation.status === "PURCHASED"
                        ? "Acheté"
                        : reservation.intent === "order"
                          ? "Commandé"
                          : "Réservé"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Par {reservation.guest_name}
                    {reservation.guest_email ? ` · ${reservation.guest_email}` : ""} · ×
                    {reservation.quantity}
                  </p>
                  {reservation.message && (
                    <p className="mt-3 rounded-lg bg-secondary/60 p-3 text-sm italic">
                      « {reservation.message} »
                    </p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => releaseReservation.mutate(reservation.id)}
                  >
                    Annuler cette réservation
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <div className="surface-card p-6">
            <ListAppearanceEditor
              registryId={registryId}
              list={list}
              onChange={(patch: AppearancePatch) =>
                updateRegistry.mutate(patch as TablesUpdate<"registries">)
              }
              onCoverUploaded={refresh}
            />
          </div>
        </TabsContent>

        <TabsContent value="share" className="mt-6">
          <div className="surface-card p-6">
            <ShareCard slug={list.slug} title={list.title} />
            {list.visibility === "PROTECTED" ? (
              <p className="mt-6 text-sm text-muted-foreground">
                Cette liste demande un code d'accès : communiquez-le à vos proches avec le lien.
              </p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="parents" className="mt-6 grid gap-8 lg:grid-cols-2">
          <section className="surface-card p-6">
            <h2 className="text-xl">Parents et co-parents</h2>
            <ul className="mt-4 space-y-3">
              {members.data?.members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {member.displayName}
                      {member.user_id === user?.id ? " (vous)" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member.role === "OWNER"
                        ? "Propriétaire"
                        : member.role === "CO_OWNER"
                          ? "Co-parent"
                          : "Éditeur"}
                    </p>
                  </div>
                  {member.role !== "OWNER" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember.mutate(member.id)}
                    >
                      Retirer
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-2">
              <Label htmlFor="invite-email">Inviter un co-parent</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="email@exemple.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <Button disabled={sendInvite.isPending} onClick={() => sendInvite.mutate()}>
                  Inviter
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Le co-parent pourra ajouter des cadeaux et voir les réservations.
              </p>
            </div>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-xl">Invitations en cours</h2>
            <ul className="mt-4 space-y-3">
              {members.data?.invitations.length === 0 && (
                <li className="text-sm text-muted-foreground">Aucune invitation envoyée.</li>
              )}
              {members.data?.invitations.map((invitation) => (
                <li key={invitation.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invitation.accepted_at
                      ? "Invitation acceptée"
                      : `Expire le ${new Date(invitation.expires_at).toLocaleDateString("fr-FR")}`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="settings" className="mt-6 grid gap-8 lg:grid-cols-2">
          <section className="surface-card space-y-5 p-6">
            <h2 className="text-xl">Informations</h2>
            <div className="space-y-2">
              <Label htmlFor="set-title">Titre</Label>
              <Input
                id="set-title"
                defaultValue={list.title}
                onBlur={(e) =>
                  e.target.value !== list.title && updateRegistry.mutate({ title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="set-baby">Prénom / occasion</Label>
              <Input
                id="set-baby"
                defaultValue={list.baby_name ?? ""}
                onBlur={(e) => updateRegistry.mutate({ baby_name: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="set-welcome">Message d'accueil</Label>
              <Textarea
                id="set-welcome"
                rows={3}
                defaultValue={list.welcome_message ?? ""}
                onBlur={(e) => updateRegistry.mutate({ welcome_message: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type de liste</Label>
              <Select
                value={list.type}
                onValueChange={(value) =>
                  updateRegistry.mutate({
                    type: value as NonNullable<TablesUpdate<"registries">["type"]>,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIST_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="set-due">Date de l'événement</Label>
              <Input
                id="set-due"
                type="date"
                defaultValue={list.due_date ?? ""}
                onBlur={(e) => updateRegistry.mutate({ due_date: e.target.value || null })}
              />
            </div>
          </section>

          <section className="surface-card space-y-5 p-6">
            <h2 className="text-xl">Confidentialité</h2>
            <div className="space-y-2">
              <Label>Visibilité</Label>
              <Select
                value={list.visibility}
                onValueChange={(value) =>
                  updateRegistry.mutate({
                    visibility: value as NonNullable<TablesUpdate<"registries">["visibility"]>,
                    is_public: value === "PUBLIC",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Publique — visible et référencée</SelectItem>
                  <SelectItem value="UNLISTED">Lien privé — accessible avec le lien</SelectItem>
                  <SelectItem value="PROTECTED">Protégée — code d'accès requis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {list.visibility === "PROTECTED" ? (
              <div className="space-y-2">
                <Label htmlFor="set-code">Code d'accès</Label>
                <div className="flex gap-2">
                  <Input
                    id="set-code"
                    value={accessCode}
                    placeholder={
                      list.access_code_hash ? "Code défini — saisir pour remplacer" : "ex. bebe2026"
                    }
                    onChange={(e) => setAccessCode(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    disabled={submitCode.isPending}
                    onClick={() => submitCode.mutate()}
                  >
                    Enregistrer
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Laissez vide et enregistrez pour retirer le code.
                </p>
              </div>
            ) : null}

            <div className="space-y-2 border-t pt-4">
              <Label>Lorsqu'un cadeau est réservé</Label>
              <Select
                value={list.reserved_display === "HIDE" ? "HIDE" : "SHOW"}
                onValueChange={(value) => updateRegistry.mutate({ reserved_display: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHOW">
                    Afficher le cadeau comme réservé (recommandé)
                  </SelectItem>
                  <SelectItem value="HIDE">Masquer le cadeau de la liste publique</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Par défaut, le cadeau reste visible avec la mention « Déjà réservé » : vos proches
                voient la progression et ne peuvent plus le réserver.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 border-t pt-4">
              <div>
                <p className="text-sm font-medium">Mode surprise</p>
                <p className="text-xs text-muted-foreground">
                  Vous ne verrez plus qui réserve quoi jusqu'à la révélation.
                </p>
              </div>
              <Switch
                checked={list.surprise_mode}
                onCheckedChange={(checked) => updateRegistry.mutate({ surprise_mode: checked })}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Autoriser les moteurs de recherche</p>
                <p className="text-xs text-muted-foreground">
                  Uniquement pour les listes publiques.
                </p>
              </div>
              <Switch
                checked={list.allow_indexing}
                disabled={list.visibility !== "PUBLIC"}
                onCheckedChange={(checked) => updateRegistry.mutate({ allow_indexing: checked })}
              />
            </div>

            <div className="flex items-center justify-between gap-4 border-t pt-4">
              <div>
                <p className="text-sm font-medium">Archiver la liste</p>
                <p className="text-xs text-muted-foreground">
                  La page publique n'est plus accessible.
                </p>
              </div>
              <Switch
                checked={list.status === "ARCHIVED"}
                onCheckedChange={(checked) =>
                  updateRegistry.mutate({ status: checked ? "ARCHIVED" : "ACTIVE" })
                }
              />
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </main>
  );
}
