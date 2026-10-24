import { Resend } from "resend";
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

export interface SendAdminWelcomeEmailOptions {
  to: string;
  recipientName?: string;
  orgName: string;
  inviteCode?: string;
  dashboardUrl: string;
}

export interface SendLoginNotificationEmailOptions {
  to: string;
  recipientName?: string;
  orgName?: string;
  loginTime: string;
  dashboardUrl: string;
}

interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export class EmailService {
  private static resendClient: Resend | null = null;

  private static getResendClient(): Resend | null {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) return null;
    if (!this.resendClient) {
      this.resendClient = new Resend(apiKey);
    }
    return this.resendClient;
  }

  private static getTransporter() {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

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
   * Unified dispatcher: sends through Resend API (modern, no app passwords),
   * or SMTP Relay (Brevo/SendGrid/Gmail), or falls back to server log if unconfigured.
   */
  private static async dispatchEmail(email: OutgoingEmail): Promise<boolean> {
    const { to, subject, text, html } = email;

    // 1. Try Standard SMTP Relay (Brevo, SendGrid, Mailgun - sends to ANY recipient without sandbox restrictions)
    const transporter = this.getTransporter();
    if (transporter) {
      try {
        const from = process.env.SMTP_FROM || `"TeamFlow Support" <${process.env.SMTP_USER}>`;
        await transporter.sendMail({
          from,
          to,
          subject,
          text,
          html,
        });
        logger.info(`✉️ [REAL EMAIL DELIVERED] Dispatched via SMTP to ${to}`);
        return true;
      } catch (err) {
        logger.error(`Failed to dispatch via SMTP: ${err}`);
      }
    }

    // 2. Try Resend API
    const resend = this.getResendClient();
    if (resend) {
      try {
        const from = process.env.EMAIL_FROM || "TeamFlow <onboarding@resend.dev>";
        const result = await resend.emails.send({
          from,
          to,
          subject,
          text,
          html,
        });

        if (result.error) {
          logger.error(`Resend API returned error: ${JSON.stringify(result.error)}`);
        } else {
          logger.info(`✉️ [REAL EMAIL DELIVERED] Dispatched via Resend API to ${to} (id: ${result.data?.id})`);
          return true;
        }
      } catch (err) {
        logger.error(`Failed to dispatch via Resend API: ${err}`);
      }
    }

    // 3. Fallback: Local development log
    return false;
  }

  /**
   * Dispatches a password reset email securely out-of-band to the recipient's inbox.
   */
  static async sendPasswordResetEmail(options: SendPasswordResetEmailOptions): Promise<void> {
    const { to, recipientName, resetUrl } = options;

    const subject = "Reset Your TeamFlow Password";
    const text = `Hello ${recipientName || ""},\n\nYou requested a password reset for your TeamFlow account. Click the link below to set a new password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.\n\nBest regards,\nTeamFlow Security Team`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
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
    `;

    const dispatched = await this.dispatchEmail({ to, subject, text, html });
    if (!dispatched) {
      logger.info(`========================================================================`);
      logger.info(`🔒 [AUTH EMAIL - SECURE LOG] Password Reset Dispatch`);
      logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
      logger.info(`🔐 Subject: Reset Your TeamFlow Password`);
      logger.info(`🔗 Secure One-Time Link: ${resetUrl}`);
      logger.info(`⏳ Security Notice: Valid for 1 hour. Out-of-band delivery only.`);
      logger.info(`💡 Tip: Add RESEND_API_KEY in server/.env to send real emails without app passwords.`);
      logger.info(`========================================================================`);
    }
  }

  /**
   * Dispatches an email notification when a user is added to a project.
   */
  static async sendProjectAddedEmail(options: SendProjectAddedEmailOptions): Promise<void> {
    const { to, recipientName, projectName, actorName, projectUrl } = options;

    const subject = `You have been added to project "${projectName}" on TeamFlow`;
    const text = `Hello ${recipientName || ""},\n\n${actorName} added you to project "${projectName}".\n\nView project: ${projectUrl}\n\nTeamFlow Team`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #4f46e5; margin-top: 0;">New Project Membership</h2>
        <p style="color: #334155; font-size: 15px;">Hello ${recipientName || "there"},</p>
        <p style="color: #334155; font-size: 15px;"><strong>${actorName}</strong> added you to the project <strong>${projectName}</strong> on TeamFlow.</p>
        <div style="margin: 24px 0;">
          <a href="${projectUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Open Project</a>
        </div>
      </div>
    `;

    const dispatched = await this.dispatchEmail({ to, subject, text, html });
    if (!dispatched) {
      logger.info(`========================================================================`);
      logger.info(`📁 [PROJECT NOTIFICATION EMAIL] Project Membership Added`);
      logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
      logger.info(`📢 Subject: ${subject}`);
      logger.info(`👤 Added by: ${actorName}`);
      logger.info(`🔗 View Project: ${projectUrl}`);
      logger.info(`========================================================================`);
    }
  }

  /**
   * Dispatches an email notification when an existing platform user is added to an organization.
   */
  static async sendOrgAddedEmail(options: SendOrgAddedEmailOptions): Promise<void> {
    const { to, recipientName, orgName, actorName, role, dashboardUrl } = options;

    const subject = `You've been added to ${orgName} on TeamFlow`;
    const text = `Hello ${recipientName || ""},\n\n${actorName} added you to ${orgName} as ${role}.\n\nGo to dashboard: ${dashboardUrl}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #4f46e5; margin-top: 0;">Welcome to ${orgName}</h2>
        <p style="color: #334155; font-size: 15px;">Hello ${recipientName || "there"},</p>
        <p style="color: #334155; font-size: 15px;"><strong>${actorName}</strong> has added you to <strong>${orgName}</strong> with the role <strong>${role}</strong>.</p>
        <div style="margin: 24px 0;">
          <a href="${dashboardUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Go to Dashboard</a>
        </div>
      </div>
    `;

    const dispatched = await this.dispatchEmail({ to, subject, text, html });
    if (!dispatched) {
      logger.info(`========================================================================`);
      logger.info(`🏢 [ORGANIZATION EMAIL] Welcome to ${orgName}`);
      logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
      logger.info(`📢 Subject: ${subject}`);
      logger.info(`👤 Added by: ${actorName} as ${role}`);
      logger.info(`🔗 Dashboard: ${dashboardUrl}`);
      logger.info(`========================================================================`);
    }
  }

  /**
   * Dispatches an invitation email when an unregistered email is invited to an organization.
   */
  static async sendInviteEmail(options: SendInviteEmailOptions): Promise<void> {
    const { to, orgName, actorName, inviteCode, registerUrl, role } = options;

    const subject = `${actorName} invited you to join ${orgName} on TeamFlow`;
    const text = `Hello,\n\n${actorName} has invited you to join ${orgName} on TeamFlow${role ? ` as ${role}` : ""}.\n\nYour Invite Code: ${inviteCode}\nComplete registration here: ${registerUrl}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #4f46e5; margin-top: 0;">Invitation to join ${orgName}</h2>
        <p style="color: #334155; font-size: 15px;">Hello,</p>
        <p style="color: #334155; font-size: 15px;"><strong>${actorName}</strong> has invited you to join <strong>${orgName}</strong> on TeamFlow.</p>
        <div style="padding: 16px; background-color: #f8fafc; border-radius: 8px; margin: 20px 0; border: 1px dashed #cbd5e1;">
          <p style="margin: 0; font-size: 13px; color: #64748b;">Organization Invite Code:</p>
          <p style="margin: 4px 0 0; font-size: 18px; font-weight: 700; letter-spacing: 1px; color: #1e293b;">${inviteCode}</p>
        </div>
        <div style="margin: 24px 0;">
          <a href="${registerUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Accept Invitation & Register</a>
        </div>
      </div>
    `;

    const dispatched = await this.dispatchEmail({ to, subject, text, html });
    if (!dispatched) {
      logger.info(`========================================================================`);
      logger.info(`✉️ [INVITATION EMAIL] Invitation to join ${orgName}`);
      logger.info(`📧 To: ${to}`);
      logger.info(`📢 Subject: ${subject}`);
      logger.info(`🔑 Organization Invite Code: ${inviteCode}`);
      if (role) logger.info(`💼 Target Role: ${role}`);
      logger.info(`🔗 Complete Your Registration: ${registerUrl}`);
      logger.info(`========================================================================`);
    }
  }

  /**
   * Dispatches an email notification when a task or bug is assigned to a member.
   */
  static async sendTaskAssignedEmail(options: SendTaskAssignedEmailOptions): Promise<void> {
    const { to, recipientName, taskKey, taskTitle, actorName, taskUrl } = options;

    const subject = `Task Assigned: ${taskKey} - ${taskTitle}`;
    const text = `Hello ${recipientName || ""},\n\n${actorName} assigned you to ${taskKey}: "${taskTitle}".\n\nView task: ${taskUrl}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #4f46e5; margin-top: 0;">New Task Assignment</h2>
        <p style="color: #334155; font-size: 15px;">Hello ${recipientName || "there"},</p>
        <p style="color: #334155; font-size: 15px;"><strong>${actorName}</strong> assigned you to <strong>${taskKey}: ${taskTitle}</strong>.</p>
        <div style="margin: 24px 0;">
          <a href="${taskUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">View Task</a>
        </div>
      </div>
    `;

    const dispatched = await this.dispatchEmail({ to, subject, text, html });
    if (!dispatched) {
      logger.info(`========================================================================`);
      logger.info(`🎯 [TASK ASSIGNMENT EMAIL] New Assignment: ${taskKey}`);
      logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
      logger.info(`📢 Subject: ${subject}`);
      logger.info(`👤 Assigned by: ${actorName}`);
      logger.info(`🔗 View Task: ${taskUrl}`);
      logger.info(`========================================================================`);
    }
  }

  /**
   * Dispatches a welcome email when a user registers or onboards as an Administrator with a new workspace.
   */
  static async sendAdminWelcomeEmail(options: SendAdminWelcomeEmailOptions): Promise<void> {
    const { to, recipientName, orgName, inviteCode, dashboardUrl } = options;

    const subject = `Welcome to TeamFlow – Your Workspace "${orgName}" is Ready! 🎉`;
    const text = `Hello ${recipientName || "there"},\n\nWelcome to TeamFlow! Your administrator account and workspace "${orgName}" have been created successfully.\n\nWorkspace: ${orgName}\nAccount Email: ${to}\nRole: Administrator (Full Access)\n${inviteCode ? `Invite Code: ${inviteCode}\n` : ""}Go to your dashboard: ${dashboardUrl}\n\nShare your invite code with team members so they can join your workspace.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 16px; letter-spacing: -0.3px;">
            TeamFlow
          </div>
        </div>
        <h2 style="color: #1e293b; margin-top: 0; font-size: 20px; text-align: center;">Welcome to TeamFlow, ${recipientName || "Admin"}! 🎉</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; text-align: center; margin-top: 8px;">
          Your administrator account and workspace <strong>${orgName}</strong> have been created successfully.
        </p>

        <div style="padding: 18px; background-color: #f8fafc; border-radius: 10px; margin: 24px 0; border: 1px solid #e2e8f0;">
          <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Workspace Details</p>
          <div style="font-size: 14px; color: #1e293b; line-height: 1.8;">
            <div><strong>Workspace Name:</strong> ${orgName}</div>
            <div><strong>Account Email:</strong> ${to}</div>
            <div><strong>Role:</strong> Administrator (Full Access)</div>
          </div>
          ${
            inviteCode
              ? `
          <div style="margin-top: 14px; padding-top: 14px; border-top: 1px dashed #cbd5e1;">
            <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #64748b;">Your Team Invite Code:</p>
            <span style="display: inline-block; padding: 6px 14px; background-color: #ede9fe; color: #5b21b6; border-radius: 6px; font-family: monospace; font-size: 16px; font-weight: 700; letter-spacing: 1px;">${inviteCode}</span>
            <p style="margin: 6px 0 0; font-size: 12px; color: #94a3b8;">Share this code with your teammates so they can join your workspace.</p>
          </div>`
              : ""
          }
        </div>

        <div style="margin: 28px 0; text-align: center;">
          <a href="${dashboardUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">Go to Dashboard &rarr;</a>
        </div>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          TeamFlow Project & Issue Management &bull; If you did not create this account, please ignore this email.
        </p>
      </div>
    `;

    const dispatched = await this.dispatchEmail({ to, subject, text, html });
    if (!dispatched) {
      logger.info(`========================================================================`);
      logger.info(`🎉 [ADMIN WELCOME EMAIL] Workspace Created: ${orgName}`);
      logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
      logger.info(`📢 Subject: ${subject}`);
      if (inviteCode) logger.info(`🔑 Invite Code: ${inviteCode}`);
      logger.info(`🔗 Dashboard: ${dashboardUrl}`);
      logger.info(`========================================================================`);
    }
  }

  /**
   * Dispatches a security notification email whenever a user signs into their account.
   */
  static async sendLoginNotificationEmail(options: SendLoginNotificationEmailOptions): Promise<void> {
    const { to, recipientName, orgName, loginTime, dashboardUrl } = options;

    const subject = `New sign-in to your TeamFlow account`;
    const text = `Hello ${recipientName || "there"},\n\nWe detected a successful sign-in to your TeamFlow account.\n\nAccount: ${to}\n${orgName ? `Active Workspace: ${orgName}\n` : ""}Time: ${loginTime}\n\nAccess Dashboard: ${dashboardUrl}\n\nSecurity Notice: If this was not you, please secure your account by changing your password immediately.`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 8px 16px; border-radius: 8px; font-weight: 700; font-size: 16px; letter-spacing: -0.3px;">
            TeamFlow
          </div>
        </div>
        <h2 style="color: #1e293b; margin-top: 0; font-size: 20px; text-align: center;">New Sign-in to Your Account</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; text-align: center; margin-top: 8px;">
          Hello <strong>${recipientName || "there"}</strong>, a new sign-in was detected for your account.
        </p>

        <div style="padding: 18px; background-color: #f8fafc; border-radius: 10px; margin: 24px 0; border: 1px solid #e2e8f0;">
          <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Sign-in Details</p>
          <div style="font-size: 14px; color: #1e293b; line-height: 1.8;">
            <div><strong>Email Address:</strong> ${to}</div>
            ${orgName ? `<div><strong>Active Workspace:</strong> ${orgName}</div>` : ""}
            <div><strong>Date & Time:</strong> ${loginTime}</div>
          </div>
        </div>

        <div style="margin: 28px 0; text-align: center;">
          <a href="${dashboardUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">Go to Dashboard &rarr;</a>
        </div>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          Security Alert &bull; If you did not perform this login, please secure your account immediately.
        </p>
      </div>
    `;

    const dispatched = await this.dispatchEmail({ to, subject, text, html });
    if (!dispatched) {
      logger.info(`========================================================================`);
      logger.info(`🔐 [LOGIN EMAIL] New Sign-in for ${to}`);
      logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
      logger.info(`📢 Subject: ${subject}`);
      logger.info(`🕒 Time: ${loginTime}`);
      logger.info(`========================================================================`);
    }
  }
}
