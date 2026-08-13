import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { AppError } from "../errors/app-error.js";
import type { MetricsRegistry } from "../observability/metrics.js";

export function installErrorHandler(app: FastifyInstance, metrics?: MetricsRegistry): void {
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: { code: "NOT_FOUND", message: "Route not found" },
      requestId: request.id,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      metrics?.recordError(error.code);
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
        requestId: request.id,
      });
    }

    if (error instanceof ZodError) {
      metrics?.recordError("VALIDATION_ERROR");
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid request", details: error.flatten() },
        requestId: request.id,
      });
    }

    const candidate = error as { statusCode?: unknown; message?: unknown };
    const numericStatus = Number(candidate.statusCode);
    const statusCode =
      Number.isInteger(numericStatus) && numericStatus >= 400 && numericStatus < 500
        ? numericStatus
        : 500;
    if (statusCode >= 500)
      request.log.error(
        {
          event: "unhandled_request_error",
          requestId: request.id,
          route: request.routeOptions.url || "unmatched",
          errorType: error instanceof Error ? error.name : "UnknownError",
        },
        "Unhandled request error",
      );
    metrics?.recordError(statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");

    return reply.status(statusCode).send({
      error: {
        code: statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
        message:
          statusCode >= 500
            ? "An internal error occurred"
            : typeof candidate.message === "string"
              ? candidate.message
              : "Invalid request",
      },
      requestId: request.id,
    });
  });
}
