import { Router } from "express";
import rateLimit from "express-rate-limit";
import { IssuesController } from "./issues.controller";
import { CommentsController } from "../comments/comments.controller";
import {
  AttachmentsController,
  attachmentUploadMiddleware,
} from "../attachments/attachments.controller";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireIssueAccess } from "../../middleware/policies";

const issuesRouter = Router();

issuesRouter.use(requireAuth);

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 uploads per 15 min
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many uploads, please wait a few minutes before trying again",
    },
  },
});

issuesRouter.get("/", IssuesController.getIssues);
issuesRouter.post("/", IssuesController.createIssue);

issuesRouter.get("/:id", requireIssueAccess, IssuesController.getIssue);
issuesRouter.patch("/:id", requireIssueAccess, IssuesController.updateIssue);
issuesRouter.patch("/:id/status", requireIssueAccess, IssuesController.updateStatus);
issuesRouter.delete("/:id", requireIssueAccess, IssuesController.deleteIssue);

issuesRouter.get("/:id/activity", requireIssueAccess, IssuesController.getActivity);

// Comments on issue
issuesRouter.get("/:id/comments", requireIssueAccess, CommentsController.getComments);
issuesRouter.post("/:id/comments", requireIssueAccess, CommentsController.createComment);

// Attachments on issue
issuesRouter.get("/:id/attachments", requireIssueAccess, AttachmentsController.getIssueAttachments);
issuesRouter.post(
  "/:id/attachments",
  requireIssueAccess,
  uploadLimiter,
  attachmentUploadMiddleware,
  AttachmentsController.upload
);

export { issuesRouter };
