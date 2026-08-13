import { apiRequest } from "@/services/api/client";

export type ProductPreview = {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  priceMinor: string | null;
  currency: string;
  url: string;
  canonicalUrl: string;
  brand: string | null;
};

export async function previewProduct(url: string): Promise<ProductPreview> {
  return (
    await apiRequest<{ preview: ProductPreview }>("/products/preview", {
      method: "POST",
      body: JSON.stringify({ url }),
      timeoutMs: 12_000,
    })
  ).preview;
}
