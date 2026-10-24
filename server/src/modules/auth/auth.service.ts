import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from "./auth.schema";
import { ConflictError, UnauthorizedError, NotFoundError, ForbiddenError } from "../../lib/errors";
import { EmailService } from "../../lib/email";

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

  static signToken(payload: TokenPayload, expiresIn?: string): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: (expiresIn || env.JWT_EXPIRES_IN) as jwt.SignOptions["expiresIn"],
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

    const result = await prisma.$transaction(async (tx) => {
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

    // If an Admin created a workspace on registration, send them a confirmation welcome email
    if (result.role === "ADMIN") {
      const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
      await EmailService.sendAdminWelcomeEmail({
        to: result.user.email,
        recipientName: result.user.name,
        orgName: result.organization.name,
        inviteCode: result.organization.inviteCode || undefined,
        dashboardUrl: `${clientOrigin}/dashboard`,
      }).catch((err) => {
        // Log without interrupting the response
      });
    }

    return result;
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

    const activeMembership = user.memberships[0] || null;

    const tokenExpires = input.rememberMe ? "30d" : "1d";
    const token = this.signToken(
      {
        userId: user.id,
        email: user.email,
        organizationId: activeMembership ? activeMembership.organizationId : "",
      },
      tokenExpires
    );

    // Dispatch login alert email to the user's specific email address
    const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
    EmailService.sendLoginNotificationEmail({
      to: user.email,
      recipientName: user.name,
      orgName: activeMembership?.organization?.name,
      loginTime: new Date().toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      dashboardUrl: `${clientOrigin}/dashboard`,
    }).catch(() => {
      // Ignore background dispatch failures
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
      organization: activeMembership ? activeMembership.organization : null,
      role: activeMembership ? activeMembership.role : null,
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

    const activeMembership = currentOrgId
      ? user.memberships.find((m) => m.organizationId === currentOrgId) || null
      : null;

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

  static async switchOrg(userId: string, targetOrgId: string) {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: targetOrgId,
        },
      },
      include: {
        organization: true,
        user: true,
      },
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this organization");
    }

    const token = this.signToken({
      userId,
      email: membership.user.email,
      organizationId: targetOrgId,
    });

    return {
      user: {
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        avatarUrl: membership.user.avatarUrl,
        jobTitle: membership.user.jobTitle,
        bio: membership.user.bio,
      },
      organization: membership.organization,
      role: membership.role,
      token,
    };
  }

  static async forgotPassword(input: ForgotPasswordInput) {
    const normalizedEmail = input.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // To prevent User Enumeration and Account Takeover attacks:
    // 1. Always return an identical generic response whether the email exists or not.
    // 2. NEVER return the reset token or reset URL in the HTTP response.
    const genericResponse = {
      message: "If an account exists with this email, a password reset link has been sent to your inbox.",
      email: normalizedEmail,
    };

    if (!user) {
      return genericResponse;
    }

    // Clean up any existing tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email: user.email },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    await prisma.passwordResetToken.create({
      data: {
        email: user.email,
        token,
        expiresAt,
      },
    });

    const clientOrigin = env.CLIENT_ORIGIN || "http://localhost:3000";
    const resetUrl = `${clientOrigin}/reset-password?token=${token}`;

    // Dispatch email securely out-of-band to user's registered inbox
    await EmailService.sendPasswordResetEmail({
      to: user.email,
      recipientName: user.name,
      token,
      resetUrl,
    });

    return genericResponse;
  }

  static async resetPassword(input: ResetPasswordInput) {
    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { token: input.token },
    });

    if (!resetRecord) {
      throw new UnauthorizedError("Invalid or expired password reset token");
    }

    if (resetRecord.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({
        where: { id: resetRecord.id },
      });
      throw new UnauthorizedError("Password reset token has expired. Please request a new one.");
    }

    const user = await prisma.user.findUnique({
      where: { email: resetRecord.email },
    });

    if (!user) {
      throw new NotFoundError("User account not found");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { email: resetRecord.email },
      }),
    ]);

    return {
      message: "Password reset successfully. You can now log in with your new password.",
    };
  }

  static async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const isCurrentValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return {
      message: "Password changed successfully",
    };
  }
}
