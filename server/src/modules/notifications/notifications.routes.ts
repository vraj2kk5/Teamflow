import { Router } from "express";
import { NotificationsController } from "./notifications.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", NotificationsController.getNotifications);
notificationsRouter.patch("/:id/read", NotificationsController.markAsRead);
notificationsRouter.post("/read-all", NotificationsController.markAllAsRead);

export { notificationsRouter };
