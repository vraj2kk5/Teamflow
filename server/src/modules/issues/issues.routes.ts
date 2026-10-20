import { Router } from "express";
import { IssuesController } from "./issues.controller";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireIssueAccess } from "../../middleware/policies";

const issuesRouter = Router();

issuesRouter.use(requireAuth);

issuesRouter.get("/", IssuesController.getIssues);
issuesRouter.post("/", IssuesController.createIssue);

issuesRouter.get("/:id", requireIssueAccess, IssuesController.getIssue);
issuesRouter.patch("/:id", requireIssueAccess, IssuesController.updateIssue);
issuesRouter.patch("/:id/status", requireIssueAccess, IssuesController.updateStatus);
issuesRouter.delete("/:id", requireIssueAccess, IssuesController.deleteIssue);

issuesRouter.get("/:id/activity", requireIssueAccess, IssuesController.getActivity);

export { issuesRouter };
