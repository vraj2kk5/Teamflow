import { Request, Response, NextFunction } from "express";
import { IssuesService } from "./issues.service";
import {
  createIssueSchema,
  updateIssueSchema,
  updateIssueStatusSchema,
} from "./issues.schema";
import { UnauthorizedError } from "../../lib/errors";

function param(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0];
  return val || "";
}

export class IssuesController {
  static async getIssues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth;
      if (!auth) throw new UnauthorizedError();

      const result = await IssuesService.getIssues(
        auth.organizationId,
        auth.userId,
        auth.role,
        {
          q: req.query.q as string,
          projectId: req.query.projectId as string,
          status: req.query.status as string,
          priority: req.query.priority as string,
          assigneeId: req.query.assigneeId as string,
          reporterId: req.query.reporterId as string,
          type: req.query.type as string,
          overdue: req.query.overdue as string,
          sort: req.query.sort as string,
          order: req.query.order as "asc" | "desc",
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 15,
        }
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const issueId = param(req.params.id);
      const issue = await IssuesService.getIssueById(issueId, auth.organizationId);
      res.status(200).json({ data: issue });
    } catch (err) {
      next(err);
    }
  }

  static async createIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const validated = createIssueSchema.parse(req.body);
      const issue = await IssuesService.createIssue(
        auth.organizationId,
        auth.userId,
        validated
      );
      res.status(201).json({ data: issue });
    } catch (err) {
      next(err);
    }
  }

  static async updateIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const issueId = param(req.params.id);
      const validated = updateIssueSchema.parse(req.body);
      const updated = await IssuesService.updateIssue(
        issueId,
        auth.organizationId,
        auth.userId,
        validated
      );
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const issueId = param(req.params.id);
      const validated = updateIssueStatusSchema.parse(req.body);
      const updated = await IssuesService.updateStatus(
        issueId,
        auth.organizationId,
        auth.userId,
        validated
      );
      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async deleteIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const issueId = param(req.params.id);
      const result = await IssuesService.deleteIssue(
        issueId,
        auth.organizationId,
        auth.userId
      );
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const issueId = param(req.params.id);
      const activity = await IssuesService.getIssueActivity(
        issueId,
        auth.organizationId
      );
      res.status(200).json({ data: activity });
    } catch (err) {
      next(err);
    }
  }
}
