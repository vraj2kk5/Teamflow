import { Router } from "express";
import { UsersController } from "./users.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.patch("/me", UsersController.updateMe);
usersRouter.get("/:id", UsersController.getProfile);
usersRouter.get("/:id/issues", UsersController.getUserIssues);
usersRouter.get("/:id/activity", UsersController.getUserActivity);

export { usersRouter };
