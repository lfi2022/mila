import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "../src/generated/prisma/client.js";
import { GiftsService } from "../src/modules/gifts/service.js";
import type { ListsService } from "../src/modules/lists/service.js";

describe("GiftsService", () => {
  it("persists corrected product data with explicit remote-image provenance", async () => {
    const giftCreate = vi
      .fn()
      .mockImplementation(({ data }) => Promise.resolve({ id: "gift-1", ...data }));
    const transactionClient = {
      productIdentity: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "identity-1" }),
      },
      gift: { create: giftCreate },
    };
    const prisma = {
      merchantDomain: { findFirst: vi.fn().mockResolvedValue({ merchantId: "merchant-1" }) },
      $transaction: vi.fn().mockImplementation((callback) => callback(transactionClient)),
    } as unknown as PrismaClient;
    const lists = { assertRole: vi.fn().mockResolvedValue("OWNER") } as unknown as ListsService;
    const queue = { enqueue: vi.fn().mockResolvedValue("job-1") };
    const service = new GiftsService(prisma, lists, queue as never);

    const result = await service.create("user-1", "list-1", {
      title: "Poussette corrigée",
      kind: "PRODUCT",
      url: "https://shop.example/product#tracking",
      canonicalUrl: "https://shop.example/product",
      currency: "eur",
      unitPriceMinor: "12995",
      quantity: 1,
      image: { url: "https://cdn.example/image.jpg", source: "REMOTE" },
      identity: { gtin: "1234567890123", brand: "Mila Test" },
    });

    expect(result.publicToken).toMatch(/^[a-f0-9]{64}$/);
    const data = giftCreate.mock.calls[0]?.[0].data;
    expect(data.url).toBe("https://shop.example/product");
    expect(data.unitPriceMinor).toBe(12_995n);
    expect(data.images.create).toMatchObject({
      sourceType: "REMOTE",
      usagePolicy: "MANUAL_REVIEW_REQUIRED",
      attributionRequired: true,
    });
    expect(queue.enqueue).toHaveBeenCalledWith(
      "gift-1",
      ["metadata", "price", "stock", "link", "authorized-image"],
      "gift-created",
    );
  });
});
