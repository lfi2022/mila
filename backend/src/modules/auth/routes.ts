import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import { AuthService } from "./service.js";

const credentials = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(12).max(128),
});
const signup = credentials.extend({
  displayName: z.string().trim().min(1).max(120).optional(),
  termsAccepted: z.literal(true),
  termsVersion: z.string().max(32),
  marketingConsent: z.boolean().default(false),
});
const tokenBody = z.object({ token: z.string().min(32).max(256) });
const resetBody = tokenBody.extend({ password: z.string().min(12).max(128) });
const profileBody = z.object({ displayName: z.string().trim().min(1).max(120).nullable() });
const bankAccountBody = z.object({
  beneficiary: z.string().trim().min(2).max(180),
  iban: z.string().trim().min(15).max(64),
  password: z.string().min(1).max(128),
});
const bankAccountDeleteBody = z.object({ password: z.string().min(1).max(128) });
const deleteBody = z.object({ confirmation: z.literal("DELETE") });
const consentBody = z.object({ granted: z.boolean() });
const privacyRequestBody = z.object({
  type: z.enum([
    "ACCESS",
    "RECTIFICATION",
    "ERASURE",
    "RESTRICTION",
    "OBJECTION",
    "PORTABILITY",
    "OTHER",
  ]),
  details: z.string().trim().max(2000).optional(),
});

export function authRoutes(service: AuthService, config: AppConfig): FastifyPluginAsync {
  const csrfCookieName = `${config.COOKIE_NAME}_csrf`;
  const cookieOptions = {
    path: "/",
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    domain: config.COOKIE_DOMAIN || undefined,
  } as const;

  const setSession = (reply: FastifyReply, token: string, csrfToken: string) => {
    reply.setCookie(config.COOKIE_NAME, token, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: config.SESSION_TTL_SECONDS,
    });
    reply.setCookie(csrfCookieName, csrfToken, {
      ...cookieOptions,
      httpOnly: false,
      maxAge: config.SESSION_TTL_SECONDS,
    });
  };
  const clearSession = (reply: FastifyReply) => {
    reply.clearCookie(config.COOKIE_NAME, cookieOptions);
    reply.clearCookie(csrfCookieName, cookieOptions);
  };
  const identity = (request: FastifyRequest) => ({
    ip: request.ip,
    userAgent: request.headers["user-agent"],
  });
  const sessionToken = (request: FastifyRequest) => request.cookies[config.COOKIE_NAME];
  const requireCsrf = (request: FastifyRequest) => {
    const cookie = request.cookies[csrfCookieName];
    const header = request.headers["x-csrf-token"];
    if (!cookie || typeof header !== "string" || !safeEqual(cookie, header)) {
      throw new AppError(403, "CSRF_INVALID", "CSRF validation failed");
    }
  };

  return async (app) => {
    app.post(
      "/signup",
      { config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
      async (request, reply) => {
        const input = signup.parse(request.body);
        const result = await service.signup(input, identity(request), request.id);
        return reply.status(201).send({
          user: result.user,
          verificationRequired: true,
          ...(config.APP_ENV === "development"
            ? { developmentVerificationToken: result.verificationToken }
            : {}),
        });
      },
    );

    app.post(
      "/login",
      { config: { rateLimit: { max: 8, timeWindow: 60_000 } } },
      async (request, reply) => {
        const input = credentials.parse(request.body);
        const result = await service.login(input.email, input.password, identity(request));
        setSession(reply, result.token, result.csrfToken);
        return { user: result.user, csrfToken: result.csrfToken };
      },
    );

    app.get("/me", async (request) => ({
      user: await service.authenticate(sessionToken(request)),
    }));

    app.post("/refresh", async (request, reply) => {
      requireCsrf(request);
      const result = await service.rotate(sessionToken(request), identity(request));
      setSession(reply, result.token, result.csrfToken);
      return { user: result.user, csrfToken: result.csrfToken };
    });

    app.post("/logout", async (request, reply) => {
      requireCsrf(request);
      await service.logout(sessionToken(request));
      clearSession(reply);
      return reply.status(204).send();
    });

    app.post("/verify-email", async (request, reply) => {
      await service.verifyEmail(tokenBody.parse(request.body).token);
      return reply.status(204).send();
    });

    app.post(
      "/forgot-password",
      { config: { rateLimit: { max: 5, timeWindow: 60_000 } } },
      async (request, reply) => {
        const { email } = credentials.pick({ email: true }).parse(request.body);
        const token = await service.requestPasswordReset(email);
        return reply.status(202).send({
          accepted: true,
          ...(config.APP_ENV === "development" && token
            ? { developmentPasswordResetToken: token }
            : {}),
        });
      },
    );

    app.post(
      "/resend-verification",
      { config: { rateLimit: { max: 3, timeWindow: 60_000 } } },
      async (request, reply) => {
        const { email } = credentials.pick({ email: true }).parse(request.body);
        await service.resendVerification(email);
        return reply.status(202).send({ accepted: true });
      },
    );

    app.post("/reset-password", async (request, reply) => {
      const input = resetBody.parse(request.body);
      await service.resetPassword(input.token, input.password);
      clearSession(reply);
      return reply.status(204).send();
    });

    app.patch("/profile", async (request) => {
      requireCsrf(request);
      const user = await service.authenticate(sessionToken(request));
      return {
        user: await service.updateProfile(user.id, profileBody.parse(request.body).displayName),
      };
    });

    app.get("/bank-account", async (request) => {
      const user = await service.authenticate(sessionToken(request));
      return { bankAccount: await service.bankAccount(user.id) };
    });

    app.put("/bank-account", async (request) => {
      requireCsrf(request);
      const user = await service.authenticate(sessionToken(request));
      return {
        bankAccount: await service.saveBankAccount(user.id, bankAccountBody.parse(request.body)),
      };
    });

    app.delete("/bank-account", async (request, reply) => {
      requireCsrf(request);
      const user = await service.authenticate(sessionToken(request));
      await service.deleteBankAccount(user.id, bankAccountDeleteBody.parse(request.body).password);
      return reply.status(204).send();
    });

    app.get("/consents", async (request) => {
      const user = await service.authenticate(sessionToken(request));
      return {
        consents: await service.consents(user.id),
        currentTermsVersion: config.LEGAL_TERMS_VERSION,
      };
    });

    app.post("/consents/marketing", async (request, reply) => {
      requireCsrf(request);
      const user = await service.authenticate(sessionToken(request));
      const { granted } = consentBody.parse(request.body);
      await service.recordConsent(
        user,
        "marketing",
        config.LEGAL_PRIVACY_VERSION,
        granted,
        "account",
        identity(request),
        request.id,
      );
      return reply.status(204).send();
    });

    app.post("/consents/terms", async (request, reply) => {
      requireCsrf(request);
      const user = await service.authenticate(sessionToken(request));
      z.object({ accepted: z.literal(true), version: z.literal(config.LEGAL_TERMS_VERSION) }).parse(
        request.body,
      );
      await service.recordConsent(
        user,
        "terms",
        config.LEGAL_TERMS_VERSION,
        true,
        "account",
        identity(request),
        request.id,
      );
      return reply.status(204).send();
    });

    app.get("/privacy-requests", async (request) => {
      const user = await service.authenticate(sessionToken(request));
      return { requests: await service.privacyRequests(user.id) };
    });

    app.post("/privacy-requests", async (request, reply) => {
      requireCsrf(request);
      const user = await service.authenticate(sessionToken(request));
      return reply.status(201).send({
        request: await service.createPrivacyRequest(user, privacyRequestBody.parse(request.body)),
      });
    });

    app.post("/onboarding/complete", async (request, reply) => {
      requireCsrf(request);
      const user = await service.authenticate(sessionToken(request));
      await service.completeOnboarding(user.id);
      return reply.status(204).send();
    });

    app.get("/export", async (request, reply) => {
      const user = await service.authenticate(sessionToken(request));
      reply.header("Content-Disposition", 'attachment; filename="mila-account-export.json"');
      return { exportedAt: new Date().toISOString(), data: await service.exportAccount(user.id) };
    });

    app.delete("/account", async (request, reply) => {
      requireCsrf(request);
      deleteBody.parse(request.body);
      const user = await service.authenticate(sessionToken(request));
      await service.deleteAccount(user.id);
      clearSession(reply);
      return reply.status(204).send();
    });
  };
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
