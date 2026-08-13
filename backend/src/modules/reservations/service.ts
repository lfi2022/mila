import { createHmac, randomBytes } from "node:crypto";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { NotificationQueue } from "../notifications/queue.js";
import type { ListsService } from "../lists/service.js";

export type ReservationInput = {
  giftToken: string;
  guestName: string;
  guestEmail?: string | null;
  message?: string | null;
  quantity: number;
};

export class ReservationsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly notifications?: NotificationQueue,
    private readonly lists?: ListsService,
  ) {}

  async create(input: ReservationInput) {
    const token = randomBytes(32).toString("base64url");
    const result = await this.prisma.$transaction(
      async (transaction) => {
        const gift = await transaction.gift.findFirst({
          where: {
            publicToken: input.giftToken,
            deletedAt: null,
            status: { in: ["AVAILABLE", "RESERVED"] },
            list: { deletedAt: null, status: "ACTIVE", closedAt: null },
          },
          select: {
            id: true,
            listId: true,
            title: true,
            list: {
              select: {
                title: true,
                ownerId: true,
                surpriseMode: true,
                members: { select: { userId: true } },
              },
            },
          },
        });
        if (!gift) throw new AppError(404, "GIFT_NOT_AVAILABLE", "Gift is not available");
        const changed = await transaction.$executeRawUnsafe(
          "UPDATE gifts SET reserved_quantity = reserved_quantity + ? WHERE id = ? AND deleted_at IS NULL AND reserved_quantity + ? <= quantity",
          input.quantity,
          gift.id,
          input.quantity,
        );
        if (changed !== 1)
          throw new AppError(
            409,
            "GIFT_QUANTITY_UNAVAILABLE",
            "Requested quantity is no longer available",
          );
        await transaction.$executeRawUnsafe(
          "UPDATE gifts SET status = 'RESERVED' WHERE id = ? AND reserved_quantity >= quantity",
          gift.id,
        );
        const reservation = await transaction.reservation.create({
          data: {
            listId: gift.listId,
            giftId: gift.id,
            guestName: input.guestName.trim(),
            guestEmail: input.guestEmail?.trim().toLowerCase() || null,
            message: input.message?.trim() || null,
            quantity: input.quantity,
            managementTokenHash: this.hashToken(token),
            tokenExpiresAt: new Date(Date.now() + 90 * 86_400_000),
          },
        });
        const userIds = [
          ...new Set([gift.list.ownerId, ...gift.list.members.map(({ userId }) => userId)]),
        ];
        const preferences = await transaction.notificationPreference.findMany({
          where: { userId: { in: userIds }, type: "RESERVATION_CREATED" },
        });
        const disabled = new Set(
          preferences.filter((item) => !item.inAppEnabled).map((item) => item.userId),
        );
        const emailDisabled = new Set(
          preferences
            .filter((item) => !item.emailEnabled || item.digest === "NEVER")
            .map((item) => item.userId),
        );
        await transaction.notification.createMany({
          data: userIds
            .filter((userId) => !disabled.has(userId))
            .map((userId) => ({
              userId,
              listId: gift.listId,
              type: "RESERVATION_CREATED",
              title: gift.list.surpriseMode
                ? "Un cadeau vient de trouver quelqu’un 🎁"
                : "Nouveau cadeau réservé",
              body: gift.list.surpriseMode
                ? "Mode surprise activé : les détails restent cachés."
                : `${input.guestName.trim()} a réservé « ${gift.title} »`,
              data: gift.list.surpriseMode
                ? { reservationId: reservation.id, surprise: true }
                : { reservationId: reservation.id, giftId: gift.id },
            })),
        });
        return {
          reservation,
          gift,
          userIds: userIds.filter((userId) => !emailDisabled.has(userId)),
        };
      },
      { isolationLevel: "Serializable" },
    );

    await Promise.all(
      result.userIds.map((userId) =>
        this.notifications
          ?.enqueue({
            type: "RESERVATION_CREATED",
            userId,
            listId: result.gift.listId,
            reservationId: result.reservation.id,
            payload: result.gift.list.surpriseMode
              ? { surprise: true }
              : { giftTitle: result.gift.title, guestName: input.guestName },
          })
          .catch(() => undefined),
      ),
    );
    return {
      managementToken: token,
      reservation: publicReservation(result.reservation, result.gift.title, result.gift.list.title),
    };
  }

  async get(token: string) {
    const record = await this.requireToken(token);
    return publicReservation(record, record.gift.title, record.list.title);
  }

  async updateMessage(token: string, message: string | null) {
    const record = await this.requireToken(token);
    return this.prisma.reservation.update({
      where: { id: record.id },
      data: { message: message?.trim() || null },
      select: { id: true, message: true, updatedAt: true },
    });
  }

  async markPurchased(token: string) {
    const record = await this.requireToken(token);
    const changed = await this.prisma.reservation.updateMany({
      where: { id: record.id, status: "RESERVED" },
      data: { status: "PURCHASED", purchasedAt: new Date() },
    });
    if (changed.count !== 1)
      throw new AppError(
        409,
        "RESERVATION_STATE_INVALID",
        "Reservation cannot be marked purchased",
      );
    await this.notifyManagers(
      record,
      "RESERVATION_PURCHASED",
      record.list.surpriseMode ? "Un cadeau a été acheté 🎁" : "Cadeau acheté",
      record.list.surpriseMode
        ? "Mode surprise activé."
        : `${record.guestName} a indiqué avoir acheté « ${record.gift.title} »`,
    );
  }

  async cancel(token: string) {
    const record = await this.requireToken(token);
    await this.prisma.$transaction(
      async (transaction) => {
        const changed = await transaction.reservation.updateMany({
          where: { id: record.id, status: { in: ["RESERVED", "PURCHASED"] } },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        if (changed.count !== 1)
          throw new AppError(409, "RESERVATION_STATE_INVALID", "Reservation is already cancelled");
        await transaction.$executeRawUnsafe(
          "UPDATE gifts SET reserved_quantity = GREATEST(reserved_quantity - ?, 0), status = CASE WHEN status = 'RESERVED' THEN 'AVAILABLE' ELSE status END WHERE id = ?",
          record.quantity,
          record.giftId,
        );
      },
      { isolationLevel: "Serializable" },
    );
    await this.notifyManagers(
      record,
      "RESERVATION_CANCELLED",
      "Réservation annulée",
      record.list.surpriseMode
        ? "Mode surprise activé : les détails restent cachés."
        : `${record.guestName} a annulé la réservation de « ${record.gift.title} »`,
    );
  }

  async listForManager(userId: string, listId: string) {
    if (!this.lists) throw new AppError(503, "MANAGER_ROUTES_UNAVAILABLE", "Service unavailable");
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    return this.prisma.reservation.findMany({
      where: { listId },
      select: {
        id: true,
        guestName: true,
        guestEmail: true,
        message: true,
        quantity: true,
        status: true,
        createdAt: true,
        gift: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async cancelForManager(userId: string, listId: string, reservationId: string): Promise<void> {
    if (!this.lists) throw new AppError(503, "MANAGER_ROUTES_UNAVAILABLE", "Service unavailable");
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    const record = await this.prisma.reservation.findFirst({
      where: { id: reservationId, listId },
      select: { id: true, giftId: true, quantity: true },
    });
    if (!record) throw new AppError(404, "RESERVATION_NOT_FOUND", "Reservation not found");
    await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.reservation.updateMany({
        where: { id: record.id, status: { in: ["RESERVED", "PURCHASED"] } },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      if (changed.count !== 1) {
        throw new AppError(409, "RESERVATION_STATE_INVALID", "Reservation is already closed");
      }
      await transaction.$executeRawUnsafe(
        "UPDATE gifts SET reserved_quantity = GREATEST(reserved_quantity - ?, 0), status = CASE WHEN status = 'RESERVED' THEN 'AVAILABLE' ELSE status END WHERE id = ?",
        record.quantity,
        record.giftId,
      );
    });
  }

  private async requireToken(token: string) {
    const record = await this.prisma.reservation.findUnique({
      where: { managementTokenHash: this.hashToken(token) },
      include: {
        gift: { select: { title: true } },
        list: {
          select: {
            title: true,
            ownerId: true,
            surpriseMode: true,
            members: { select: { userId: true } },
          },
        },
      },
    });
    if (!record || record.tokenExpiresAt <= new Date()) {
      throw new AppError(
        404,
        "RESERVATION_TOKEN_INVALID",
        "Reservation link is invalid or expired",
      );
    }
    return record;
  }

  private async notifyManagers(
    record: {
      id: string;
      listId: string;
      list: { ownerId: string; surpriseMode: boolean; members: { userId: string }[] };
    },
    type: string,
    title: string,
    body: string,
  ) {
    const userIds = [
      ...new Set([record.list.ownerId, ...record.list.members.map(({ userId }) => userId)]),
    ];
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: userIds }, type },
    });
    const inAppDisabled = new Set(
      preferences.filter((item) => !item.inAppEnabled).map((item) => item.userId),
    );
    const emailDisabled = new Set(
      preferences
        .filter((item) => !item.emailEnabled || item.digest === "NEVER")
        .map((item) => item.userId),
    );
    await this.prisma.notification.createMany({
      data: userIds
        .filter((userId) => !inAppDisabled.has(userId))
        .map((userId) => ({
          userId,
          listId: record.listId,
          type,
          title,
          body,
          data: { reservationId: record.id },
        })),
    });
    await Promise.all(
      userIds
        .filter((userId) => !emailDisabled.has(userId))
        .map((userId) =>
          this.notifications
            ?.enqueue({ type, userId, listId: record.listId, reservationId: record.id })
            .catch(() => undefined),
        ),
    );
  }

  private hashToken(token: string) {
    return createHmac("sha256", this.config.AUTH_SECRET).update(token).digest("hex");
  }
}

function publicReservation(
  reservation: {
    id: string;
    guestName: string;
    guestEmail: string | null;
    message: string | null;
    quantity: number;
    status: string;
    purchasedAt: Date | null;
    cancelledAt: Date | null;
    tokenExpiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  },
  giftTitle: string,
  listTitle: string,
) {
  return { ...reservation, giftTitle, listTitle };
}
