import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const urlInput = z.object({ url: z.string().min(3).max(2048) });

export type ProductPreview = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  storeName: string | null;
  url: string;
  merchantId: string | null;
  merchantName: string | null;
  extracted: boolean;
};

/**
 * Reads the public metadata of a product page so the parent gets a preview.
 * Signed-in only (prevents using Mila as an open URL fetcher) and rate limited.
 */
export const previewProductUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => urlInput.parse(data))
  .handler(async ({ data, context }): Promise<ProductPreview> => {
    const { validateExternalUrl } = await import("./url-safety");
    const { rateLimit } = await import("./server-utils.server");

    if (!rateLimit(`preview:${context.userId}`, 20, 60_000)) {
      throw new Error("Trop de tentatives, patientez une minute.");
    }

    const validated = validateExternalUrl(data.url);
    if (!validated.ok) throw new Error(validated.reason);

    const { extractProductMetadata } = await import("./metadata.server");
    const { findMerchantForUrl } = await import("./affiliate");

    const [metadata, merchants] = await Promise.all([
      extractProductMetadata(validated.url).catch(() => null),
      context.supabase
        .from("merchants_public")
        .select("id, name, domains")
        .then((res) => res.data ?? []),
    ]);

    const merchant = findMerchantForUrl(validated.url, merchants as never);

    return {
      title: metadata?.title ?? null,
      description: metadata?.description ?? null,
      imageUrl: metadata?.imageUrl ?? null,
      price: metadata?.price ?? null,
      currency: metadata?.currency ?? "EUR",
      storeName: merchant?.name ?? metadata?.siteName ?? validated.hostname.replace(/^www\./, ""),
      url: validated.url,
      merchantId: merchant?.id ?? null,
      merchantName: merchant?.name ?? null,
      extracted: Boolean(metadata?.title),
    };
  });

/** Resolves the merchant for a URL without fetching the remote page. */
export const matchMerchant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => urlInput.parse(data))
  .handler(async ({ data, context }) => {
    const { validateExternalUrl } = await import("./url-safety");
    const { findMerchantForUrl } = await import("./affiliate");
    const validated = validateExternalUrl(data.url);
    if (!validated.ok) throw new Error(validated.reason);
    const { data: merchants } = await context.supabase
      .from("merchants_public")
      .select("id, name, domains");
    const merchant = findMerchantForUrl(validated.url, (merchants ?? []) as never);
    return {
      merchantId: merchant?.id ?? null,
      merchantName: merchant?.name ?? null,
      url: validated.url,
    };
  });
