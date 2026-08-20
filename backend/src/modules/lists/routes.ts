import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import { AuthService } from "../auth/service.js";
import { ListsService } from "./service.js";

const listInput = z.object({
  title: z.string().trim().min(1).max(180),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(120),
  description: z.string().max(10_000).nullable().optional(),
  welcomeMessage: z.string().max(10_000).nullable().optional(),
  childName: z.string().max(120).nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  type: z
    .enum(["BIRTH", "BIRTHDAY", "CHRISTENING", "CHRISTMAS", "WEDDING", "OTHER"])
    .default("BIRTH"),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PROTECTED"]).default("UNLISTED"),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  accessCode: z.string().min(6).max(128).nullable().optional(),
  surpriseMode: z.boolean().default(false),
  hideReservedGifts: z.boolean().default(false),
  showReservationNames: z.boolean().default(false),
  allowIndexing: z.boolean().default(false),
  showProgress: z.boolean().default(true),
  theme: z.string().min(1).max(64).default("default"),
  heroStyle: z.enum(["soft", "cover", "minimal"]).default("soft"),
  fontPair: z.enum(["baloo", "serif", "moderne"]).default("baloo"),
  layout: z.enum(["grid", "list", "magazine"]).default("grid"),
  coverMediaKey: z.null().optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
});
const idParams = z.object({ listId: z.string().uuid() });

export function listRoutes(
  lists: ListsService,
  auth: AuthService,
  config: AppConfig,
): FastifyPluginAsync {
  const token = (request: FastifyRequest) => request.cookies[config.COOKIE_NAME];
  const current = (request: FastifyRequest) => auth.authenticate(token(request));
  const requireCsrf = (request: FastifyRequest) => {
    const cookie = request.cookies[`${config.COOKIE_NAME}_csrf`];
    const header = request.headers["x-csrf-token"];
    const left = Buffer.from(cookie ?? "");
    const right = Buffer.from(typeof header === "string" ? header : "");
    if (!cookie || left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new AppError(403, "CSRF_INVALID", "CSRF validation failed");
    }
  };

  return async (app) => {
    app.get("/lists", async (request) => {
      const user = await current(request);
      return { lists: await lists.listMine(user.id) };
    });

    app.post("/lists", async (request, reply) => {
      requireCsrf(request);
      const user = await current(request);
      const list = await lists.create(
        user.id,
        listInput.parse(request.body),
        request.cookies["mila_partner_attribution"],
      );
      if (request.cookies["mila_partner_attribution"])
        reply.clearCookie("mila_partner_attribution", { path: "/api/v1" });
      return reply.status(201).send({ list });
    });

    app.get("/lists/:listId", async (request) => {
      const user = await current(request);
      return { list: await lists.getForMember(user.id, idParams.parse(request.params).listId) };
    });

    app.patch("/lists/:listId", async (request) => {
      requireCsrf(request);
      const user = await current(request);
      return {
        list: await lists.update(
          user.id,
          idParams.parse(request.params).listId,
          listInput.partial().parse(request.body),
        ),
      };
    });

    app.delete("/lists/:listId", async (request, reply) => {
      requireCsrf(request);
      const user = await current(request);
      await lists.remove(user.id, idParams.parse(request.params).listId);
      return reply.status(204).send();
    });

    app.get("/lists/:listId/lifecycle", async (request) => {
      const user = await current(request);
      return {
        lifecycle: await lists.lifecycleSummary(user.id, idParams.parse(request.params).listId),
      };
    });

    app.post("/lists/:listId/lifecycle/close", async (request) => {
      requireCsrf(request);
      const user = await current(request);
      return { list: await lists.close(user.id, idParams.parse(request.params).listId) };
    });

    app.post("/lists/:listId/lifecycle/archive", async (request) => {
      requireCsrf(request);
      const user = await current(request);
      return { list: await lists.archive(user.id, idParams.parse(request.params).listId) };
    });

    app.post("/lists/:listId/lifecycle/future", async (request, reply) => {
      requireCsrf(request);
      const user = await current(request);
      const input = z
        .object({
          title: z.string().trim().min(2).max(180),
          slug: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .max(120),
          type: z.enum(["BIRTH", "BIRTHDAY", "CHRISTENING", "CHRISTMAS", "WEDDING", "OTHER"]),
          dueDate: z.string().date().nullable().optional(),
        })
        .parse(request.body);
      const list = await lists.createFuture(user.id, idParams.parse(request.params).listId, input);
      return reply.status(201).send({ list });
    });

    app.post("/lists/:listId/invitations", async (request, reply) => {
      requireCsrf(request);
      const user = await current(request);
      const input = z
        .object({ email: z.string().email(), role: z.enum(["CO_OWNER", "EDITOR"]) })
        .parse(request.body);
      const result = await lists.invite(
        user.id,
        idParams.parse(request.params).listId,
        input.email,
        input.role,
      );
      return reply.status(201).send({
        invitation: result.invitation,
        ...(config.APP_ENV === "development" ? { developmentInvitationToken: result.token } : {}),
      });
    });

    app.delete("/lists/:listId/invitations/:invitationId", async (request, reply) => {
      requireCsrf(request);
      const user = await current(request);
      const params = z
        .object({ listId: z.string().uuid(), invitationId: z.string().uuid() })
        .parse(request.params);
      await lists.revokeInvitation(user.id, params.listId, params.invitationId);
      return reply.status(204).send();
    });

    app.delete("/lists/:listId/members/:memberId", async (request, reply) => {
      requireCsrf(request);
      const user = await current(request);
      const params = z
        .object({ listId: z.string().uuid(), memberId: z.string().uuid() })
        .parse(request.params);
      await lists.removeMember(user.id, params.listId, params.memberId);
      return reply.status(204).send();
    });

    app.post("/invitations/accept", async (request) => {
      requireCsrf(request);
      const user = await current(request);
      const { invitationToken } = z
        .object({ invitationToken: z.string().min(32) })
        .parse(request.body);
      return lists.acceptInvitation(user.id, user.email, invitationToken);
    });

    app.get("/public/lists/:slug", async (request) => {
      const { slug } = z.object({ slug: z.string().min(1).max(120) }).parse(request.params);
      return { list: await lists.publicList(slug, request.cookies["mila_list_access"]) };
    });

    app.post(
      "/public/lists/:slug/unlock",
      { config: { rateLimit: { max: 8, timeWindow: 60_000 } } },
      async (request, reply) => {
        const { slug } = z.object({ slug: z.string().min(1).max(120) }).parse(request.params);
        const { accessCode } = z
          .object({ accessCode: z.string().min(6).max(128) })
          .parse(request.body);
        const result = await lists.unlock(slug, accessCode);
        reply.setCookie("mila_list_access", result.grant, {
          path: "/api/v1/public/lists",
          httpOnly: true,
          secure: config.COOKIE_SECURE,
          sameSite: config.COOKIE_SAME_SITE,
          maxAge: 3_600,
        });
        return { unlocked: true };
      },
    );
  };
}
