import type { Redis } from "ioredis";

export type StreamJob = { id: string; values: Record<string, string> };
export type StreamProcessor = (job: StreamJob) => Promise<void>;

export class StreamWorker {
  private stopping = false;

  constructor(
    private readonly redis: Redis,
    private readonly stream: string,
    private readonly consumer: string,
    private readonly processor: StreamProcessor,
    private readonly maxAttempts = 5,
  ) {}

  async run(): Promise<void> {
    await this.createGroup();
    while (!this.stopping) {
      const response = await this.redis.xreadgroup(
        "GROUP",
        "mila-workers",
        this.consumer,
        "COUNT",
        1,
        "BLOCK",
        2_000,
        "STREAMS",
        this.stream,
        ">",
      );
      const rows = response as unknown as Array<[string, Array<[string, string[]]>]> | null;
      await this.heartbeat();
      const messages = rows?.[0]?.[1] ?? [];
      for (const [id, fields] of messages) await this.process(id, fields);
    }
  }

  stop(): void {
    this.stopping = true;
  }

  private async createGroup(): Promise<void> {
    try {
      // ioredis applies keyPrefix to XREADGROUP/XACK but does not identify the
      // stream key in every XGROUP subcommand. Address the physical key here so
      // group creation and consumption always target the same stream.
      const physicalStream = `${this.redis.options.keyPrefix ?? ""}${this.stream}`;
      await this.redis.call("XGROUP", "CREATE", physicalStream, "mila-workers", "0", "MKSTREAM");
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) throw error;
    }
  }

  private async process(id: string, fields: string[]): Promise<void> {
    const values = Object.fromEntries(chunkPairs(fields));
    const attempt = Number.parseInt(values["attempt"] ?? "0", 10) || 0;
    const startedAt = Date.now();
    try {
      await this.processor({ id, values });
      await this.recordResult("success", startedAt);
    } catch (error) {
      const nextAttempt = attempt + 1;
      const target = nextAttempt >= this.maxAttempts ? `${this.stream}:dead-letter` : this.stream;
      await this.redis.xadd(
        target,
        "*",
        ...fieldsWithout(fields, "attempt"),
        "attempt",
        String(nextAttempt),
        "failedAt",
        new Date().toISOString(),
        "error",
        error instanceof Error ? error.name : "UnknownError",
      );
      await this.recordResult("failure", startedAt, error instanceof Error ? error.name : "Error");
    } finally {
      await this.redis.xack(this.stream, "mila-workers", id);
    }
  }

  private async heartbeat(): Promise<void> {
    const key = this.telemetryKey();
    await this.redis.hset(key, "heartbeatAt", new Date().toISOString());
    await this.redis.expire(key, 86_400);
  }

  private async recordResult(
    result: "success" | "failure",
    startedAt: number,
    errorName?: string,
  ): Promise<void> {
    const key = this.telemetryKey();
    const now = new Date().toISOString();
    await this.redis.hincrby(key, `${result}Count`, 1);
    await this.redis.hset(
      key,
      "heartbeatAt",
      now,
      `last${result === "success" ? "Success" : "Failure"}At`,
      now,
      "lastDurationMs",
      String(Date.now() - startedAt),
      ...(errorName ? ["lastErrorType", errorName] : []),
    );
    await this.redis.expire(key, 86_400);
  }

  private telemetryKey(): string {
    return `ops:worker:${this.stream.replace(/^stream:/, "")}`;
  }
}

function chunkPairs(fields: string[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let index = 0; index < fields.length; index += 2) {
    pairs.push([fields[index] ?? "", fields[index + 1] ?? ""]);
  }
  return pairs;
}

function fieldsWithout(fields: string[], omitted: string): string[] {
  return chunkPairs(fields).flatMap(([key, value]) => (key === omitted ? [] : [key, value]));
}
