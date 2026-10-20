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
    let token: string | undefined = req.cookies?.token;

    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
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

    // Load active membership
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        userId: payload.userId,
        organizationId: payload.organizationId,
      },
      include: {
        user: true,
      },
    });

    if (!membership) {
      throw new UnauthorizedError("User is no longer a member of this organization");
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
