import { prisma } from "../../lib/prisma";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../lib/errors";
import {
  CreateIssueInput,
  UpdateIssueInput,
  UpdateIssueStatusInput,
} from "./issues.schema";
import { Prisma, Role } from "@prisma/client";
import { getStorageDriver } from "../../lib/storage";

export class IssuesService {
  static async getIssues(
    orgId: string,
    userId: string,
    role: Role,
    query: {
      q?: string;
      projectId?: string;
      status?: string;
      priority?: string;
      assigneeId?: string;
      reporterId?: string;
      type?: string;
      overdue?: string;
      sort?: string;
      order?: "asc" | "desc";
      page?: number;
      pageSize?: number;
    }
  ) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 15));
    const skip = (page - 1) * pageSize;

    const where: Prisma.IssueWhereInput = {
      organizationId: orgId,
    };

    // Scoping for members: only issues from projects they belong to
    if (role === Role.MEMBER) {
      where.project = {
        memberships: {
          some: { userId },
        },
      };
    }

    if (query.projectId) {
      where.projectId = query.projectId;
    }

    if (query.type) {
      where.type = query.type as Prisma.EnumIssueTypeFilter;
    }

    if (query.status) {
      where.status = query.status as Prisma.EnumIssueStatusFilter;
    }

    if (query.priority) {
      where.priority = query.priority as Prisma.EnumPriorityFilter;
    }

    if (query.assigneeId) {
      where.assigneeId = query.assigneeId === "me" ? userId : query.assigneeId;
    }

    if (query.reporterId) {
      where.reporterId = query.reporterId;
    }

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        { key: { contains: query.q, mode: "insensitive" } },
      ];
    }

    if (query.overdue === "true") {
      where.dueDate = {
        lt: new Date(),
      };
      where.status = {
        not: "DONE",
      };
    }

    // Sort order
    const sortField = query.sort || "createdAt";
    const sortOrder = query.order || "desc";
    const orderBy: Prisma.IssueOrderByWithRelationInput = {
      [sortField]: sortOrder,
    };

    const [total, data] = await Promise.all([
      prisma.issue.count({ where }),
      prisma.issue.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          project: {
            select: { id: true, name: true },
          },
          reporter: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          assignee: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          _count: {
            select: { comments: true, attachments: true },
          },
        },
      }),
    ]);

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

  static async getIssueById(issueId: string, orgId: string) {
    const issue = await prisma.issue.findFirst({
      where: { id: issueId, organizationId: orgId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
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
          },
        },
        reporter: {
          select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatarUrl: true, jobTitle: true },
        },
        attachments: {
          orderBy: { createdAt: "desc" },
          include: {
            uploadedBy: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        activityLogs: {
          orderBy: { createdAt: "desc" },
          take: 30,
          include: {
            actor: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundError("Issue not found");
    }

    return issue;
  }

  static async createIssue(
    orgId: string,
    reporterId: string,
    input: CreateIssueInput,
    userRole?: Role
  ) {
    // 0. Permission check: Members cannot add tasks (they can only report bugs)
    if (input.type === "TASK" && userRole === Role.MEMBER) {
      throw new ForbiddenError(
        "Members cannot create tasks. Only Admins and Project Managers can add tasks."
      );
    }

    // 1. Verify project exists in org
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, organizationId: orgId },
    });

    if (!project) {
      throw new NotFoundError("Project not found in current organization");
    }

    // 2. Validate assignee is not an Admin and is a member of the project
    if (input.assigneeId) {
      const assigneeOrgMembership = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: input.assigneeId,
            organizationId: orgId,
          },
        },
      });

      if (assigneeOrgMembership?.role === Role.ADMIN) {
        throw new BadRequestError(
          "Administrators cannot be assigned tasks to perform. Tasks must be assigned to team members."
        );
      }

      const isProjectMember = await prisma.projectMembership.findUnique({
        where: {
          projectId_userId: {
            projectId: input.projectId,
            userId: input.assigneeId,
          },
        },
      });

      if (!isProjectMember) {
        throw new BadRequestError(
          "Assigned user must be a registered member of this project"
        );
      }
    }

    // 3. Atomically increment issue sequence and create Issue
    return prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: input.projectId },
        data: {
          issueSequence: {
            increment: 1,
          },
        },
      });

      const key = `TF-${updatedProject.issueSequence}`;

      const issue = await tx.issue.create({
        data: {
          projectId: input.projectId,
          organizationId: orgId,
          key,
          type: input.type,
          title: input.title,
          description: input.description,
          priority: input.priority,
          reporterId,
          assigneeId: input.assigneeId || null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          estimatedHours: input.estimatedHours || null,
          stepsToReproduce: input.stepsToReproduce || null,
          expectedResult: input.expectedResult || null,
          actualResult: input.actualResult || null,
          errorLog: input.errorLog || null,
        },
        include: {
          project: { select: { id: true, name: true } },
          reporter: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit log
      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          projectId: input.projectId,
          issueId: issue.id,
          actorId: reporterId,
          action: "ISSUE_CREATED",
          metadata: {
            key: issue.key,
            title: issue.title,
            type: issue.type,
            priority: issue.priority,
          },
        },
      });

      if (issue.assigneeId && issue.assigneeId !== reporterId) {
        await tx.notification.create({
          data: {
            userId: issue.assigneeId,
            actorId: reporterId,
            title: "New Task Assigned",
            message: `${issue.reporter.name} assigned you to ${issue.key}: "${issue.title}"`,
            link: `/issues/${issue.id}`,
            type: "ASSIGNMENT",
          },
        });
      }

      return issue;
    });
  }

  static async updateIssue(
    issueId: string,
    orgId: string,
    actorId: string,
    input: UpdateIssueInput
  ) {
    const existing = await prisma.issue.findFirst({
      where: { id: issueId, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundError("Issue not found");
    }

    if (input.assigneeId && input.assigneeId !== existing.assigneeId) {
      const assigneeOrgMembership = await prisma.organizationMembership.findUnique({
        where: {
          userId_organizationId: {
            userId: input.assigneeId,
            organizationId: orgId,
          },
        },
      });

      if (assigneeOrgMembership?.role === Role.ADMIN) {
        throw new BadRequestError(
          "Administrators cannot be assigned tasks to perform. Tasks must be assigned to team members."
        );
      }

      const isProjectMember = await prisma.projectMembership.findUnique({
        where: {
          projectId_userId: {
            projectId: existing.projectId,
            userId: input.assigneeId,
          },
        },
      });

      if (!isProjectMember) {
        throw new BadRequestError(
          "Assigned user must be a member of this project"
        );
      }
    }

    const resolvedAt =
      input.status === "DONE" && existing.status !== "DONE"
        ? new Date()
        : input.status && input.status !== "DONE"
        ? null
        : existing.resolvedAt;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({
        where: { id: issueId },
        data: {
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          assigneeId: input.assigneeId !== undefined ? input.assigneeId : existing.assigneeId,
          dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : existing.dueDate,
          estimatedHours: input.estimatedHours !== undefined ? input.estimatedHours : existing.estimatedHours,
          stepsToReproduce: input.stepsToReproduce !== undefined ? input.stepsToReproduce : existing.stepsToReproduce,
          expectedResult: input.expectedResult !== undefined ? input.expectedResult : existing.expectedResult,
          actualResult: input.actualResult !== undefined ? input.actualResult : existing.actualResult,
          errorLog: input.errorLog !== undefined ? input.errorLog : existing.errorLog,
          resolvedAt,
        },
        include: {
          reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      // Log specific changes
      if (input.status && input.status !== existing.status) {
        await tx.activityLog.create({
          data: {
            organizationId: orgId,
            projectId: existing.projectId,
            issueId,
            actorId,
            action: input.status === "DONE" ? "ISSUE_RESOLVED" : "STATUS_CHANGED",
            metadata: { from: existing.status, to: input.status },
          },
        });
      }

      if (input.priority && input.priority !== existing.priority) {
        await tx.activityLog.create({
          data: {
            organizationId: orgId,
            projectId: existing.projectId,
            issueId,
            actorId,
            action: "PRIORITY_CHANGED",
            metadata: { from: existing.priority, to: input.priority },
          },
        });
      }

      if (input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId) {
        await tx.activityLog.create({
          data: {
            organizationId: orgId,
            projectId: existing.projectId,
            issueId,
            actorId,
            action: "ASSIGNEE_CHANGED",
            metadata: { from: existing.assigneeId, to: input.assigneeId },
          },
        });
      }

      if (input.assigneeId && input.assigneeId !== existing.assigneeId && input.assigneeId !== actorId) {
        await tx.notification.create({
          data: {
            userId: input.assigneeId,
            actorId,
            title: "Task Assigned to You",
            message: `You were assigned to ${updated.key}: "${updated.title}"`,
            link: `/issues/${updated.id}`,
            type: "ASSIGNMENT",
          },
        });
      }

      return updated;
    });
  }

  static async updateStatus(
    issueId: string,
    orgId: string,
    actorId: string,
    input: UpdateIssueStatusInput
  ) {
    const existing = await prisma.issue.findFirst({
      where: { id: issueId, organizationId: orgId },
    });

    if (!existing) {
      throw new NotFoundError("Issue not found");
    }

    if (existing.status === input.status) {
      return existing;
    }

    const resolvedAt = input.status === "DONE" ? new Date() : null;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({
        where: { id: issueId },
        data: {
          status: input.status,
          resolvedAt,
        },
        include: {
          reporter: { select: { id: true, name: true, avatarUrl: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          projectId: existing.projectId,
          issueId,
          actorId,
          action: input.status === "DONE" ? "ISSUE_RESOLVED" : "STATUS_CHANGED",
          metadata: { from: existing.status, to: input.status },
        },
      });

      if (existing.assigneeId && existing.assigneeId !== actorId) {
        await tx.notification.create({
          data: {
            userId: existing.assigneeId,
            actorId,
            title: "Task Status Updated",
            message: `${updated.key}: "${updated.title}" was moved to ${input.status}`,
            link: `/issues/${updated.id}`,
            type: "STATUS_CHANGED",
          },
        });
      }

      return updated;
    });
  }

  static async deleteIssue(issueId: string, orgId: string, actorId: string) {
    const existing = await prisma.issue.findFirst({
      where: { id: issueId, organizationId: orgId },
      include: {
        attachments: true,
      },
    });

    if (!existing) {
      throw new NotFoundError("Issue not found");
    }

    // Delete stored attachment files best effort
    const storage = getStorageDriver();
    for (const attachment of existing.attachments) {
      try {
        await storage.delete(attachment.storageKey);
      } catch {
        // Logged inside driver
      }
    }

    return prisma.$transaction(async (tx) => {
      await tx.issue.delete({
        where: { id: issueId },
      });

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          projectId: existing.projectId,
          actorId,
          action: "ISSUE_UPDATED",
          metadata: { action: "DELETED", key: existing.key, title: existing.title },
        },
      });

      return { success: true };
    });
  }

  static async getIssueActivity(issueId: string, orgId: string) {
    return prisma.activityLog.findMany({
      where: {
        issueId,
        organizationId: orgId,
      },
      include: {
        actor: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
