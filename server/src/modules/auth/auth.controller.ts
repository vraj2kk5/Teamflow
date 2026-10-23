import { Request, Response, NextFunction } from "express";
import { AuthService } from "./auth.service";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./auth.schema";
import { env } from "../../config/env";
import { UnauthorizedError } from "../../lib/errors";

export class AuthController {
  private static setAuthCookie(res: Response, token: string, rememberMe = false): void {
    const maxAge = rememberMe
      ? 30 * 24 * 60 * 60 * 1000 // 30 days
      : 24 * 60 * 60 * 1000; // 1 day

    res.cookie("token", token, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAMESITE,
      maxAge,
      path: "/",
    });
  }

  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = registerSchema.parse(req.body);
      const result = await AuthService.register(validated);

      AuthController.setAuthCookie(res, result.token, validated.rememberMe);

      res.status(201).json({
        data: {
          user: result.user,
          organization: result.organization,
          role: result.role,
          token: result.token,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const result = await AuthService.login(validated);

      AuthController.setAuthCookie(res, result.token, validated.rememberMe);

      res.status(200).json({
        data: {
          user: result.user,
          organization: result.organization,
          role: result.role,
          token: result.token,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie("token", {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAMESITE,
      path: "/",
    });

    res.status(200).json({
      data: {
        message: "Logged out successfully",
      },
    });
  }

  static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = (req as unknown as { auth?: { userId: string; organizationId: string } }).auth;
      if (!auth?.userId) {
        throw new UnauthorizedError("Not authenticated");
      }

      const result = await AuthService.getMe(auth.userId, auth.organizationId);

      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = forgotPasswordSchema.parse(req.body);
      const result = await AuthService.forgotPassword(validated);

      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = resetPasswordSchema.parse(req.body);
      const result = await AuthService.resetPassword(validated);

      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const auth = (req as unknown as { auth?: { userId: string } }).auth;
      if (!auth?.userId) {
        throw new UnauthorizedError("Not authenticated");
      }

      const validated = changePasswordSchema.parse(req.body);
      const result = await AuthService.changePassword(auth.userId, validated);

      res.status(200).json({
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
