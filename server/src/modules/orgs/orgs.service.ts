import { prisma } from "../../lib/prisma";
import crypto from "crypto";
import { NotFoundError, BadRequestError, ConflictError } from "../../lib/errors";
import { Role } from "@prisma/client";
import { AddMemberInput, UpdateOrgInput } from "./orgs.schema";
import { NotificationsService } from "../notifications/notifications.service";
import { EmailService } from "../../lib/email";

export class OrgsService {
  static async getCurrentOrg(orgId: string, role?: Role) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            memberships: true,
            projects: true,
            issues: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    return org;
  }

  static async updateOrg(orgId: string, input: UpdateOrgInput, actorId: string) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: orgId },
        data: { name: input.name },
      });

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          actorId,
          action: "PROJECT_UPDATED",
          metadata: { field: "name", to: input.name },
        },
      });

      return updated;
    });
  }

  static async getMembers(orgId: string) {
    return prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            jobTitle: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  static async addMemberByEmail(orgId: string, input: AddMemberInput, actorId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, inviteCode: true },
    });

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    let inviteCode = org.inviteCode;
    if (!inviteCode) {
      inviteCode = `TF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      await prisma.organization.update({
        where: { id: org.id },
        data: { inviteCode },
      });
    }

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, name: true },
    });
    const actorName = actor?.name || "A team administrator";
    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";

    // 1. Check if user with email exists in platform
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    // If user is not yet registered on TeamFlow, automatically send an invitation email with the org invite code
    if (!user) {
      const registerUrl = `${clientOrigin}/register?inviteCode=${encodeURIComponent(
        inviteCode
      )}&email=${encodeURIComponent(input.email)}`;

      await EmailService.sendInviteEmail({
        to: input.email,
        orgName: org.name,
        actorName,
        inviteCode,
        registerUrl,
        role: input.role,
      });

      return {
        invited: true,
        email: input.email,
        role: input.role,
        message: `An invitation email has been sent to ${input.email} with your organization invite code (${inviteCode}). Once registered, they will be part of ${org.name}.`,
      };
    }

    // 2. Check if already member
    const existing = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: orgId,
        },
      },
    });

    if (existing) {
      throw new ConflictError("This user is already a member of the organization");
    }

    // 3. Add membership and log activity in transaction
    const membership = await prisma.$transaction(async (tx) => {
      const created = await tx.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: orgId,
          role: input.role,
        },
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

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          actorId,
          action: "MEMBER_ADDED",
          metadata: {
            targetUserId: user.id,
            targetEmail: user.email,
            role: input.role,
          },
        },
      });

      return created;
    });

    // Send in-app notification to the existing user
    await NotificationsService.createNotification({
      userId: user.id,
      actorId,
      title: `Welcome to ${org.name}`,
      message: `${actorName} added you to ${org.name} as ${input.role}`,
      link: "/dashboard",
      type: "ASSIGNMENT",
    });

    // Send email alert to user
    await EmailService.sendOrgAddedEmail({
      to: user.email,
      recipientName: user.name,
      orgName: org.name,
      actorName,
      role: input.role,
      dashboardUrl: `${clientOrigin}/dashboard`,
    });

    return {
      ...membership,
      invited: false,
    };
  }

  static async updateMemberRole(
    orgId: string,
    targetUserId: string,
    newRole: Role,
    actorId: string
  ) {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: orgId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError("Member not found in organization");
    }

    // If target is currently ADMIN and changing to non-admin, verify there is at least one other ADMIN
    if (membership.role === Role.ADMIN && newRole !== Role.ADMIN) {
      const adminCount = await prisma.organizationMembership.count({
        where: {
          organizationId: orgId,
          role: Role.ADMIN,
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestError(
          "Cannot demote the last administrator of the organization"
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.organizationMembership.update({
        where: { id: membership.id },
        data: { role: newRole },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          actorId,
          action: "ROLE_CHANGED",
          metadata: {
            targetUserId,
            from: membership.role,
            to: newRole,
          },
        },
      });

      return updated;
    });
  }

  static async removeMember(orgId: string, targetUserId: string, actorId: string) {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId: orgId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError("Member not found in organization");
    }

    if (membership.role === Role.ADMIN) {
      const adminCount = await prisma.organizationMembership.count({
        where: {
          organizationId: orgId,
          role: Role.ADMIN,
        },
      });

      if (adminCount <= 1) {
        throw new BadRequestError(
          "Cannot remove the last administrator of the organization"
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      // Clean up project memberships for this user in this org
      const projects = await tx.project.findMany({
        where: { organizationId: orgId },
        select: { id: true },
      });

      const projectIds = projects.map((p) => p.id);
      if (projectIds.length > 0) {
        await tx.projectMembership.deleteMany({
          where: {
            userId: targetUserId,
            projectId: { in: projectIds },
          },
        });

        // Unassign any assigned issues in this org
        await tx.issue.updateMany({
          where: {
            organizationId: orgId,
            assigneeId: targetUserId,
          },
          data: {
            assigneeId: null,
          },
        });
      }

      await tx.organizationMembership.delete({
        where: { id: membership.id },
      });

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          actorId,
          action: "MEMBER_REMOVED",
          metadata: { targetUserId },
        },
      });

      return { success: true };
    });
  }

  static async rotateInviteCode(orgId: string) {
    const newCode = `TF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    return prisma.organization.update({
      where: { id: orgId },
      data: { inviteCode: newCode },
    });
  }
}
