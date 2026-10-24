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
import { notificationsRouter } from "./modules/notifications/notifications.routes";
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

// Root endpoint guidance page
app.get("/", (_req: Request, res: Response) => {
  res.status(200).send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>TeamFlow API Server</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 480px; width: 90%; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); text-align: center; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: #064e3b; color: #6ee7b7; margin-bottom: 16px; border: 1px solid #059669; }
        h1 { margin: 0 0 8px; font-size: 22px; }
        p { color: #94a3b8; font-size: 14px; margin: 0 0 24px; line-height: 1.5; }
        .btn { display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
        .btn:hover { background: #4338ca; }
        .links { margin-top: 24px; font-size: 12px; color: #64748b; }
        .links a { color: #818cf8; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">● API Server Online</div>
        <h1>TeamFlow Backend API</h1>
        <p>This is the backend data & authentication engine (port 5000). The user interface is running on the frontend server.</p>
        <a href="http://localhost:3000" class="btn">Open TeamFlow App (localhost:3000) &rarr;</a>
        <div class="links">
          Health Check: <a href="/api/health">/api/health</a> &bull; Database: <a href="http://localhost:5555">Prisma Studio (:5555)</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

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
app.use("/api/notifications", notificationsRouter);

// Central error handler
app.use(errorHandler);
