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

  static async getAnalytics(
    orgId: string,
    userId: string,
    role: Role,
    days: number = 7
  ) {
    const validDays = [7, 14, 30].includes(days) ? days : 7;
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - (validDays - 1));
    startDate.setHours(0, 0, 0, 0);

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

    // 1. Fetch organization members to have full roster
    const orgMembers = await prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            jobTitle: true,
          },
        },
      },
    });

    // 2. Fetch completed issues in the window
    const completedIssues = await prisma.issue.findMany({
      where: {
        ...issueWhere,
        status: "DONE",
        OR: [
          { resolvedAt: { gte: startDate } },
          {
            AND: [
              { resolvedAt: null },
              { updatedAt: { gte: startDate } },
            ],
          },
        ],
      },
      include: {
        assignee: {
          select: { id: true, name: true, avatarUrl: true, email: true },
        },
        reporter: {
          select: { id: true, name: true, avatarUrl: true },
        },
        project: {
          select: { id: true, name: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 3. Fetch active issues (TODO, IN_PROGRESS, IN_REVIEW) per user
    const activeIssues = await prisma.issue.findMany({
      where: {
        ...issueWhere,
        status: { not: "DONE" },
        assigneeId: { not: null },
      },
      select: {
        id: true,
        assigneeId: true,
      },
    });

    const activeCountsByUser: Record<string, number> = {};
    for (const item of activeIssues) {
      if (item.assigneeId) {
        activeCountsByUser[item.assigneeId] = (activeCountsByUser[item.assigneeId] || 0) + 1;
      }
    }

    // 4. Generate daily date buckets
    const timeline: Array<{
      date: string;
      label: string;
      tasksCount: number;
      bugsCount: number;
      totalCount: number;
      items: Array<{
        id: string;
        key: string;
        title: string;
        type: string;
        priority: string;
        resolvedAt: string;
        assignee: { id: string; name: string; avatarUrl: string | null; email: string } | null;
        reporter: { id: string; name: string; avatarUrl: string | null };
        project: { id: string; name: string };
      }>;
    }> = [];

    const dateMap = new Map<
      string,
      {
        tasks: number;
        bugs: number;
        items: Array<{
          id: string;
          key: string;
          title: string;
          type: string;
          priority: string;
          resolvedAt: string;
          assignee: { id: string; name: string; avatarUrl: string | null; email: string } | null;
          reporter: { id: string; name: string; avatarUrl: string | null };
          project: { id: string; name: string };
        }>;
      }
    >();

    for (let i = 0; i < validDays; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateKey = d.toISOString().split("T")[0]; // YYYY-MM-DD
      const label = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      dateMap.set(dateKey, { tasks: 0, bugs: 0, items: [] });
      timeline.push({
        date: dateKey,
        label,
        tasksCount: 0,
        bugsCount: 0,
        totalCount: 0,
        items: [],
      });
    }

    // 5. Populate timeline with completed issues
    const formattedCompleted = completedIssues.map((issue) => {
      const completionDate = issue.resolvedAt || issue.updatedAt;
      const dateKey = completionDate.toISOString().split("T")[0];
      const itemData = {
        id: issue.id,
        key: issue.key,
        title: issue.title,
        type: issue.type,
        priority: issue.priority,
        resolvedAt: completionDate.toISOString(),
        assignee: issue.assignee,
        reporter: issue.reporter,
        project: issue.project,
      };

      const bucket = dateMap.get(dateKey);
      if (bucket) {
        if (issue.type === "BUG") {
          bucket.bugs++;
        } else {
          bucket.tasks++;
        }
        bucket.items.push(itemData);
      }

      return itemData;
    });

    for (const t of timeline) {
      const b = dateMap.get(t.date);
      if (b) {
        t.tasksCount = b.tasks;
        t.bugsCount = b.bugs;
        t.totalCount = b.tasks + b.bugs;
        t.items = b.items;
      }
    }

    // 6. Aggregate by member
    type MemberStat = {
      user: {
        id: string;
        name: string;
        avatarUrl: string | null;
        email: string;
        jobTitle: string | null;
      };
      role: Role;
      completedCount: number;
      tasksCount: number;
      bugsCount: number;
      activeCount: number;
      completedIssues: typeof formattedCompleted;
    };

    const memberStatsMap = new Map<string, MemberStat>();

    // Initialize with org members
    for (const m of orgMembers) {
      memberStatsMap.set(m.user.id, {
        user: m.user,
        role: m.role,
        completedCount: 0,
        tasksCount: 0,
        bugsCount: 0,
        activeCount: activeCountsByUser[m.user.id] || 0,
        completedIssues: [],
      });
    }

    // Fill completed items per member
    const unassignedCompleted: typeof formattedCompleted = [];
    for (const item of formattedCompleted) {
      if (item.assignee) {
        let stats = memberStatsMap.get(item.assignee.id);
        if (!stats) {
          stats = {
            user: { ...item.assignee, jobTitle: null },
            role: Role.MEMBER,
            completedCount: 0,
            tasksCount: 0,
            bugsCount: 0,
            activeCount: activeCountsByUser[item.assignee.id] || 0,
            completedIssues: [],
          };
          memberStatsMap.set(item.assignee.id, stats);
        }
        stats.completedCount++;
        if (item.type === "BUG") stats.bugsCount++;
        else stats.tasksCount++;
        stats.completedIssues.push(item);
      } else {
        unassignedCompleted.push(item);
      }
    }

    const memberStats = Array.from(memberStatsMap.values()).sort(
      (a, b) => b.completedCount - a.completedCount || b.activeCount - a.activeCount
    );

    const totalTasks = formattedCompleted.filter((i) => i.type === "TASK").length;
    const totalBugs = formattedCompleted.filter((i) => i.type === "BUG").length;
    const activeContributors = memberStats.filter((m) => m.completedCount > 0).length;

    return {
      timeframeDays: validDays,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      summary: {
        totalCompleted: formattedCompleted.length,
        tasksCompleted: totalTasks,
        bugsResolved: totalBugs,
        activeContributors,
      },
      timeline,
      memberStats,
      unassignedCompleted,
      recentCompleted: formattedCompleted.slice(0, 50),
    };
  }
}
