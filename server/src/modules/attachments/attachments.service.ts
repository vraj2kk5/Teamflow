import FileType from "file-type";
import crypto from "crypto";
import path from "path";
import { prisma } from "../../lib/prisma";
import { getStorageDriver } from "../../lib/storage";
import {
  BadRequestError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  NotFoundError,
  ForbiddenError,
} from "../../lib/errors";
import { AttachmentKind, Role } from "@prisma/client";
import { logger } from "../../lib/logger";
import { env } from "../../config/env";

interface AllowedMimeConfig {
  kind: AttachmentKind;
  maxBytes: number;
}

const ALLOWED_MIMES: Record<string, AllowedMimeConfig> = {
  // Audio
  "audio/webm": { kind: AttachmentKind.AUDIO, maxBytes: env.MAX_AUDIO_MB * 1024 * 1024 },
  "audio/ogg": { kind: AttachmentKind.AUDIO, maxBytes: env.MAX_AUDIO_MB * 1024 * 1024 },
  "audio/mp4": { kind: AttachmentKind.AUDIO, maxBytes: env.MAX_AUDIO_MB * 1024 * 1024 },
  "audio/mpeg": { kind: AttachmentKind.AUDIO, maxBytes: env.MAX_AUDIO_MB * 1024 * 1024 },
  "audio/wav": { kind: AttachmentKind.AUDIO, maxBytes: env.MAX_AUDIO_MB * 1024 * 1024 },
  "audio/x-wav": { kind: AttachmentKind.AUDIO, maxBytes: env.MAX_AUDIO_MB * 1024 * 1024 },

  // Video
  "video/webm": { kind: AttachmentKind.VIDEO, maxBytes: env.MAX_VIDEO_MB * 1024 * 1024 },
  "video/mp4": { kind: AttachmentKind.VIDEO, maxBytes: env.MAX_VIDEO_MB * 1024 * 1024 },
  "video/x-matroska": { kind: AttachmentKind.VIDEO, maxBytes: env.MAX_VIDEO_MB * 1024 * 1024 },

  // Images
  "image/png": { kind: AttachmentKind.IMAGE, maxBytes: env.MAX_IMAGE_MB * 1024 * 1024 },
  "image/jpeg": { kind: AttachmentKind.IMAGE, maxBytes: env.MAX_IMAGE_MB * 1024 * 1024 },
  "image/webp": { kind: AttachmentKind.IMAGE, maxBytes: env.MAX_IMAGE_MB * 1024 * 1024 },
  "image/gif": { kind: AttachmentKind.IMAGE, maxBytes: env.MAX_IMAGE_MB * 1024 * 1024 },
};

export class AttachmentsService {
  static async uploadAttachment(
    issueId: string,
    orgId: string,
    userId: string,
    file: Express.Multer.File,
    durationSeconds?: number,
    userRole?: Role
  ) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestError("Empty file uploaded");
    }

    // 1. Verify Issue exists & check max attachments limit (max 10)
    const issue = await prisma.issue.findFirst({
      where: { id: issueId, organizationId: orgId },
      include: {
        _count: { select: { attachments: true } },
      },
    });

    if (!issue) {
      throw new NotFoundError("Issue not found in current organization");
    }

    // Permission check:
    // Only the user who reported the bug (or admin) can add attachments to it.
    if (issue.type === "BUG") {
      const isReporter = issue.reporterId === userId;
      const isAdmin = userRole === Role.ADMIN;
      if (!isReporter && !isAdmin) {
        throw new ForbiddenError(
          "Only the user who reported this bug can add attachments to it"
        );
      }
    } else {
      // For tasks, only the reporter, assignee, or admin can add attachments
      const isReporter = issue.reporterId === userId;
      const isAssignee = issue.assigneeId === userId;
      const isAdmin = userRole === Role.ADMIN;
      if (!isReporter && !isAssignee && !isAdmin) {
        throw new ForbiddenError(
          "You do not have permission to add attachments to this task"
        );
      }
    }

    if (issue._count.attachments >= 10) {
      throw new BadRequestError("Issue attachment limit reached (maximum 10 files per issue)");
    }

    // 2. Magic-byte sniffing: Do not trust client-supplied Content-Type or extension
    const detected = await FileType.fromBuffer(file.buffer);
    const clientMime = file.mimetype ? file.mimetype.split(";")[0].toLowerCase().trim() : "";

    // Reject SVG files explicitly
    if (clientMime.includes("svg") || (detected && detected.mime.includes("svg"))) {
      throw new UnsupportedMediaTypeError("SVG files are not permitted for security reasons");
    }

    if (!detected) {
      throw new UnsupportedMediaTypeError(
        "Could not verify valid media format from file content. Disguised or corrupt files are rejected."
      );
    }

    let resolvedMime: string = detected.mime;

    // WebM recordings from MediaRecorder share EBML container format and are detected as video/webm or video/x-matroska
    if (clientMime.startsWith("audio/webm") && (resolvedMime === "video/webm" || resolvedMime === "video/x-matroska")) {
      resolvedMime = "audio/webm";
    }

    const mimeConfig = ALLOWED_MIMES[resolvedMime];

    if (!mimeConfig) {
      throw new UnsupportedMediaTypeError(
        `Unsupported media type: ${resolvedMime}. Allowed formats: webm, mp4, ogg, wav, png, jpeg, webp, gif`
      );
    }

    // 3. Enforce size limit
    if (file.buffer.length > mimeConfig.maxBytes) {
      const maxMb = Math.round(mimeConfig.maxBytes / (1024 * 1024));
      throw new PayloadTooLargeError(
        `File size (${(file.buffer.length / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed ${maxMb} MB for ${mimeConfig.kind.toLowerCase()}`
      );
    }

    // 4. Generate safe server storage key
    const fileExt = detected?.ext || path.extname(file.originalname).replace(/^\./, "") || "bin";
    const storageKey = `org/${orgId}/issues/${issueId}/${crypto.randomUUID()}.${fileExt}`;

    // Clean original filename for display
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 150);

    const storage = getStorageDriver();

    // 5. Write to storage driver first
    try {
      await storage.put(storageKey, file.buffer, resolvedMime);
    } catch (err) {
      logger.error("Storage driver write failed", err);
      throw new BadRequestError("Failed to store media file in object storage");
    }

    // 6. Persist Attachment row and ActivityLog in transaction
    try {
      return await prisma.$transaction(async (tx) => {
        const attachment = await tx.attachment.create({
          data: {
            issueId,
            uploadedById: userId,
            originalFilename: sanitizedName,
            mimeType: resolvedMime,
            kind: mimeConfig.kind,
            sizeBytes: file.buffer.length,
            durationSeconds: durationSeconds ? Math.min(3600, Math.max(0, durationSeconds)) : null,
            storageKey,
          },
          include: {
            uploadedBy: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        });

        await tx.activityLog.create({
          data: {
            organizationId: orgId,
            projectId: issue.projectId,
            issueId,
            actorId: userId,
            action: "ATTACHMENT_ADDED",
            metadata: {
              attachmentId: attachment.id,
              kind: attachment.kind,
              filename: attachment.originalFilename,
            },
          },
        });

        return attachment;
      });
    } catch (dbErr) {
      // If DB fails after storage write, delete orphaned storage file (best-effort)
      await storage.delete(storageKey).catch(() => {});
      logger.error("DB write failed after storage write, orphaned object cleaned", dbErr);
      throw dbErr;
    }
  }

  static async getIssueAttachments(issueId: string, orgId: string) {
    const issue = await prisma.issue.findFirst({
      where: { id: issueId, organizationId: orgId },
    });

    if (!issue) {
      throw new NotFoundError("Issue not found");
    }

    return prisma.attachment.findMany({
      where: { issueId },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  static async getAccessUrl(attachmentId: string, orgId: string) {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        issue: true,
      },
    });

    if (!attachment || attachment.issue.organizationId !== orgId) {
      throw new NotFoundError("Attachment not found");
    }

    const storage = getStorageDriver();
    // 10 minutes expiry (600 seconds)
    const accessUrl = await storage.getSignedUrl(attachment.storageKey, 600, attachment.id);

    return {
      accessUrl,
      expiresIn: 600,
      attachment: {
        id: attachment.id,
        filename: attachment.originalFilename,
        mimeType: attachment.mimeType,
        kind: attachment.kind,
      },
    };
  }

  static async deleteAttachment(
    attachmentId: string,
    orgId: string,
    userId: string,
    role: Role
  ) {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        issue: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!attachment || attachment.issue.organizationId !== orgId) {
      throw new NotFoundError("Attachment not found");
    }

    const isUploader = attachment.uploadedById === userId;
    const isReporter = attachment.issue.reporterId === userId;
    const isAdmin = role === Role.ADMIN;

    if (!isUploader && !isReporter && !isAdmin) {
      throw new ForbiddenError(
        "Only the user who reported the bug or added the attachment can delete it"
      );
    }

    const storage = getStorageDriver();
    await storage.delete(attachment.storageKey).catch(() => {});

    return prisma.$transaction(async (tx) => {
      await tx.attachment.delete({
        where: { id: attachmentId },
      });

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          projectId: attachment.issue.projectId,
          issueId: attachment.issueId,
          actorId: userId,
          action: "ATTACHMENT_DELETED",
          metadata: {
            filename: attachment.originalFilename,
          },
        },
      });

      return { success: true };
    });
  }
}
