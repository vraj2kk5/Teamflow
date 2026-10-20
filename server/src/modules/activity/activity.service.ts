import { prisma } from "../../lib/prisma";

export class ActivityService {
  static async getOrganizationActivity(
    orgId: string,
    query: { page?: number; pageSize?: number }
  ) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const [total, data] = await Promise.all([
      prisma.activityLog.count({
        where: { organizationId: orgId },
      }),
      prisma.activityLog.findMany({
        where: { organizationId: orgId },
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
