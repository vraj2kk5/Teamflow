import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { NotFoundError, ForbiddenError } from "../lib/errors";
import { Role } from "@prisma/client";

export async function requireProjectAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) return next(new ForbiddenError("Authentication required"));

    const rawId = req.params.projectId || req.params.id || req.body?.projectId;
    if (!rawId) return next();
    const projectId = Array.isArray(rawId) ? rawId[0] : rawId;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: auth.organizationId,
      },
      include: {
        memberships: true,
      },
    });

    if (!project) {
      return next(new NotFoundError("Project not found in current organization"));
    }

    if (auth.role === Role.MEMBER) {
      const isMember =
        project.memberships.some((m) => m.userId === auth.userId) ||
        project.ownerId === auth.userId;
      if (!isMember) {
        return next(new ForbiddenError("You are not a member of this project"));
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

export async function canManageProject(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) return next(new ForbiddenError("Authentication required"));

    if (auth.role === Role.ADMIN || auth.role === Role.PROJECT_MANAGER) {
      return next();
    }

    const rawId = req.params.id || req.params.projectId;
    const projectId = Array.isArray(rawId) ? rawId[0] : rawId;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: auth.organizationId,
      },
    });

    if (!project) {
      return next(new NotFoundError("Project not found in current organization"));
    }

    if (project.ownerId === auth.userId) {
      return next();
    }

    return next(new ForbiddenError("Only organization Admins or Project Managers can manage this project"));
  } catch (err) {
    next(err);
  }
}

export async function requireIssueAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) return next(new ForbiddenError("Authentication required"));

    const rawId = req.params.id || req.params.issueId;
    if (!rawId) return next();
    const issueId = Array.isArray(rawId) ? rawId[0] : rawId;

    const issue = await prisma.issue.findFirst({
      where: {
        id: issueId,
        organizationId: auth.organizationId,
      },
      include: {
        project: {
          include: {
            memberships: true,
          },
        },
      },
    });

    if (!issue) {
      return next(new NotFoundError("Issue not found in current organization"));
    }

    if (auth.role === Role.MEMBER) {
      const isProjectMember = issue.project.memberships.some(
        (m: { userId: string }) => m.userId === auth.userId
      );
      if (!isProjectMember) {
        return next(new ForbiddenError("You are not a member of this issue's project"));
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}
