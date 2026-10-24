import { prisma } from "../../lib/prisma";
import crypto from "crypto";
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from "../../lib/errors";
import { Role } from "@prisma/client";
import { AddMemberInput, UpdateOrgInput } from "./orgs.schema";
import { NotificationsService } from "../notifications/notifications.service";
import { EmailService } from "../../lib/email";
import { AuthService } from "../auth/auth.service";

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
      )}&email=${encodeURIComponent(input.email)}&role=${encodeURIComponent(input.role)}`;

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
        inviteCode,
        registerUrl,
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
      link: undefined,
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

  static async deleteOrg(orgId: string, actorId: string) {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: actorId,
          organizationId: orgId,
        },
      },
    });

    if (!membership || membership.role !== Role.ADMIN) {
      throw new ForbiddenError("Only organization Administrators can delete the organization");
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    // Cascade delete automatically removes all memberships, projects, issues, comments, attachments, and activity logs
    await prisma.organization.delete({
      where: { id: orgId },
    });

    return {
      success: true,
      deletedOrgId: orgId,
      deletedOrgName: org.name,
      message: `Organization "${org.name}" has been permanently deleted.`,
    };
  }

  static async createOrg(userId: string, input: { name?: string }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundError("User not found");

    const orgName = (input.name || "").trim() || `${user.name}'s Organization`;
    const baseSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const slug = `${baseSlug || "org"}-${crypto.randomBytes(3).toString("hex")}`;
    const inviteCode = `TF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          inviteCode,
        },
      });

      await tx.organizationMembership.create({
        data: {
          userId,
          organizationId: org.id,
          role: Role.ADMIN,
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId: org.id,
          actorId: userId,
          action: "MEMBER_ADDED",
          metadata: { role: Role.ADMIN, event: "ORGANIZATION_CREATED" },
        },
      });

      const token = AuthService.signToken({
        userId,
        email: user.email,
        organizationId: org.id,
      });

      return {
        organization: org,
        role: Role.ADMIN,
        token,
      };
    });

    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
    await EmailService.sendAdminWelcomeEmail({
      to: user.email,
      recipientName: user.name,
      orgName: result.organization.name,
      inviteCode: result.organization.inviteCode || undefined,
      dashboardUrl: `${clientOrigin}/dashboard`,
    }).catch(() => {
      // Ignore background email failure
    });

    return result;
  }

  static async joinOrg(userId: string, input: { inviteCode: string }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundError("User not found");

    const code = (input.inviteCode || "").trim().toUpperCase();
    if (!code) throw new BadRequestError("Invite code is required");

    const org = await prisma.organization.findUnique({
      where: { inviteCode: code },
    });
    if (!org) throw new NotFoundError("Invalid organization invite code");

    let membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: org.id,
        },
      },
    });

    if (!membership) {
      membership = await prisma.organizationMembership.create({
        data: {
          userId,
          organizationId: org.id,
          role: Role.MEMBER,
        },
      });

      await prisma.activityLog.create({
        data: {
          organizationId: org.id,
          actorId: userId,
          action: "MEMBER_ADDED",
          metadata: { role: Role.MEMBER, method: "INVITE_CODE" },
        },
      });
    }

    const token = AuthService.signToken({
      userId,
      email: user.email,
      organizationId: org.id,
    });

    return {
      organization: org,
      role: membership.role,
      token,
    };
  }
}
