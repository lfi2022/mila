import type { RedisService } from "../../common/redis/client.js";

export type ProductRefreshKind = "metadata" | "price" | "stock" | "link" | "authorized-image";

export class ProductRefreshQueue {
  constructor(private readonly redis: RedisService) {}
  async enqueue(giftId: string, kinds: ProductRefreshKind[], reason: string): Promise<string> {
    if (this.redis.client.status === "wait") await this.redis.client.connect();
    return this.redis.client.xadd(
      "stream:product-refresh",
      "*",
      "giftId",
      giftId,
      "kinds",
      JSON.stringify(kinds),
      "reason",
      reason,
      "createdAt",
      new Date().toISOString(),
    ) as Promise<string>;
  }
}
