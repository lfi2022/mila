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
      const messages = rows?.[0]?.[1] ?? [];
      for (const [id, fields] of messages) await this.process(id, fields);
    }
  }

  stop(): void {
    this.stopping = true;
  }

  private async createGroup(): Promise<void> {
    try {
      await this.redis.xgroup("CREATE", this.stream, "mila-workers", "0", "MKSTREAM");
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) throw error;
    }
  }

  private async process(id: string, fields: string[]): Promise<void> {
    const values = Object.fromEntries(chunkPairs(fields));
    const attempt = Number.parseInt(values["attempt"] ?? "0", 10) || 0;
    try {
      await this.processor({ id, values });
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
    } finally {
      await this.redis.xack(this.stream, "mila-workers", id);
    }
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
