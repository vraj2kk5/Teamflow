import nodemailer from "nodemailer";
import { logger } from "./logger";

export interface SendPasswordResetEmailOptions {
  to: string;
  recipientName?: string;
  token: string;
  resetUrl: string;
}

export interface SendProjectAddedEmailOptions {
  to: string;
  recipientName?: string;
  projectName: string;
  actorName: string;
  projectUrl: string;
}

export interface SendOrgAddedEmailOptions {
  to: string;
  recipientName?: string;
  orgName: string;
  actorName: string;
  role: string;
  dashboardUrl: string;
}

export interface SendInviteEmailOptions {
  to: string;
  orgName: string;
  actorName: string;
  inviteCode: string;
  registerUrl: string;
  role?: string;
}

export interface SendTaskAssignedEmailOptions {
  to: string;
  recipientName?: string;
  taskKey: string;
  taskTitle: string;
  actorName: string;
  taskUrl: string;
}

export class EmailService {
  private static getTransporter() {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  /**
   * Dispatches a password reset email securely out-of-band to the recipient's inbox.
   * If SMTP credentials exist in .env, sends real email. Otherwise logs link in console.
   */
  static async sendPasswordResetEmail(options: SendPasswordResetEmailOptions): Promise<void> {
    const { to, recipientName, resetUrl } = options;
    const transporter = this.getTransporter();

    if (transporter) {
      try {
        const from = process.env.SMTP_FROM || `"TeamFlow Support" <${process.env.SMTP_USER}>`;
        await transporter.sendMail({
          from,
          to,
          subject: "Reset Your TeamFlow Password",
          text: `Hello ${recipientName || ""},\n\nYou requested a password reset for your TeamFlow account. Click the link below to set a new password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.\n\nBest regards,\nTeamFlow Team`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #4f46e5; margin-top: 0;">Reset Your Password</h2>
              <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello ${recipientName || "there"},</p>
              <p style="color: #334155; font-size: 15px; line-height: 1.5;">We received a request to reset your password for TeamFlow. Click the button below to choose a new password:</p>
              <div style="margin: 28px 0;">
                <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This link is valid for 1 hour. If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="color: #64748b; font-size: 12px; word-break: break-all;"><a href="${resetUrl}" style="color: #4f46e5;">${resetUrl}</a></p>
              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
              <p style="color: #94a3b8; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
          `,
        });
        logger.info(`✉️ [REAL SMTP EMAIL SENT] Password reset email delivered to ${to}`);
        return;
      } catch (err) {
        logger.error(`Failed to dispatch SMTP email: ${err}. Falling back to terminal log.`);
      }
    }

    // Fallback: local development logging
    logger.info(`========================================================================`);
    logger.info(`🔒 [AUTH EMAIL - DEV SIMULATION] Password Reset Dispatch`);
    logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
    logger.info(`🔐 Subject: Reset Your TeamFlow Password`);
    logger.info(`🔗 Secure One-Time Link: ${resetUrl}`);
    logger.info(`⏳ Security Notice: Valid for 1 hour. Never share this link with anyone.`);
    logger.info(`💡 Note: Set SMTP_USER and SMTP_PASS in server/.env to send real emails.`);
    logger.info(`========================================================================`);
  }

  /**
   * Dispatches an email notification when a user is added to a project.
   */
  static async sendProjectAddedEmail(options: SendProjectAddedEmailOptions): Promise<void> {
    const { to, recipientName, projectName, actorName, projectUrl } = options;
    const transporter = this.getTransporter();

    if (transporter) {
      try {
        const from = process.env.SMTP_FROM || `"TeamFlow Support" <${process.env.SMTP_USER}>`;
        await transporter.sendMail({
          from,
          to,
          subject: `You have been added to project "${projectName}" on TeamFlow`,
          text: `Hello ${recipientName || ""},\n\n${actorName} added you to project "${projectName}".\n\nView project: ${projectUrl}\n\nTeamFlow Team`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #4f46e5;">New Project Membership</h2>
              <p>Hello ${recipientName || "there"},</p>
              <p><strong>${actorName}</strong> added you to the project <strong>${projectName}</strong> on TeamFlow.</p>
              <div style="margin: 24px 0;">
                <a href="${projectUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Project</a>
              </div>
            </div>
          `,
        });
        logger.info(`✉️ [REAL SMTP EMAIL SENT] Project membership email delivered to ${to}`);
        return;
      } catch (err) {
        logger.error(`Failed to dispatch SMTP email: ${err}. Falling back to terminal log.`);
      }
    }

    logger.info(`========================================================================`);
    logger.info(`📁 [PROJECT NOTIFICATION EMAIL] Project Membership Added`);
    logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
    logger.info(`📢 Subject: You have been added to project "${projectName}" on TeamFlow`);
    logger.info(`👤 Added by: ${actorName}`);
    logger.info(`🔗 View Project: ${projectUrl}`);
    logger.info(`========================================================================`);
  }

  /**
   * Dispatches an email notification when an existing platform user is added to an organization.
   */
  static async sendOrgAddedEmail(options: SendOrgAddedEmailOptions): Promise<void> {
    const { to, recipientName, orgName, actorName, role, dashboardUrl } = options;
    const transporter = this.getTransporter();

    if (transporter) {
      try {
        const from = process.env.SMTP_FROM || `"TeamFlow Support" <${process.env.SMTP_USER}>`;
        await transporter.sendMail({
          from,
          to,
          subject: `You've been added to ${orgName} on TeamFlow`,
          text: `Hello ${recipientName || ""},\n\n${actorName} added you to ${orgName} as ${role}.\n\nGo to dashboard: ${dashboardUrl}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #4f46e5;">Welcome to ${orgName}</h2>
              <p>Hello ${recipientName || "there"},</p>
              <p><strong>${actorName}</strong> has added you to <strong>${orgName}</strong> with the role <strong>${role}</strong>.</p>
              <div style="margin: 24px 0;">
                <a href="${dashboardUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Go to Dashboard</a>
              </div>
            </div>
          `,
        });
        logger.info(`✉️ [REAL SMTP EMAIL SENT] Org added email delivered to ${to}`);
        return;
      } catch (err) {
        logger.error(`Failed to dispatch SMTP email: ${err}. Falling back to terminal log.`);
      }
    }

    logger.info(`========================================================================`);
    logger.info(`🏢 [ORGANIZATION EMAIL] Welcome to ${orgName}`);
    logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
    logger.info(`📢 Subject: You've been added to ${orgName} on TeamFlow`);
    logger.info(`👤 Added by: ${actorName} as ${role}`);
    logger.info(`🔗 Dashboard: ${dashboardUrl}`);
    logger.info(`========================================================================`);
  }

  /**
   * Dispatches an invitation email when an unregistered email is invited to an organization.
   */
  static async sendInviteEmail(options: SendInviteEmailOptions): Promise<void> {
    const { to, orgName, actorName, inviteCode, registerUrl, role } = options;
    const transporter = this.getTransporter();

    if (transporter) {
      try {
        const from = process.env.SMTP_FROM || `"TeamFlow Support" <${process.env.SMTP_USER}>`;
        await transporter.sendMail({
          from,
          to,
          subject: `${actorName} invited you to join ${orgName} on TeamFlow`,
          text: `Hello,\n\n${actorName} has invited you to join ${orgName} on TeamFlow${role ? ` as ${role}` : ""}.\n\nYour Invite Code: ${inviteCode}\nComplete registration here: ${registerUrl}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #4f46e5;">Invitation to join ${orgName}</h2>
              <p>Hello,</p>
              <p><strong>${actorName}</strong> has invited you to join <strong>${orgName}</strong> on TeamFlow.</p>
              <div style="padding: 16px; background-color: #f8fafc; border-radius: 8px; margin: 20px 0; border: 1px dashed #cbd5e1;">
                <p style="margin: 0; font-size: 13px; color: #64748b;">Organization Invite Code:</p>
                <p style="margin: 4px 0 0; font-size: 18px; font-weight: 700; letter-spacing: 1px; color: #1e293b;">${inviteCode}</p>
              </div>
              <div style="margin: 24px 0;">
                <a href="${registerUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Accept Invitation & Register</a>
              </div>
            </div>
          `,
        });
        logger.info(`✉️ [REAL SMTP EMAIL SENT] Invitation email delivered to ${to}`);
        return;
      } catch (err) {
        logger.error(`Failed to dispatch SMTP email: ${err}. Falling back to terminal log.`);
      }
    }

    logger.info(`========================================================================`);
    logger.info(`✉️ [INVITATION EMAIL] Invitation to join ${orgName}`);
    logger.info(`📧 To: ${to}`);
    logger.info(`📢 Subject: ${actorName} invited you to join ${orgName} on TeamFlow`);
    logger.info(`🔑 Organization Invite Code: ${inviteCode}`);
    if (role) logger.info(`💼 Target Role: ${role}`);
    logger.info(`🔗 Complete Your Registration: ${registerUrl}`);
    logger.info(`========================================================================`);
  }

  /**
   * Dispatches an email notification when a task or bug is assigned to a member.
   */
  static async sendTaskAssignedEmail(options: SendTaskAssignedEmailOptions): Promise<void> {
    const { to, recipientName, taskKey, taskTitle, actorName, taskUrl } = options;
    const transporter = this.getTransporter();

    if (transporter) {
      try {
        const from = process.env.SMTP_FROM || `"TeamFlow Support" <${process.env.SMTP_USER}>`;
        await transporter.sendMail({
          from,
          to,
          subject: `Task Assigned: ${taskKey} - ${taskTitle}`,
          text: `Hello ${recipientName || ""},\n\n${actorName} assigned you to ${taskKey}: "${taskTitle}".\n\nView task: ${taskUrl}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #4f46e5;">New Task Assignment</h2>
              <p>Hello ${recipientName || "there"},</p>
              <p><strong>${actorName}</strong> assigned you to <strong>${taskKey}: ${taskTitle}</strong>.</p>
              <div style="margin: 24px 0;">
                <a href="${taskUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Task</a>
              </div>
            </div>
          `,
        });
        logger.info(`✉️ [REAL SMTP EMAIL SENT] Task assigned email delivered to ${to}`);
        return;
      } catch (err) {
        logger.error(`Failed to dispatch SMTP email: ${err}. Falling back to terminal log.`);
      }
    }

    logger.info(`========================================================================`);
    logger.info(`🎯 [TASK ASSIGNMENT EMAIL] New Assignment: ${taskKey}`);
    logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
    logger.info(`📢 Subject: Task Assigned: ${taskKey} - ${taskTitle}`);
    logger.info(`👤 Assigned by: ${actorName}`);
    logger.info(`🔗 View Task: ${taskUrl}`);
    logger.info(`========================================================================`);
  }
}
