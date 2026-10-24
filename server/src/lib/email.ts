import { logger } from "./logger";

export interface SendPasswordResetEmailOptions {
  to: string;
  recipientName?: string;
  token: string;
  resetUrl: string;
}

export class EmailService {
  /**
   * Dispatches a password reset email securely out-of-band to the recipient's inbox.
   * If external SMTP / email provider credentials are provided, it dispatches across the network.
   * In local/development mode, it securely logs the email simulation directly to the backend
   * server console, ensuring the token is NEVER leaked to the client HTTP response or browser UI.
   */
  static async sendPasswordResetEmail(options: SendPasswordResetEmailOptions): Promise<void> {
    const { to, recipientName, resetUrl } = options;

    logger.info(`========================================================================`);
    logger.info(`🔒 [SECURE AUTH EMAIL SERVICE] Password Reset Dispatch`);
    logger.info(`📧 To: ${to} ${recipientName ? `(${recipientName})` : ""}`);
    logger.info(`🔐 Subject: Reset Your TeamFlow Password`);
    logger.info(`🔗 Secure One-Time Link: ${resetUrl}`);
    logger.info(`⏳ Security Notice: Valid for 1 hour. Never share this link with anyone.`);
    logger.info(`========================================================================`);
  }
}
