import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error.middleware";
import { authRouter } from "./modules/auth/auth.routes";
import { orgsRouter } from "./modules/orgs/orgs.routes";
import { projectsRouter } from "./modules/projects/projects.routes";
import { issuesRouter } from "./modules/issues/issues.routes";
import { commentsRouter } from "./modules/comments/comments.routes";
import { attachmentsRouter } from "./modules/attachments/attachments.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { usersRouter } from "./modules/users/users.routes";
import { activityRouter } from "./modules/activity/activity.routes";
import { getStorageDriver, LocalDiskDriver } from "./lib/storage";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";

export const app: Express = express();

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Parsers
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health Check
app.get("/api/health", async (req: Request, res: Response) => {
  let dbStatus = "connected";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = "disconnected";
    logger.error("Health check DB ping failed", err);
  }

  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    storageDriver: env.STORAGE_DRIVER,
  });
});

// Stream token-authorized local media files with HTTP 206 Range support
app.get("/api/files/:token", async (req: Request, res: Response, next) => {
  try {
    const storage = getStorageDriver();
    if (!(storage instanceof LocalDiskDriver)) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "Local file driver not active" } });
      return;
    }

    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    if (!token) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "Token is required" } });
      return;
    }

    const payload = storage.verifyToken(token);
    if (!payload) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Media link expired or invalid signature" } });
      return;
    }

    // Range parsing
    const rangeHeader = req.headers.range;
    let range: { start: number; end?: number } | undefined;

    if (rangeHeader && rangeHeader.startsWith("bytes=")) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : undefined;
      range = { start, end };
    }

    const result = await storage.getStream(payload.key, range);

    // Allowed media mime types
    const allowedTypes = [
      "audio/webm",
      "audio/ogg",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "video/webm",
      "video/mp4",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
    ];

    const safeMime = allowedTypes.includes(result.contentType)
      ? result.contentType
      : "application/octet-stream";

    res.setHeader("Content-Type", safeMime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");

    if (range) {
      res.status(206);
      res.setHeader(
        "Content-Range",
        `bytes ${range.start}-${range.end ?? result.contentLength - 1}/${result.contentLength}`
      );
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", result.contentLength);
    } else {
      res.status(200);
      res.setHeader("Content-Length", result.contentLength);
      res.setHeader("Accept-Ranges", "bytes");
    }

    result.stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

// Feature Routes
app.use("/api/auth", authRouter);
app.use("/api/organizations", orgsRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/issues", issuesRouter);
app.use("/api/attachments", attachmentsRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/users", usersRouter);
app.use("/api/activity", activityRouter);

// Central error handler
app.use(errorHandler);
