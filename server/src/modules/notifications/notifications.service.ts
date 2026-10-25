import { prisma } from "../../lib/prisma";
import { NotificationType } from "@prisma/client";

export class NotificationsService {
  static async createNotification(data: {
    userId: string;
    actorId?: string;
    title: string;
    message: string;
    link?: string;
    type?: NotificationType;
    allowSelf?: boolean;
  }) {
    // Avoid self-notification unless explicitly allowed or when type is ASSIGNMENT
    if (!data.allowSelf && data.actorId && data.actorId === data.userId && data.type !== "ASSIGNMENT") {
      return null;
    }

    return prisma.notification.create({
      data: {
        userId: data.userId,
        actorId: data.actorId,
        title: data.title,
        message: data.message,
        link: data.link,
        type: data.type || "ASSIGNMENT",
      },
    });
  }

  static async getUserNotifications(userId: string, limit = 20) {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      data: notifications,
      unreadCount,
    };
  }

  static async markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
