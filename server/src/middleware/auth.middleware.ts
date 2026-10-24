import { Request, Response, NextFunction } from "express";
import { AuthService } from "../modules/auth/auth.service";
import { UnauthorizedError, ForbiddenError } from "../lib/errors";
import { prisma } from "../lib/prisma";
import { Role } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      auth?: AuthContext;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token: string | undefined;

    // Prioritize explicit Authorization header (for tab-isolated sessions)
    if (req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
    }

    // Fall back to shared cookie if header is not present
    if (!token) {
      token = req.cookies?.token;
    }

    if (!token) {
      throw new UnauthorizedError("Authentication token is missing");
    }

    const payload = AuthService.verifyToken(token);

    // CSRF check on state-changing methods if cookie-based
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.cookies?.token) {
      const origin = req.headers.origin;
      const xRequestedWith = req.headers["x-requested-with"];
      const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";

      if (origin && origin !== allowedOrigin && !xRequestedWith) {
        throw new ForbiddenError("Cross-Site Request Forgery validation failed");
      }
    }

    // Load active membership for the organization specified in the token
    const membership = payload.organizationId
      ? await prisma.organizationMembership.findFirst({
          where: {
            userId: payload.userId,
            organizationId: payload.organizationId,
          },
          include: {
            user: true,
          },
        })
      : null;

    if (!membership) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new UnauthorizedError("User account no longer exists");
      }

      // Allow auth management, notifications, and organization creation/joining through so user can onboard or recover even if active organization is deleted/unselected
      if (
        req.baseUrl.includes("/auth") ||
        req.baseUrl.includes("/notifications") ||
        (req.baseUrl.includes("/organizations") &&
          req.method === "POST" &&
          (req.path === "/" || req.path === "/join" || req.path === "")) ||
        req.path === "/me" ||
        req.path === "/logout" ||
        req.path === "/switch-org"
      ) {
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
        };
        req.auth = {
          userId: user.id,
          organizationId: "",
          role: Role.MEMBER,
        };
        return next();
      }

      throw new UnauthorizedError("Active organization not found or deleted");
    }

    req.user = {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
    };

    req.auth = {
      userId: membership.userId,
      organizationId: membership.organizationId,
      role: membership.role,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export function requireOrgRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(new UnauthorizedError("Authentication required"));
    }

    if (!allowedRoles.includes(req.auth.role)) {
      return next(
        new ForbiddenError(
          `Action requires one of the following roles: ${allowedRoles.join(", ")}`
        )
      );
    }

    next();
  };
}
