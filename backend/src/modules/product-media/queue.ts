import type { RedisService } from "../../common/redis/client.js";

export class ProductMediaQueue {
  constructor(private readonly redis: RedisService) {}
  async enqueue(mediaId: string, reason: string) {
    if (this.redis.client.status === "wait") await this.redis.client.connect();
    return this.redis.client.xadd(
      "stream:product-media",
      "*",
      "mediaId",
      mediaId,
      "reason",
      reason,
      "createdAt",
      new Date().toISOString(),
    ) as Promise<string>;
  }
}
