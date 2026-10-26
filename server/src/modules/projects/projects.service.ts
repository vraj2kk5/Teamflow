import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { NotFoundError, BadRequestError } from "../../lib/errors";
import { CreateProjectInput, UpdateProjectInput } from "./projects.schema";
import { Role, Prisma } from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { EmailService } from "../../lib/email";

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
      allOrgProjects?: string;
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
    // For bug reporting or org project pickers (allOrgProjects === "true"), allow members to select any project in their organization.
    if (role === Role.MEMBER && query.allOrgProjects !== "true") {
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
          webhookUrl: input.webhookUrl || null,
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
          webhookUrl: input.webhookUrl !== undefined ? (input.webhookUrl || null) : undefined,
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

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
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

    let actorName = "A team administrator";
    if (actorId) {
      const actor = await prisma.user.findUnique({
        where: { id: actorId },
        select: { name: true },
      });
      if (actor?.name) actorName = actor.name;

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

    // Send in-app notification to member
    await NotificationsService.createNotification({
      userId: targetUserId,
      actorId,
      title: `Added to Project`,
      message: `${actorName} added you to project "${project.name}"`,
      link: `/projects/${project.id}`,
      type: "ASSIGNMENT",
    });

    // Send email alert to member
    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
    await EmailService.sendProjectAddedEmail({
      to: membership.user.email,
      recipientName: membership.user.name,
      projectName: project.name,
      actorName,
      projectUrl: `${clientOrigin}/projects/${project.id}`,
    });

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
  static async getProjectAnalytics(projectId: string, orgId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
      include: {
        issues: {
          select: {
            id: true,
            key: true,
            title: true,
            type: true,
            status: true,
            priority: true,
            estimatedHours: true,
            createdAt: true,
            resolvedAt: true,
            assignee: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const totalIssues = project.issues.length;
    const completedIssues = project.issues.filter((i) => i.status === "DONE");
    const openIssues = project.issues.filter((i) => i.status !== "DONE");

    let totalEstimatedHours = 0;
    let completedHours = 0;
    project.issues.forEach((i) => {
      const hours = i.estimatedHours ? Number(i.estimatedHours) : 0;
      totalEstimatedHours += hours;
      if (i.status === "DONE") completedHours += hours;
    });

    let totalResolutionDays = 0;
    completedIssues.forEach((i) => {
      if (i.resolvedAt) {
        const diffMs = new Date(i.resolvedAt).getTime() - new Date(i.createdAt).getTime();
        totalResolutionDays += Math.max(0.1, diffMs / (1000 * 60 * 60 * 24));
      }
    });
    const avgResolutionDays = completedIssues.length > 0
      ? Number((totalResolutionDays / completedIssues.length).toFixed(1))
      : 0;

    const burndown = [];
    const now = new Date();
    const days = 14;
    for (let d = days - 1; d >= 0; d--) {
      const dayDate = new Date(now);
      dayDate.setDate(dayDate.getDate() - d);
      dayDate.setHours(23, 59, 59, 999);

      const label = dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const createdUntilDay = project.issues.filter((i) => new Date(i.createdAt) <= dayDate);
      const resolvedUntilDay = project.issues.filter((i) => i.status === "DONE" && i.resolvedAt && new Date(i.resolvedAt) <= dayDate);

      const remainingCount = Math.max(0, createdUntilDay.length - resolvedUntilDay.length);
      const idealRemaining = Math.max(0, Math.round(totalIssues - ((totalIssues / (days - 1)) * (days - 1 - d))));

      burndown.push({
        date: label,
        actualRemaining: remainingCount,
        idealRemaining,
        completed: resolvedUntilDay.length,
      });
    }

    const velocityWeekly = [];
    for (let w = 3; w >= 0; w--) {
      const start = new Date(now);
      start.setDate(start.getDate() - (w + 1) * 7);
      const end = new Date(now);
      end.setDate(end.getDate() - w * 7);

      const weekLabel = `Week ${4 - w}`;
      const resolvedInWeek = completedIssues.filter((i) => {
        if (!i.resolvedAt) return false;
        const resTime = new Date(i.resolvedAt).getTime();
        return resTime >= start.getTime() && resTime < end.getTime();
      });

      const tasksCompleted = resolvedInWeek.filter((i) => i.type === "TASK").length;
      const bugsResolved = resolvedInWeek.filter((i) => i.type === "BUG").length;

      velocityWeekly.push({
        week: weekLabel,
        tasks: tasksCompleted,
        bugs: bugsResolved,
        total: tasksCompleted + bugsResolved,
      });
    }

    const memberStats = project.memberships.map((m) => {
      const memberIssues = project.issues.filter((i) => i.assignee?.id === m.user.id);
      const done = memberIssues.filter((i) => i.status === "DONE").length;
      const inProgress = memberIssues.filter((i) => i.status === "IN_PROGRESS" || i.status === "IN_REVIEW").length;
      const todo = memberIssues.filter((i) => i.status === "TODO").length;

      return {
        id: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        total: memberIssues.length,
        done,
        inProgress,
        todo,
        velocityRate: memberIssues.length > 0 ? Math.round((done / memberIssues.length) * 100) : 0,
      };
    });

    const priorityDistribution = {
      CRITICAL: project.issues.filter((i) => i.priority === "CRITICAL").length,
      HIGH: project.issues.filter((i) => i.priority === "HIGH").length,
      MEDIUM: project.issues.filter((i) => i.priority === "MEDIUM").length,
      LOW: project.issues.filter((i) => i.priority === "LOW").length,
    };

    return {
      summary: {
        totalIssues,
        completedIssues: completedIssues.length,
        openIssues: openIssues.length,
        completionPercentage: totalIssues > 0 ? Math.round((completedIssues.length / totalIssues) * 100) : 0,
        totalEstimatedHours,
        completedHours,
        avgResolutionDays,
      },
      burndown,
      velocityWeekly,
      priorityDistribution,
      memberStats,
    };
  }
}
