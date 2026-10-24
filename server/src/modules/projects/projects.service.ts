import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { NotFoundError, BadRequestError } from "../../lib/errors";
import { CreateProjectInput, UpdateProjectInput } from "./projects.schema";
import { Role, Prisma } from "@prisma/client";

export class ProjectsService {
  private static generateInviteCode(): string {
    return `PRJ-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  }

  static async getProjects(
    orgId: string,
    userId: string,
    role: Role,
    query: {
      q?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 10));
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProjectWhereInput = {
      organizationId: orgId,
    };

    // Scoping: Regular members see only projects they are members of (or created).
    // Admins and Project Managers can view and manage organization projects.
    if (role === Role.MEMBER) {
      where.OR = [
        { ownerId: userId },
        { memberships: { some: { userId } } },
      ];
    }

    if (query.q) {
      where.name = { contains: query.q, mode: "insensitive" };
    }

    if (query.status) {
      where.status = query.status as Prisma.EnumProjectStatusFilter;
    }

    const [total, rawProjects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          owner: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatarUrl: true,
                  memberships: {
                    where: { organizationId: orgId },
                    select: { role: true },
                  },
                },
              },
            },
          },
          issues: {
            select: {
              id: true,
              status: true,
              type: true,
              dueDate: true,
            },
          },
        },
      }),
    ]);

    const now = new Date();

    const data = rawProjects.map((project) => {
      const totalIssues = project.issues.length;
      const doneIssues = project.issues.filter((i) => i.status === "DONE").length;
      const completionPercentage =
        totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;

      const openBugs = project.issues.filter(
        (i) => i.type === "BUG" && i.status !== "DONE"
      ).length;

      const overdueCount = project.issues.filter(
        (i) => i.dueDate && new Date(i.dueDate) < now && i.status !== "DONE"
      ).length;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { issues, ...rest } = project;

      return {
        ...rest,
        stats: {
          totalIssues,
          doneIssues,
          completionPercentage,
          openBugs,
          overdueCount,
        },
      };
    });

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  static async getProjectById(projectId: string, orgId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                jobTitle: true,
                memberships: {
                  where: { organizationId: orgId },
                  select: { role: true },
                },
              },
            },
          },
        },
        issues: {
          select: {
            id: true,
            status: true,
            type: true,
            priority: true,
            dueDate: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    // Auto-generate invite code if legacy project lacked one
    if (!project.inviteCode) {
      const newCode = this.generateInviteCode();
      await prisma.project.update({
        where: { id: project.id },
        data: { inviteCode: newCode },
      });
      project.inviteCode = newCode;
    }

    const now = new Date();
    const totalIssues = project.issues.length;
    const doneIssues = project.issues.filter((i) => i.status === "DONE").length;
    const completionPercentage =
      totalIssues > 0 ? Math.round((doneIssues / totalIssues) * 100) : 0;
    const openBugs = project.issues.filter(
      (i) => i.type === "BUG" && i.status !== "DONE"
    ).length;
    const overdueCount = project.issues.filter(
      (i) => i.dueDate && new Date(i.dueDate) < now && i.status !== "DONE"
    ).length;

    return {
      ...project,
      stats: {
        totalIssues,
        doneIssues,
        completionPercentage,
        openBugs,
        overdueCount,
      },
    };
  }

  static async createProject(
    orgId: string,
    creatorId: string,
    input: CreateProjectInput
  ) {
    return prisma.$transaction(async (tx) => {
      const inviteCode = this.generateInviteCode();
      const project = await tx.project.create({
        data: {
          organizationId: orgId,
          name: input.name,
          description: input.description,
          status: input.status,
          ownerId: creatorId,
          inviteCode,
        },
      });

      // Add creator as first project member
      await tx.projectMembership.create({
        data: {
          projectId: project.id,
          userId: creatorId,
        },
      });

      // Audit log
      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          projectId: project.id,
          actorId: creatorId,
          action: "PROJECT_CREATED",
          metadata: { name: project.name, inviteCode },
        },
      });

      return project;
    });
  }

  static async updateProject(
    projectId: string,
    orgId: string,
    actorId: string,
    input: UpdateProjectInput
  ) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          name: input.name,
          description: input.description,
          status: input.status,
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          projectId,
          actorId,
          action: "PROJECT_UPDATED",
          metadata: { changes: input },
        },
      });

      return updated;
    });
  }

  static async deleteProject(projectId: string, orgId: string, actorId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    return prisma.$transaction(async (tx) => {
      await tx.project.delete({
        where: { id: projectId },
      });

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          actorId,
          action: "PROJECT_DELETED",
          metadata: { projectName: project.name },
        },
      });

      return { success: true };
    });
  }

  static async regenerateInviteCode(
    projectId: string,
    orgId: string,
    actorId: string
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const newCode = this.generateInviteCode();

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { inviteCode: newCode },
      select: { id: true, inviteCode: true },
    });

    await prisma.activityLog.create({
      data: {
        organizationId: orgId,
        projectId,
        actorId,
        action: "PROJECT_UPDATED",
        metadata: { action: "REGENERATE_INVITE_CODE", inviteCode: newCode },
      },
    });

    return updated;
  }

  static async joinProjectByInviteCode(
    orgId: string,
    userId: string,
    inviteCode: string
  ) {
    const normalizedCode = inviteCode.trim().toUpperCase();

    const project = await prisma.project.findFirst({
      where: {
        organizationId: orgId,
        inviteCode: normalizedCode,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        memberships: true,
      },
    });

    if (!project) {
      throw new NotFoundError(
        "Invalid project invitation code or project does not exist in your organization"
      );
    }

    const alreadyMember =
      project.ownerId === userId ||
      project.memberships.some((m) => m.userId === userId);

    if (!alreadyMember) {
      await prisma.projectMembership.create({
        data: {
          projectId: project.id,
          userId,
        },
      });

      await prisma.activityLog.create({
        data: {
          organizationId: orgId,
          projectId: project.id,
          actorId: userId,
          action: "MEMBER_ADDED",
          metadata: { userId, viaInviteCode: true },
        },
      });
    }

    return {
      id: project.id,
      name: project.name,
      inviteCode: project.inviteCode,
      alreadyMember,
    };
  }

  static async addProjectMember(
    projectId: string,
    orgId: string,
    targetUserId: string,
    actorId?: string
  ) {
    // Verify user is an organization member
    const orgMembership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: orgId,
        },
      },
    });

    if (!orgMembership) {
      throw new BadRequestError("User is not a member of this organization");
    }

    const existing = await prisma.projectMembership.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    const membership = await prisma.projectMembership.create({
      data: {
        projectId,
        userId: targetUserId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    if (actorId) {
      await prisma.activityLog.create({
        data: {
          organizationId: orgId,
          projectId,
          actorId,
          action: "MEMBER_ADDED",
          metadata: { userId: targetUserId },
        },
      });
    }

    return membership;
  }

  static async removeProjectMember(projectId: string, targetUserId: string) {
    const existing = await prisma.projectMembership.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("Member is not assigned to this project");
    }

    return prisma.$transaction(async (tx) => {
      await tx.projectMembership.delete({
        where: { id: existing.id },
      });

      // Clear assignee on any issues in this project
      await tx.issue.updateMany({
        where: {
          projectId,
          assigneeId: targetUserId,
        },
        data: {
          assigneeId: null,
        },
      });

      return { success: true };
    });
  }

  static async getProjectActivity(projectId: string, orgId: string) {
    return prisma.activityLog.findMany({
      where: {
        projectId,
        organizationId: orgId,
      },
      include: {
        actor: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        issue: {
          select: { id: true, key: true, title: true, type: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }
}
