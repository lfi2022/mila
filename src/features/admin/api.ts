import { apiRequest } from "@/services/api/client";

type AdminStats = {
  users: { total: number; newLast30Days: number; activeLast30Days: number };
  lists: {
    total: number;
    active: number;
    archived: number;
    suspended: number;
    public: number;
    private: number;
    premium: number;
  };
  gifts: { total: number; available: number; reserved: number; purchased: number };
  business: {
    merchantClicks: number;
    affiliateClicks: number;
    clicksLast7Days: number;
    clicksByMerchant: Array<{ merchant: string; clicks: number; affiliateClicks: number }>;
    premiumLists: number;
    premiumRevenue: Array<{ currency: string; amountMinor: string }>;
    confirmedCommissions: string;
    rewardCost: string;
  };
  moderation: { openReports: number; totalReports: number };
};
type AdminList = {
  id: string;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  createdAt: string;
  _count: { gifts: number; reservations: number };
};
type AdminUser = {
  id: string;
  displayName: string | null;
  createdAt: string;
  roles: Array<{ role: string }>;
};
type AdminReport = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
};
type AuditEntry = {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  metadata: unknown;
  createdAt: string;
};
type Merchant = {
  id: string;
  name: string;
  logoKey: string | null;
  active: boolean;
  affiliationEnabled: boolean;
  affiliateNetwork: string | null;
  affiliateIdentifier: string | null;
  affiliateLinkTemplate: string | null;
  connectorType: string;
  connectorConfig: unknown;
  domains: Array<{ domain: string }>;
};
type MerchantInput = {
  id?: string;
  name: string;
  domains: string[];
  enabled: boolean;
  affiliateEnabled: boolean;
  affiliateNetwork: string;
  affiliateId: string;
  affiliateTemplate: string;
  linkMode: "NONE" | "TEMPLATE" | "API";
  apiConfig: string;
};

export const getAdminStats = () => apiRequest<AdminStats>("/admin/overview");
export const adminListLists = async () => {
  const { lists } = await apiRequest<{ lists: AdminList[] }>("/admin/lists?limit=200");
  return lists.map((list) => ({ ...list, created_at: list.createdAt, view_count: "—" }));
};
export const adminListUsers = async () => {
  const { users } = await apiRequest<{ users: AdminUser[] }>("/admin/users?limit=200");
  return users.map((user) => ({
    ...user,
    display_name: user.displayName,
    created_at: user.createdAt,
    roles: user.roles.map((role: { role: string }) => role.role),
  }));
};
export const adminListReports = async () => {
  const { reports } = await apiRequest<{ reports: AdminReport[] }>("/admin/reports?limit=200");
  return reports.map((report) => ({
    ...report,
    target_type: report.targetType,
    target_id: report.targetId,
    created_at: report.createdAt,
  }));
};
export const adminListAuditLog = async () => {
  const { entries } = await apiRequest<{ entries: AuditEntry[] }>("/admin/audit-log?limit=100");
  return entries.map((entry) => ({
    ...entry,
    actor_id: entry.actorId,
    target_type: entry.targetType,
    target_id: entry.targetId,
    created_at: entry.createdAt,
  }));
};
export const adminListRisks = async () =>
  (
    await apiRequest<{
      risks: Array<{
        id: string;
        category: string;
        score: number;
        status: string;
        targetType: string;
        targetId: string | null;
        createdAt: string;
      }>;
    }>("/admin/risk-reviews?limit=100")
  ).risks;
export const adminListPartners = async () =>
  (
    await apiRequest<{
      partners: Array<{
        id: string;
        name: string;
        category: string;
        region: string | null;
        status: string;
        contractReference: string | null;
        campaigns: Array<{ id: string; name: string; active: boolean }>;
      }>;
    }>("/admin/partners?limit=100")
  ).partners;
export const adminReviewRisk = (
  riskId: string,
  status: "RESOLVED" | "DISMISSED",
  resolution: string,
) =>
  apiRequest(`/admin/risk-reviews/${riskId}/review`, {
    method: "POST",
    csrf: true,
    body: JSON.stringify({ status, resolution }),
  });
export const adminModerate = (input: { action: string; targetId: string; notes?: string }) =>
  apiRequest<{ ok: true }>("/admin/moderation", {
    method: "POST",
    csrf: true,
    body: JSON.stringify({
      action: input.action,
      targetId: input.targetId,
      reason: input.notes?.trim() || "Action confirmée depuis le tableau de bord",
    }),
  });

export const adminListMerchants = async () => {
  const { merchants } = await apiRequest<{ merchants: Merchant[] }>("/admin/merchants");
  return merchants.map((merchant) => ({
    ...merchant,
    domains: merchant.domains.map((row: { domain: string }) => row.domain),
    logo_url: merchant.logoKey,
    enabled: merchant.active,
    affiliate_enabled: merchant.affiliationEnabled,
    affiliate_network: merchant.affiliateNetwork,
    affiliate_id: merchant.affiliateIdentifier,
    affiliate_template: merchant.affiliateLinkTemplate,
    link_mode:
      merchant.connectorType === "OFFICIAL_API"
        ? "API"
        : merchant.affiliationEnabled
          ? "TEMPLATE"
          : "NONE",
    api_endpoint: null,
    has_api_key: false,
    api_config: JSON.stringify(merchant.connectorConfig ?? {}),
  }));
};
export const adminSaveMerchant = async (data: MerchantInput) => {
  let connectorConfig: Record<string, unknown> = {};
  if (data.apiConfig) connectorConfig = JSON.parse(data.apiConfig);
  const id = data.id ?? crypto.randomUUID();
  await apiRequest(`/admin/merchants/${id}`, {
    method: "PUT",
    csrf: true,
    body: JSON.stringify({
      name: data.name,
      slug:
        data.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || `merchant-${id.slice(0, 8)}`,
      active: data.enabled,
      domains: data.domains,
      affiliationEnabled: data.affiliateEnabled,
      affiliateNetwork: data.affiliateNetwork || null,
      affiliateIdentifier: data.affiliateId || null,
      affiliateLinkTemplate: data.affiliateTemplate || null,
      affiliateRules: { trackingHosts: [] },
      rewardEnabled: false,
      connectorType: data.linkMode === "API" ? "OFFICIAL_API" : "MANUAL",
      automationTrustLevel: 0,
      offerTrustScore: 50,
      refreshMinMinutes: 1440,
      connectorConfig,
    }),
  });
  return { id };
};
export const adminTestAffiliateLink = async ({
  merchantId,
  url,
}: {
  merchantId: string;
  url: string;
}) => {
  const merchants = await adminListMerchants();
  const merchant = merchants.find((item) => item.id === merchantId);
  if (!merchant) return { ok: false as const, reason: "Marchand introuvable." };
  try {
    const parsed = new URL(url);
    const domainMatches = merchant.domains.some(
      (domain: string) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
    );
    return {
      ok: true as const,
      domainMatches,
      affiliate: Boolean(merchant.affiliate_enabled && domainMatches),
      url,
    };
  } catch {
    return { ok: false as const, reason: "URL invalide." };
  }
};
