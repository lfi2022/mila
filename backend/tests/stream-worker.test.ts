import { describe, expect, it, vi } from "vitest";
import type { Redis } from "ioredis";

import { StreamWorker } from "../src/workers/stream-worker.js";

describe("StreamWorker telemetry and retries", () => {
  it("acknowledges successful jobs and records non-identifying telemetry", async () => {
    const redis = fakeRedis();
    const processor = vi.fn(async () => worker.stop());
    const worker = new StreamWorker(redis.client, "stream:email", "consumer-1", processor);
    await worker.run();
    expect(processor).toHaveBeenCalledWith({ id: "1-0", values: { job: "{}" } });
    expect(redis.xack).toHaveBeenCalledWith("stream:email", "mila-workers", "1-0");
    expect(redis.call).toHaveBeenCalledWith(
      "XGROUP",
      "CREATE",
      "mila:stream:email",
      "mila-workers",
      "0",
      "MKSTREAM",
    );
    expect(redis.hincrby).toHaveBeenCalledWith("ops:worker:email", "successCount", 1);
    expect(JSON.stringify(redis.hset.mock.calls)).not.toContain("job");
  });

  it("dead-letters the final failed attempt without storing the error message", async () => {
    const redis = fakeRedis(["job", "{}", "attempt", "4"]);
    const worker = new StreamWorker(redis.client, "stream:webhooks", "consumer-1", async () => {
      worker.stop();
      throw new Error("secret payload must not be copied");
    });
    await worker.run();
    expect(redis.xadd).toHaveBeenCalledWith(
      "stream:webhooks:dead-letter",
      "*",
      "job",
      "{}",
      "attempt",
      "5",
      "failedAt",
      expect.any(String),
      "error",
      "Error",
    );
    expect(JSON.stringify(redis.xadd.mock.calls)).not.toContain("secret payload");
    expect(redis.hincrby).toHaveBeenCalledWith("ops:worker:webhooks", "failureCount", 1);
  });
});

function fakeRedis(fields = ["job", "{}"]) {
  const xack = vi.fn().mockResolvedValue(1);
  const xadd = vi.fn().mockResolvedValue("2-0");
  const hset = vi.fn().mockResolvedValue(1);
  const hincrby = vi.fn().mockResolvedValue(1);
  const call = vi.fn().mockResolvedValue("OK");
  const client = {
    options: { keyPrefix: "mila:" },
    call,
    xreadgroup: vi.fn().mockResolvedValue([["stream", [["1-0", fields]]]]),
    xack,
    xadd,
    hset,
    hincrby,
    expire: vi.fn().mockResolvedValue(1),
  } as unknown as Redis;
  return { client, xack, xadd, hset, hincrby, call };
}
