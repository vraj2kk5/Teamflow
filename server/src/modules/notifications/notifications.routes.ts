import { Router } from "express";
import { NotificationsController } from "./notifications.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/", NotificationsController.getNotifications);

// Support both POST, PATCH and PUT for mark-all-read and single mark-read
notificationsRouter.post("/read-all", NotificationsController.markAllAsRead);
notificationsRouter.patch("/read-all", NotificationsController.markAllAsRead);
notificationsRouter.put("/read-all", NotificationsController.markAllAsRead);

notificationsRouter.patch("/:id/read", NotificationsController.markAsRead);
notificationsRouter.post("/:id/read", NotificationsController.markAsRead);
notificationsRouter.put("/:id/read", NotificationsController.markAsRead);

export { notificationsRouter };
