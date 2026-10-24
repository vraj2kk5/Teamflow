import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(date);
}

export function formatActivityAction(
  action: string,
  metadata?: Record<string, unknown> | null
): string {
  const norm = (action || "").toUpperCase();
  const meta = (metadata || {}) as Record<string, unknown>;

  if (
    norm === "ORGANIZATION_CREATED" ||
    (norm === "MEMBER_ADDED" && meta.role === "ADMIN" && meta.action === "REGISTERED_JOINED") ||
    meta.event === "ORGANIZATION_CREATED"
  ) {
    return "created the workspace";
  }

  if (
    norm === "MEMBER_JOINED" ||
    (norm === "MEMBER_ADDED" && meta.action === "REGISTERED_JOINED" && meta.role === "MEMBER") ||
    meta.method === "INVITE_CODE"
  ) {
    return "joined the workspace";
  }

  if (norm === "MEMBER_ADDED") {
    if (meta.targetUserName || meta.name) {
      return `added ${meta.targetUserName || meta.name} to the team`;
    }
    return "added a team member";
  }

  if (norm === "MEMBER_REMOVED") {
    return "removed a team member";
  }

  if (norm === "ROLE_CHANGED") {
    if (meta.to) {
      return `changed role to ${meta.to}`;
    }
    return "updated member role";
  }

  if (norm === "PROJECT_CREATED") return "created project";
  if (norm === "PROJECT_UPDATED") return "updated project";
  if (norm === "PROJECT_DELETED") return "deleted project";
  if (norm === "ISSUE_CREATED") return "created task";
  if (norm === "ISSUE_UPDATED") return "updated task";
  if (norm === "ISSUE_DELETED") return "deleted task";
  if (norm === "STATUS_CHANGED") {
    if (meta.to) {
      return `moved task to ${String(meta.to).replace(/_/g, " ").toLowerCase()}`;
    }
    return "updated task status";
  }
  if (norm === "COMMENT_ADDED") return "added a comment";
  if (norm === "ATTACHMENT_UPLOADED") return "uploaded an attachment";

  return action.replace(/_/g, " ").toLowerCase();
}
