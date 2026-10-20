import { prisma } from "../../lib/prisma";
import crypto from "crypto";
import { NotFoundError, BadRequestError, ConflictError } from "../../lib/errors";
import { Role } from "@prisma/client";
import { AddMemberInput, UpdateOrgInput } from "./orgs.schema";

export class OrgsService {
  static async getCurrentOrg(orgId: string) {
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
    // 1. Check if user with email exists in platform
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new NotFoundError(
        "No registered user with this email. Ask them to register first."
      );
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
    return prisma.$transaction(async (tx) => {
      const membership = await tx.organizationMembership.create({
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

      return membership;
    });
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
