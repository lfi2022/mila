import argon2 from "argon2";
import { createHmac, randomBytes } from "node:crypto";

import { AppError } from "../../common/errors/app-error.js";
import { selectProductImage } from "../product-media/policy.js";
import type { AppConfig } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  ListRole,
  ListStatus,
  ListType,
  ListVisibility,
} from "../../generated/prisma/enums.js";
import type { NotificationQueue } from "../notifications/queue.js";

type ListInput = {
  title: string;
  slug: string;
  description?: string | null;
  welcomeMessage?: string | null;
  childName?: string | null;
  dueDate?: string | null;
  type: ListType;
  visibility: ListVisibility;
  status: ListStatus;
  accessCode?: string | null;
  surpriseMode: boolean;
  hideReservedGifts: boolean;
  allowIndexing: boolean;
  showProgress: boolean;
  theme: string;
  heroStyle?: string;
  fontPair?: string;
  layout?: string;
  coverMediaKey?: null;
  accentColor?: string | null;
};

export class ListsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
    private readonly notifications?: NotificationQueue,
  ) {}

  listMine(userId: string) {
    return this.prisma.giftList.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: {
        members: { select: { userId: true, role: true } },
        _count: { select: { gifts: true, reservations: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getForMember(userId: string, listId: string) {
    await this.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    return this.prisma.giftList.findFirstOrThrow({
      where: { id: listId, deletedAt: null },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        members: { include: { user: { select: { id: true, email: true, displayName: true } } } },
        invitations: {
          where: { revokedAt: null },
          select: { id: true, email: true, role: true, acceptedAt: true, expiresAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async create(userId: string, input: ListInput, attributionToken?: string) {
    this.assertTypeEnabled(input.type);
    assertPublicSlugAvailable(input.slug);
    const accessCodeHash = await this.accessCodeHash(input.visibility, input.accessCode);
    const data = {
      ownerId: userId,
      ...listData(input),
      title: input.title.trim(),
      slug: input.slug.trim().toLowerCase(),
      type: input.type,
      visibility: input.visibility,
      status: input.status,
      accessCodeHash,
    };
    if (!attributionToken) return this.prisma.giftList.create({ data });
    return this.prisma.$transaction(async (tx) => {
      const list = await tx.giftList.create({ data });
      await tx.partnerAttribution.updateMany({
        where: {
          tokenHash: this.sign(attributionToken),
          listId: null,
          expiresAt: { gt: new Date() },
        },
        data: { userId, listId: list.id, convertedAt: new Date() },
      });
      return list;
    });
  }

  async update(userId: string, listId: string, input: Partial<ListInput>) {
    await this.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    if (input.type) this.assertTypeEnabled(input.type);
    if (input.slug) assertPublicSlugAvailable(input.slug);
    if (input.status === "ARCHIVED" || input.status === "DELETED")
      throw new AppError(409, "USE_LIST_LIFECYCLE", "Use the archive lifecycle action");
    const current = await this.prisma.giftList.findUniqueOrThrow({ where: { id: listId } });
    if (current.status === "ARCHIVED" || current.status === "DELETED")
      throw new AppError(409, "LIST_LIFECYCLE_INVALID", "Archived lists cannot be edited");
    const visibility = input.visibility ?? current.visibility;
    let accessCodeHash = current.accessCodeHash;
    if (visibility !== "PROTECTED") accessCodeHash = null;
    if (input.accessCode)
      accessCodeHash = await argon2.hash(input.accessCode, { type: argon2.argon2id });
    if (visibility === "PROTECTED" && !accessCodeHash) {
      throw new AppError(400, "ACCESS_CODE_REQUIRED", "Protected lists require an access code");
    }
    return this.prisma.giftList.update({
      where: { id: listId },
      data: { ...listData(input), accessCodeHash },
    });
  }

  async remove(userId: string, listId: string): Promise<void> {
    await this.assertRole(userId, listId, ["OWNER"]);
    await this.prisma.giftList.update({
      where: { id: listId },
      data: { deletedAt: new Date(), status: "DELETED", slug: `deleted-${listId}` },
    });
  }

  async lifecycleSummary(userId: string, listId: string) {
    await this.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const list = await this.prisma.giftList.findUniqueOrThrow({
      where: { id: listId },
      select: {
        id: true,
        status: true,
        closedAt: true,
        archivedAt: true,
        memoryBook: {
          select: { id: true, exportPreparedAt: true, _count: { select: { items: true } } },
        },
        thankYous: { select: { receivedAt: true, thankedAt: true } },
        wallet: {
          select: {
            transactions: { where: { status: "CONFIRMED" }, select: { amountMinor: true } },
          },
        },
        futureLists: {
          select: { id: true, title: true, type: true, dueDate: true, status: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    return {
      status: list.status,
      closedAt: list.closedAt,
      archivedAt: list.archivedAt,
      memoryBook: list.memoryBook,
      thankYous: {
        received: list.thankYous.filter((item) => item.receivedAt).length,
        pending: list.thankYous.filter((item) => item.receivedAt && !item.thankedAt).length,
      },
      confirmedRewardMinor: (list.wallet?.transactions ?? [])
        .reduce((sum, item) => sum + item.amountMinor, 0n)
        .toString(),
      futureLists: list.futureLists,
    };
  }

  async close(userId: string, listId: string) {
    await this.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.giftList.findUniqueOrThrow({ where: { id: listId } });
      if (current.status === "ARCHIVED" || current.status === "DELETED")
        throw new AppError(
          409,
          "LIST_LIFECYCLE_INVALID",
          "Archived or deleted lists cannot be closed",
        );
      if (current.closedAt) return current;
      const closedAt = current.closedAt ?? new Date();
      const list = await tx.giftList.update({ where: { id: listId }, data: { closedAt } });
      await tx.listLifecycleEvent.create({ data: { listId, actorId: userId, action: "CLOSED" } });
      return list;
    });
  }

  async archive(userId: string, listId: string) {
    await this.assertRole(userId, listId, ["OWNER"]);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.giftList.findUniqueOrThrow({ where: { id: listId } });
      if (current.status === "ARCHIVED") return current;
      if (current.status === "DELETED")
        throw new AppError(409, "LIST_LIFECYCLE_INVALID", "Deleted lists cannot be archived");
      const now = new Date();
      const list = await tx.giftList.update({
        where: { id: listId },
        data: { status: "ARCHIVED", closedAt: current.closedAt ?? now, archivedAt: now },
      });
      await tx.listLifecycleEvent.create({ data: { listId, actorId: userId, action: "ARCHIVED" } });
      return list;
    });
  }

  async createFuture(
    userId: string,
    listId: string,
    input: { title: string; slug: string; type: ListType; dueDate?: string | null },
  ) {
    await this.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    this.assertTypeEnabled(input.type);
    const source = await this.prisma.giftList.findUniqueOrThrow({ where: { id: listId } });
    return this.prisma.$transaction(async (tx) => {
      const future = await tx.giftList.create({
        data: {
          ownerId: source.ownerId,
          sourceListId: source.id,
          title: input.title.trim(),
          slug: input.slug.trim().toLowerCase(),
          type: input.type,
          dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00Z`) : null,
          status: "DRAFT",
          visibility: "UNLISTED",
          theme: source.theme,
          accentColor: source.accentColor,
          heroStyle: source.heroStyle,
          fontPair: source.fontPair,
          layout: source.layout,
        },
      });
      await tx.listLifecycleEvent.create({
        data: {
          listId,
          actorId: userId,
          action: "FUTURE_CREATED",
          metadata: { futureListId: future.id, type: future.type },
        },
      });
      return future;
    });
  }

  async setCover(userId: string, listId: string, storageKey: string): Promise<void> {
    await this.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    await this.prisma.giftList.update({
      where: { id: listId },
      data: { coverMediaKey: storageKey },
    });
  }

  async removeMember(userId: string, listId: string, memberId: string): Promise<void> {
    await this.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    const member = await this.prisma.listMember.findFirst({
      where: { id: memberId, listId },
      select: { id: true, role: true, userId: true },
    });
    if (!member) throw new AppError(404, "LIST_MEMBER_NOT_FOUND", "List member not found");
    if (member.role === "OWNER" || member.userId === userId) {
      throw new AppError(403, "LIST_MEMBER_REMOVE_FORBIDDEN", "This member cannot be removed");
    }
    await this.prisma.listMember.delete({ where: { id: member.id } });
  }

  async publicList(slug: string, grant?: string) {
    const list = await this.prisma.giftList.findFirst({
      where: { slug, deletedAt: null, status: "ACTIVE" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        welcomeMessage: true,
        childName: true,
        coverMediaKey: true,
        dueDate: true,
        type: true,
        visibility: true,
        surpriseMode: true,
        hideReservedGifts: true,
        allowIndexing: true,
        showProgress: true,
        closedAt: true,
        theme: true,
        accentColor: true,
        accessCodeHash: true,
        gifts: {
          where: { deletedAt: null, hiddenByModerator: false },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            publicToken: true,
            title: true,
            description: true,
            kind: true,
            status: true,
            url: true,
            currency: true,
            unitPriceMinor: true,
            quantity: true,
            reservedQuantity: true,
            fundedAmountMinor: true,
            contributionTargetMinor: true,
            genericImageCategory: true,
            images: {
              where: { status: "ACTIVE" },
              orderBy: { position: "asc" },
              select: {
                usageStatus: true,
                status: true,
                originalUrl: true,
                publicUrl: true,
                storedObjectKey: true,
              },
            },
          },
        },
      },
    });
    if (!list) throw new AppError(404, "LIST_NOT_FOUND", "List not found");
    if (list.visibility === "PROTECTED" && !this.verifyGrant(list.id, grant)) {
      throw new AppError(403, "LIST_ACCESS_REQUIRED", "This list requires an access code");
    }
    const { accessCodeHash: _hidden, gifts, ...safe } = list;
    const publicGifts = gifts.map((gift) => ({
      id: gift.id,
      publicToken: gift.publicToken,
      title: gift.title,
      description: gift.description,
      kind: gift.kind,
      status: gift.status,
      hasLink: Boolean(gift.url),
      currency: gift.currency,
      unitPriceMinor: gift.unitPriceMinor?.toString() ?? null,
      quantity: gift.quantity,
      reservedQuantity: gift.reservedQuantity,
      fundedAmountMinor: gift.fundedAmountMinor.toString(),
      contributionTargetMinor: gift.contributionTargetMinor?.toString() ?? null,
      imageUrl: selectProductImage(gift.images, gift.genericImageCategory),
      isReserved:
        gift.reservedQuantity >= gift.quantity ||
        ["RESERVED", "ORDERED", "SHIPPED", "RECEIVED"].includes(gift.status),
    }));
    return {
      ...safe,
      // A due date can reveal pregnancy information and is never required by visitors.
      // A child's first name is withheld from indexable public lists by default.
      dueDate: null,
      childName: list.visibility === "PUBLIC" ? null : list.childName,
      gifts: safe.hideReservedGifts ? publicGifts.filter((gift) => !gift.isReserved) : publicGifts,
      totals: {
        items: publicGifts.length,
        taken: publicGifts.filter((gift) => gift.isReserved).length,
      },
    };
  }

  async unlock(slug: string, accessCode: string): Promise<{ listId: string; grant: string }> {
    const list = await this.prisma.giftList.findFirst({
      where: { slug, deletedAt: null, status: "ACTIVE", visibility: "PROTECTED" },
      select: { id: true, accessCodeHash: true },
    });
    if (!list?.accessCodeHash || !(await argon2.verify(list.accessCodeHash, accessCode))) {
      throw new AppError(403, "ACCESS_CODE_INVALID", "Invalid access code");
    }
    const expires = Date.now() + 3_600_000;
    const payload = `${list.id}.${expires}`;
    return { listId: list.id, grant: `${payload}.${this.sign(payload)}` };
  }

  async invite(userId: string, listId: string, email: string, role: Exclude<ListRole, "OWNER">) {
    await this.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    const token = randomBytes(32).toString("base64url");
    const invitation = await this.prisma.listInvitation.create({
      data: {
        listId,
        email: email.trim().toLowerCase(),
        role,
        tokenHash: this.sign(token),
        invitedById: userId,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
    await this.notifications
      ?.enqueue({
        type: "LIST_INVITATION",
        userId,
        listId,
        email: email.trim().toLowerCase(),
        payload: { token, role },
      })
      .catch(() => undefined);
    return { invitation, token };
  }

  async acceptInvitation(userId: string, userEmail: string, token: string) {
    const invitation = await this.prisma.listInvitation.findUnique({
      where: { tokenHash: this.sign(token) },
    });
    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.acceptedAt ||
      invitation.expiresAt <= new Date() ||
      invitation.email !== userEmail.trim().toLowerCase()
    ) {
      throw new AppError(400, "INVITATION_INVALID", "Invitation is invalid or expired");
    }
    await this.prisma.$transaction([
      this.prisma.listMember.upsert({
        where: { listId_userId: { listId: invitation.listId, userId } },
        create: { listId: invitation.listId, userId, role: invitation.role },
        update: { role: invitation.role },
      }),
      this.prisma.listInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), acceptedById: userId },
      }),
    ]);
    return { listId: invitation.listId };
  }

  async revokeInvitation(userId: string, listId: string, invitationId: string): Promise<void> {
    await this.assertRole(userId, listId, ["OWNER", "CO_OWNER"]);
    await this.prisma.listInvitation.updateMany({
      where: { id: invitationId, listId, acceptedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async assertRole(userId: string, listId: string, allowed: ListRole[]) {
    const list = await this.prisma.giftList.findFirst({
      where: { id: listId, deletedAt: null },
      select: { ownerId: true, members: { where: { userId }, select: { role: true } } },
    });
    const role: ListRole | undefined = list?.ownerId === userId ? "OWNER" : list?.members[0]?.role;
    if (!role || !allowed.includes(role))
      throw new AppError(403, "FORBIDDEN", "List permission denied");
    return role;
  }

  private async accessCodeHash(visibility: ListVisibility, code?: string | null) {
    if (visibility !== "PROTECTED") return null;
    if (!code)
      throw new AppError(400, "ACCESS_CODE_REQUIRED", "Protected lists require an access code");
    return argon2.hash(code, { type: argon2.argon2id });
  }

  private assertTypeEnabled(type: ListType) {
    if (!this.config.ENABLED_LIST_TYPES.split(",").includes(type))
      throw new AppError(409, "LIST_TYPE_DISABLED", "This list type is not enabled for launch");
  }

  private verifyGrant(listId: string, grant?: string): boolean {
    if (!grant) return false;
    const parts = grant.split(".");
    const expires = Number(parts[1]);
    const payload = `${parts[0]}.${parts[1]}`;
    return (
      parts.length === 3 &&
      parts[0] === listId &&
      expires > Date.now() &&
      parts[2] === this.sign(payload)
    );
  }

  private sign(value: string): string {
    return createHmac("sha256", this.config.AUTH_SECRET).update(value).digest("hex");
  }
}

function assertPublicSlugAvailable(slug: string) {
  if (slug.trim().toLowerCase() === "demo-mila") {
    throw new AppError(409, "LIST_SLUG_RESERVED", "This public link is reserved by Mila");
  }
}

function listData(input: Partial<ListInput>) {
  return {
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.slug !== undefined ? { slug: input.slug.trim().toLowerCase() } : {}),
    ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
    ...(input.welcomeMessage !== undefined
      ? { welcomeMessage: input.welcomeMessage?.trim() || null }
      : {}),
    ...(input.childName !== undefined ? { childName: input.childName?.trim() || null } : {}),
    ...(input.dueDate !== undefined
      ? { dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00Z`) : null }
      : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.surpriseMode !== undefined ? { surpriseMode: input.surpriseMode } : {}),
    ...(input.hideReservedGifts !== undefined
      ? { hideReservedGifts: input.hideReservedGifts }
      : {}),
    ...(input.allowIndexing !== undefined ? { allowIndexing: input.allowIndexing } : {}),
    ...(input.showProgress !== undefined ? { showProgress: input.showProgress } : {}),
    ...(input.theme !== undefined ? { theme: input.theme } : {}),
    ...(input.accentColor !== undefined ? { accentColor: input.accentColor || null } : {}),
    ...(input.heroStyle !== undefined ? { heroStyle: input.heroStyle } : {}),
    ...(input.fontPair !== undefined ? { fontPair: input.fontPair } : {}),
    ...(input.layout !== undefined ? { layout: input.layout } : {}),
    ...(input.coverMediaKey !== undefined ? { coverMediaKey: null } : {}),
  };
}
