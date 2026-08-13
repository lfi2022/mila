import argon2 from "argon2";
import { createHmac, randomBytes } from "node:crypto";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  ListRole,
  ListStatus,
  ListType,
  ListVisibility,
} from "../../generated/prisma/enums.js";

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
  accentColor?: string | null;
};

export class ListsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
  ) {}

  listMine(userId: string) {
    return this.prisma.giftList.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: { members: { select: { userId: true, role: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getForMember(userId: string, listId: string) {
    await this.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    return this.prisma.giftList.findFirstOrThrow({
      where: { id: listId, deletedAt: null },
      include: {
        members: { include: { user: { select: { id: true, email: true, displayName: true } } } },
      },
    });
  }

  async create(userId: string, input: ListInput) {
    const accessCodeHash = await this.accessCodeHash(input.visibility, input.accessCode);
    return this.prisma.giftList.create({
      data: {
        ownerId: userId,
        ...listData(input),
        title: input.title.trim(),
        slug: input.slug.trim().toLowerCase(),
        type: input.type,
        visibility: input.visibility,
        status: input.status,
        accessCodeHash,
      },
    });
  }

  async update(userId: string, listId: string, input: Partial<ListInput>) {
    await this.assertRole(userId, listId, ["OWNER", "CO_OWNER", "EDITOR"]);
    const current = await this.prisma.giftList.findUniqueOrThrow({ where: { id: listId } });
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
        showProgress: true,
        theme: true,
        accentColor: true,
        accessCodeHash: true,
        gifts: { where: { deletedAt: null }, orderBy: { position: "asc" } },
      },
    });
    if (!list) throw new AppError(404, "LIST_NOT_FOUND", "List not found");
    if (list.visibility === "PROTECTED" && !this.verifyGrant(list.id, grant)) {
      throw new AppError(403, "LIST_ACCESS_REQUIRED", "This list requires an access code");
    }
    const { accessCodeHash: _hidden, ...safe } = list;
    return safe;
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
  };
}
