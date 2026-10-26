"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";

export interface RealtimeMessage {
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
  payload: Record<string, any>;
}

export function useRealtime(onEvent?: (event: RealtimeMessage) => void) {
  const { user } = useAuth();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!user) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    let es: EventSource | null = null;
    let isMounted = true;

    try {
      es = new EventSource(`${apiUrl}/api/activity/stream`, {
        withCredentials: true,
      });

      es.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data) as RealtimeMessage;
          if (data && data.type && onEventRef.current) {
            onEventRef.current(data);
          }
        } catch {
          // Heartbeat or comment line
        }
      };

      es.onerror = () => {
        // EventSource will automatically retry connecting
      };
    } catch {
      // Fallback if EventSource fails
    }

    return () => {
      isMounted = false;
      if (es) {
        es.close();
      }
    };
  }, [user]);
}
