import { createHash } from "node:crypto";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { OrderGroupStatus, OrderMode } from "../../generated/prisma/enums.js";
import type { ListsService } from "../lists/service.js";

const activeStatuses: OrderGroupStatus[] = [
  "DRAFT",
  "READY",
  "WAITING_PARENT",
  "SUBMITTED",
  "PARTIALLY_ORDERED",
  "ORDERED",
  "SHIPPED",
];

const transitions: Record<OrderGroupStatus, OrderGroupStatus[]> = {
  DRAFT: ["READY", "WAITING_PARENT", "CANCELLED"],
  READY: ["WAITING_PARENT", "SUBMITTED", "CANCELLED"],
  WAITING_PARENT: ["READY", "SUBMITTED", "CANCELLED"],
  SUBMITTED: ["PARTIALLY_ORDERED", "ORDERED", "CANCELLED"],
  PARTIALLY_ORDERED: ["ORDERED", "CANCELLED"],
  ORDERED: ["SHIPPED", "COMPLETED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderGroupStatus, to: OrderGroupStatus) {
  return transitions[from].includes(to);
}

export function isGiftReadyForOrder(status: string) {
  return ["FUNDED", "READY_TO_ORDER"].includes(status);
}

export function buildOrderGroupingKey(
  listId: string,
  merchantId: string,
  destinationKey: string,
  currency: string,
  windowStart?: Date,
  windowEnd?: Date,
) {
  return hash(
    [
      listId,
      merchantId,
      destinationKey,
      currency,
      windowStart?.toISOString(),
      windowEnd?.toISOString(),
    ].join(":"),
  );
}

export class OrdersService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly lists: ListsService,
  ) {}

  async center(userId: string) {
    const lists = await this.prisma.giftList.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true, title: true },
    });
    const listIds = lists.map((list) => list.id);
    if (!listIds.length) return emptyCenter(this.config.FEATURE_ORDER_FULFILMENT);
    const [groups, candidates, funds] = await Promise.all([
      this.prisma.orderGroup.findMany({
        where: { listId: { in: listIds } },
        include: {
          list: { select: { title: true } },
          merchant: { select: { name: true, connectorType: true } },
          items: { include: { gift: { select: { status: true } } }, orderBy: { createdAt: "asc" } },
          history: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.gift.findMany({
        where: {
          listId: { in: listIds },
          deletedAt: null,
          merchantId: { not: null },
          unitPriceMinor: { not: null },
          status: { notIn: ["ORDERED", "SHIPPED", "RECEIVED", "CANCELLED"] },
          orderItems: { none: { orderGroup: { status: { in: activeStatuses } } } },
        },
        include: { list: { select: { title: true } }, merchant: { select: { name: true } } },
        orderBy: [{ listId: "asc" }, { position: "asc" }],
      }),
      this.prisma.fundsLedgerEntry.findMany({
        where: { listId: { in: listIds }, status: "CONFIRMED" },
        select: { listId: true, amountMinor: true },
      }),
    ]);
    const heldByList = new Map<string, bigint>();
    for (const entry of funds)
      heldByList.set(entry.listId, (heldByList.get(entry.listId) ?? 0n) + entry.amountMinor);
    const plannedByList = new Map<string, bigint>();
    for (const group of groups.filter((row) => activeStatuses.includes(row.status)))
      for (const item of group.items)
        plannedByList.set(
          group.listId,
          (plannedByList.get(group.listId) ?? 0n) + item.contributionAmountMinor,
        );
    const serialized = groups.map(serializeGroup);
    return {
      enabled: this.config.FEATURE_ORDER_FULFILMENT,
      automaticOrdersEnabled: this.config.FEATURE_AUTOMATIC_ORDERS,
      lists: lists.map((list) => ({
        ...list,
        heldMinor: (heldByList.get(list.id) ?? 0n).toString(),
        plannedMinor: (plannedByList.get(list.id) ?? 0n).toString(),
      })),
      candidates: candidates.map((gift) => ({
        id: gift.id,
        listId: gift.listId,
        listTitle: gift.list.title,
        merchantId: gift.merchantId!,
        merchantName: gift.merchant!.name,
        title: gift.title,
        quantity: gift.quantity,
        unitPriceMinor: gift.unitPriceMinor!.toString(),
        currency: gift.currency,
        status: gift.status,
        selectedVariant: gift.selectedVariant,
      })),
      sections: {
        ready: serialized.filter((group) => ["READY", "SUBMITTED"].includes(group.status)),
        awaitingFunding: serialized.filter((group) =>
          ["DRAFT", "WAITING_PARENT"].includes(group.status),
        ),
        ordered: serialized.filter((group) =>
          ["PARTIALLY_ORDERED", "ORDERED", "SHIPPED"].includes(group.status),
        ),
        received: serialized.filter((group) => group.status === "COMPLETED"),
        problems: serialized.filter((group) => group.status === "CANCELLED"),
      },
    };
  }

  async prepare(
    userId: string,
    listId: string,
    input: {
      giftIds?: string[];
      orderMode: OrderMode;
      deliveryMode?: string;
      destination: Record<string, unknown>;
      windowStart?: Date;
      windowEnd?: Date;
    },
  ) {
    this.requireEnabled();
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    if (input.windowStart && input.windowEnd && input.windowStart > input.windowEnd)
      throw new AppError(400, "ORDER_WINDOW_INVALID", "Order window is invalid");
    const destination = canonicalDestination(input.destination);
    const destinationKey = hash(JSON.stringify(destination));
    const gifts = await this.prisma.gift.findMany({
      where: {
        listId,
        deletedAt: null,
        ...(input.giftIds ? { id: { in: input.giftIds } } : {}),
        merchantId: { not: null },
        unitPriceMinor: { not: null },
        status: { notIn: ["ORDERED", "SHIPPED", "RECEIVED", "CANCELLED"] },
        orderItems: { none: { orderGroup: { status: { in: activeStatuses } } } },
      },
      include: { merchant: true },
      take: this.config.ORDER_PREPARATION_MAX_ITEMS,
    });
    if (!gifts.length) throw new AppError(409, "NO_ORDER_CANDIDATES", "No gifts can be prepared");
    if (input.giftIds && gifts.length !== new Set(input.giftIds).size)
      throw new AppError(409, "ORDER_GIFT_CONFLICT", "One or more gifts cannot be prepared");
    const byMerchantCurrency = new Map<string, typeof gifts>();
    for (const gift of gifts) {
      const bucket = `${gift.merchantId}:${gift.currency}`;
      const merchantGifts = byMerchantCurrency.get(bucket) ?? [];
      merchantGifts.push(gift);
      byMerchantCurrency.set(bucket, merchantGifts);
    }
    if (input.orderMode === "AUTOMATIC_PLATFORM")
      for (const merchantGifts of byMerchantCurrency.values())
        this.assertAutomaticAuthorized(merchantGifts[0]!.merchant!);
    return this.prisma.$transaction(
      async (tx) => {
        const availableCount = await tx.gift.count({
          where: {
            id: { in: gifts.map((gift) => gift.id) },
            orderItems: { none: { orderGroup: { status: { in: activeStatuses } } } },
          },
        });
        if (availableCount !== gifts.length)
          throw new AppError(409, "ORDER_GIFT_CONFLICT", "A gift is already being prepared");
        const created = [];
        for (const merchantGifts of byMerchantCurrency.values()) {
          const merchantId = merchantGifts[0]!.merchantId!;
          const currency = merchantGifts[0]!.currency;
          const allReady = merchantGifts.every((gift) => isGiftReadyForOrder(gift.status));
          const groupingKey = buildOrderGroupingKey(
            listId,
            merchantId,
            destinationKey,
            currency,
            input.windowStart,
            input.windowEnd,
          );
          const group = await tx.orderGroup.create({
            data: {
              listId,
              merchantId,
              status: allReady ? "READY" : "WAITING_PARENT",
              orderMode: input.orderMode,
              currency,
              groupingKey,
              deliveryMode: input.deliveryMode,
              destinationKey,
              destination: destination as Prisma.InputJsonValue,
              orderWindowStart: input.windowStart,
              orderWindowEnd: input.windowEnd,
              items: {
                create: merchantGifts.map((gift) => ({
                  giftId: gift.id,
                  titleSnapshot: gift.title,
                  urlSnapshot: gift.url,
                  quantity: gift.quantity,
                  unitPriceMinor: gift.unitPriceMinor!,
                  selectedVariant: gift.selectedVariant ?? undefined,
                  status: allReady ? "READY" : "AWAITING_FUNDING",
                })),
              },
              history: {
                create: {
                  actorId: userId,
                  toStatus: allReady ? "READY" : "WAITING_PARENT",
                  reason: "Order group prepared by merchant, destination and window",
                },
              },
            },
            include: { merchant: true, list: true, items: true, history: true },
          });
          created.push(serializeGroup(group));
        }
        return { groups: created };
      },
      { isolationLevel: "Serializable" },
    );
  }

  async updateItem(
    userId: string,
    groupId: string,
    itemId: string,
    input: {
      quantity?: number;
      selectedVariant?: Record<string, unknown> | null;
      included?: boolean;
      deliveryAmountMinor?: bigint;
    },
  ) {
    const group = await this.requireGroup(userId, groupId);
    if (!["DRAFT", "READY", "WAITING_PARENT"].includes(group.status))
      throw new AppError(409, "ORDER_LOCKED", "Order items can no longer be changed");
    const item = group.items.find((row) => row.id === itemId);
    if (!item) throw new AppError(404, "ORDER_ITEM_NOT_FOUND", "Order item not found");
    return this.prisma.orderGroupItem.update({
      where: { id: itemId },
      data: {
        quantity: input.quantity,
        selectedVariant:
          input.selectedVariant === null
            ? Prisma.JsonNull
            : input.selectedVariant
              ? (input.selectedVariant as Prisma.InputJsonValue)
              : undefined,
        status: input.included === undefined ? undefined : input.included ? "READY" : "EXCLUDED",
        contributionAmountMinor: input.included === false ? 0n : undefined,
        deliveryAmountMinor: input.deliveryAmountMinor,
      },
    });
  }

  async planContribution(userId: string, groupId: string, itemId: string, amountMinor: bigint) {
    const group = await this.requireGroup(userId, groupId);
    if (!["DRAFT", "READY", "WAITING_PARENT", "SUBMITTED"].includes(group.status))
      throw new AppError(409, "ORDER_FUNDING_LOCKED", "Contribution allocation is locked");
    const item = group.items.find((row) => row.id === itemId);
    if (!item || item.status === "EXCLUDED")
      throw new AppError(404, "ORDER_ITEM_NOT_FOUND", "Order item not found");
    const itemMaximum = item.unitPriceMinor * BigInt(item.quantity) + item.deliveryAmountMinor;
    if (amountMinor < 0n || amountMinor > itemMaximum)
      throw new AppError(400, "ORDER_ALLOCATION_INVALID", "Allocation exceeds item total");
    return this.prisma.$transaction(
      async (tx) => {
        const [funds, planned] = await Promise.all([
          tx.fundsLedgerEntry.aggregate({
            where: { listId: group.listId, status: "CONFIRMED" },
            _sum: { amountMinor: true },
          }),
          tx.orderGroupItem.aggregate({
            where: {
              id: { not: item.id },
              orderGroup: { listId: group.listId, status: { in: activeStatuses } },
            },
            _sum: { contributionAmountMinor: true },
          }),
        ]);
        const available =
          (funds._sum.amountMinor ?? 0n) - (planned._sum.contributionAmountMinor ?? 0n);
        if (amountMinor > available)
          throw new AppError(
            409,
            "ORDER_FUNDS_UNAVAILABLE",
            "Not enough unallocated confirmed funds",
          );
        await tx.orderGroupItem.update({
          where: { id: item.id },
          data: { contributionAmountMinor: amountMinor },
        });
        const groupTotal =
          group.deliveryMinor +
          group.items
            .filter((row) => row.status !== "EXCLUDED")
            .reduce(
              (sum, row) =>
                sum + row.unitPriceMinor * BigInt(row.quantity) + row.deliveryAmountMinor,
              0n,
            );
        const groupPlanned = group.items
          .filter((row) => row.status !== "EXCLUDED")
          .reduce(
            (sum, row) => sum + (row.id === item.id ? amountMinor : row.contributionAmountMinor),
            0n,
          );
        const nextStatus =
          groupPlanned >= groupTotal && group.status === "WAITING_PARENT"
            ? "READY"
            : groupPlanned < groupTotal && group.status === "READY"
              ? "WAITING_PARENT"
              : group.status;
        if (nextStatus !== group.status)
          await tx.orderGroup.update({ where: { id: group.id }, data: { status: nextStatus } });
        await tx.orderGroupStatusHistory.create({
          data: {
            orderGroupId: group.id,
            actorId: userId,
            fromStatus: group.status,
            toStatus: nextStatus,
            reason:
              nextStatus === "READY"
                ? "Order group is fully covered by planned contributions"
                : "Planned contribution allocation updated",
            metadata: { itemId, amountMinor: amountMinor.toString() },
          },
        });
        return {
          amountMinor: amountMinor.toString(),
          remainingMinor: (available - amountMinor).toString(),
        };
      },
      { isolationLevel: "Serializable" },
    );
  }

  async transition(
    userId: string,
    groupId: string,
    toStatus: OrderGroupStatus,
    input: { reason?: string; externalOrderReference?: string; trackingUrl?: string },
  ) {
    const group = await this.requireGroup(userId, groupId);
    if (!canTransition(group.status, toStatus))
      throw new AppError(409, "ORDER_STATUS_INVALID", "Invalid order status transition");
    if (group.orderMode === "AUTOMATIC_PLATFORM" && toStatus === "SUBMITTED")
      throw new AppError(
        503,
        "AUTOMATIC_ORDER_BLOCKED_EXTERNAL",
        "No authorized automatic merchant ordering connector is active",
      );
    if (toStatus === "ORDERED" && !input.externalOrderReference)
      throw new AppError(400, "ORDER_REFERENCE_REQUIRED", "Order reference is required");
    await this.prisma.$transaction(async (tx) => {
      await tx.orderGroup.update({
        where: { id: group.id },
        data: {
          status: toStatus,
          submittedAt: ["SUBMITTED", "ORDERED"].includes(toStatus) ? new Date() : undefined,
          externalOrderReference: input.externalOrderReference,
          trackingUrl: input.trackingUrl,
          items:
            toStatus === "CANCELLED"
              ? {
                  updateMany: {
                    where: {},
                    data: { contributionAmountMinor: 0n, status: "CANCELLED" },
                  },
                }
              : undefined,
        },
      });
      await tx.orderGroupStatusHistory.create({
        data: {
          orderGroupId: group.id,
          actorId: userId,
          fromStatus: group.status,
          toStatus,
          reason: input.reason,
          metadata: {
            externalOrderReference: input.externalOrderReference,
            trackingUrl: input.trackingUrl,
          },
        },
      });
      const giftStatus =
        toStatus === "ORDERED"
          ? "ORDERED"
          : toStatus === "SHIPPED"
            ? "SHIPPED"
            : toStatus === "COMPLETED"
              ? "RECEIVED"
              : null;
      if (giftStatus)
        await tx.gift.updateMany({
          where: {
            id: {
              in: group.items
                .filter((item) => item.status !== "EXCLUDED")
                .map((item) => item.giftId),
            },
          },
          data: { status: giftStatus },
        });
    });
    return { status: toStatus };
  }

  private requireEnabled() {
    if (!this.config.FEATURE_ORDER_FULFILMENT)
      throw new AppError(404, "ORDER_FULFILMENT_DISABLED", "Order fulfilment is disabled");
  }

  private async requireGroup(userId: string, groupId: string) {
    this.requireEnabled();
    const group = await this.prisma.orderGroup.findUnique({
      where: { id: groupId },
      include: { merchant: true, items: true },
    });
    if (!group) throw new AppError(404, "ORDER_GROUP_NOT_FOUND", "Order group not found");
    await this.lists.assertRole(userId, group.listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    return group;
  }

  private assertAutomaticAuthorized(merchant: {
    connectorType: string;
    automationTrustLevel: number;
    connectorConfig: unknown;
  }) {
    const config = merchant.connectorConfig;
    const orderingAuthorized =
      config &&
      typeof config === "object" &&
      (config as Record<string, unknown>)["orderingAuthorized"] === true;
    if (
      !this.config.FEATURE_AUTOMATIC_ORDERS ||
      merchant.connectorType === "MANUAL" ||
      merchant.automationTrustLevel < 4 ||
      !orderingAuthorized
    )
      throw new AppError(
        503,
        "AUTOMATIC_ORDER_BLOCKED_EXTERNAL",
        "Merchant API and contract are not authorized for automatic ordering",
      );
  }
}

type SerializableGroup = {
  id: string;
  listId: string;
  merchantId: string;
  status: OrderGroupStatus;
  orderMode: OrderMode;
  deliveryMode: string | null;
  destination: unknown;
  orderWindowStart: Date | null;
  orderWindowEnd: Date | null;
  currency: string;
  deliveryMinor: bigint;
  externalOrderReference: string | null;
  trackingUrl: string | null;
  submittedAt: Date | null;
  list?: { title: string } | null;
  merchant?: { name: string } | null;
  items: Array<{
    id: string;
    giftId: string;
    titleSnapshot: string;
    urlSnapshot: string | null;
    quantity: number;
    unitPriceMinor: bigint;
    deliveryAmountMinor: bigint;
    contributionAmountMinor: bigint;
    selectedVariant: unknown;
    status: string;
  }>;
  history?: Array<{
    id: string;
    fromStatus: OrderGroupStatus | null;
    toStatus: OrderGroupStatus;
    reason: string | null;
    createdAt: Date;
  }>;
};

function serializeGroup(group: SerializableGroup) {
  const items = group.items.map((item) => ({
    id: item.id,
    giftId: item.giftId,
    title: item.titleSnapshot,
    url: item.urlSnapshot,
    quantity: item.quantity,
    unitPriceMinor: item.unitPriceMinor.toString(),
    deliveryAmountMinor: item.deliveryAmountMinor.toString(),
    contributionAmountMinor: item.contributionAmountMinor.toString(),
    selectedVariant: item.selectedVariant,
    status: item.status,
  }));
  return {
    id: group.id,
    listId: group.listId,
    listTitle: group.list?.title ?? null,
    merchantId: group.merchantId,
    merchantName: group.merchant?.name ?? null,
    status: group.status,
    orderMode: group.orderMode,
    deliveryMode: group.deliveryMode,
    destination: group.destination,
    orderWindowStart: group.orderWindowStart?.toISOString() ?? null,
    orderWindowEnd: group.orderWindowEnd?.toISOString() ?? null,
    currency: group.currency,
    deliveryMinor: group.deliveryMinor.toString(),
    externalOrderReference: group.externalOrderReference,
    trackingUrl: group.trackingUrl,
    submittedAt: group.submittedAt?.toISOString() ?? null,
    items,
    totalMinor: items
      .reduce(
        (sum: bigint, item) =>
          item.status === "EXCLUDED"
            ? sum
            : sum +
              BigInt(item.unitPriceMinor) * BigInt(item.quantity) +
              BigInt(item.deliveryAmountMinor),
        BigInt(group.deliveryMinor),
      )
      .toString(),
    plannedContributionMinor: items
      .reduce((sum: bigint, item) => sum + BigInt(item.contributionAmountMinor), 0n)
      .toString(),
    history: (group.history ?? []).map((row) => ({
      id: row.id,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

function canonicalDestination(value: Record<string, unknown>) {
  const allowed = ["label", "name", "street", "postalCode", "city", "country"];
  const result = Object.fromEntries(
    allowed.flatMap((key) => {
      const item = value[key];
      return typeof item === "string" && item.trim() ? [[key, item.trim()]] : [];
    }),
  );
  if (!result["label"] || !result["country"])
    throw new AppError(
      400,
      "ORDER_DESTINATION_INVALID",
      "Destination label and country are required",
    );
  return result;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emptyCenter(enabled: boolean) {
  return {
    enabled,
    automaticOrdersEnabled: false,
    lists: [],
    candidates: [],
    sections: { ready: [], awaitingFunding: [], ordered: [], received: [], problems: [] },
  };
}
