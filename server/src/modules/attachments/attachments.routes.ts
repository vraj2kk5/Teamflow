import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AttachmentsController } from "./attachments.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const attachmentsRouter = Router();

attachmentsRouter.use(requireAuth);

const accessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many access token requests, please try again later",
    },
  },
});

attachmentsRouter.get("/:id/access", accessLimiter, AttachmentsController.getAccessUrl);
attachmentsRouter.delete("/:id", AttachmentsController.delete);

export { attachmentsRouter };
