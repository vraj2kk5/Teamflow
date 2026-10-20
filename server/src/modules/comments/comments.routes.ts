import { Router } from "express";
import { CommentsController } from "./comments.controller";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireIssueAccess } from "../../middleware/policies";

const commentsRouter = Router();

commentsRouter.use(requireAuth);

// Direct comment updates and deletes
commentsRouter.patch("/:id", CommentsController.updateComment);
commentsRouter.delete("/:id", CommentsController.deleteComment);

export { commentsRouter };
