import type { FastifyInstance, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";

import type { AppConfig } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { RedisService } from "../redis/client.js";

const requestStartedAt = Symbol("requestStartedAt");

type RequestWithTiming = FastifyRequest & { [requestStartedAt]?: bigint };

export class MetricsRegistry {
  private readonly startedAt = Date.now();
  private readonly requests = new Map<string, { count: number; durationMs: number }>();
  private readonly errors = new Map<string, number>();
  private readonly dependencies = new Map<string, "up" | "down">();

  observeHttp(method: string, route: string, statusCode: number, durationMs: number) {
    const status = `${Math.floor(statusCode / 100)}xx`;
    const key = JSON.stringify([method, route, status]);
    const current = this.requests.get(key) ?? { count: 0, durationMs: 0 };
    current.count += 1;
    current.durationMs += durationMs;
    this.requests.set(key, current);
  }

  recordError(code: string) {
    this.errors.set(code, (this.errors.get(code) ?? 0) + 1);
  }

  setDependencies(dependencies: Record<string, "up" | "down">) {
    for (const [name, status] of Object.entries(dependencies)) this.dependencies.set(name, status);
  }

  render(): string {
    const lines = [
      "# HELP mila_process_uptime_seconds API process uptime.",
      "# TYPE mila_process_uptime_seconds gauge",
      `mila_process_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1_000)}`,
      "# HELP mila_http_requests_total Completed HTTP requests.",
      "# TYPE mila_http_requests_total counter",
      "# HELP mila_http_request_duration_milliseconds_sum Total request duration.",
      "# TYPE mila_http_request_duration_milliseconds_sum counter",
    ];
    for (const [key, value] of this.requests) {
      const [method, route, status] = JSON.parse(key) as [string, string, string];
      const labels = `method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${status}"`;
      lines.push(`mila_http_requests_total{${labels}} ${value.count}`);
      lines.push(
        `mila_http_request_duration_milliseconds_sum{${labels}} ${value.durationMs.toFixed(3)}`,
      );
    }
    lines.push(
      "# HELP mila_application_errors_total Controlled application errors by non-identifying code.",
      "# TYPE mila_application_errors_total counter",
    );
    for (const [code, count] of this.errors)
      lines.push(`mila_application_errors_total{code="${escapeLabel(code)}"} ${count}`);
    lines.push(
      "# HELP mila_dependency_up Whether a readiness dependency is available.",
      "# TYPE mila_dependency_up gauge",
    );
    for (const [dependency, status] of this.dependencies)
      lines.push(
        `mila_dependency_up{dependency="${escapeLabel(dependency)}"} ${status === "up" ? 1 : 0}`,
      );
    return `${lines.join("\n")}\n`;
  }
}

export function installRequestObservability(app: FastifyInstance, metrics: MetricsRegistry): void {
  app.addHook("onRequest", async (request) => {
    (request as RequestWithTiming)[requestStartedAt] = process.hrtime.bigint();
  });
  app.addHook("onResponse", async (request, reply) => {
    const startedAt = (request as RequestWithTiming)[requestStartedAt] ?? process.hrtime.bigint();
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route = request.routeOptions.url || "unmatched";
    metrics.observeHttp(request.method, route, reply.statusCode, durationMs);
    request.log.info(
      {
        event: "http_request_completed",
        requestId: request.id,
        method: request.method,
        route,
        statusCode: reply.statusCode,
        durationMs: Number(durationMs.toFixed(3)),
      },
      "HTTP request completed",
    );
  });
}

export class OperationalMetrics {
  constructor(
    private readonly config: AppConfig,
    private readonly prisma?: PrismaClient,
    private readonly redis?: RedisService,
  ) {}

  async render(): Promise<string> {
    const lines: string[] = [];
    await this.queueMetrics(lines);
    await this.databaseMetrics(lines);
    lines.push(
      "# HELP mila_integration_configured Whether an external integration is configured and enabled.",
      "# TYPE mila_integration_configured gauge",
      `mila_integration_configured{integration="email"} ${this.config.EMAIL_PROVIDER === "smtp" ? 1 : 0}`,
      `mila_integration_configured{integration="mollie"} ${this.config.FEATURE_MOLLIE_PAYMENTS ? 1 : 0}`,
      `mila_integration_configured{integration="storage"} ${this.redis ? 1 : 0}`,
    );
    return `${lines.join("\n")}\n`;
  }

  private async queueMetrics(lines: string[]) {
    lines.push(
      "# HELP mila_queue_depth Redis stream length.",
      "# TYPE mila_queue_depth gauge",
      "# HELP mila_queue_dead_letter_depth Redis dead-letter stream length.",
      "# TYPE mila_queue_dead_letter_depth gauge",
      "# HELP mila_worker_heartbeat_age_seconds Seconds since the last worker heartbeat.",
      "# TYPE mila_worker_heartbeat_age_seconds gauge",
      "# HELP mila_worker_stale Whether the worker heartbeat exceeds the configured threshold.",
      "# TYPE mila_worker_stale gauge",
      "# HELP mila_worker_jobs_total Worker jobs by result.",
      "# TYPE mila_worker_jobs_total counter",
    );
    if (!this.redis) return;
    const queues = [...new Set(this.config.WORKER_QUEUES.split(",").map((item) => item.trim()))];
    for (const queue of queues) {
      const stream = `stream:${queue}`;
      try {
        const [pending, deadLetters, telemetry] = await Promise.all([
          this.redis.client.xpending(stream, "mila-workers"),
          this.redis.client.xlen(`${stream}:dead-letter`),
          this.redis.client.hgetall(`ops:worker:${queue}`),
        ]);
        const heartbeat = Date.parse(telemetry["heartbeatAt"] ?? "");
        const heartbeatAge = Number.isFinite(heartbeat)
          ? Math.max(0, Math.floor((Date.now() - heartbeat) / 1_000))
          : -1;
        const label = `queue="${escapeLabel(queue)}"`;
        const depth = Number((pending as unknown as [number])[0] ?? 0);
        lines.push(`mila_queue_depth{${label}} ${depth}`);
        lines.push(`mila_queue_dead_letter_depth{${label}} ${deadLetters}`);
        lines.push(`mila_worker_heartbeat_age_seconds{${label}} ${heartbeatAge}`);
        lines.push(
          `mila_worker_stale{${label}} ${heartbeatAge < 0 || heartbeatAge > this.config.WORKER_STALE_AFTER_SECONDS ? 1 : 0}`,
        );
        lines.push(
          `mila_worker_jobs_total{${label},result="success"} ${telemetry["successCount"] ?? "0"}`,
        );
        lines.push(
          `mila_worker_jobs_total{${label},result="failure"} ${telemetry["failureCount"] ?? "0"}`,
        );
      } catch {
        lines.push(`mila_queue_depth{queue="${escapeLabel(queue)}"} -1`);
      }
    }
  }

  private async databaseMetrics(lines: string[]) {
    lines.push(
      "# HELP mila_payment_inconsistencies Payments whose settled state lacks its expected entitlement.",
      "# TYPE mila_payment_inconsistencies gauge",
      "# HELP mila_recent_chargebacks Chargebacks recorded during the last 24 hours.",
      "# TYPE mila_recent_chargebacks gauge",
      "# HELP mila_open_high_risk_reviews Open high-score abuse or fraud reviews.",
      "# TYPE mila_open_high_risk_reviews gauge",
      "# HELP mila_payout_anomalies Enabled or non-positive payout records requiring review.",
      "# TYPE mila_payout_anomalies gauge",
    );
    if (!this.prisma) return;
    const since = new Date(Date.now() - 86_400_000);
    try {
      const [paymentInconsistencies, chargebacks, highRiskReviews, payoutAnomalies] =
        await Promise.all([
          this.prisma.payment.count({
            where: { status: "PAID", purpose: "PREMIUM", entitlement: { is: null } },
          }),
          this.prisma.chargeback.count({ where: { occurredAt: { gte: since } } }),
          this.prisma.riskReview.count({ where: { status: "OPEN", score: { gte: 70 } } }),
          this.prisma.payout.count({
            where: { OR: [{ amountMinor: { lte: 0n } }, { status: { not: "DISABLED" } }] },
          }),
        ]);
      lines.push(`mila_payment_inconsistencies ${paymentInconsistencies}`);
      lines.push(`mila_recent_chargebacks ${chargebacks}`);
      lines.push(`mila_open_high_risk_reviews ${highRiskReviews}`);
      lines.push(`mila_payout_anomalies ${payoutAnomalies}`);
    } catch {
      lines.push("mila_payment_inconsistencies -1");
    }
  }
}

export function observabilityAuthorized(request: FastifyRequest, token: string): boolean {
  const authorization = request.headers.authorization ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const left = Buffer.from(supplied);
  const right = Buffer.from(token);
  return Boolean(token) && left.length === right.length && timingSafeEqual(left, right);
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
