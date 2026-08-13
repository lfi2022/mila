import { apiRequest } from "@/services/api/client";

export type PartnerLanding = {
  partner: {
    slug: string;
    name: string;
    category: string;
    summary: string | null;
    websiteUrl: string | null;
    landingTitle: string | null;
    landingBody: string | null;
    region: string | null;
  };
  campaign: {
    code: string;
    name: string;
    benefit: { title?: string; description?: string; rewardMinor?: number };
    currency: string;
    endsAt: string;
  } | null;
};

export const partnerApi = {
  landing(slug: string, campaign?: string) {
    const query = new URLSearchParams();
    if (campaign) query.set("campaign", campaign);
    return apiRequest<PartnerLanding>(
      `/public/partners/${encodeURIComponent(slug)}?${query.toString()}`,
    );
  },
  startAttribution(slug: string, campaign: string | undefined, channel: "LINK" | "QR") {
    return apiRequest<{ attributed: true }>(
      `/public/partners/${encodeURIComponent(slug)}/attributions`,
      {
        method: "POST",
        body: JSON.stringify({ campaign, channel, accepted: true }),
      },
    );
  },
};
