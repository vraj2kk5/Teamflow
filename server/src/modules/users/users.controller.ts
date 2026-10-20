import { Request, Response, NextFunction } from "express";
import { UsersService } from "./users.service";
import { updateProfileSchema } from "./users.schema";
import { UnauthorizedError } from "../../lib/errors";

function param(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0];
  return val || "";
}

export class UsersController {
  static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth;
      if (!auth) throw new UnauthorizedError();

      const targetId = param(req.params.id) === "me" ? auth.userId : param(req.params.id);
      const profile = await UsersService.getUserProfile(targetId, auth.organizationId);

      res.status(200).json({ data: profile });
    } catch (err) {
      next(err);
    }
  }

  static async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth;
      if (!auth) throw new UnauthorizedError();

      const validated = updateProfileSchema.parse(req.body);
      const updated = await UsersService.updateMyProfile(auth.userId, validated);

      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async getUserIssues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const targetId = param(req.params.id) === "me" ? auth.userId : param(req.params.id);
      const relation = req.query.relation === "reported" ? "reported" : "assigned";

      const issues = await UsersService.getUserIssues(
        targetId,
        auth.organizationId,
        relation
      );

      res.status(200).json({ data: issues });
    } catch (err) {
      next(err);
    }
  }

  static async getUserActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth!;
      const targetId = param(req.params.id) === "me" ? auth.userId : param(req.params.id);

      const activity = await UsersService.getUserActivity(targetId, auth.organizationId);

      res.status(200).json({ data: activity });
    } catch (err) {
      next(err);
    }
  }
}
