import { createHash, createHmac, randomBytes } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { decimalToMinor, type PaymentProviderClient } from "./mollie.js";

type Item = { giftToken: string; mode: "PURCHASE" | "CONTRIBUTION"; amountCents?: number };

export class GiftCheckoutService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly provider: PaymentProviderClient,
  ) {}

  async create(input: {
    items: Item[];
    guestName: string;
    guestEmail: string;
    idempotencyKey: string;
  }) {
    if (!this.config.FEATURE_MOLLIE_PAYMENTS || !this.config.FEATURE_GIFT_MOLLIE_CHECKOUT)
      throw new AppError(404, "GIFT_CHECKOUT_DISABLED", "Le paiement des cadeaux est indisponible");
    if (
      input.items.length < 1 ||
      input.items.length > 20 ||
      new Set(input.items.map((item) => item.giftToken)).size !== input.items.length
    )
      throw new AppError(
        400,
        "CART_INVALID",
        "Le panier doit contenir de 1 à 20 articles distincts",
      );
    const key = `gift-checkout:${input.idempotencyKey}`;
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          items: [...input.items].sort((a, b) => a.giftToken.localeCompare(b.giftToken)),
          guestName: input.guestName.trim(),
          guestEmail: input.guestEmail.trim().toLowerCase(),
        }),
      )
      .digest("hex");
    const replay = await this.prisma.payment.findUnique({ where: { idempotencyKey: key } });
    if (replay) {
      const metadata =
        replay.metadata && typeof replay.metadata === "object" && !Array.isArray(replay.metadata)
          ? replay.metadata
          : {};
      if (metadata["fingerprint"] !== fingerprint)
        throw new AppError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Cette demande de paiement concerne un autre panier",
        );
    }
    if (replay?.redirectUrl) return { paymentId: replay.id, redirectUrl: replay.redirectUrl };
    if (replay && Date.now() - replay.createdAt.valueOf() > 50 * 60_000)
      throw new AppError(
        409,
        "PAYMENT_CREATION_AMBIGUOUS",
        "Paiement à rapprocher avec Mollie avant de réessayer",
      );
    const gifts = await this.prisma.gift.findMany({
      where: {
        publicToken: { in: input.items.map((item) => item.giftToken) },
        deletedAt: null,
        list: { status: "ACTIVE", deletedAt: null, closedAt: null },
      },
      select: {
        id: true,
        title: true,
        listId: true,
        publicToken: true,
        unitPriceMinor: true,
        contributionTargetMinor: true,
        currency: true,
      },
    });
    if (gifts.length !== input.items.length)
      throw new AppError(404, "GIFT_NOT_FOUND", "Article introuvable");
    if (
      new Set(gifts.map((gift) => gift.listId)).size !== 1 ||
      new Set(gifts.map((gift) => gift.currency)).size !== 1
    )
      throw new AppError(
        400,
        "CART_MIXED_LIST",
        "Les articles doivent appartenir à la même liste et devise",
      );
    const byToken = new Map(gifts.map((gift) => [gift.publicToken, gift]));
    const rows = input.items.map((item) => {
      const gift = byToken.get(item.giftToken)!;
      const amount =
        item.mode === "PURCHASE"
          ? gift.unitPriceMinor
          : item.amountCents === undefined
            ? null
            : BigInt(item.amountCents);
      if (amount === null || amount < BigInt(this.config.CONTRIBUTION_MIN_MINOR))
        throw new AppError(
          400,
          "PAYMENT_AMOUNT_INVALID",
          `Montant invalide pour « ${gift.title} »`,
        );
      if (item.mode === "CONTRIBUTION" && gift.contributionTargetMinor === null)
        throw new AppError(
          409,
          "CONTRIBUTION_NOT_ENABLED",
          `Cagnotte désactivée pour « ${gift.title} »`,
        );
      return { gift, mode: item.mode, amount };
    });
    const listId = gifts[0]!.listId;
    const currency = gifts[0]!.currency;
    const total = rows.reduce((sum, row) => sum + row.amount, 0n);
    const payment =
      replay ??
      (await this.prisma.$transaction(
        async (tx) => {
          for (const row of [...rows].sort((a, b) => a.gift.id.localeCompare(b.gift.id))) {
            const current = await tx.$queryRawUnsafe<
              Array<{ status: string; quantity: number; reserved_quantity: number }>
            >(
              "SELECT status, quantity, reserved_quantity FROM gifts WHERE id = ? FOR UPDATE",
              row.gift.id,
            );
            if (
              !current[0] ||
              current[0].reserved_quantity > 0 ||
              ["RESERVED", "FUNDED", "READY_TO_ORDER", "ORDERED", "SHIPPED", "RECEIVED"].includes(
                current[0].status,
              )
            )
              throw new AppError(409, "GIFT_RESERVED", `« ${row.gift.title} » est déjà réservé`);
            const committed = await tx.contribution.aggregate({
              where: { giftId: row.gift.id, status: { in: ["PENDING", "CONFIRMED"] } },
              _sum: { amountMinor: true },
            });
            if (row.mode === "PURCHASE" && (committed._sum.amountMinor ?? 0n) > 0n)
              throw new AppError(
                409,
                "GIFT_ALREADY_FUNDED",
                `« ${row.gift.title} » a déjà reçu des participations`,
              );
            if (
              row.mode === "CONTRIBUTION" &&
              row.gift.contributionTargetMinor !== null &&
              (committed._sum.amountMinor ?? 0n) + row.amount > row.gift.contributionTargetMinor
            )
              throw new AppError(
                409,
                "CONTRIBUTION_TARGET_EXCEEDED",
                `Montant trop élevé pour « ${row.gift.title} »`,
              );
          }
          const created = await tx.payment.create({
            data: {
              listId,
              provider: "MOLLIE",
              idempotencyKey: key,
              purpose: "GIFT_CART",
              amountMinor: total,
              currency,
              description: rows.length === 1 ? rows[0]!.gift.title : `${rows.length} cadeaux`,
              metadata: {
                clientCode: listId,
                guestEmail: input.guestEmail,
                guestName: input.guestName,
                itemCount: rows.length,
                fingerprint,
              },
            },
          });
          for (const row of rows) {
            let reservationId: string | null = null;
            if (row.mode === "PURCHASE") {
              const changed = await tx.$executeRawUnsafe(
                "UPDATE gifts SET status = 'RESERVED', reserved_quantity = reserved_quantity + 1 WHERE id = ? AND reserved_quantity = 0 AND reserved_quantity + 1 <= quantity",
                row.gift.id,
              );
              if (changed !== 1)
                throw new AppError(409, "GIFT_RESERVED", `« ${row.gift.title} » est déjà réservé`);
              const token = randomBytes(32).toString("base64url");
              const reservation = await tx.reservation.create({
                data: {
                  listId,
                  giftId: row.gift.id,
                  guestName: input.guestName.trim(),
                  guestEmail: input.guestEmail.trim().toLowerCase(),
                  managementTokenHash: createHmac("sha256", this.config.AUTH_SECRET)
                    .update(token)
                    .digest("hex"),
                  tokenExpiresAt: new Date(Date.now() + 30 * 60_000),
                  quantity: 1,
                },
              });
              reservationId = reservation.id;
            }
            await tx.contribution.create({
              data: {
                listId,
                giftId: row.gift.id,
                reservationId,
                paymentId: created.id,
                idempotencyKey: `gift-cart:${created.id}:${row.gift.id}`,
                contributorName: input.guestName.trim(),
                contributorEmail: input.guestEmail.trim().toLowerCase(),
                amountMinor: row.amount,
                currency,
                metadata: { mode: row.mode },
              },
            });
          }
          return created;
        },
        { isolationLevel: "Serializable" },
      ));
    if (payment.redirectUrl) return { paymentId: payment.id, redirectUrl: payment.redirectUrl };
    const remote = await this.provider.createPayment({
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      description: `${rows.length} cadeau(x) · ${listId.slice(0, 8)}`,
      redirectUrl: `${this.config.MOLLIE_REDIRECT_URL}${this.config.MOLLIE_REDIRECT_URL.includes("?") ? "&" : "?"}payment=${payment.id}`,
      webhookUrl: this.config.MOLLIE_WEBHOOK_URL,
      internalPaymentId: payment.id,
      idempotencyKey: payment.id,
      metadata: { clientCode: listId },
    });
    if (
      remote.mode !== this.config.MOLLIE_MODE ||
      remote.amount.currency !== currency ||
      decimalToMinor(remote.amount.value) !== payment.amountMinor ||
      (typeof remote.metadata === "object" ? remote.metadata?.internalPaymentId : null) !==
        payment.id ||
      remote._links.checkout?.href === undefined
    )
      throw new AppError(502, "MOLLIE_RESPONSE_INVALID", "Réponse Mollie invalide");
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: remote.id,
        status: "OPEN",
        redirectUrl: remote._links.checkout.href,
      },
    });
    return { paymentId: updated.id, redirectUrl: updated.redirectUrl! };
  }

  async createForReservation(input: { token: string; idempotencyKey: string }) {
    if (!this.config.FEATURE_MOLLIE_PAYMENTS || !this.config.FEATURE_GIFT_MOLLIE_CHECKOUT)
      throw new AppError(404, "GIFT_CHECKOUT_DISABLED", "Le paiement des cadeaux est indisponible");
    const tokenHash = createHmac("sha256", this.config.AUTH_SECRET)
      .update(input.token)
      .digest("hex");
    const reservation = await this.prisma.reservation.findUnique({
      where: { managementTokenHash: tokenHash },
      include: {
        gift: {
          select: {
            id: true,
            title: true,
            unitPriceMinor: true,
            currency: true,
            publicToken: true,
          },
        },
      },
    });
    if (
      !reservation ||
      reservation.status !== "RESERVED" ||
      reservation.tokenExpiresAt <= new Date()
    )
      throw new AppError(
        404,
        "RESERVATION_NOT_AVAILABLE",
        "Cette réservation n'est plus disponible",
      );
    if (!reservation.guestEmail)
      throw new AppError(
        409,
        "RESERVATION_EMAIL_REQUIRED",
        "Une adresse e-mail est nécessaire pour payer",
      );
    if (reservation.gift.unitPriceMinor === null)
      throw new AppError(409, "GIFT_PRICE_REQUIRED", "Le prix de cet article n'est pas renseigné");
    const amount = reservation.gift.unitPriceMinor * BigInt(reservation.quantity);
    const key = `reservation-checkout:${reservation.id}:${input.idempotencyKey}`;
    const replay = await this.prisma.payment.findUnique({ where: { idempotencyKey: key } });
    if (replay?.redirectUrl) return { paymentId: replay.id, redirectUrl: replay.redirectUrl };
    const existing = await this.prisma.contribution.findFirst({
      where: {
        reservationId: reservation.id,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      include: { payment: true },
    });
    if (existing?.status === "CONFIRMED")
      throw new AppError(409, "RESERVATION_ALREADY_PAID", "Cette réservation est déjà payée");
    if (existing?.payment?.redirectUrl)
      return {
        paymentId: existing.payment.id,
        redirectUrl: existing.payment.redirectUrl,
      };
    if (existing)
      throw new AppError(
        409,
        "PAYMENT_CREATION_AMBIGUOUS",
        "Un paiement existe déjà et doit être rapproché avec Mollie avant de réessayer",
      );
    const payment =
      replay ??
      (await this.prisma.$transaction(
        async (tx) => {
          const locked = await tx.$queryRawUnsafe<Array<{ status: string }>>(
            "SELECT status FROM reservations WHERE id = ? FOR UPDATE",
            reservation.id,
          );
          if (locked[0]?.status !== "RESERVED")
            throw new AppError(
              409,
              "RESERVATION_NOT_AVAILABLE",
              "Cette réservation n'est plus disponible",
            );
          const created = await tx.payment.create({
            data: {
              listId: reservation.listId,
              provider: "MOLLIE",
              idempotencyKey: key,
              purpose: "GIFT_CART",
              amountMinor: amount,
              currency: reservation.gift.currency,
              description: reservation.gift.title,
              metadata: {
                clientCode: reservation.listId,
                guestEmail: reservation.guestEmail,
                guestName: reservation.guestName,
                itemCount: 1,
              },
            },
          });
          await tx.contribution.create({
            data: {
              listId: reservation.listId,
              giftId: reservation.giftId,
              reservationId: reservation.id,
              paymentId: created.id,
              idempotencyKey: `reservation-payment:${created.id}`,
              contributorName: reservation.guestName,
              contributorEmail: reservation.guestEmail,
              amountMinor: amount,
              currency: reservation.gift.currency,
              metadata: { mode: "PURCHASE", reservedEarlier: true },
            },
          });
          return created;
        },
        { isolationLevel: "Serializable" },
      ));
    const remote = await this.provider.createPayment({
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      description: `${reservation.gift.title} · ${reservation.listId.slice(0, 8)}`,
      redirectUrl: `${this.config.MOLLIE_REDIRECT_URL}${this.config.MOLLIE_REDIRECT_URL.includes("?") ? "&" : "?"}payment=${payment.id}`,
      webhookUrl: this.config.MOLLIE_WEBHOOK_URL,
      internalPaymentId: payment.id,
      idempotencyKey: payment.id,
      metadata: { clientCode: reservation.listId, reservationId: reservation.id },
    });
    const remoteMetadata = typeof remote.metadata === "object" ? remote.metadata : null;
    if (
      remote.mode !== this.config.MOLLIE_MODE ||
      remote.amount.currency !== payment.currency ||
      decimalToMinor(remote.amount.value) !== payment.amountMinor ||
      remoteMetadata?.internalPaymentId !== payment.id ||
      !remote._links.checkout?.href
    )
      throw new AppError(502, "MOLLIE_RESPONSE_INVALID", "Réponse Mollie invalide");
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        externalId: remote.id,
        status: "OPEN",
        redirectUrl: remote._links.checkout.href,
      },
    });
    return { paymentId: updated.id, redirectUrl: updated.redirectUrl! };
  }

  async status(paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, purpose: "GIFT_CART" },
      select: {
        id: true,
        status: true,
        amountMinor: true,
        currency: true,
        contributions: {
          select: { amountMinor: true, status: true, gift: { select: { title: true } } },
        },
      },
    });
    if (!payment) throw new AppError(404, "PAYMENT_NOT_FOUND", "Paiement introuvable");
    return {
      id: payment.id,
      status: payment.status,
      amountCents: Number(payment.amountMinor),
      currency: payment.currency,
      items: payment.contributions.map((row) => ({
        giftTitle: row.gift?.title,
        amountCents: Number(row.amountMinor),
        allocationStatus: row.status,
      })),
    };
  }
}
