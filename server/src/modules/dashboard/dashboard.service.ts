import { prisma } from "../../lib/prisma";
import { Role, Prisma } from "@prisma/client";

export class DashboardService {
  static async getMetrics(orgId: string, userId: string, role: Role) {
    const projectWhere: Prisma.ProjectWhereInput = {
      organizationId: orgId,
    };

    if (role !== Role.ADMIN) {
      projectWhere.OR = [
        { ownerId: userId },
        { memberships: { some: { userId } } },
      ];
    }

    const issueWhere: Prisma.IssueWhereInput = {
      organizationId: orgId,
    };

    if (role !== Role.ADMIN) {
      issueWhere.project = {
        OR: [
          { ownerId: userId },
          { memberships: { some: { userId } } },
        ],
      };
    }

    const now = new Date();

    const [
      totalProjects,
      openTasks,
      inProgressIssues,
      inReviewIssues,
      completedIssues,
      openBugs,
      highPriorityOpen,
      overdueIssues,
      recentActivity,
      projectsList,
      myAssignedIssues,
    ] = await Promise.all([
      // 1. Total projects
      prisma.project.count({ where: projectWhere }),

      // 2. Open Tasks (TODO)
      prisma.issue.count({
        where: {
          ...issueWhere,
          type: "TASK",
          status: "TODO",
        },
      }),

      // 3. In Progress
      prisma.issue.count({
        where: {
          ...issueWhere,
          status: "IN_PROGRESS",
        },
      }),

      // 4. In Review
      prisma.issue.count({
        where: {
          ...issueWhere,
          status: "IN_REVIEW",
        },
      }),

      // 5. Completed
      prisma.issue.count({
        where: {
          ...issueWhere,
          status: "DONE",
        },
      }),

      // 6. Open Bugs
      prisma.issue.count({
        where: {
          ...issueWhere,
          type: "BUG",
          status: { not: "DONE" },
        },
      }),

      // 7. High & Critical open
      prisma.issue.count({
        where: {
          ...issueWhere,
          priority: { in: ["HIGH", "CRITICAL"] },
          status: { not: "DONE" },
        },
      }),

      // 8. Overdue tasks
      prisma.issue.count({
        where: {
          ...issueWhere,
          dueDate: { lt: now },
          status: { not: "DONE" },
        },
      }),

      // 9. Recent Activity
      prisma.activityLog.findMany({
        where: {
          organizationId: orgId,
          ...(role !== Role.ADMIN
            ? {
                OR: [
                  { projectId: null },
                  {
                    project: {
                      OR: [
                        { ownerId: userId },
                        { memberships: { some: { userId } } },
                      ],
                    },
                  },
                ],
              }
            : {}),
        },
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: { id: true, name: true, avatarUrl: true },
          },
          project: {
            select: { id: true, name: true },
          },
          issue: {
            select: { id: true, key: true, title: true, type: true },
          },
        },
      }),

      // 10. Per-project health breakdown
      prisma.project.findMany({
        where: projectWhere,
        take: 10,
        orderBy: { updatedAt: "desc" },
        include: {
          issues: {
            select: {
              status: true,
              type: true,
              dueDate: true,
            },
          },
        },
      }),

      // 11. My assigned open issues
      prisma.issue.findMany({
        where: {
          organizationId: orgId,
          assigneeId: userId,
          status: { not: "DONE" },
        },
        take: 5,
        orderBy: { priority: "desc" },
        include: {
          project: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Compute project health metrics
    const projectHealth = projectsList.map((p) => {
      const total = p.issues.length;
      const done = p.issues.filter((i) => i.status === "DONE").length;
      const completionPercentage = total > 0 ? Math.round((done / total) * 100) : 0;
      const bugs = p.issues.filter((i) => i.type === "BUG" && i.status !== "DONE").length;
      const overdue = p.issues.filter(
        (i) => i.dueDate && new Date(i.dueDate) < now && i.status !== "DONE"
      ).length;

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        totalIssues: total,
        doneIssues: done,
        completionPercentage,
        openBugs: bugs,
        overdueCount: overdue,
      };
    });

    return {
      stats: {
        totalProjects,
        openTasks,
        inProgressIssues,
        inReviewIssues,
        completedIssues,
        openBugs,
        highPriorityOpen,
        overdueIssues,
      },
      projectHealth,
      recentActivity,
      myAssignedIssues,
    };
  }
}
