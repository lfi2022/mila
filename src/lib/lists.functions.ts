import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Sets or clears the access code of a protected list (hashed, never stored in clear). */
export const setListAccessCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        registryId: z.string().uuid(),
        code: z.string().trim().min(4, "4 caractères minimum").max(64).optional().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { sha256Hex } = await import("./server-utils.server");
    const { data: allowed } = await context.supabase.rpc("is_list_owner", {
      _registry_id: data.registryId,
      _user_id: context.userId,
    });
    if (!allowed) throw new Error("Action réservée aux propriétaires de la liste.");

    const hash = data.code ? await sha256Hex(data.code) : null;
    const { error } = await context.supabase
      .from("registries")
      .update({ access_code_hash: hash })
      .eq("id", data.registryId);
    if (error) throw new Error("Le code n'a pas pu être enregistré.");
    return { ok: true, hasCode: Boolean(hash) };
  });

/** Invites a second parent by email with a single-use expiring token. */
export const inviteCoParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        registryId: z.string().uuid(),
        email: z.string().trim().email("Email invalide").max(255),
        role: z.enum(["CO_OWNER", "EDITOR"]).default("CO_OWNER"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { sha256Hex, randomToken, appOrigin, rateLimit } = await import("./server-utils.server");
    if (!rateLimit(`invite:${context.userId}`, 10, 3_600_000)) {
      throw new Error("Trop d'invitations envoyées. Réessayez plus tard.");
    }

    const { data: allowed } = await context.supabase.rpc("is_list_owner", {
      _registry_id: data.registryId,
      _user_id: context.userId,
    });
    if (!allowed) throw new Error("Action réservée aux propriétaires de la liste.");

    const { data: list } = await context.supabase
      .from("registries")
      .select("title")
      .eq("id", data.registryId)
      .maybeSingle();
    if (!list) throw new Error("Liste introuvable.");

    const token = randomToken();
    const { error } = await context.supabase.from("list_invitations").insert({
      registry_id: data.registryId,
      email: data.email.toLowerCase(),
      role: data.role,
      token_hash: await sha256Hex(token),
      invited_by: context.userId,
    });
    if (error) throw new Error("L'invitation n'a pas pu être créée.");

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();

    const link = `${appOrigin()}/invitation/${token}`;
    const { sendEmail } = await import("./email/provider.server");
    const { emailTemplates } = await import("./email/templates");
    const delivery = await sendEmail({
      to: data.email,
      template: emailTemplates.coParentInvitation({
        listTitle: list.title,
        inviterName: profile?.display_name ?? "Un parent",
        link,
      }),
    });

    return { ok: true, link, emailed: delivery.delivered };
  });

/** Accepts an invitation: the signed-in user becomes a member of the list. */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().trim().min(32).max(128).regex(/^[a-f0-9]+$/i) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { sha256Hex } = await import("./server-utils.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const hash = await sha256Hex(data.token);
    const { data: invitation } = await supabaseAdmin
      .from("list_invitations")
      .select("id, registry_id, role, expires_at, accepted_at, registries(title, slug)")
      .eq("token_hash", hash)
      .maybeSingle();

    if (!invitation) return { state: "invalid" as const };
    if (invitation.accepted_at) return { state: "already_used" as const };
    if (new Date(invitation.expires_at).getTime() < Date.now()) return { state: "expired" as const };

    const { error } = await supabaseAdmin
      .from("list_members")
      .upsert(
        { registry_id: invitation.registry_id, user_id: context.userId, role: invitation.role },
        { onConflict: "registry_id,user_id" },
      );
    if (error) throw new Error("Impossible de rejoindre la liste.");

    await supabaseAdmin
      .from("list_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    const registry = invitation.registries as { title: string; slug: string } | null;
    return {
      state: "joined" as const,
      registryId: invitation.registry_id,
      title: registry?.title ?? "la liste",
    };
  });

/** GDPR: full export of the signed-in user's own data. */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, memberships, lists, items, reservations, notifications] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase.from("list_members").select("*").eq("user_id", context.userId),
      context.supabase.from("registries").select("*"),
      context.supabase.from("items").select("*"),
      context.supabase.from("reservations").select("*"),
      context.supabase.from("notifications").select("*").eq("user_id", context.userId),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: profile.data,
      memberships: memberships.data ?? [],
      lists: lists.data ?? [],
      gifts: items.data ?? [],
      reservations: reservations.data ?? [],
      notifications: notifications.data ?? [],
    };
  });

/** GDPR: deletes the account and everything owned by it. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ownedLists } = await supabaseAdmin
      .from("list_members")
      .select("registry_id")
      .eq("user_id", context.userId)
      .eq("role", "OWNER");

    for (const row of ownedLists ?? []) {
      await supabaseAdmin.from("registries").delete().eq("id", row.registry_id);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error("Le compte n'a pas pu être supprimé.");
    return { ok: true };
  });
