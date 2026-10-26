import { Router } from "express";
import { ActivityController } from "./activity.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const activityRouter = Router();

activityRouter.use(requireAuth);

activityRouter.get("/stream", ActivityController.streamEvents);
activityRouter.get("/", ActivityController.getActivity);

export { activityRouter };
