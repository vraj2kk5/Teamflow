import { prisma } from "../../lib/prisma";
import { Role, Prisma } from "@prisma/client";

export class ActivityService {
  static async getOrganizationActivity(
    orgId: string,
    userId: string,
    role: Role,
    query: { page?: number; pageSize?: number }
  ) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.ActivityLogWhereInput = {
      organizationId: orgId,
    };

    if (role !== Role.ADMIN) {
      where.OR = [
        { projectId: null },
        {
          project: {
            OR: [
              { ownerId: userId },
              { memberships: { some: { userId } } },
            ],
          },
        },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          project: {
            select: { id: true, name: true },
          },
          issue: {
            select: { id: true, key: true, title: true, type: true },
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
}
