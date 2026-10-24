"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { formatRelativeTime } from "../../lib/utils";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  MessageSquare,
  UserPlus,
  RefreshCw,
  ExternalLink,
  Inbox,
} from "lucide-react";

export interface NotificationItem {
  id: string;
  userId: string;
  actorId?: string | null;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  type: "ASSIGNMENT" | "ISSUE_CREATED" | "COMMENT_ADDED" | "STATUS_CHANGED";
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
}

export function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<any>("/notifications?limit=50");

      let items: NotificationItem[] = [];
      let count = 0;

      if (Array.isArray(res)) {
        items = res;
        count = items.filter((n) => !n.isRead).length;
      } else if (res && typeof res === "object") {
        if (Array.isArray(res.data)) {
          items = res.data;
        } else if (res.data && Array.isArray(res.data.data)) {
          items = res.data.data;
        }

        if (typeof res.unreadCount === "number") {
          count = res.unreadCount;
        } else if (res.data && typeof res.data.unreadCount === "number") {
          count = res.data.unreadCount;
        } else {
          count = items.filter((n) => !n.isRead).length;
        }
      }

      setNotifications(items);
      setUnreadCount(count);
    } catch {
      // silent fallback
    }
  }, [user]);

  // Poll notifications periodically (every 30s)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (item: NotificationItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Optimistic UI update immediately
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await api.patch(`/notifications/${item.id}/read`, {});
    } catch {
      try {
        await api.post(`/notifications/${item.id}/read`, {});
      } catch {
        // silent fallback
      }
    }

    const label = getLinkLabel(item);
    if (item.link && label && !item.link.includes("/dashboard")) {
      setIsOpen(false);
      router.push(item.link);
    }
  };

  const handleMarkAllAsRead = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Instant optimistic UI update: immediately clear dots and counter
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    setIsLoading(true);

    try {
      await api.post("/notifications/read-all", {});
    } catch (err) {
      console.error("POST /read-all failed, trying PATCH:", err);
      try {
        await api.patch("/notifications/read-all", {});
      } catch (patchErr) {
        console.error("PATCH /read-all failed:", patchErr);
        await fetchNotifications();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "ASSIGNMENT":
        return <UserPlus className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />;
      case "COMMENT_ADDED":
        return <MessageSquare className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />;
      case "STATUS_CHANGED":
        return <RefreshCw className="w-4 h-4 text-amber-500 dark:text-amber-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />;
    }
  };

  const getLinkLabel = (item: NotificationItem): string | null => {
    const title = (item.title || "").toLowerCase();
    const msg = (item.message || "").toLowerCase();
    const link = (item.link || "").toLowerCase();

    // Welcome, onboardings, or dashboard links are purely informational notifications (no link button)
    if (title.includes("welcome") || link.includes("/dashboard") || !item.link) {
      return null;
    }

    // Projects: show "View project"
    if (title.includes("project") || link.includes("/projects")) {
      return "View project";
    }

    // Bugs: show "View bug"
    if (title.includes("bug") || msg.includes("bug")) {
      return "View bug";
    }

    // Tasks / Issues: show "View task"
    if (
      title.includes("task") ||
      msg.includes("task") ||
      title.includes("issue") ||
      link.includes("/issues") ||
      link.includes("/tasks")
    ) {
      return "View task";
    }

    return null;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center animate-pulse shadow-md shadow-rose-600/50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800">
                  {unreadCount} new
                </span>
              )}
            </div>

            {(unreadCount > 0 || notifications.some((n) => !n.isRead)) && (
              <button
                type="button"
                onClick={(e) => handleMarkAllAsRead(e)}
                disabled={isLoading}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-300">All caught up!</p>
                <p className="text-[11px] text-slate-500">
                  When new tasks are assigned or comments are added, they will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const linkLabel = getLinkLabel(item);
                return (
                  <div
                    key={item.id}
                    onClick={(e) => handleMarkAsRead(item, e)}
                    className={`p-3 transition-colors cursor-pointer flex items-start gap-3 ${
                      item.isRead
                        ? "hover:bg-slate-50 dark:hover:bg-slate-850/50 opacity-80"
                        : "bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/30 border-l-2 border-indigo-500"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shrink-0 mt-0.5">
                      {getIcon(item.type)}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                        {item.message}
                      </p>

                      {linkLabel && (
                        <div className="pt-0.5 flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
                          <span>{linkLabel}</span>
                          <ExternalLink className="w-3 h-3" />
                        </div>
                      )}
                    </div>

                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
