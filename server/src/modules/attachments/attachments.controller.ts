import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AttachmentsService } from "./attachments.service";
import { BadRequestError, UnauthorizedError } from "../../lib/errors";

function param(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0];
  return val || "";
}

// Multer memory storage with 105MB max buffer limit (to accommodate 100MB videos)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 105 * 1024 * 1024,
    files: 1,
  },
});

export const attachmentUploadMiddleware = upload.single("file");

export class AttachmentsController {
  static async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth;
      if (!auth) throw new UnauthorizedError();

      const issueId = param(req.params.id);
      if (!req.file) {
        throw new BadRequestError("No file uploaded in form field 'file'");
      }

      const duration = req.body.durationSeconds
        ? parseFloat(req.body.durationSeconds)
        : undefined;

      const attachment = await AttachmentsService.uploadAttachment(
        issueId,
        auth.organizationId,
        auth.userId,
        req.file,
        duration
      );

      res.status(201).json({ data: attachment });
    } catch (err) {
      next(err);
    }
  }

  static async getIssueAttachments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const issueId = param(req.params.id);
      const attachments = await AttachmentsService.getIssueAttachments(
        issueId,
        auth.organizationId
      );
      res.status(200).json({ data: attachments });
    } catch (err) {
      next(err);
    }
  }

  static async getAccessUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const attachmentId = param(req.params.id);
      const access = await AttachmentsService.getAccessUrl(
        attachmentId,
        auth.organizationId
      );
      res.status(200).json({ data: access });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const attachmentId = param(req.params.id);
      const result = await AttachmentsService.deleteAttachment(
        attachmentId,
        auth.organizationId,
        auth.userId,
        auth.role
      );
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
