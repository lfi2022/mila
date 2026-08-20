import type {
  GenericImageCategory,
  ProductMediaSourceType,
  ProductMediaUsageStatus,
} from "../../generated/prisma/enums.js";

export type MediaRights = {
  allowRemoteDisplay: boolean;
  allowCaching: boolean;
  allowLocalStorage: boolean;
  allowTransformation: boolean;
  allowCommercialUse: boolean;
  verifiedAt: Date | null;
  reviewAfter: Date | null;
  status: string;
};

export type MediaDecision = {
  usageStatus: ProductMediaUsageStatus;
  display: boolean;
  cache: boolean;
  reason: string;
};

const alwaysOwned = new Set<ProductMediaSourceType>([
  "USER_UPLOADED",
  "GENERIC_LIBRARY",
  "GENERATED",
]);

export function decideMediaUsage(
  sourceType: ProductMediaSourceType,
  rights?: MediaRights | null,
  now = new Date(),
): MediaDecision {
  if (sourceType === "BLOCKED") return deny("source-blocked", "BLOCKED");
  if (sourceType === "REMOTE_UNVERIFIED") return deny("remote-source-unverified");
  if (alwaysOwned.has(sourceType)) {
    return {
      usageStatus: sourceType === "USER_UPLOADED" ? "USER_DECLARED" : "AUTHORIZED",
      display: true,
      cache: false,
      reason: sourceType === "USER_UPLOADED" ? "user-rights-declared" : "mila-owned-asset",
    };
  }
  if (
    !rights ||
    rights.status !== "VERIFIED" ||
    !rights.verifiedAt ||
    (rights.reviewAfter && rights.reviewAfter <= now)
  ) {
    return deny("merchant-rights-not-current");
  }
  if (rights.allowCaching && rights.allowLocalStorage) {
    return {
      usageStatus: "AUTHORIZED_CACHE",
      display: true,
      cache: true,
      reason: "merchant-policy-authorizes-cache",
    };
  }
  if (rights.allowRemoteDisplay) {
    return {
      usageStatus: "AUTHORIZED_REMOTE_ONLY",
      display: true,
      cache: false,
      reason: "merchant-policy-authorizes-remote-display",
    };
  }
  return deny("merchant-policy-denies-image-use");
}

function deny(reason: string, usageStatus: ProductMediaUsageStatus = "REVIEW_REQUIRED") {
  return { usageStatus, display: false, cache: false, reason };
}

export const genericImageUrls: Record<GenericImageCategory, string> = {
  STROLLER: "/generic-images/stroller.webp",
  PLUSH_RABBIT: "/generic-images/plush-rabbit.webp",
  BABY_BOUNCER: "/generic-images/baby-bouncer.webp",
  BABY_CRIB: "/generic-images/baby-crib.webp",
  CLOTHING: "/generic-images/baby-clothing.webp",
  FEEDING: "/generic-images/baby-feeding.webp",
  BATH: "/generic-images/baby-bath.webp",
  TOY: "/generic-images/baby-toys.webp",
  OTHER: "/generic-images/plush-rabbit.webp",
};

export function detectGenericImageCategory(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ").toLocaleLowerCase("fr-BE");
  if (/poussette|stroller|buggy/.test(text)) return "STROLLER" as const;
  if (/lapin|doudou|peluche|rabbit|bunny/.test(text)) return "PLUSH_RABBIT" as const;
  if (/transat|balancelle|bouncer/.test(text)) return "BABY_BOUNCER" as const;
  if (/\b(?:lit|berceau|couffin|crib|cot)\b/.test(text)) return "BABY_CRIB" as const;
  if (/body|pyjama|vêtement|vetement|bonnet|chausson/.test(text)) return "CLOTHING" as const;
  if (/biberon|repas|assiette|chaise haute/.test(text)) return "FEEDING" as const;
  if (/bain|baignoire|toilette/.test(text)) return "BATH" as const;
  if (/jouet|jeu|éveil|eveil/.test(text)) return "TOY" as const;
  return "OTHER" as const;
}

export type DisplayableMedia = {
  usageStatus: ProductMediaUsageStatus;
  status: string;
  originalUrl: string | null;
  publicUrl: string | null;
  storedObjectKey: string | null;
};

export function selectProductImage(
  media: readonly DisplayableMedia[] | null | undefined,
  category: GenericImageCategory | null | undefined,
  assetBase = "/assets/product-image/",
): string {
  for (const item of media ?? []) {
    if (item.status !== "ACTIVE") continue;
    if (["AUTHORIZED", "AUTHORIZED_CACHE", "USER_DECLARED"].includes(item.usageStatus)) {
      if (item.publicUrl) return item.publicUrl;
      if (item.storedObjectKey) return `${assetBase}${encodeURIComponent(item.storedObjectKey)}`;
    }
    if (item.usageStatus === "AUTHORIZED_REMOTE_ONLY" && item.originalUrl) {
      return item.originalUrl;
    }
  }
  return genericImageUrls[category ?? "OTHER"];
}
