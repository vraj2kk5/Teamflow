import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service";
import { UnauthorizedError } from "../../lib/errors";

export class DashboardController {
  static async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth;
      if (!auth) throw new UnauthorizedError();

      const metrics = await DashboardService.getMetrics(
        auth.organizationId,
        auth.userId,
        auth.role
      );

      res.status(200).json({ data: metrics });
    } catch (err) {
      next(err);
    }
  }
}
