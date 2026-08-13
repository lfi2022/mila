import type { DatabaseService } from "../../common/database/client.js";
import type { AppConfig } from "../../config/env.js";
import type { ProductRefreshQueue } from "../products/refresh-queue.js";

export function calculateRefreshHours(input: {
  status: string;
  dueDate: Date | null;
  volatilityBps: number;
  merchantMinMinutes: number;
  failureCount: number;
  minHours: number;
  maxHours: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dueDays = input.dueDate
    ? Math.ceil((input.dueDate.getTime() - now.getTime()) / 86_400_000)
    : null;
  let hours = 24;
  if (dueDays !== null && dueDays <= 30) hours = 12;
  if (dueDays !== null && dueDays <= 7) hours = 6;
  if (input.volatilityBps >= 500) hours = Math.min(hours, 6);
  if (["RESERVED", "ORDERED", "SHIPPED", "RECEIVED", "CANCELLED"].includes(input.status))
    hours = 72;
  hours *= 2 ** Math.min(input.failureCount, 3);
  hours = Math.max(hours, Math.ceil(input.merchantMinMinutes / 60), input.minHours);
  return Math.min(hours, input.maxHours);
}

export async function scheduleDueProductRefreshes(
  config: AppConfig,
  database: DatabaseService,
  queue: ProductRefreshQueue,
  now = new Date(),
) {
  if (!config.FEATURE_PRICE_TRACKING) return 0;
  const candidates = await database.client.gift.findMany({
    where: {
      deletedAt: null,
      url: { not: null },
      status: { notIn: ["CANCELLED", "RECEIVED"] },
      list: { status: "ACTIVE", deletedAt: null, productAutoRefresh: true },
      OR: [{ nextRefreshAt: null }, { nextRefreshAt: { lte: now } }],
    },
    select: { id: true, nextRefreshAt: true, merchantId: true },
    orderBy: [{ nextRefreshAt: "asc" }, { createdAt: "asc" }],
    take: config.PRICE_REFRESH_BATCH_SIZE,
  });
  let queued = 0;
  const merchantCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const merchantKey = candidate.merchantId ?? "unmatched";
    const merchantCount = merchantCounts.get(merchantKey) ?? 0;
    if (merchantCount >= config.PRICE_REFRESH_PER_MERCHANT_BATCH) continue;
    const leasedUntil = new Date(now.getTime() + config.PRICE_SCHEDULER_INTERVAL_MS * 2);
    const claimed = await database.client.gift.updateMany({
      where: {
        id: candidate.id,
        nextRefreshAt: candidate.nextRefreshAt,
      },
      data: { nextRefreshAt: leasedUntil },
    });
    if (claimed.count !== 1) continue;
    try {
      await queue.enqueue(candidate.id, ["price", "stock", "link"], "scheduled");
      queued += 1;
      merchantCounts.set(merchantKey, merchantCount + 1);
    } catch (error) {
      await database.client.gift.update({
        where: { id: candidate.id },
        data: { nextRefreshAt: now },
      });
      throw error;
    }
  }
  return queued;
}
