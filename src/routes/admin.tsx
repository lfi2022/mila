import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentsAdmin, RewardsAdmin } from "@/features/admin/components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import {
  adminListAuditLog,
  adminCreatePartner,
  adminCreatePartnerCampaign,
  adminListLists,
  adminListMerchants,
  adminListPartners,
  adminListPrivacyRequests,
  adminListReports,
  adminListRisks,
  adminListUsers,
  adminModerate,
  adminReviewRisk,
  adminSaveMerchant,
  adminTestAffiliateLink,
  adminSetPartnerCampaignActive,
  adminSetPartnerActive,
  adminUpdatePrivacyRequest,
  adminListProductMedia,
  adminBlockProductMedia,
  adminSaveMerchantMediaPolicy,
  getAdminStats,
} from "@/features/admin/api";
import { runtimeConfig } from "@/config/runtime";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Mila" },
      {
        name: "description",
        content: "Pilotage de la plateforme Mila : statistiques, marchands et modération.",
      },
      { property: "og:title", content: "Administration — Mila" },
      { property: "og:description", content: "Espace interne de pilotage de la plateforme." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading } = useAuth();
  const isStaff = user?.roles.some((role) => ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(role));

  if (loading) {
    return <Shell>Vérification de vos droits…</Shell>;
  }

  if (!user) {
    return (
      <Shell>
        <p>Cet espace est réservé à l'équipe Mila.</p>
        <Button asChild className="mt-4">
          <Link to="/auth">Se connecter</Link>
        </Button>
      </Shell>
    );
  }

  if (!isStaff) {
    return (
      <Shell>
        <p>Vous n'avez pas accès à l'administration.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/dashboard">Retour à mes listes</Link>
        </Button>
      </Shell>
    );
  }

  return (
    <AdminContent isAdmin={user.roles.some((role) => ["ADMIN", "SUPER_ADMIN"].includes(role))} />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-20 text-sm text-muted-foreground">{children}</main>
    </div>
  );
}

function AdminContent({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const statsQuery = useQuery({ queryKey: ["admin-stats"], queryFn: getAdminStats });
  const listsQuery = useQuery({ queryKey: ["admin-lists"], queryFn: adminListLists });
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: adminListUsers });
  const merchantsQuery = useQuery({ queryKey: ["admin-merchants"], queryFn: adminListMerchants });
  const partnersQuery = useQuery({ queryKey: ["admin-partners"], queryFn: adminListPartners });
  const reportsQuery = useQuery({ queryKey: ["admin-reports"], queryFn: adminListReports });
  const risksQuery = useQuery({ queryKey: ["admin-risks"], queryFn: adminListRisks });
  const auditQuery = useQuery({ queryKey: ["admin-audit"], queryFn: adminListAuditLog });
  const privacyQuery = useQuery({
    queryKey: ["admin-privacy"],
    queryFn: adminListPrivacyRequests,
    enabled: isAdmin,
  });
  const mediaQuery = useQuery({ queryKey: ["admin-media"], queryFn: adminListProductMedia });
  const [partnerForm, setPartnerForm] = useState({
    slug: "",
    name: "",
    category: "",
    region: "",
    summary: "",
    landingTitle: "",
    landingBody: "",
    websiteUrl: "",
    contractReference: "",
    reason: "",
  });
  const [campaignForm, setCampaignForm] = useState({
    partnerId: "",
    code: "",
    name: "",
    startsAt: "",
    endsAt: "",
    benefitTitle: "",
    benefitDescription: "",
    budgetMinor: "",
    reason: "",
  });

  const refresh = () => {
    for (const key of [
      "admin-stats",
      "admin-lists",
      "admin-merchants",
      "admin-reports",
      "admin-risks",
      "admin-audit",
      "admin-partners",
      "admin-privacy",
      "admin-media",
    ]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const moderateMutation = useMutation({
    mutationFn: (input: { action: ModerationAction; targetId: string }) => adminModerate(input),
    onSuccess: () => {
      toast.success("Action appliquée");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const s = statsQuery.data;
  const createPartner = useMutation({
    mutationFn: () =>
      adminCreatePartner({
        slug: partnerForm.slug,
        name: partnerForm.name,
        category: partnerForm.category,
        reason: partnerForm.reason,
        ...(partnerForm.region ? { region: partnerForm.region } : {}),
        ...(partnerForm.summary ? { summary: partnerForm.summary } : {}),
        ...(partnerForm.landingTitle ? { landingTitle: partnerForm.landingTitle } : {}),
        ...(partnerForm.landingBody ? { landingBody: partnerForm.landingBody } : {}),
        ...(partnerForm.websiteUrl ? { websiteUrl: partnerForm.websiteUrl } : {}),
        ...(partnerForm.contractReference
          ? { contractReference: partnerForm.contractReference }
          : {}),
      }),
    onSuccess: () => {
      toast.success("Partenaire créé en attente");
      setPartnerForm({
        slug: "",
        name: "",
        category: "",
        region: "",
        summary: "",
        landingTitle: "",
        landingBody: "",
        websiteUrl: "",
        contractReference: "",
        reason: "",
      });
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const createCampaign = useMutation({
    mutationFn: () =>
      adminCreatePartnerCampaign({
        partnerId: campaignForm.partnerId,
        code: campaignForm.code,
        name: campaignForm.name,
        startsAt: new Date(campaignForm.startsAt).toISOString(),
        endsAt: new Date(campaignForm.endsAt).toISOString(),
        benefit: { title: campaignForm.benefitTitle, description: campaignForm.benefitDescription },
        ...(campaignForm.budgetMinor ? { budgetMinor: campaignForm.budgetMinor } : {}),
        currency: "EUR",
        reason: campaignForm.reason,
      }),
    onSuccess: () => {
      toast.success("Campagne créée inactive");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const activateCampaign = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminSetPartnerCampaignActive(id, active),
    onSuccess: () => refresh(),
    onError: (error: Error) => toast.error(error.message),
  });
  const activatePartner = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      adminSetPartnerActive(id, active),
    onSuccess: () => refresh(),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-3xl">Administration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Données réelles issues de la base. Les indicateurs financiers restent vides tant qu'aucun
          paiement ni rapport d'affiliation n'est connecté.
        </p>

        <Tabs defaultValue="overview" className="mt-8">
          <TabsList>
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="lists">Listes</TabsTrigger>
            <TabsTrigger value="users">Utilisateurs</TabsTrigger>
            <TabsTrigger value="merchants">Marchands</TabsTrigger>
            <TabsTrigger value="media">Médias</TabsTrigger>
            <TabsTrigger value="partners">Partenaires</TabsTrigger>
            {runtimeConfig.rewardsPremiumUiEnabled ? (
              <TabsTrigger value="rewards">Récompenses</TabsTrigger>
            ) : null}
            <TabsTrigger value="payments">Paiements</TabsTrigger>
            <TabsTrigger value="moderation">Modération</TabsTrigger>
            {isAdmin ? <TabsTrigger value="privacy">RGPD</TabsTrigger> : null}
            <TabsTrigger value="audit">Journal</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {!s ? (
              <p className="text-sm text-muted-foreground">Chargement des statistiques…</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Comptes"
                  value={s.users.total}
                  hint={`+${s.users.newLast30Days} sur 30 jours`}
                />
                <Stat
                  label="Listes actives"
                  value={s.lists.active}
                  hint={`${s.lists.total} au total`}
                />
                <Stat label="Cadeaux" value={s.gifts.total} hint={`${s.gifts.reserved} réservés`} />
                <Stat
                  label="Clics marchands"
                  value={s.business.merchantClicks}
                  hint={`${s.business.affiliateClicks} affiliés · ${s.business.clicksLast7Days} sur 7 jours`}
                />
                <Stat
                  label="Listes publiques"
                  value={s.lists.public}
                  hint={`${s.lists.private} privées`}
                />
                <Stat label="Cadeaux achetés" value={s.gifts.purchased} />
                <Stat label="Signalements ouverts" value={s.moderation.openReports} />
                {runtimeConfig.rewardsPremiumUiEnabled ? (
                  <Stat
                    label="Listes premium"
                    value={s.lists.premium}
                    hint="Revenus non connectés"
                  />
                ) : null}
              </div>
            )}

            {s && s.business.clicksByMerchant.length > 0 ? (
              <div className="surface-card mt-8 p-6">
                <h2 className="text-lg">Clics par marchand</h2>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marchand</TableHead>
                      <TableHead>Clics</TableHead>
                      <TableHead>Dont affiliés</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.business.clicksByMerchant.map(
                      (row: { merchant: string; clicks: number; affiliateClicks: number }) => (
                        <TableRow key={row.merchant}>
                          <TableCell>{row.merchant}</TableCell>
                          <TableCell>{row.clicks}</TableCell>
                          <TableCell>{row.affiliateClicks}</TableCell>
                        </TableRow>
                      ),
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="lists" className="mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Liste</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Visibilité</TableHead>
                  <TableHead>Visites</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {listsQuery.data?.map((list) => (
                  <TableRow key={list.id}>
                    <TableCell>
                      <a
                        href={`/l/${list.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {list.title}
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant={list.status === "ACTIVE" ? "default" : "secondary"}>
                        {list.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{list.visibility}</TableCell>
                    <TableCell>{list.view_count}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          moderateMutation.mutate({
                            action: list.status === "SUSPENDED" ? "restore_list" : "suspend_list",
                            targetId: list.id,
                          })
                        }
                      >
                        {list.status === "SUSPENDED" ? "Réactiver" : "Suspendre"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom affiché</TableHead>
                  <TableHead>Rôles</TableHead>
                  <TableHead>Inscription</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQuery.data?.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>{profile.display_name ?? "—"}</TableCell>
                    <TableCell>
                      {profile.roles.length ? profile.roles.join(", ") : "USER"}
                    </TableCell>
                    <TableCell>
                      {new Date(profile.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              Les emails ne sont pas affichés ici pour limiter l'exposition des données
              personnelles.
            </p>
          </TabsContent>

          <TabsContent value="merchants" className="mt-6 space-y-8">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marchand</TableHead>
                  <TableHead>Domaines</TableHead>
                  <TableHead>Actif</TableHead>
                  <TableHead>Affiliation</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchantsQuery.data?.map((merchant) => (
                  <MerchantRow
                    key={merchant.id}
                    merchant={merchant}
                    isAdmin={isAdmin}
                    onSave={async (values) => {
                      await adminSaveMerchant(values);
                      toast.success("Marchand mis à jour");
                      refresh();
                    }}
                  />
                ))}
              </TableBody>
            </Table>

            {isAdmin ? (
              <MerchantEditor
                trigger="Ajouter un marchand"
                initial={{
                  name: "",
                  domains: [],
                  logoUrl: "",
                  enabled: true,
                  affiliateEnabled: false,
                  affiliateNetwork: "",
                  affiliateId: "",
                  affiliateTemplate: "",
                  linkMode: "TEMPLATE",
                  apiEndpoint: "",
                  apiConfig: "",
                }}
                onSave={async (values) => {
                  await adminSaveMerchant(values);
                  toast.success("Marchand enregistré");
                  refresh();
                }}
              />
            ) : null}

            {isAdmin ? (
              <AffiliateTester
                merchants={merchantsQuery.data ?? []}
                testLink={adminTestAffiliateLink}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="media" className="mt-6">
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              {(merchantsQuery.data ?? []).map((merchant) => (
                <MerchantMediaPolicyEditor
                  key={merchant.id}
                  merchant={merchant}
                  onSaved={refresh}
                />
              ))}
            </div>
            <div className="surface-card overflow-x-auto p-6">
              <h2 className="mb-4 text-lg">Conformité des images produit</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cadeau</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Droits</TableHead>
                    <TableHead>Contrôle / cache</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(mediaQuery.data ?? []).map((media) => (
                    <TableRow key={media.id}>
                      <TableCell>{media.gift.title}</TableCell>
                      <TableCell>{media.merchant?.name ?? media.sourceType}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{media.usageStatus}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {media.copyrightOwner ?? media.licenseName ?? "Non documentés"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {media.verifiedAt
                          ? `Vérifié ${new Date(media.verifiedAt).toLocaleDateString("fr-BE")}`
                          : "Non vérifié"}
                        {media.storedObjectKey ? " · copie locale" : " · aucune copie"}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={media.status === "BLOCKED"}
                          onClick={async () => {
                            await adminBlockProductMedia(
                              media.id,
                              "Blocage ou retrait confirmé par la modération",
                            );
                            toast.success("Image immédiatement bloquée");
                            refresh();
                          }}
                        >
                          Bloquer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {runtimeConfig.rewardsPremiumUiEnabled ? (
            <TabsContent value="rewards" className="mt-6">
              <RewardsAdmin />
            </TabsContent>
          ) : null}

          <TabsContent value="partners" className="mt-6">
            {isAdmin ? (
              <div className="mb-8 grid gap-6 lg:grid-cols-2">
                <section className="surface-card space-y-3 p-5">
                  <h2 className="text-lg">Nouveau partenaire réel</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      aria-label="Nom du partenaire"
                      placeholder="Nom"
                      value={partnerForm.name}
                      onChange={(event) =>
                        setPartnerForm({ ...partnerForm, name: event.target.value })
                      }
                    />
                    <Input
                      aria-label="Slug du partenaire"
                      placeholder="slug-public"
                      value={partnerForm.slug}
                      onChange={(event) =>
                        setPartnerForm({ ...partnerForm, slug: event.target.value })
                      }
                    />
                    <Input
                      aria-label="Catégorie du partenaire"
                      placeholder="Catégorie"
                      value={partnerForm.category}
                      onChange={(event) =>
                        setPartnerForm({ ...partnerForm, category: event.target.value })
                      }
                    />
                    <Input
                      aria-label="Région du partenaire"
                      placeholder="Région"
                      value={partnerForm.region}
                      onChange={(event) =>
                        setPartnerForm({ ...partnerForm, region: event.target.value })
                      }
                    />
                    <Input
                      aria-label="Référence contractuelle"
                      placeholder="Référence contrat"
                      value={partnerForm.contractReference}
                      onChange={(event) =>
                        setPartnerForm({ ...partnerForm, contractReference: event.target.value })
                      }
                    />
                    <Input
                      aria-label="Site du partenaire"
                      placeholder="https://…"
                      value={partnerForm.websiteUrl}
                      onChange={(event) =>
                        setPartnerForm({ ...partnerForm, websiteUrl: event.target.value })
                      }
                    />
                  </div>
                  <Textarea
                    aria-label="Présentation du partenaire"
                    placeholder="Présentation publique"
                    value={partnerForm.summary}
                    onChange={(event) =>
                      setPartnerForm({ ...partnerForm, summary: event.target.value })
                    }
                  />
                  <Input
                    aria-label="Motif de création"
                    placeholder="Motif administratif obligatoire"
                    value={partnerForm.reason}
                    onChange={(event) =>
                      setPartnerForm({ ...partnerForm, reason: event.target.value })
                    }
                  />
                  <Button
                    disabled={createPartner.isPending || partnerForm.reason.length < 3}
                    onClick={() => createPartner.mutate()}
                  >
                    Créer en attente
                  </Button>
                </section>
                <section className="surface-card space-y-3 p-5">
                  <h2 className="text-lg">Nouvelle campagne</h2>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3"
                    aria-label="Partenaire de la campagne"
                    value={campaignForm.partnerId}
                    onChange={(event) =>
                      setCampaignForm({ ...campaignForm, partnerId: event.target.value })
                    }
                  >
                    <option value="">Choisir un partenaire</option>
                    {partnersQuery.data?.map((partner) => (
                      <option key={partner.id} value={partner.id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      aria-label="Code campagne"
                      placeholder="code-campagne"
                      value={campaignForm.code}
                      onChange={(event) =>
                        setCampaignForm({ ...campaignForm, code: event.target.value })
                      }
                    />
                    <Input
                      aria-label="Nom campagne"
                      placeholder="Nom"
                      value={campaignForm.name}
                      onChange={(event) =>
                        setCampaignForm({ ...campaignForm, name: event.target.value })
                      }
                    />
                    <Input
                      aria-label="Début campagne"
                      type="datetime-local"
                      value={campaignForm.startsAt}
                      onChange={(event) =>
                        setCampaignForm({ ...campaignForm, startsAt: event.target.value })
                      }
                    />
                    <Input
                      aria-label="Fin campagne"
                      type="datetime-local"
                      value={campaignForm.endsAt}
                      onChange={(event) =>
                        setCampaignForm({ ...campaignForm, endsAt: event.target.value })
                      }
                    />
                    <Input
                      aria-label="Titre avantage"
                      placeholder="Titre avantage"
                      value={campaignForm.benefitTitle}
                      onChange={(event) =>
                        setCampaignForm({ ...campaignForm, benefitTitle: event.target.value })
                      }
                    />
                    <Input
                      aria-label="Budget centimes"
                      inputMode="numeric"
                      placeholder="Budget en centimes"
                      value={campaignForm.budgetMinor}
                      onChange={(event) =>
                        setCampaignForm({ ...campaignForm, budgetMinor: event.target.value })
                      }
                    />
                  </div>
                  <Textarea
                    aria-label="Description avantage"
                    placeholder="Description et conditions"
                    value={campaignForm.benefitDescription}
                    onChange={(event) =>
                      setCampaignForm({ ...campaignForm, benefitDescription: event.target.value })
                    }
                  />
                  <Input
                    aria-label="Motif campagne"
                    placeholder="Motif administratif obligatoire"
                    value={campaignForm.reason}
                    onChange={(event) =>
                      setCampaignForm({ ...campaignForm, reason: event.target.value })
                    }
                  />
                  <Button
                    disabled={
                      createCampaign.isPending ||
                      !campaignForm.partnerId ||
                      !campaignForm.code ||
                      !campaignForm.name ||
                      !campaignForm.startsAt ||
                      !campaignForm.endsAt ||
                      !campaignForm.benefitTitle ||
                      !campaignForm.benefitDescription ||
                      campaignForm.reason.length < 3
                    }
                    onClick={() => createCampaign.mutate()}
                  >
                    Créer inactive
                  </Button>
                </section>
              </div>
            ) : null}
            {!partnersQuery.data?.length ? (
              <p className="text-sm text-muted-foreground">
                Aucun partenaire contractuel. Mila n’affiche jamais de partenaire fictif.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partenaire</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Campagnes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnersQuery.data.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell>{partner.name}</TableCell>
                      <TableCell>{partner.category}</TableCell>
                      <TableCell>{partner.region ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={partner.status === "ACTIVE" ? "default" : "secondary"}>
                            {partner.status}
                          </Badge>
                          {isAdmin ? (
                            <Switch
                              aria-label={`${partner.status === "ACTIVE" ? "Désactiver" : "Activer"} ${partner.name}`}
                              checked={partner.status === "ACTIVE"}
                              onCheckedChange={(active) =>
                                activatePartner.mutate({ id: partner.id, active })
                              }
                            />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="space-y-2">
                        {partner.campaigns.length || "0"}
                        {partner.campaigns.map((campaign) => (
                          <div key={campaign.id} className="flex items-center gap-2 text-xs">
                            <span>
                              {campaign.name} · {campaign._count.attributions} attributions · coûts{" "}
                              {campaign.costsMinor} {campaign.currency}
                            </span>
                            {isAdmin ? (
                              <Switch
                                aria-label={`${campaign.active ? "Désactiver" : "Activer"} ${campaign.name}`}
                                checked={campaign.active}
                                onCheckedChange={(active) =>
                                  activateCampaign.mutate({ id: campaign.id, active })
                                }
                              />
                            ) : null}
                          </div>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <PaymentsAdmin />
          </TabsContent>

          <TabsContent value="moderation" className="mt-6">
            {risksQuery.data?.length ? (
              <section className="mb-8 space-y-3">
                <h2 className="text-lg">Revue de risque</h2>
                {risksQuery.data.map((risk) => (
                  <div
                    key={risk.id}
                    className="surface-card flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <p>
                      <strong>{risk.category}</strong> · score {risk.score} · {risk.targetType}
                    </p>
                    {!["RESOLVED", "DISMISSED"].includes(risk.status) ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            void adminReviewRisk(
                              risk.id,
                              "RESOLVED",
                              "Signal vérifié et traité depuis le tableau de bord",
                            ).then(refresh)
                          }
                        >
                          Traiter
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void adminReviewRisk(
                              risk.id,
                              "DISMISSED",
                              "Signal écarté après revue manuelle",
                            ).then(refresh)
                          }
                        >
                          Écarter
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="secondary">{risk.status}</Badge>
                    )}
                  </div>
                ))}
              </section>
            ) : null}
            {reportsQuery.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun signalement.</p>
            ) : (
              <ul className="space-y-3">
                {reportsQuery.data?.map((report) => (
                  <li key={report.id} className="surface-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        {report.target_type} · {report.reason}
                      </p>
                      <Badge variant={report.status === "OPEN" ? "default" : "secondary"}>
                        {report.status}
                      </Badge>
                    </div>
                    {report.details ? (
                      <p className="mt-2 text-sm text-muted-foreground">{report.details}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {report.target_type === "list" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            moderateMutation.mutate({
                              action: "suspend_list",
                              targetId: report.target_id,
                            })
                          }
                        >
                          Suspendre la liste
                        </Button>
                      ) : null}
                      {report.target_type === "item" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            moderateMutation.mutate({
                              action: "hide_item",
                              targetId: report.target_id,
                            })
                          }
                        >
                          Masquer le cadeau
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        onClick={() =>
                          moderateMutation.mutate({ action: "resolve_report", targetId: report.id })
                        }
                      >
                        Résoudre
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          moderateMutation.mutate({ action: "dismiss_report", targetId: report.id })
                        }
                      >
                        Rejeter
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {isAdmin ? (
            <TabsContent value="privacy" className="mt-6">
              <div className="space-y-3">
                <h2 className="text-lg">Demandes d’exercice de droits</h2>
                <p className="text-sm text-muted-foreground">
                  Chaque changement de statut et son motif sont inscrits dans le journal d’audit.
                </p>
                {privacyQuery.data?.map((request) => (
                  <article key={request.id} className="surface-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <strong>{request.type}</strong> · {request.subjectEmail}
                        <p className="text-xs text-muted-foreground">
                          Reçue le {new Date(request.createdAt).toLocaleDateString("fr-BE")} ·
                          échéance {new Date(request.dueAt).toLocaleDateString("fr-BE")}
                        </p>
                      </div>
                      <Badge variant={request.status === "OPEN" ? "default" : "secondary"}>
                        {request.status}
                      </Badge>
                    </div>
                    {request.details ? <p className="mt-3 text-sm">{request.details}</p> : null}
                    {!request.completedAt ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const resolution = window.prompt("Note de traitement obligatoire");
                            if (resolution && resolution.trim().length >= 3)
                              void adminUpdatePrivacyRequest(
                                request.id,
                                "IN_PROGRESS",
                                resolution,
                              ).then(refresh);
                          }}
                        >
                          Prendre en charge
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            const resolution = window.prompt(
                              "Résolution communiquée à la personne",
                            );
                            if (resolution && resolution.trim().length >= 3)
                              void adminUpdatePrivacyRequest(
                                request.id,
                                "COMPLETED",
                                resolution,
                              ).then(refresh);
                          }}
                        >
                          Clôturer
                        </Button>
                      </div>
                    ) : null}
                  </article>
                ))}
                {privacyQuery.data?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune demande.</p>
                ) : null}
              </div>
            </TabsContent>
          ) : null}

          <TabsContent value="audit" className="mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Cible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditQuery.data?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{new Date(entry.created_at).toLocaleString("fr-FR")}</TableCell>
                    <TableCell>{entry.action}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.target_type} {entry.target_id ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

type ModerationAction =
  "suspend_list" | "restore_list" | "hide_item" | "show_item" | "resolve_report" | "dismiss_report";

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type MerchantRowData = {
  id: string;
  name: string;
  domains: string[];
  logo_url: string | null;
  enabled: boolean;
  affiliate_enabled: boolean;
  affiliate_network: string | null;
  affiliate_id: string | null;
  affiliate_template: string | null;
  link_mode: string;
  api_endpoint: string | null;
  api_config: string;
  has_api_key: boolean;
};

export type MerchantFormValues = {
  id?: string;
  name: string;
  domains: string[];
  logoUrl: string;
  enabled: boolean;
  affiliateEnabled: boolean;
  affiliateNetwork: string;
  affiliateId: string;
  affiliateTemplate: string;
  linkMode: "NONE" | "TEMPLATE" | "API";
  apiEndpoint: string;
  apiKey?: string | undefined;
  apiConfig: string;
};

function MerchantRow({
  merchant,
  isAdmin,
  onSave,
}: {
  merchant: MerchantRowData;
  isAdmin: boolean;
  onSave: (values: MerchantFormValues) => Promise<void>;
}) {
  const base = (): MerchantFormValues => ({
    id: merchant.id,
    name: merchant.name,
    domains: merchant.domains,
    logoUrl: merchant.logo_url ?? "",
    enabled: merchant.enabled,
    affiliateEnabled: merchant.affiliate_enabled,
    affiliateNetwork: merchant.affiliate_network ?? "",
    affiliateId: merchant.affiliate_id ?? "",
    affiliateTemplate: merchant.affiliate_template ?? "",
    linkMode: (merchant.link_mode as MerchantFormValues["linkMode"]) ?? "TEMPLATE",
    apiEndpoint: merchant.api_endpoint ?? "",
    apiConfig: merchant.api_config,
  });

  return (
    <TableRow>
      <TableCell className="font-medium">{merchant.name}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{merchant.domains.join(", ")}</TableCell>
      <TableCell>
        <Switch
          checked={merchant.enabled}
          disabled={!isAdmin}
          onCheckedChange={(checked) => void onSave({ ...base(), enabled: checked })}
        />
      </TableCell>
      <TableCell>
        <Switch
          checked={merchant.affiliate_enabled}
          disabled={!isAdmin}
          onCheckedChange={(checked) => void onSave({ ...base(), affiliateEnabled: checked })}
        />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {merchant.link_mode === "API"
          ? `API${merchant.has_api_key ? " · clé ok" : " · clé manquante"}`
          : merchant.link_mode}
        {merchant.affiliate_network ? ` · ${merchant.affiliate_network}` : ""}
      </TableCell>
      <TableCell className="text-right">
        {isAdmin ? <MerchantEditor initial={base()} onSave={onSave} trigger="Configurer" /> : null}
      </TableCell>
    </TableRow>
  );
}

/** Full merchant configuration: domain recognition, template rewriting or partner API. */
function MerchantEditor({
  initial,
  onSave,
  trigger,
}: {
  initial: MerchantFormValues;
  onSave: (values: MerchantFormValues) => Promise<void>;
  trigger: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<MerchantFormValues>(initial);
  const [domains, setDomains] = useState(initial.domains.join(", "));
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof MerchantFormValues>(key: K, value: MerchantFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValues(initial);
          setDomains(initial.domains.join(", "));
          setApiKey("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {trigger}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Configurer le marchand" : "Nouveau marchand"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="m-name">Nom</Label>
            <Input id="m-name" value={values.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-domains">Domaines reconnus (séparés par des virgules)</Label>
            <Input
              id="m-domains"
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="amazon.fr, amazon.be"
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={values.enabled} onCheckedChange={(v) => set("enabled", v)} /> Actif
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={values.affiliateEnabled}
                onCheckedChange={(v) => set("affiliateEnabled", v)}
              />{" "}
              Affiliation
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="m-mode">Mode de conversion du lien</Label>
            <select
              id="m-mode"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={values.linkMode}
              onChange={(e) => set("linkMode", e.target.value as MerchantFormValues["linkMode"])}
            >
              <option value="NONE">Aucune conversion (lien direct)</option>
              <option value="TEMPLATE">Gabarit (paramètres ou URL de tracking)</option>
              <option value="API">API partenaire (deeplink généré)</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="m-network">Réseau</Label>
              <Input
                id="m-network"
                value={values.affiliateNetwork}
                onChange={(e) => set("affiliateNetwork", e.target.value)}
                placeholder="Awin, Tradedoubler…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-affid">Identifiant affilié</Label>
              <Input
                id="m-affid"
                value={values.affiliateId}
                onChange={(e) => set("affiliateId", e.target.value)}
              />
            </div>
          </div>

          {values.linkMode === "TEMPLATE" ? (
            <div className="space-y-2">
              <Label htmlFor="m-template">Gabarit</Label>
              <Input
                id="m-template"
                value={values.affiliateTemplate}
                onChange={(e) => set("affiliateTemplate", e.target.value)}
                placeholder="tag={affiliateId}  ou  https://reseau.com/click?id={affiliateId}&url={encodedUrl}"
              />
              <p className="text-xs text-muted-foreground">
                Variables disponibles : {"{url}"}, {"{encodedUrl}"}, {"{affiliateId}"}.
              </p>
            </div>
          ) : null}

          {values.linkMode === "API" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="m-endpoint">URL de l'API de conversion</Label>
                <Input
                  id="m-endpoint"
                  value={values.apiEndpoint}
                  onChange={(e) => set("apiEndpoint", e.target.value)}
                  placeholder="https://api.reseau.com/deeplink"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-key">Clé d'API</Label>
                <Input
                  id="m-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    initial.id
                      ? "Laisser vide pour conserver la clé actuelle"
                      : "Clé fournie par le réseau"
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Saisir « - » pour effacer la clé. La clé n'est jamais renvoyée au navigateur.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-config">Réglages complémentaires (JSON)</Label>
                <Input
                  id="m-config"
                  value={values.apiConfig}
                  onChange={(e) => set("apiConfig", e.target.value)}
                  placeholder='{"header":"X-Api-Key","scheme":"","site_id":"12345"}'
                />
                <p className="text-xs text-muted-foreground">
                  Envoyé dans le corps de la requête. « header » et « scheme » personnalisent
                  l'en-tête d'authentification.
                </p>
              </div>
              <p className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
                L'API reçoit {"{ url, destination_url, affiliate_id, network, … }"} et doit renvoyer
                le lien converti (champ <code>url</code>, <code>link</code>, <code>deeplink</code>{" "}
                ou <code>tracking_url</code>). En cas d'échec, le visiteur est redirigé vers le lien
                d'origine.
              </p>
            </>
          ) : null}

          <Button
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave({
                  ...values,
                  domains: domains
                    .split(",")
                    .map((d) => d.trim())
                    .filter(Boolean),
                  apiKey: apiKey || undefined,
                });
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AffiliateTester({
  merchants,
  testLink,
}: {
  merchants: MerchantRowData[];
  testLink: (opts: {
    merchantId: string;
    url: string;
  }) => Promise<
    | { ok: false; reason: string }
    | { ok: true; domainMatches: boolean; affiliate: boolean; url: string }
  >;
}) {
  const [merchantId, setMerchantId] = useState(merchants[0]?.id ?? "");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="surface-card space-y-4 p-6">
      <h2 className="text-lg">Tester un lien d'affiliation</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="test-merchant">Marchand</Label>
          <select
            id="test-merchant"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={merchantId}
            onChange={(event) => setMerchantId(event.target.value)}
          >
            {merchants.map((merchant) => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="test-url">URL produit</Label>
          <Input id="test-url" value={url} onChange={(event) => setUrl(event.target.value)} />
        </div>
      </div>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            const response = await testLink({ merchantId, url });
            setResult(
              response.ok
                ? `${response.affiliate ? "Affilié" : "Lien direct"} · domaine ${
                    response.domainMatches ? "reconnu" : "non reconnu"
                  } → ${response.url}`
                : response.reason,
            );
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Test impossible");
          }
        }}
      >
        Tester
      </Button>
      {result ? <p className="break-all rounded-lg bg-secondary/60 p-3 text-xs">{result}</p> : null}
    </div>
  );
}

function MerchantMediaPolicyEditor({
  merchant,
  onSaved,
}: {
  merchant: {
    id: string;
    name: string;
    mediaPolicy: {
      allowRemoteDisplay: boolean;
      allowCaching: boolean;
      allowCommercialUse: boolean;
      licenseSourceUrl: string | null;
      termsSourceUrl: string | null;
      status: string;
    } | null;
  };
  onSaved: () => void;
}) {
  const current = merchant.mediaPolicy;
  const [licenseUrl, setLicenseUrl] = useState(current?.licenseSourceUrl ?? "");
  const [termsUrl, setTermsUrl] = useState(current?.termsSourceUrl ?? "");
  const [remote, setRemote] = useState(current?.allowRemoteDisplay ?? false);
  const [cache, setCache] = useState(current?.allowCaching ?? false);
  const [commercial, setCommercial] = useState(current?.allowCommercialUse ?? false);
  const [busy, setBusy] = useState(false);
  return (
    <section className="surface-card space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">{merchant.name}</h3>
        <Badge variant={current?.status === "VERIFIED" ? "default" : "secondary"}>
          {current?.status ?? "REVIEW_REQUIRED"}
        </Badge>
      </div>
      <Input
        value={licenseUrl}
        onChange={(event) => setLicenseUrl(event.target.value)}
        placeholder="URL de licence"
      />
      <Input
        value={termsUrl}
        onChange={(event) => setTermsUrl(event.target.value)}
        placeholder="URL des conditions"
      />
      <label className="flex items-center justify-between text-sm">
        Affichage distant <Switch checked={remote} onCheckedChange={setRemote} />
      </label>
      <label className="flex items-center justify-between text-sm">
        Cache et stockage local <Switch checked={cache} onCheckedChange={setCache} />
      </label>
      <label className="flex items-center justify-between text-sm">
        Usage commercial <Switch checked={commercial} onCheckedChange={setCommercial} />
      </label>
      <Button
        size="sm"
        disabled={busy || (!licenseUrl && !termsUrl)}
        onClick={async () => {
          setBusy(true);
          try {
            await adminSaveMerchantMediaPolicy(merchant.id, {
              allowRemoteDisplay: remote,
              allowCaching: cache,
              allowLocalStorage: cache,
              allowTransformation: false,
              allowCommercialUse: commercial,
              attributionRequired: false,
              licenseSourceUrl: licenseUrl || null,
              termsSourceUrl: termsUrl || null,
              status: "VERIFIED",
            });
            toast.success("Politique média vérifiée");
            onSaved();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
          } finally {
            setBusy(false);
          }
        }}
      >
        Vérifier la politique
      </Button>
      <p className="text-xs text-muted-foreground">
        Tout droit non activé reste refusé. Le cache exige aussi le stockage local.
      </p>
    </section>
  );
}
