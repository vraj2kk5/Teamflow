import { Request, Response, NextFunction } from "express";
import { CommentsService } from "./comments.service";
import { createCommentSchema, updateCommentSchema } from "./comments.schema";

function param(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0];
  return val || "";
}

export class CommentsController {
  static async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const issueId = param(req.params.id);
      const comments = await CommentsService.getComments(
        issueId,
        req.auth!.organizationId
      );
      res.status(200).json({ data: comments });
    } catch (err) {
      next(err);
    }
  }

  static async createComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const issueId = param(req.params.id);
      const validated = createCommentSchema.parse(req.body);
      const comment = await CommentsService.createComment(
        issueId,
        req.auth!.organizationId,
        req.auth!.userId,
        validated
      );
      res.status(201).json({ data: comment });
    } catch (err) {
      next(err);
    }
  }

  static async updateComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const commentId = param(req.params.id);
      const validated = updateCommentSchema.parse(req.body);
      const updated = await CommentsService.updateComment(
        commentId,
        req.auth!.userId,
        validated
      );
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async deleteComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const commentId = param(req.params.id);
      const result = await CommentsService.deleteComment(
        commentId,
        req.auth!.organizationId,
        req.auth!.userId,
        req.auth!.role
      );
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
