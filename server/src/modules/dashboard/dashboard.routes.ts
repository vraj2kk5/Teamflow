import { Router } from "express";
import { DashboardController } from "./dashboard.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/", DashboardController.getMetrics);
dashboardRouter.get("/analytics", DashboardController.getAnalytics);

export { dashboardRouter };
