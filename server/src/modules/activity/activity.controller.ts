import { Request, Response, NextFunction } from "express";
import { ActivityService } from "./activity.service";
import { UnauthorizedError } from "../../lib/errors";

export class ActivityController {
  static async getActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth;
      if (!auth) throw new UnauthorizedError();

      const result = await ActivityService.getOrganizationActivity(
        auth.organizationId,
        auth.userId,
        auth.role,
        {
          page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
          pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20,
        }
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
