import { Response } from "express";
import { logger } from "./logger";

export interface RealtimeEvent {
  type:
    | "ISSUE_CREATED"
    | "ISSUE_UPDATED"
    | "STATUS_CHANGED"
    | "ASSIGNEE_CHANGED"
    | "COMMENT_ADDED"
    | "NOTIFICATION_RECEIVED"
    | "PROJECT_UPDATED";
  organizationId: string;
  projectId?: string;
  issueId?: string;
  actorId?: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

interface ConnectedClient {
  userId: string;
  res: Response;
}

class RealtimeEventsHub {
  // Map of organizationId -> Array of connected clients
  private orgClients = new Map<string, ConnectedClient[]>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat() {
    // Send keep-alive every 25 seconds
    this.heartbeatInterval = setInterval(() => {
      for (const [orgId, clients] of this.orgClients.entries()) {
        for (const client of clients) {
          try {
            client.res.write(": heartbeat\n\n");
          } catch {
            // Broken connection, will be cleaned up on close
          }
        }
      }
    }, 25000);

    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  registerClient(orgId: string, userId: string, res: Response) {
    if (!this.orgClients.has(orgId)) {
      this.orgClients.set(orgId, []);
    }

    const client: ConnectedClient = { userId, res };
    this.orgClients.get(orgId)!.push(client);

    logger.info(`[REALTIME-SSE] User ${userId} subscribed to org ${orgId} events (Total in org: ${this.orgClients.get(orgId)!.length})`);

    // Clean up when connection closes
    res.on("close", () => {
      this.unregisterClient(orgId, res);
    });
  }

  unregisterClient(orgId: string, res: Response) {
    const clients = this.orgClients.get(orgId);
    if (!clients) return;

    const filtered = clients.filter((c) => c.res !== res);
    if (filtered.length > 0) {
      this.orgClients.set(orgId, filtered);
    } else {
      this.orgClients.delete(orgId);
    }
  }

  broadcast(event: Omit<RealtimeEvent, "timestamp">) {
    const orgId = event.organizationId;
    const clients = this.orgClients.get(orgId);
    if (!clients || clients.length === 0) return;

    const fullEvent: RealtimeEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    const ssePayload = `event: message\ndata: ${JSON.stringify(fullEvent)}\n\n`;

    for (const client of clients) {
      try {
        client.res.write(ssePayload);
      } catch (err) {
        logger.warn(`[REALTIME-SSE] Error pushing to client ${client.userId}`, err);
      }
    }
  }
}

export const realtimeHub = new RealtimeEventsHub();
