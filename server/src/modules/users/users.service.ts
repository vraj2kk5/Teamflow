import { prisma } from "../../lib/prisma";
import { NotFoundError } from "../../lib/errors";
import { UpdateProfileInput } from "./users.schema";

export class UsersService {
  static async getUserProfile(targetUserId: string, orgId: string) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        jobTitle: true,
        bio: true,
        createdAt: true,
        memberships: {
          where: { organizationId: orgId },
          select: { role: true, createdAt: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const [assignedCount, reportedCount, resolvedCount] = await Promise.all([
      prisma.issue.count({
        where: { organizationId: orgId, assigneeId: targetUserId },
      }),
      prisma.issue.count({
        where: { organizationId: orgId, reporterId: targetUserId },
      }),
      prisma.issue.count({
        where: { organizationId: orgId, assigneeId: targetUserId, status: "DONE" },
      }),
    ]);

    return {
      ...user,
      stats: {
        assignedCount,
        reportedCount,
        resolvedCount,
      },
    };
  }

  static async updateMyProfile(userId: string, input: UpdateProfileInput) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        jobTitle: input.jobTitle,
        bio: input.bio,
        avatarUrl: input.avatarUrl,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        jobTitle: true,
        bio: true,
      },
    });
  }

  static async getUserIssues(
    targetUserId: string,
    orgId: string,
    relation: "assigned" | "reported"
  ) {
    const where = {
      organizationId: orgId,
      ...(relation === "assigned"
        ? { assigneeId: targetUserId }
        : { reporterId: targetUserId }),
    };

    return prisma.issue.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  static async getUserActivity(targetUserId: string, orgId: string) {
    return prisma.activityLog.findMany({
      where: {
        actorId: targetUserId,
        organizationId: orgId,
      },
      take: 25,
      orderBy: { createdAt: "desc" },
      include: {
        project: { select: { id: true, name: true } },
        issue: { select: { id: true, key: true, title: true } },
      },
    });
  }
}
