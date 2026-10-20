import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "./auth.controller";
import { requireAuth } from "../../middleware/auth.middleware";

const authRouter = Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts, please try again in 15 minutes",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post("/register", authRateLimiter, AuthController.register);
authRouter.post("/login", authRateLimiter, AuthController.login);
authRouter.post("/logout", AuthController.logout);
authRouter.get("/me", requireAuth, AuthController.me);

export { authRouter };
