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

  static async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = req.auth;
      if (!auth) throw new UnauthorizedError();

      const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;

      const analytics = await DashboardService.getAnalytics(
        auth.organizationId,
        auth.userId,
        auth.role,
        days
      );

      res.status(200).json({ data: analytics });
    } catch (err) {
      next(err);
    }
  }
}
