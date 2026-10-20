import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { RegisterInput, LoginInput } from "./auth.schema";
import { ConflictError, UnauthorizedError, NotFoundError } from "../../lib/errors";

export interface TokenPayload {
  userId: string;
  email: string;
  organizationId: string;
}

export class AuthService {
  private static generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `${base}-${crypto.randomBytes(3).toString("hex")}`;
  }

  private static generateInviteCode(): string {
    return `TF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  }

  static signToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });
  }

  static verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    } catch {
      throw new UnauthorizedError("Invalid or expired session token");
    }
  }

  static async register(input: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new ConflictError("A user with this email address already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    return prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
        },
      });

      let targetOrgId: string;
      let targetRole: "ADMIN" | "MEMBER" = "ADMIN";

      if (input.inviteCode) {
        const org = await tx.organization.findUnique({
          where: { inviteCode: input.inviteCode },
        });
        if (!org) {
          throw new NotFoundError("Invalid organization invite code");
        }
        targetOrgId = org.id;
        targetRole = "MEMBER";
      } else {
        const orgName = input.orgName || `${input.name}'s Organization`;
        const slug = this.generateSlug(orgName);
        const inviteCode = this.generateInviteCode();

        const org = await tx.organization.create({
          data: {
            name: orgName,
            slug,
            inviteCode,
          },
        });
        targetOrgId = org.id;
        targetRole = "ADMIN";
      }

      // 2. Create Membership
      const membership = await tx.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: targetOrgId,
          role: targetRole,
        },
        include: {
          organization: true,
        },
      });

      // 3. Activity Log
      await tx.activityLog.create({
        data: {
          organizationId: targetOrgId,
          actorId: user.id,
          action: "MEMBER_ADDED",
          metadata: {
            role: targetRole,
            action: "REGISTERED_JOINED",
          },
        },
      });

      const token = this.signToken({
        userId: user.id,
        email: user.email,
        organizationId: targetOrgId,
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          jobTitle: user.jobTitle,
          bio: user.bio,
        },
        organization: membership.organization,
        role: membership.role,
        token,
      };
    });
  }

  static async login(input: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        memberships: {
          include: {
            organization: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(
      input.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (!user.memberships.length) {
      throw new UnauthorizedError("User does not belong to any organization");
    }

    const activeMembership = user.memberships[0];

    const token = this.signToken({
      userId: user.id,
      email: user.email,
      organizationId: activeMembership.organizationId,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        jobTitle: user.jobTitle,
        bio: user.bio,
      },
      organization: activeMembership.organization,
      role: activeMembership.role,
      token,
    };
  }

  static async getMe(userId: string, currentOrgId?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const activeMembership =
      user.memberships.find((m) => m.organizationId === currentOrgId) ||
      user.memberships[0];

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        jobTitle: user.jobTitle,
        bio: user.bio,
      },
      organization: activeMembership ? activeMembership.organization : null,
      role: activeMembership ? activeMembership.role : null,
      allOrganizations: user.memberships.map((m) => ({
        ...m.organization,
        role: m.role,
      })),
    };
  }
}
