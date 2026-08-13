import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../common/errors/app-error.js";
import type { AppConfig } from "../../config/env.js";
import type { AuthService } from "../auth/service.js";
import { AdminService } from "./service.js";

export function adminRoutes(
  service: AdminService,
  auth: AuthService,
  config: AppConfig,
): FastifyPluginAsync {
  const staff = async (request: FastifyRequest) => {
    const user = await auth.authenticate(request.cookies[config.COOKIE_NAME]);
    if (!user.roles.some((role) => ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(role)))
      throw new AppError(403, "STAFF_REQUIRED", "Staff access required");
    return user;
  };
  const csrf = (request: FastifyRequest) => {
    const cookie = request.cookies[`${config.COOKIE_NAME}_csrf`] ?? "";
    const header =
      typeof request.headers["x-csrf-token"] === "string" ? request.headers["x-csrf-token"] : "";
    const left = Buffer.from(cookie);
    const right = Buffer.from(header);
    if (!cookie || left.length !== right.length || !timingSafeEqual(left, right))
      throw new AppError(403, "CSRF_INVALID", "CSRF validation failed");
  };
  const page = (request: FastifyRequest) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(200).default(100),
      })
      .parse(request.query);
    return { skip: (query.page - 1) * query.limit, take: query.limit };
  };
  return async (app) => {
    app.get("/admin/overview", async (request) => {
      await staff(request);
      return jsonSafe(await service.overview());
    });
    app.get("/admin/lists", async (request) => {
      await staff(request);
      const value = page(request);
      return jsonSafe({ lists: await service.lists(value.skip, value.take) });
    });
    app.get("/admin/users", async (request) => {
      await staff(request);
      const value = page(request);
      return jsonSafe({ users: await service.users(value.skip, value.take) });
    });
    app.get("/admin/reports", async (request) => {
      await staff(request);
      const value = page(request);
      return jsonSafe({ reports: await service.reports(value.skip, value.take) });
    });
    app.get("/admin/audit-log", async (request) => {
      await staff(request);
      const value = page(request);
      return jsonSafe({ entries: await service.audit(value.skip, value.take) });
    });
    app.get("/admin/risk-reviews", async (request) => {
      await staff(request);
      const value = page(request);
      return jsonSafe({ risks: await service.risks(value.skip, value.take) });
    });
    app.get("/admin/partners", async (request) => {
      await staff(request);
      const value = page(request);
      return jsonSafe({ partners: await service.partners(value.skip, value.take) });
    });
    app.post("/admin/risk-reviews/:riskId/review", async (request) => {
      csrf(request);
      const user = await staff(request);
      const { riskId } = z.object({ riskId: z.string().uuid() }).parse(request.params);
      const input = z
        .object({
          status: z.enum(["RESOLVED", "DISMISSED"]),
          resolution: z.string().trim().min(3).max(1_000),
        })
        .parse(request.body);
      return {
        risk: await service.reviewRisk(user.id, request.id, riskId, input.status, input.resolution),
      };
    });
    app.post("/admin/moderation", async (request) => {
      csrf(request);
      const user = await staff(request);
      const input = z
        .object({
          action: z.enum([
            "suspend_list",
            "restore_list",
            "hide_item",
            "show_item",
            "resolve_report",
            "dismiss_report",
            "review_report",
            "suspend_user",
            "restore_user",
          ]),
          targetId: z.string().uuid(),
          reason: z.string().trim().min(3).max(1000),
        })
        .parse(request.body);
      return service.moderate(user.id, request.id, input.action, input.targetId, input.reason);
    });
  };
}
function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)),
  ) as T;
}
