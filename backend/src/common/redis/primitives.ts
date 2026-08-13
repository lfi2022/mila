import { randomUUID } from "node:crypto";

import type { RedisService } from "./client.js";

export class RedisPrimitives {
  constructor(private readonly redis: RedisService) {}

  async cacheGet<T>(key: string): Promise<T | null> {
    const value = await this.redis.client.get(`cache:${key}`);
    return value === null ? null : (JSON.parse(value) as T);
  }

  async cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.client.set(`cache:${key}`, JSON.stringify(value), "EX", ttlSeconds);
  }

  async withLock<T>(key: string, ttlMs: number, operation: () => Promise<T>): Promise<T | null> {
    const token = randomUUID();
    const acquired = await this.redis.client.set(`lock:${key}`, token, "PX", ttlMs, "NX");
    if (acquired !== "OK") return null;
    try {
      return await operation();
    } finally {
      await this.redis.client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        `lock:${key}`,
        token,
      );
    }
  }

  async idempotent<T>(key: string, ttlSeconds: number, operation: () => Promise<T>): Promise<T> {
    const resultKey = `idempotency:${key}:result`;
    const existing = await this.redis.client.get(resultKey);
    if (existing !== null) return JSON.parse(existing) as T;
    const result = await this.withLock(`idempotency:${key}`, 30_000, operation);
    if (result === null) throw new Error("Idempotent operation is already in progress");
    await this.redis.client.set(resultKey, JSON.stringify(result), "EX", ttlSeconds);
    return result;
  }
}
