import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { AppError } from "../errors/app-error.js";

export function installErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: { code: "NOT_FOUND", message: "Route not found" },
      requestId: request.id,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
        requestId: request.id,
      });
    }

    if (error instanceof ZodError) {
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
    if (statusCode >= 500) request.log.error({ err: error }, "Unhandled request error");

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
