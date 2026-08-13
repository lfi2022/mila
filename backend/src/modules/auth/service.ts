import argon2 from "argon2";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AppRole } from "../../generated/prisma/enums.js";
import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  roles: AppRole[];
};

export type IssuedSession = { token: string; csrfToken: string; user: AuthUser };
export type RequestIdentity = { ip: string; userAgent?: string };

const userWithRoles = {
  id: true,
  email: true,
  displayName: true,
  emailVerifiedAt: true,
  onboardingCompleted: true,
  suspendedAt: true,
  deletedAt: true,
  passwordHash: true,
  roles: { select: { role: true } },
} as const;

export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: AppConfig,
  ) {}

  async signup(input: { email: string; password: string; displayName?: string }) {
    const email = normalizeEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing)
      throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "This email is already registered");

    const passwordHash = await hashPassword(input.password);
    const verificationToken = createOpaqueToken();
    const expiresAt = addSeconds(this.config.EMAIL_VERIFICATION_TTL_SECONDS);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: input.displayName?.trim() || null,
        roles: { create: { role: "USER" } },
        verificationTokens: {
          create: { tokenHash: this.hashToken(verificationToken), expiresAt },
        },
      },
      select: userWithRoles,
    });
    return { user: toAuthUser(user), verificationToken };
  }

  async login(emailInput: string, password: string, identity: RequestIdentity) {
    const email = normalizeEmail(emailInput);
    const user = await this.prisma.user.findUnique({ where: { email }, select: userWithRoles });
    const valid = await argon2
      .verify(user?.passwordHash ?? DUMMY_PASSWORD_HASH, password)
      .catch(() => false);
    if (!user || !valid)
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    this.assertActive(user);
    if (!user.emailVerifiedAt) {
      throw new AppError(403, "EMAIL_NOT_VERIFIED", "Verify your email before signing in");
    }
    return this.issueSession(user, identity);
  }

  async authenticate(token: string | undefined): Promise<AuthUser> {
    if (!token) throw new AppError(401, "AUTH_REQUIRED", "Authentication required");
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { user: { select: userWithRoles } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new AppError(401, "SESSION_INVALID", "Session is invalid or expired");
    }
    this.assertActive(session.user);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
    return toAuthUser(session.user);
  }

  async rotate(token: string | undefined, identity: RequestIdentity): Promise<IssuedSession> {
    if (!token) throw new AppError(401, "AUTH_REQUIRED", "Authentication required");
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { user: { select: userWithRoles } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new AppError(401, "SESSION_INVALID", "Session is invalid or expired");
    }
    this.assertActive(session.user);
    const replacement = this.buildSession(session.userId, identity);
    await this.prisma.$transaction([
      this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } }),
      this.prisma.session.create({ data: replacement.data }),
    ]);
    return {
      token: replacement.token,
      csrfToken: createOpaqueToken(),
      user: toAuthUser(session.user),
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.prisma.session.updateMany({
      where: { tokenHash: this.hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new AppError(400, "TOKEN_INVALID", "Verification token is invalid or expired");
    }
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
    ]);
  }

  async requestPasswordReset(emailInput: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(emailInput) },
      select: { id: true, deletedAt: true, suspendedAt: true },
    });
    if (!user || user.deletedAt || user.suspendedAt) return null;
    const token = createOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: addSeconds(this.config.PASSWORD_RESET_TTL_SECONDS),
      },
    });
    return token;
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new AppError(400, "TOKEN_INVALID", "Reset token is invalid or expired");
    }
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async updateProfile(userId: string, displayName: string | null): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: displayName?.trim() || null },
      select: userWithRoles,
    });
    return toAuthUser(user);
  }

  async completeOnboarding(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { onboardingCompleted: true } });
  }

  async exportAccount(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
        onboardingCompleted: true,
        createdAt: true,
        updatedAt: true,
        roles: { select: { role: true, createdAt: true } },
        ownedLists: true,
        memberships: true,
        reservations: true,
        notifications: true,
        messages: true,
      },
    });
  }

  async deleteAccount(userId: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted+${userId}@mila.invalid`,
          passwordHash: await hashPassword(createOpaqueToken()),
          displayName: null,
          avatarKey: null,
          deletedAt: now,
        },
      }),
    ]);
  }

  private async issueSession(
    user: Parameters<typeof toAuthUser>[0],
    identity: RequestIdentity,
  ): Promise<IssuedSession> {
    const session = this.buildSession(user.id, identity);
    await this.prisma.session.create({ data: session.data });
    return { token: session.token, csrfToken: createOpaqueToken(), user: toAuthUser(user) };
  }

  private buildSession(userId: string, identity: RequestIdentity) {
    const token = createOpaqueToken();
    return {
      token,
      data: {
        id: randomUUID(),
        userId,
        tokenHash: this.hashToken(token),
        ipHash: this.hashIdentity(identity.ip),
        userAgent: identity.userAgent?.slice(0, 512),
        expiresAt: addSeconds(this.config.SESSION_TTL_SECONDS),
      },
    };
  }

  private hashToken(token: string): string {
    return createHmac("sha256", this.config.SESSION_SECRET).update(token).digest("hex");
  }

  private hashIdentity(value: string): string {
    return createHmac("sha256", this.config.AUTH_SECRET).update(value).digest("hex");
  }

  private assertActive(user: { suspendedAt: Date | null; deletedAt: Date | null }): void {
    if (user.deletedAt) throw new AppError(401, "ACCOUNT_DELETED", "Account no longer exists");
    if (user.suspendedAt) throw new AppError(403, "ACCOUNT_SUSPENDED", "Account is suspended");
  }
}

export function hasAnyRole(user: AuthUser, roles: readonly AppRole[]): boolean {
  return roles.some((role) => user.roles.includes(role));
}

export function assertAnyRole(user: AuthUser, roles: readonly AppRole[]): void {
  if (!hasAnyRole(user, roles)) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to perform this action");
  }
}

function toAuthUser(user: {
  id: string;
  email: string;
  displayName: string | null;
  emailVerifiedAt: Date | null;
  onboardingCompleted: boolean;
  roles: { role: AppRole }[];
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: Boolean(user.emailVerifiedAt),
    onboardingCompleted: user.onboardingCompleted,
    roles: user.roles.map(({ role }) => role),
  };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function addSeconds(seconds: number): Date {
  return new Date(Date.now() + seconds * 1_000);
}

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

// Valid Argon2id hash used only to equalize unknown-user login work.
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$v5CjqbBdOO3Y0UW8Rbf1Fg$8mdXZrW3QPaXbENai7MLPGTDL8zC/kZJUcENzuTM2ec";
