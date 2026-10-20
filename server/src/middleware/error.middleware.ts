import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";
import crypto from "crypto";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const requestId = crypto.randomUUID();

  // Handle custom AppError
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[${requestId}] AppError: ${err.message}`, { err, path: req.path });
    }
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Handle Zod Validation Error
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input provided",
        details,
      },
    });
    return;
  }

  // Handle Multer Errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: {
          code: "PAYLOAD_TOO_LARGE",
          message: "Uploaded file exceeds maximum allowed size",
        },
      });
      return;
    }
    res.status(400).json({
      error: {
        code: "UPLOAD_ERROR",
        message: err.message,
      },
    });
    return;
  }

  // Handle Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta.target as string[]).join(", ")
        : "Field";
      res.status(409).json({
        error: {
          code: "CONFLICT",
          message: `${target} already exists`,
        },
      });
      return;
    }

    if (err.code === "P2025") {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Requested resource was not found",
        },
      });
      return;
    }
  }

  // Unexpected internal server error: log with requestId, conceal stack trace
  logger.error(`[${requestId}] Unhandled Server Error on ${req.method} ${req.path}:`, err);

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred. Please try again later.",
      requestId,
    },
  });
}
