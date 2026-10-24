import { Request, Response, NextFunction } from "express";
import { NotificationsService } from "./notifications.service";
import { UnauthorizedError } from "../../lib/errors";

export class NotificationsController {
  static async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth?.userId || req.user?.id;
      if (!userId) throw new UnauthorizedError();

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const result = await NotificationsService.getUserNotifications(userId, limit);

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  static async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth?.userId || req.user?.id;
      if (!userId) throw new UnauthorizedError();

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await NotificationsService.markAsRead(id, userId);

      res.status(200).json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }

  static async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.auth?.userId || req.user?.id;
      if (!userId) throw new UnauthorizedError();

      await NotificationsService.markAllAsRead(userId);

      res.status(200).json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  }
}
