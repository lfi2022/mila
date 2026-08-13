import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

/** Uploads a cover photo for a list and stores a long-lived signed URL on the registry. */
export const uploadListCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        registryId: z.string().uuid(),
        contentType: z.string().trim().max(60),
        // raw base64 (no data-URL prefix)
        base64: z.string().min(32).max(9_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!ALLOWED.has(data.contentType)) {
      throw new Error("Format non supporté : utilisez un JPEG, PNG ou WebP.");
    }

    const { data: allowed } = await context.supabase.rpc("is_list_member", {
      _registry_id: data.registryId,
      _user_id: context.userId,
    });
    if (!allowed) throw new Error("Action réservée aux parents de cette liste.");

    const binary = atob(data.base64);
    if (binary.length > MAX_BYTES) throw new Error("Image trop lourde (5 Mo maximum).");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const ext = data.contentType === "image/png" ? "png" : data.contentType === "image/webp" ? "webp" : "jpg";
    const path = `${data.registryId}/cover-${Date.now()}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uploadError } = await supabaseAdmin.storage
      .from("list-covers")
      .upload(path, bytes, { contentType: data.contentType, upsert: true });
    if (uploadError) throw new Error("L'image n'a pas pu être envoyée.");

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("list-covers")
      .createSignedUrl(path, 315_360_000);
    if (signError || !signed?.signedUrl) throw new Error("L'image n'a pas pu être publiée.");

    const { error: updateError } = await context.supabase
      .from("registries")
      .update({ cover_image_url: signed.signedUrl })
      .eq("id", data.registryId);
    if (updateError) throw new Error("La photo n'a pas pu être enregistrée sur la liste.");

    return { url: signed.signedUrl };
  });
