import { buildAssetUrl } from "@/config/runtime";
import { apiRequest, ApiError } from "@/services/api/client";

export type PublicGift = {
  id: string;
  title: string;
  description: string | null;
  store_name: string | null;
  price: number | null;
  currency: string;
  image_url: string | null;
  quantity: number;
  reserved_qty: number;
  kind: "LINK" | "PRODUCT" | "SERVICE" | "EXPERIENCE" | "FREE_GIFT" | "CONTRIBUTION";
  public_token: string;
  has_link: boolean;
  is_reserved: boolean;
  contribution_target: number | null;
  contribution_collected: number;
  second_hand_policy: "NEW_ONLY" | "SECOND_HAND_ALLOWED" | "SECOND_HAND_PREFERRED";
  reservation_labels: Array<{ name: string; purchased: boolean }>;
};

type PublicListPayload = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  welcomeMessage: string | null;
  childName: string | null;
  coverMediaKey: string | null;
  dueDate: string | null;
  type: string;
  visibility: "PUBLIC" | "UNLISTED" | "PROTECTED";
  surpriseMode: boolean;
  allowIndexing: boolean;
  showProgress: boolean;
  showReservationNames: boolean;
  theme: string;
  accentColor: string | null;
  heroStyle: string;
  fontPair: string;
  layout: string;
  gifts: Array<{
    id: string;
    publicToken: string;
    title: string;
    description: string | null;
    kind: PublicGift["kind"];
    hasLink: boolean;
    currency: string;
    unitPriceMinor: string | null;
    quantity: number;
    reservedQuantity: number;
    fundedAmountMinor: string;
    contributionTargetMinor: string | null;
    secondHandPolicy: PublicGift["second_hand_policy"];
    isReserved: boolean;
    imageUrl: string;
    reservationLabels: Array<{ name: string; purchased: boolean }>;
  }>;
  totals: {
    items: number;
    taken: number;
    valuesByCurrency: Array<{ currency: string; amountMinor: string }>;
  };
};

export type PublicListResult =
  | { state: "not_found" }
  | { state: "locked"; title: string; babyName: null; wrongCode: boolean }
  | {
      state: "ok";
      list: {
        id: string;
        slug: string;
        title: string;
        baby_name: string | null;
        welcome_message: string | null;
        description: string | null;
        cover_image_url: string | null;
        due_date: string | null;
        type: string;
        visibility: PublicListPayload["visibility"];
        allow_indexing: boolean;
        surprise_mode: boolean;
        is_demo: boolean;
        theme: string;
        accent_color: string | null;
        hero_style: string;
        font_pair: string;
        layout: string;
        show_progress: boolean;
        reserved_display: "SHOW" | "HIDE";
        show_reservation_names: boolean;
      };
      gifts: PublicGift[];
      totals: PublicListPayload["totals"];
    };

export async function getPublicList(slug: string, wrongCode = false): Promise<PublicListResult> {
  try {
    const { list } = await apiRequest<{ list: PublicListPayload }>(
      `/public/lists/${encodeURIComponent(slug)}`,
    );
    return {
      state: "ok",
      list: {
        id: list.id,
        slug: list.slug,
        title: list.title,
        baby_name: list.childName,
        welcome_message: list.welcomeMessage,
        description: list.description,
        cover_image_url: list.coverMediaKey
          ? buildAssetUrl("list-cover", list.coverMediaKey)
          : null,
        due_date: list.dueDate,
        type: list.type,
        visibility: list.visibility,
        allow_indexing: list.allowIndexing,
        surprise_mode: list.surpriseMode,
        is_demo: list.slug === "demo-mila",
        theme: list.theme,
        accent_color: list.accentColor,
        hero_style: list.heroStyle,
        font_pair: list.fontPair,
        layout: list.layout,
        show_progress: list.showProgress,
        reserved_display: "SHOW",
        show_reservation_names: list.showReservationNames,
      },
      gifts: list.gifts.map((gift) => ({
        id: gift.id,
        title: gift.title,
        description: gift.description,
        store_name: null,
        price: gift.unitPriceMinor == null ? null : Number(gift.unitPriceMinor) / 100,
        currency: gift.currency,
        image_url: gift.imageUrl,
        quantity: gift.quantity,
        reserved_qty: gift.reservedQuantity,
        kind: gift.kind,
        public_token: gift.publicToken,
        has_link: gift.hasLink,
        is_reserved: gift.isReserved,
        contribution_target:
          gift.contributionTargetMinor == null ? null : Number(gift.contributionTargetMinor) / 100,
        contribution_collected: Number(gift.fundedAmountMinor) / 100,
        second_hand_policy: gift.secondHandPolicy,
        reservation_labels: gift.reservationLabels,
      })),
      totals: list.totals,
    };
  } catch (error) {
    if (error instanceof ApiError && error.code === "LIST_ACCESS_REQUIRED") {
      return { state: "locked", title: "Liste protégée", babyName: null, wrongCode };
    }
    if (error instanceof ApiError && error.status === 404) return { state: "not_found" };
    throw error;
  }
}

export async function unlockPublicList(slug: string, accessCode: string): Promise<void> {
  await apiRequest(`/public/lists/${encodeURIComponent(slug)}/unlock`, {
    method: "POST",
    body: JSON.stringify({ accessCode }),
  });
}

export async function reserveGift(input: {
  giftToken: string;
  guestName: string;
  guestEmail?: string;
  message?: string;
  quantity: number;
}): Promise<{ managementToken: string }> {
  return apiRequest("/public/reservations", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      guestEmail: input.guestEmail || null,
      message: input.message || null,
    }),
  });
}
