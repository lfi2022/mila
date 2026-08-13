import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  kind: "LINK" | "MANUAL" | "CONTRIBUTION";
  public_token: string;
  has_link: boolean;
  is_reserved: boolean;

  contribution_target: number | null;
  contribution_collected: number;
};

export type PublicList = {
  id: string;
  slug: string;
  title: string;
  baby_name: string | null;
  welcome_message: string | null;
  description: string | null;
  cover_image_url: string | null;
  due_date: string | null;
  type: string;
  visibility: "PUBLIC" | "UNLISTED" | "PROTECTED";
  allow_indexing: boolean;
  surprise_mode: boolean;
  is_demo: boolean;
  theme: string;
  accent_color: string | null;
  hero_style: string;
  font_pair: string;
  layout: string;
  show_progress: boolean;
  /** "SHOW" keeps reserved gifts visible (default), "HIDE" removes them from the public page. */
  reserved_display: "SHOW" | "HIDE";
};

export type PublicListResult =
  | { state: "not_found" }
  | { state: "locked"; title: string; babyName: string | null; wrongCode: boolean }
  | {
      state: "ok";
      list: PublicList;
      gifts: PublicGift[];
      totals: { items: number; taken: number };
    };

const slugInput = z.object({
  slug: z.string().trim().min(1).max(120),
  code: z.string().trim().max(64).optional(),
});

export const getPublicList = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => slugInput.parse(data))
  .handler(async ({ data }): Promise<PublicListResult> => {
    const { createPublicSupabase, sha256Hex } = await import("./server-utils.server");
    const supabasePublic = createPublicSupabase();

    const { data: list } = await supabasePublic
      .from("registries")
      .select(
        "id, slug, title, baby_name, welcome_message, description, cover_image_url, due_date, type, visibility, allow_indexing, surprise_mode, is_demo, theme, accent_color, hero_style, font_pair, layout, show_progress, reserved_display, access_code_hash",
      )
      .eq("slug", data.slug)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (!list) return { state: "not_found" };

    const { access_code_hash: accessCodeHash, ...publicFields } = list;

    if (list.visibility === "PROTECTED") {
      const provided = data.code?.trim();
      const matches = Boolean(
        provided && accessCodeHash && (await sha256Hex(provided)) === accessCodeHash,
      );
      if (!matches) {
        return {
          state: "locked",
          title: list.title,
          babyName: list.baby_name,
          wrongCode: Boolean(provided),
        };
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: gifts }, { data: allItems }] = await Promise.all([
      supabaseAdmin
        .from("items")
        .select(
          "id, title, description, store_name, price, currency, image_url, quantity, reserved_qty, kind, public_token, url, contribution_target, contribution_collected",
        )
        .eq("registry_id", list.id)
        .eq("hidden_by_moderator", false)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("items")
        .select("quantity, reserved_qty, status")
        .eq("registry_id", list.id)
        .eq("hidden_by_moderator", false),
    ]);

    const totals = {
      items: allItems?.length ?? 0,
      taken: (allItems ?? []).filter(
        (i) => i.status !== "AVAILABLE" || i.reserved_qty >= i.quantity,
      ).length,
    };

    const hideReserved = list.reserved_display === "HIDE";
    const visible = (gifts ?? [])
      .map(({ url, ...gift }) => {
        const isReserved = gift.reserved_qty >= gift.quantity;
        return { ...gift, has_link: Boolean(url), is_reserved: isReserved } as PublicGift;
      })
      .filter((gift) => !(hideReserved && gift.is_reserved));

    // Demo lists never pollute real statistics.
    if (!list.is_demo) {
      await supabasePublic.rpc("increment_list_view", { _slug: data.slug });
    }

    return { state: "ok", list: publicFields as PublicList, gifts: visible, totals };
  });

const reserveInput = z.object({
  itemId: z.string().uuid(),
  guestName: z.string().trim().min(2, "Indiquez votre prénom").max(80),
  guestEmail: z.string().trim().email("Email invalide").max(255).optional().or(z.literal("")),
  message: z.string().trim().max(800).optional().or(z.literal("")),
  quantity: z.number().int().min(1).max(20).default(1),
  intent: z.enum(["reserve", "order"]).default("reserve"),
});

const ERROR_MESSAGES: Record<string, string> = {
  already_taken: "Ce cadeau vient d'être réservé par quelqu'un d'autre.",
  item_not_found: "Ce cadeau n'existe plus.",
  item_unavailable: "Ce cadeau n'est plus disponible.",
  list_unavailable: "Cette liste n'est plus active.",
  invalid_quantity: "Quantité invalide.",
  invalid_name: "Prénom invalide.",
};

/** Atomic, guest-friendly reservation. The database locks the gift row. */
export const reserveGift = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reserveInput.parse(data))
  .handler(async ({ data }) => {
    const { createPublicSupabase, rateLimit, clientFingerprint, appOrigin } =
      await import("./server-utils.server");

    if (!rateLimit(`reserve:${clientFingerprint()}`, 8, 60_000)) {
      throw new Error("Trop de réservations d'affilée. Réessayez dans une minute.");
    }

    // Demo lists let visitors open the flow, but nothing is ever written.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: demoCheck } = await supabaseAdmin
      .from("items")
      .select("registries(is_demo)")
      .eq("id", data.itemId)
      .maybeSingle();
    if (demoCheck?.registries?.is_demo) {
      throw new Error(
        "Ceci est une liste de démonstration : la réservation n'est pas enregistrée. Créez votre liste pour de vrai !",
      );
    }

    const supabasePublic = createPublicSupabase();

    const { data: result, error } = await supabasePublic.rpc("reserve_item", {
      _item_id: data.itemId,
      _guest_name: data.guestName,
      _guest_email: (data.guestEmail || null) as unknown as string,
      _message: (data.message || null) as unknown as string,
      _quantity: data.quantity,
      _intent: data.intent,
    });

    if (error) {
      const key = Object.keys(ERROR_MESSAGES).find((k) => error.message.includes(k));
      throw new Error(key ? ERROR_MESSAGES[key]! : "La réservation n'a pas pu être enregistrée.");
    }

    const row = Array.isArray(result) ? result[0] : null;
    if (!row?.token) throw new Error("La réservation n'a pas pu être enregistrée.");

    const manageLink = `${appOrigin()}/r/${row.token}`;
    await notifyReservation({
      itemId: data.itemId,
      guestName: data.guestName,
      guestEmail: data.guestEmail || null,
      message: data.message || null,
      manageLink,
    });

    return { manageLink, reservationId: row.reservation_id };
  });

async function notifyReservation(params: {
  itemId: string;
  guestName: string;
  guestEmail: string | null;
  message: string | null;
  manageLink: string;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail } = await import("./email/provider.server");
    const { emailTemplates } = await import("./email/templates");
    const { appOrigin } = await import("./server-utils.server");

    const { data: item } = await supabaseAdmin
      .from("items")
      .select("title, registry_id, registries(title, surprise_mode)")
      .eq("id", params.itemId)
      .maybeSingle();
    if (!item) return;

    const registry = item.registries as { title: string; surprise_mode: boolean } | null;
    const listTitle = registry?.title ?? "votre liste";
    const surprise = registry?.surprise_mode ?? false;
    const origin = appOrigin();

    if (params.guestEmail) {
      await sendEmail({
        to: params.guestEmail,
        template: emailTemplates.reservationConfirmation({
          guestName: params.guestName,
          itemTitle: item.title,
          listTitle,
          manageLink: params.manageLink,
        }),
      });
    }

    const { data: members } = await supabaseAdmin
      .from("list_members")
      .select("user_id")
      .eq("registry_id", item.registry_id);

    for (const member of (members ?? []).slice(0, 5)) {
      const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
      const email = userResult?.user?.email;
      if (!email) continue;
      await sendEmail({
        to: email,
        template: emailTemplates.giftReserved({
          itemTitle: item.title,
          guestName: params.guestName,
          listTitle,
          appUrl: origin,
          surprise,
        }),
      });
      if (params.message && !surprise) {
        await sendEmail({
          to: email,
          template: emailTemplates.messageReceived({
            guestName: params.guestName,
            message: params.message,
            listTitle,
            appUrl: origin,
          }),
        });
      }
    }
  } catch (error) {
    console.error("[reservation] notification failed", error);
  }
}

const tokenInput = z.object({
  token: z
    .string()
    .trim()
    .min(32)
    .max(128)
    .regex(/^[a-f0-9]+$/i),
});

export const getReservationByToken = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => tokenInput.parse(data))
  .handler(async ({ data }) => {
    const { createPublicSupabase } = await import("./server-utils.server");
    const { data: rows, error } = await createPublicSupabase().rpc("get_reservation_by_token", {
      _token: data.token,
    });
    if (error) throw new Error("Lien invalide ou expiré.");
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return { state: "invalid" as const };
    return { state: "ok" as const, reservation: row };
  });

const updateInput = z.object({
  token: z
    .string()
    .trim()
    .min(32)
    .max(128)
    .regex(/^[a-f0-9]+$/i),
  action: z.enum(["message", "purchased", "cancel"]),
  message: z.string().trim().max(800).optional(),
});

export const updateReservationByToken = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateInput.parse(data))
  .handler(async ({ data }) => {
    const { createPublicSupabase, rateLimit, clientFingerprint } =
      await import("./server-utils.server");
    if (!rateLimit(`res-update:${clientFingerprint()}`, 20, 60_000)) {
      throw new Error("Trop de requêtes, patientez un instant.");
    }

    const supabasePublic = createPublicSupabase();
    const { data: rows } = await supabasePublic.rpc("get_reservation_by_token", {
      _token: data.token,
    });
    const before = Array.isArray(rows) ? rows[0] : null;

    const { error } = await supabasePublic.rpc("update_reservation_by_token", {
      _token: data.token,
      _action: data.action,
      _message: (data.message ?? null) as unknown as string,
    });
    if (error) throw new Error("Cette action n'a pas pu être effectuée.");

    if (before) {
      try {
        const { sendEmail } = await import("./email/provider.server");
        const { emailTemplates } = await import("./email/templates");
        const { appOrigin } = await import("./server-utils.server");
        if (data.action === "cancel" && before.guest_email) {
          await sendEmail({
            to: before.guest_email,
            template: emailTemplates.reservationCancelled({
              itemTitle: before.item_title,
              listTitle: before.registry_title,
            }),
          });
        }
        if (data.action === "purchased") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: list } = await supabaseAdmin
            .from("registries")
            .select("id, title, surprise_mode")
            .eq("slug", before.registry_slug)
            .maybeSingle();
          if (list) {
            const { data: members } = await supabaseAdmin
              .from("list_members")
              .select("user_id")
              .eq("registry_id", list.id);
            for (const member of (members ?? []).slice(0, 5)) {
              const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(
                member.user_id,
              );
              if (!userResult?.user?.email) continue;
              await sendEmail({
                to: userResult.user.email,
                template: emailTemplates.giftPurchased({
                  itemTitle: before.item_title,
                  listTitle: list.title,
                  appUrl: appOrigin(),
                  surprise: list.surprise_mode,
                }),
              });
            }
          }
        }
      } catch (error) {
        console.error("[reservation] update notification failed", error);
      }
    }

    return { ok: true };
  });
