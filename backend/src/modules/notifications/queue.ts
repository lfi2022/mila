import type { RedisService } from "../../common/redis/client.js";

export type NotificationJob = {
  type: string;
  userId: string;
  listId?: string;
  reservationId?: string;
  email?: string;
  payload?: Record<string, unknown>;
};

export class NotificationQueue {
  constructor(private readonly redis: RedisService) {}
  async enqueue(job: NotificationJob): Promise<string> {
    if (this.redis.client.status === "wait") await this.redis.client.connect();
    return this.redis.client.xadd(
      "stream:notifications",
      "*",
      "job",
      JSON.stringify(job),
      "createdAt",
      new Date().toISOString(),
    ) as Promise<string>;
  }
}
