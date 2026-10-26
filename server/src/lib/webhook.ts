import { logger } from "./logger";

export interface WebhookPayload {
  event: "ISSUE_CREATED" | "ISSUE_UPDATED" | "STATUS_CHANGED" | "BUG_REPORTED";
  taskKey: string;
  title: string;
  type: "TASK" | "BUG";
  status: string;
  priority: string;
  actorName: string;
  assigneeName?: string;
  taskUrl: string;
  description?: string;
  severityColor?: number;
}

export class WebhookService {
  /**
   * Dispatch a webhook to Discord, Slack, or generic HTTP endpoint asynchronously
   */
  static async send(webhookUrl: string | undefined | null, payload: WebhookPayload): Promise<void> {
    const url = webhookUrl?.trim() || process.env.DISCORD_WEBHOOK_URL?.trim() || process.env.SLACK_WEBHOOK_URL?.trim();
    if (!url) return;

    try {
      const isDiscord = url.includes("discord.com/api/webhooks");
      const isSlack = url.includes("hooks.slack.com");

      let body: string;
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      // Priority color mapping: Critical=Red, High=Orange, Medium=Yellow, Low=Blue
      const colorMap: Record<string, number> = {
        CRITICAL: 0xe11d48, // Crimson red
        HIGH: 0xf97316,     // Orange
        MEDIUM: 0xeab308,   // Amber
        LOW: 0x3b82f6,      // Blue
      };
      const embedColor = colorMap[payload.priority] || 0x6366f1;

      if (isDiscord) {
        body = JSON.stringify({
          username: "TeamFlow Bot",
          avatar_url: "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/workflow.png",
          embeds: [
            {
              title: `${payload.type === "BUG" ? "🐛" : "📌"} [${payload.taskKey}] ${payload.title}`,
              url: payload.taskUrl,
              description: payload.description ? payload.description.substring(0, 300) : "No description provided.",
              color: embedColor,
              fields: [
                { name: "Type", value: payload.type, inline: true },
                { name: "Status", value: payload.status, inline: true },
                { name: "Priority", value: payload.priority, inline: true },
                { name: "Actor", value: payload.actorName, inline: true },
                { name: "Assignee", value: payload.assigneeName || "Unassigned", inline: true },
              ],
              footer: {
                text: `TeamFlow Real-Time • ${new Date().toLocaleTimeString()}`,
              },
              timestamp: new Date().toISOString(),
            },
          ],
        });
      } else if (isSlack) {
        body = JSON.stringify({
          text: `${payload.type === "BUG" ? "🚨 *New Bug Alert*" : "📋 *Task Update*"} - <${payload.taskUrl}|${payload.taskKey}: ${payload.title}>`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${payload.type === "BUG" ? "🐛 Bug:" : "📌 Task:"}* <${payload.taskUrl}|${payload.taskKey}: ${payload.title}>\n*Status:* \`${payload.status}\` | *Priority:* \`${payload.priority}\`\n*By:* ${payload.actorName} | *Assignee:* ${payload.assigneeName || "Unassigned"}`,
              },
            },
          ],
        });
      } else {
        // Generic JSON Webhook
        body = JSON.stringify({
          source: "TeamFlow",
          ...payload,
          timestamp: new Date().toISOString(),
        });
      }

      // Fire and forget with 5-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        logger.warn(`[WEBHOOK] Endpoint returned status ${res.status}: ${await res.text()}`);
      } else {
        logger.info(`[WEBHOOK] Dispatched ${payload.event} to ${url.substring(0, 35)}...`);
      }
    } catch (err: unknown) {
      logger.warn(`[WEBHOOK] Failed to dispatch webhook`, err);
    }
  }
}
