
import { Request, Response, NextFunction } from "express";
import { IssuesService } from "./issues.service";
import {
  createIssueSchema,
  updateIssueSchema,
  updateIssueStatusSchema,
} from "./issues.schema";
import path from "path";
import fs from "fs";
import { UnauthorizedError, NotFoundError, ForbiddenError, BadRequestError } from "../../lib/errors";

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

  static async getCodeFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filePathQuery = req.query.path as string;
      if (!filePathQuery || typeof filePathQuery !== "string") {
        throw new BadRequestError("Missing 'path' query parameter");
      }

      const projectRoot = path.resolve(__dirname, "../../../../");
      const normalizedRelative = path.normalize(filePathQuery).replace(/^(\.\.(\/|\\|$))+/, "");
      const fullPath = path.resolve(projectRoot, normalizedRelative);

      if (!fullPath.startsWith(projectRoot)) {
        throw new ForbiddenError("Access outside workspace is restricted");
      }

      if (
        normalizedRelative.includes("node_modules") ||
        normalizedRelative.includes(".git") ||
        path.basename(normalizedRelative).startsWith(".env")
      ) {
        throw new ForbiddenError("Access to internal files is restricted");
      }

      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        throw new NotFoundError(`File "${normalizedRelative}" not found in project repository`);
      }

      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      res.status(200).json({
        data: {
          relativePath: normalizedRelative.replace(/\\/g, "/"),
          fileName: path.basename(normalizedRelative),
          content,
          lineCount: lines.length,
          sizeBytes: Buffer.byteLength(content, "utf-8"),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async downloadCodeFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filePathQuery = req.query.path as string;
      if (!filePathQuery || typeof filePathQuery !== "string") {
        throw new BadRequestError("Missing 'path' query parameter");
      }

      const projectRoot = path.resolve(__dirname, "../../../../");
      const normalizedRelative = path.normalize(filePathQuery).replace(/^(\.\.(\/|\\|$))+/, "");
      const fullPath = path.resolve(projectRoot, normalizedRelative);

      if (!fullPath.startsWith(projectRoot)) {
        throw new ForbiddenError("Access outside workspace is restricted");
      }

      if (
        normalizedRelative.includes("node_modules") ||
        normalizedRelative.includes(".git") ||
        path.basename(normalizedRelative).startsWith(".env")
      ) {
        throw new ForbiddenError("Access to internal files is restricted");
      }

      if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
        throw new NotFoundError(`File "${normalizedRelative}" not found in project repository`);
      }

      res.download(fullPath, path.basename(normalizedRelative));
    } catch (err) {
      next(err);
    }
  }
}
