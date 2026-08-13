import { createHmac, randomBytes } from "node:crypto";

import { AppError } from "../../common/errors/app-error.js";
import type { StorageService } from "../../common/storage/service.js";
import type { AppConfig } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ListsService } from "../lists/service.js";

type SecondHandInput = {
  giftToken: string;
  proposerName: string;
  proposerEmail?: string | null;
  condition: "LIKE_NEW" | "VERY_GOOD" | "GOOD" | "FAIR";
  comment?: string | null;
};

export class MemoriesService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly lists: ListsService,
    private readonly storage?: StorageService,
  ) {}

  async createSecondHandOffer(input: SecondHandInput) {
    this.enabled("FEATURE_SECOND_HAND_OFFERS");
    const gift = await this.prisma.gift.findFirst({
      where: {
        publicToken: input.giftToken,
        deletedAt: null,
        list: { status: "ACTIVE", deletedAt: null },
      },
      select: { id: true, listId: true, title: true, secondHandPolicy: true },
    });
    if (!gift) throw new AppError(404, "GIFT_NOT_FOUND", "Gift not found");
    if (!acceptsSecondHand(gift.secondHandPolicy)) {
      throw new AppError(409, "SECOND_HAND_NOT_ALLOWED", "This gift only accepts new products");
    }
    const token = randomBytes(32).toString("base64url");
    const offer = await this.prisma.secondHandOffer.create({
      data: {
        listId: gift.listId,
        giftId: gift.id,
        proposerName: input.proposerName.trim(),
        proposerEmail: input.proposerEmail?.trim().toLowerCase() || null,
        condition: input.condition,
        comment: input.comment?.trim() || null,
        managementTokenHash: this.hash(token),
        tokenExpiresAt: new Date(Date.now() + 90 * 86_400_000),
      },
    });
    return { managementToken: token, offer: publicOffer(offer, gift.title) };
  }

  async getSecondHandOffer(token: string) {
    const offer = await this.requireOfferToken(token);
    return publicOffer(offer, offer.gift.title);
  }

  async presignSecondHandPhoto(token: string, mimeType: string, sizeBytes: number) {
    const offer = await this.requireOfferToken(token);
    if (offer.status !== "PENDING") throw new AppError(409, "OFFER_CLOSED", "Offer is closed");
    if (!this.storage) throw new AppError(503, "STORAGE_UNAVAILABLE", "Storage is unavailable");
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType) || sizeBytes > 8_388_608) {
      throw new AppError(
        413,
        "OFFER_PHOTO_POLICY",
        "Photo must be JPEG, PNG or WebP and at most 8 MB",
      );
    }
    return this.storage.presignUpload(
      `second-hand-${offer.id}`,
      "user-upload",
      mimeType,
      sizeBytes,
    );
  }

  async verifySecondHandPhoto(token: string, key: string, mimeType: string, sizeBytes: number) {
    const offer = await this.requireOfferToken(token);
    if (offer.status !== "PENDING") throw new AppError(409, "OFFER_CLOSED", "Offer is closed");
    if (!this.storage) throw new AppError(503, "STORAGE_UNAVAILABLE", "Storage is unavailable");
    await this.storage.verifyUpload(
      `second-hand-${offer.id}`,
      "user-upload",
      key,
      mimeType,
      sizeBytes,
    );
    return this.prisma.secondHandOffer.update({
      where: { id: offer.id },
      data: {
        photoStorageKey: key,
        photoMimeType: mimeType,
        photoSizeBytes: BigInt(sizeBytes),
        photoScanStatus: "PENDING",
      },
    });
  }

  async withdrawSecondHandOffer(token: string) {
    const offer = await this.requireOfferToken(token);
    const changed = await this.prisma.secondHandOffer.updateMany({
      where: { id: offer.id, status: "PENDING" },
      data: { status: "WITHDRAWN" },
    });
    if (changed.count !== 1) throw new AppError(409, "OFFER_CLOSED", "Offer is already closed");
  }

  async listSecondHandOffers(userId: string, listId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    return this.prisma.secondHandOffer.findMany({
      where: { listId },
      include: { gift: { select: { title: true, secondHandPolicy: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async reviewSecondHandOffer(
    userId: string,
    listId: string,
    offerId: string,
    accept: boolean,
    comment?: string,
  ) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    return this.prisma.$transaction(
      async (tx) => {
        const offer = await tx.secondHandOffer.findFirst({
          where: { id: offerId, listId },
          include: { gift: true },
        });
        if (!offer) throw new AppError(404, "SECOND_HAND_OFFER_NOT_FOUND", "Offer not found");
        if (offer.status !== "PENDING")
          throw new AppError(409, "OFFER_CLOSED", "Offer is already reviewed");
        if (accept) {
          const changed = await tx.$executeRawUnsafe(
            "UPDATE gifts SET reserved_quantity = reserved_quantity + 1, status = CASE WHEN reserved_quantity + 1 >= quantity THEN 'RESERVED' ELSE status END WHERE id = ? AND deleted_at IS NULL AND second_hand_policy <> 'NEW_ONLY' AND reserved_quantity < quantity",
            offer.giftId,
          );
          if (changed !== 1)
            throw new AppError(409, "GIFT_QUANTITY_UNAVAILABLE", "Gift is no longer available");
          await tx.secondHandOffer.updateMany({
            where: { giftId: offer.giftId, status: "PENDING", id: { not: offer.id } },
            data: {
              status: "REJECTED",
              reviewedById: userId,
              reviewedAt: new Date(),
              reviewComment: "Une autre proposition a été retenue",
            },
          });
        }
        return tx.secondHandOffer.update({
          where: { id: offer.id },
          data: {
            status: accept ? "ACCEPTED" : "REJECTED",
            reviewedById: userId,
            reviewedAt: new Date(),
            reviewComment: comment?.trim() || null,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );
  }

  async secondHandPhotoUrl(userId: string, listId: string, offerId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    if (!this.storage) throw new AppError(503, "STORAGE_UNAVAILABLE", "Storage is unavailable");
    const offer = await this.prisma.secondHandOffer.findFirst({
      where: { id: offerId, listId },
      select: { photoStorageKey: true },
    });
    if (!offer?.photoStorageKey)
      throw new AppError(404, "OFFER_PHOTO_NOT_FOUND", "Photo not found");
    const url = await this.storage.signedCleanDownload("user-upload", offer.photoStorageKey);
    await this.prisma.secondHandOffer.update({
      where: { id: offerId },
      data: { photoScanStatus: "CLEAN" },
    });
    return url;
  }

  async createReservationMessage(token: string, text?: string | null) {
    this.enabled("FEATURE_MEDIA_MESSAGES");
    const reservation = await this.requireReservationToken(token);
    if (!text?.trim())
      throw new AppError(400, "MESSAGE_EMPTY", "A text or media attachment is required");
    return this.prisma.message.create({
      data: {
        listId: reservation.listId,
        giftId: reservation.giftId,
        reservationId: reservation.id,
        guestName: reservation.guestName,
        text: text.trim(),
      },
    });
  }

  async presignMessageMedia(token: string, messageId: string, mimeType: string, sizeBytes: number) {
    this.enabled("FEATURE_MEDIA_MESSAGES");
    const reservation = await this.requireReservationToken(token);
    await this.requireReservationMessage(reservation.id, messageId);
    if (!this.storage) throw new AppError(503, "STORAGE_UNAVAILABLE", "Storage is unavailable");
    this.assertMediaPolicy(mimeType, sizeBytes);
    return this.storage.presignUpload(
      `reservation-${reservation.id}`,
      "media-message",
      mimeType,
      sizeBytes,
    );
  }

  async verifyMessageMedia(
    token: string,
    messageId: string,
    key: string,
    mimeType: string,
    sizeBytes: number,
    durationSeconds?: number,
  ) {
    const reservation = await this.requireReservationToken(token);
    await this.requireReservationMessage(reservation.id, messageId);
    if (!this.storage) throw new AppError(503, "STORAGE_UNAVAILABLE", "Storage is unavailable");
    this.assertMediaPolicy(mimeType, sizeBytes, durationSeconds);
    const verified = await this.storage.verifyUpload(
      `reservation-${reservation.id}`,
      "media-message",
      key,
      mimeType,
      sizeBytes,
    );
    return this.prisma.mediaAsset.create({
      data: {
        messageId,
        kind: mimeType.startsWith("audio/") ? "AUDIO" : "VIDEO",
        storageKey: key,
        mimeType,
        sizeBytes: BigInt(sizeBytes),
        checksum: verified.checksum,
        scanStatus: "PENDING",
        transcodeStatus: this.config.FEATURE_MEDIA_TRANSCODING ? "PENDING" : "NOT_REQUIRED",
        durationSeconds: durationSeconds ?? null,
        retentionUntil: new Date(Date.now() + this.config.MEDIA_RETENTION_DAYS * 86_400_000),
      },
    });
  }

  async listMessages(userId: string, listId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    return this.prisma.message.findMany({
      where: { listId, hiddenAt: null },
      include: { gift: { select: { title: true } }, media: { where: { deletedAt: null } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async approveMessage(userId: string, listId: string, messageId: string, approved: boolean) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    const changed = await this.prisma.message.updateMany({
      where: { id: messageId, listId },
      data: {
        approvedForMemory: approved,
        approvedById: approved ? userId : null,
        approvedAt: approved ? new Date() : null,
      },
    });
    if (changed.count !== 1) throw new AppError(404, "MESSAGE_NOT_FOUND", "Message not found");
  }

  async messageMediaUrl(userId: string, listId: string, assetId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    if (!this.storage) throw new AppError(503, "STORAGE_UNAVAILABLE", "Storage is unavailable");
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, deletedAt: null, message: { listId } },
      include: { message: { select: { reservationId: true } } },
    });
    if (!asset) throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found");
    const url = await this.storage.signedCleanDownload(
      "media-message",
      asset.transcodedStorageKey ?? asset.storageKey,
    );
    if (asset.scanStatus !== "CLEAN")
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { scanStatus: "CLEAN" },
      });
    return url;
  }

  async deleteMessageMedia(userId: string, listId: string, assetId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, deletedAt: null, message: { listId } },
      include: { message: { select: { reservationId: true } } },
    });
    if (!asset) throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found");
    await this.prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { deletedAt: new Date() },
    });
    if (this.storage && asset.message?.reservationId)
      await this.storage
        .deleteOwned(
          `reservation-${asset.message.reservationId}`,
          "media-message",
          asset.storageKey,
        )
        .catch(() => undefined);
  }

  async thankYouCenter(userId: string, listId: string, onlyUnthanked = false) {
    this.enabled("FEATURE_THANK_YOUS");
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const reservations = await this.prisma.reservation.findMany({
      where: {
        listId,
        status: "PURCHASED",
        ...(onlyUnthanked
          ? { OR: [{ thankYou: { is: null } }, { thankYou: { thankedAt: null } }] }
          : {}),
      },
      include: { gift: { select: { title: true, status: true } }, thankYou: true },
      orderBy: { createdAt: "desc" },
    });
    return reservations;
  }

  async updateThankYou(
    userId: string,
    listId: string,
    reservationId: string,
    input: {
      received?: boolean;
      thanked?: boolean;
      draft?: string | null;
      approveDraft?: boolean;
      cardTheme?: string;
      cardMessage?: string;
    },
  ) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, listId, status: "PURCHASED" },
      select: { id: true, giftId: true },
    });
    if (!reservation)
      throw new AppError(404, "RESERVATION_NOT_FOUND", "Purchased reservation not found");
    const now = new Date();
    return this.prisma.thankYou.upsert({
      where: { reservationId },
      create: {
        listId,
        giftId: reservation.giftId,
        reservationId,
        userId,
        receivedAt: input.received ? now : null,
        thankedAt: input.thanked ? now : null,
        draft: input.draft?.trim() || null,
        draftApprovedAt: input.approveDraft ? now : null,
        cardTheme: input.cardTheme?.trim() || null,
        cardMessage: input.cardMessage?.trim() || null,
        cardCreatedAt: input.cardMessage ? now : null,
      },
      update: {
        ...(input.received !== undefined ? { receivedAt: input.received ? now : null } : {}),
        ...(input.thanked !== undefined ? { thankedAt: input.thanked ? now : null } : {}),
        ...(input.draft !== undefined
          ? { draft: input.draft?.trim() || null, draftApprovedAt: null }
          : {}),
        ...(input.approveDraft !== undefined
          ? { draftApprovedAt: input.approveDraft ? now : null }
          : {}),
        ...(input.cardTheme !== undefined ? { cardTheme: input.cardTheme.trim() } : {}),
        ...(input.cardMessage !== undefined
          ? { cardMessage: input.cardMessage.trim(), cardCreatedAt: now }
          : {}),
      },
    });
  }

  async thankYouExport(userId: string, listId: string) {
    const rows = await this.thankYouCenter(userId, listId);
    const cells = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    return [
      ["Proche", "Email", "Cadeau", "Reçu", "Remercié", "Brouillon approuvé"].map(cells).join(","),
      ...rows.map((row) =>
        [
          row.guestName,
          row.guestEmail,
          row.gift.title,
          row.thankYou?.receivedAt?.toISOString() ?? "",
          row.thankYou?.thankedAt?.toISOString() ?? "",
          row.thankYou?.draftApprovedAt?.toISOString() ?? "",
        ]
          .map(cells)
          .join(","),
      ),
    ].join("\r\n");
  }

  async digitalCard(userId: string, listId: string, reservationId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const card = await this.prisma.thankYou.findFirst({
      where: {
        listId,
        reservationId,
        draftApprovedAt: { not: null },
        cardCreatedAt: { not: null },
      },
      include: { reservation: { select: { guestName: true } }, gift: { select: { title: true } } },
    });
    if (!card?.cardMessage)
      throw new AppError(409, "THANK_YOU_CARD_NOT_APPROVED", "Card must be approved by a parent");
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><style>body{font-family:Georgia,serif;background:#fbf7f1;padding:8vh;text-align:center;color:#473c38}.card{max-width:680px;margin:auto;background:white;border-radius:24px;padding:64px;box-shadow:0 8px 40px #0001}</style></head><body><main class="card"><h1>Merci ${escapeHtml(card.reservation?.guestName ?? "")}</h1><p>${escapeHtml(card.cardMessage)}</p><small>${escapeHtml(card.gift?.title ?? "")}</small></main></body></html>`;
  }

  async memoryBook(userId: string, listId: string) {
    this.enabled("FEATURE_MEMORY_BOOK");
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const book = await this.prisma.memoryBook.upsert({
      where: { listId },
      create: { listId },
      update: {},
    });
    const [items, messages, gifts] = await Promise.all([
      this.prisma.memoryBookItem.findMany({
        where: { memoryBookId: book.id },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.message.findMany({
        where: { listId, hiddenAt: null, approvedForMemory: true },
        include: { media: { where: { deletedAt: null } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.gift.findMany({
        where: { listId, deletedAt: null, status: { in: ["ORDERED", "SHIPPED", "RECEIVED"] } },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          images: {
            where: {
              status: "ACTIVE",
              usagePolicy: { notIn: ["MANUAL_REVIEW_REQUIRED", "DO_NOT_DISPLAY"] },
            },
            take: 1,
            select: { sourceUrl: true },
          },
        },
        orderBy: { position: "asc" },
      }),
    ]);
    return { book, items, sources: { messages, gifts } };
  }

  async updateMemoryBook(
    userId: string,
    listId: string,
    input: {
      theme?: string;
      title?: string | null;
      introduction?: string | null;
      retentionMonths?: number;
    },
  ) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    return this.prisma.memoryBook.upsert({
      where: { listId },
      create: {
        listId,
        theme: input.theme ?? "soft",
        title: input.title,
        introduction: input.introduction,
        retentionMonths: input.retentionMonths ?? 24,
      },
      update: input,
    });
  }

  async addMemoryItem(
    userId: string,
    listId: string,
    input: {
      sourceType: "MESSAGE" | "GIFT";
      sourceId: string;
      caption?: string | null;
      position?: number;
    },
  ) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    if (input.sourceType === "MESSAGE") {
      const count = await this.prisma.message.count({
        where: { id: input.sourceId, listId, approvedForMemory: true, hiddenAt: null },
      });
      if (!count)
        throw new AppError(409, "MEMORY_SOURCE_NOT_APPROVED", "Message must be parent-approved");
    } else {
      const count = await this.prisma.gift.count({
        where: { id: input.sourceId, listId, deletedAt: null },
      });
      if (!count) throw new AppError(404, "MEMORY_SOURCE_NOT_FOUND", "Gift not found");
    }
    const book = await this.prisma.memoryBook.upsert({
      where: { listId },
      create: { listId },
      update: {},
    });
    return this.prisma.memoryBookItem.upsert({
      where: {
        memoryBookId_sourceType_sourceId: {
          memoryBookId: book.id,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
        },
      },
      create: {
        memoryBookId: book.id,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        caption: input.caption?.trim() || null,
        position: input.position ?? 0,
        approvedById: userId,
      },
      update: {
        caption: input.caption?.trim() || null,
        position: input.position ?? 0,
        approvedById: userId,
        approvedAt: new Date(),
      },
    });
  }

  async removeMemoryItem(userId: string, listId: string, itemId: string) {
    await this.lists.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    const deleted = await this.prisma.memoryBookItem.deleteMany({
      where: { id: itemId, memoryBook: { listId } },
    });
    if (deleted.count !== 1)
      throw new AppError(404, "MEMORY_ITEM_NOT_FOUND", "Memory item not found");
  }

  async printReadyMemoryBook(userId: string, listId: string) {
    const data = await this.memoryBook(userId, listId);
    const selected = new Map(
      data.items.map((item) => [`${item.sourceType}:${item.sourceId}`, item]),
    );
    const messageSections = await Promise.all(
      data.sources.messages
        .filter((item) => selected.has(`MESSAGE:${item.id}`))
        .map(async (item) => {
          const media = await Promise.all(
            item.media.map(async (asset) => {
              if (!this.storage) return "";
              const url = await this.storage
                .signedCleanDownload(
                  "media-message",
                  asset.transcodedStorageKey ?? asset.storageKey,
                )
                .catch(() => null);
              if (!url) return `<p>Média en attente d’analyse de sécurité.</p>`;
              return asset.kind === "AUDIO"
                ? `<audio controls src="${escapeHtml(url)}"></audio>`
                : `<video controls src="${escapeHtml(url)}"></video>`;
            }),
          );
          return `<article><h2>Message de ${escapeHtml(item.guestName ?? "Un proche")}</h2><p>${escapeHtml(item.text ?? "Message audio ou vidéo")}</p>${media.join("")}</article>`;
        }),
    );
    const giftSections = data.sources.gifts
      .filter((item) => selected.has(`GIFT:${item.id}`))
      .map(
        (item) =>
          `<article><h2>${escapeHtml(item.title)}</h2>${item.images[0]?.sourceUrl ? `<img src="${escapeHtml(item.images[0].sourceUrl!)}" alt="">` : ""}<p>${escapeHtml(item.description ?? "Un cadeau reçu avec affection.")}</p></article>`,
      );
    const sections = [...messageSections, ...giftSections].join("\n");
    await this.prisma.memoryBook.update({
      where: { id: data.book.id },
      data: { exportPreparedAt: new Date() },
    });
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(data.book.title ?? "Livre souvenir Mila")}</title><style>@page{size:A4;margin:18mm}body{font-family:Georgia,serif;color:#342b2b}article{break-inside:avoid;border-bottom:1px solid #ddd;padding:16px 0}h1{text-align:center}</style></head><body><h1>${escapeHtml(data.book.title ?? "Notre livre souvenir")}</h1><p>${escapeHtml(data.book.introduction ?? "")}</p>${sections}</body></html>`;
  }

  private async requireOfferToken(token: string) {
    const offer = await this.prisma.secondHandOffer.findUnique({
      where: { managementTokenHash: this.hash(token) },
      include: { gift: { select: { title: true } } },
    });
    if (!offer || offer.tokenExpiresAt <= new Date())
      throw new AppError(404, "OFFER_TOKEN_INVALID", "Offer link is invalid or expired");
    return offer;
  }

  private async requireReservationToken(token: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { managementTokenHash: this.hash(token) },
      select: { id: true, listId: true, giftId: true, guestName: true, tokenExpiresAt: true },
    });
    if (!reservation || reservation.tokenExpiresAt <= new Date())
      throw new AppError(
        404,
        "RESERVATION_TOKEN_INVALID",
        "Reservation link is invalid or expired",
      );
    return reservation;
  }

  private async requireReservationMessage(reservationId: string, messageId: string) {
    const count = await this.prisma.message.count({
      where: { id: messageId, reservationId, hiddenAt: null },
    });
    if (!count) throw new AppError(404, "MESSAGE_NOT_FOUND", "Message not found");
  }

  private assertMediaPolicy(mimeType: string, sizeBytes: number, durationSeconds?: number) {
    const kind = classifyMedia(
      mimeType,
      sizeBytes,
      durationSeconds,
      this.config.MEDIA_AUDIO_MAX_BYTES,
      this.config.MEDIA_VIDEO_MAX_BYTES,
    );
    if (!kind) {
      throw new AppError(413, "MEDIA_POLICY_REJECTED", "Media type or size is not allowed");
    }
  }

  private enabled(
    key:
      | "FEATURE_SECOND_HAND_OFFERS"
      | "FEATURE_MEDIA_MESSAGES"
      | "FEATURE_THANK_YOUS"
      | "FEATURE_MEMORY_BOOK",
  ) {
    if (!this.config[key]) throw new AppError(503, "FEATURE_DISABLED", "Feature is disabled");
  }

  private hash(token: string) {
    return createHmac("sha256", this.config.AUTH_SECRET).update(token).digest("hex");
  }
}

function publicOffer(
  offer: {
    id: string;
    proposerName: string;
    condition: string;
    comment: string | null;
    status: string;
    photoStorageKey: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  giftTitle: string,
) {
  return {
    id: offer.id,
    giftTitle,
    proposerName: offer.proposerName,
    condition: offer.condition,
    comment: offer.comment,
    hasPhoto: Boolean(offer.photoStorageKey),
    status: offer.status,
    createdAt: offer.createdAt,
    updatedAt: offer.updatedAt,
  };
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!,
  );
}

export function acceptsSecondHand(policy: string) {
  return policy === "SECOND_HAND_ALLOWED" || policy === "SECOND_HAND_PREFERRED";
}

export function classifyMedia(
  mimeType: string,
  sizeBytes: number,
  durationSeconds: number | undefined,
  audioMaxBytes: number,
  videoMaxBytes: number,
): "AUDIO" | "VIDEO" | null {
  const audio = /^audio\/(mpeg|mp4|ogg|webm)$/.test(mimeType);
  const video = /^video\/(mp4|webm)$/.test(mimeType);
  if (!audio && !video) return null;
  if (sizeBytes < 1 || sizeBytes > (audio ? audioMaxBytes : videoMaxBytes)) return null;
  if (durationSeconds && durationSeconds > (audio ? 300 : 180)) return null;
  return audio ? "AUDIO" : "VIDEO";
}

export function canIncludeMemoryMessage(message: {
  approvedForMemory: boolean;
  hiddenAt: Date | null;
}) {
  return message.approvedForMemory && message.hiddenAt === null;
}
