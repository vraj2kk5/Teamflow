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
    const isMember = role === Role.MEMBER;

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

      // 2. Open Tasks (TODO) - For Members, scoped to their own assigned tasks
      prisma.issue.count({
        where: {
          ...issueWhere,
          type: "TASK",
          status: "TODO",
          ...(isMember ? { assigneeId: userId } : {}),
        },
      }),

      // 3. In Progress - For Members, scoped to their own assigned tasks
      prisma.issue.count({
        where: {
          ...issueWhere,
          type: "TASK",
          status: "IN_PROGRESS",
          ...(isMember ? { assigneeId: userId } : {}),
        },
      }),

      // 4. In Review - For Members, scoped to their own assigned tasks
      prisma.issue.count({
        where: {
          ...issueWhere,
          type: "TASK",
          status: "IN_REVIEW",
          ...(isMember ? { assigneeId: userId } : {}),
        },
      }),

      // 5. Completed - For Members, scoped to their own assigned tasks
      prisma.issue.count({
        where: {
          ...issueWhere,
          type: "TASK",
          status: "DONE",
          ...(isMember ? { assigneeId: userId } : {}),
        },
      }),

      // 6. Open Bugs - Collaborative for all project members
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
          ...(isMember ? { OR: [{ assigneeId: userId }, { type: "BUG" }] } : {}),
        },
      }),

      // 8. Overdue tasks - For Members, only alert on tasks assigned to them
      prisma.issue.count({
        where: {
          ...issueWhere,
          dueDate: { lt: now },
          status: { not: "DONE" },
          ...(isMember ? { assigneeId: userId } : {}),
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

      // 11. My assigned open issues (or unassigned open tasks needing assignment for Admin)
      prisma.issue.findMany({
        where: {
          organizationId: orgId,
          ...(role === Role.ADMIN
            ? { assigneeId: null, status: { not: "DONE" } }
            : { assigneeId: userId, status: { not: "DONE" } }),
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

    // 2. Fetch ALL issues in scope to compute pipeline (Total, Completed, In Progress, To Do)
    const allIssues = await prisma.issue.findMany({
      where: issueWhere,
      select: {
        id: true,
        type: true,
        status: true,
        assigneeId: true,
      },
    });

    const totalWork = allIssues.length;
    const totalTasks = allIssues.filter((i) => i.type === "TASK").length;
    const totalBugs = allIssues.filter((i) => i.type === "BUG").length;
    const completedWork = allIssues.filter((i) => i.status === "DONE").length;
    const inProgressWork = allIssues.filter(
      (i) => i.status === "IN_PROGRESS" || i.status === "IN_REVIEW"
    ).length;
    const toDoWork = allIssues.filter((i) => i.status === "TODO").length;
    const completionRate = totalWork > 0 ? Math.round((completedWork / totalWork) * 100) : 0;

    // 3. Fetch completed issues in the selected timeframe window
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
      totalAssigned: number;
      completedCount: number;
      tasksCount: number;
      bugsCount: number;
      activeCount: number;
      toDoCount: number;
      completionRate: number;
      completedIssues: typeof formattedCompleted;
    };

    const memberStatsMap = new Map<string, MemberStat>();

    // Initialize with org members
    for (const m of orgMembers) {
      const userTotal = allIssues.filter((i) => i.assigneeId === m.user.id).length;
      const userActive = allIssues.filter(
        (i) => i.assigneeId === m.user.id && (i.status === "IN_PROGRESS" || i.status === "IN_REVIEW")
      ).length;
      const userToDo = allIssues.filter(
        (i) => i.assigneeId === m.user.id && i.status === "TODO"
      ).length;
      const userDone = allIssues.filter(
        (i) => i.assigneeId === m.user.id && i.status === "DONE"
      ).length;
      const userRate = userTotal > 0 ? Math.round((userDone / userTotal) * 100) : 0;

      memberStatsMap.set(m.user.id, {
        user: m.user,
        role: m.role,
        totalAssigned: userTotal,
        completedCount: 0,
        tasksCount: 0,
        bugsCount: 0,
        activeCount: userActive,
        toDoCount: userToDo,
        completionRate: userRate,
        completedIssues: [],
      });
    }

    // Fill completed items per member in the timeframe window
    const unassignedCompleted: typeof formattedCompleted = [];
    for (const item of formattedCompleted) {
      if (item.assignee) {
        let stats = memberStatsMap.get(item.assignee.id);
        if (!stats) {
          const userTotal = allIssues.filter((i) => i.assigneeId === item.assignee!.id).length;
          const userActive = allIssues.filter(
            (i) => i.assigneeId === item.assignee!.id && (i.status === "IN_PROGRESS" || i.status === "IN_REVIEW")
          ).length;
          const userToDo = allIssues.filter(
            (i) => i.assigneeId === item.assignee!.id && i.status === "TODO"
          ).length;
          const userDone = allIssues.filter(
            (i) => i.assigneeId === item.assignee!.id && i.status === "DONE"
          ).length;
          const userRate = userTotal > 0 ? Math.round((userDone / userTotal) * 100) : 0;

          stats = {
            user: { ...item.assignee, jobTitle: null },
            role: Role.MEMBER,
            totalAssigned: userTotal,
            completedCount: 0,
            tasksCount: 0,
            bugsCount: 0,
            activeCount: userActive,
            toDoCount: userToDo,
            completionRate: userRate,
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

    const totalTasksCompleted = formattedCompleted.filter((i) => i.type === "TASK").length;
    const totalBugsCompleted = formattedCompleted.filter((i) => i.type === "BUG").length;
    const activeContributors = memberStats.filter((m) => m.completedCount > 0).length;

    return {
      timeframeDays: validDays,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      summary: {
        totalWork,
        totalTasks,
        totalBugs,
        completedWork,
        completedInTimeframe: formattedCompleted.length,
        tasksCompleted: totalTasksCompleted,
        bugsResolved: totalBugsCompleted,
        inProgressWork,
        toDoWork,
        completionRate,
        activeContributors,
      },
      timeline,
      memberStats,
      unassignedCompleted,
      recentCompleted: formattedCompleted.slice(0, 50),
    };
  }
}
