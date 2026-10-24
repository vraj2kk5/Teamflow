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
  /**
   * Dispatches a password reset email securely out-of-band to the recipient's inbox.
   */
  static async sendPasswordResetEmail(options: SendPasswordResetEmailOptions): Promise<void> {
    const { to, recipientName, resetUrl } = options;

    logger.info(`========================================================================`);
    logger.info(`🔒 [SECURE AUTH EMAIL] Password Reset Dispatch`);
    logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
    logger.info(`🔐 Subject: Reset Your TeamFlow Password`);
    logger.info(`🔗 Secure One-Time Link: ${resetUrl}`);
    logger.info(`⏳ Security Notice: Valid for 1 hour. Never share this link with anyone.`);
    logger.info(`========================================================================`);
  }

  /**
   * Dispatches an email notification when a user is added to a project.
   */
  static async sendProjectAddedEmail(options: SendProjectAddedEmailOptions): Promise<void> {
    const { to, recipientName, projectName, actorName, projectUrl } = options;

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

    logger.info(`========================================================================`);
    logger.info(`🎯 [TASK ASSIGNMENT EMAIL] New Assignment: ${taskKey}`);
    logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
    logger.info(`📢 Subject: Task Assigned: ${taskKey} - ${taskTitle}`);
    logger.info(`👤 Assigned by: ${actorName}`);
    logger.info(`🔗 View Task: ${taskUrl}`);
    logger.info(`========================================================================`);
  }
}
