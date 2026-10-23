"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "../../lib/api";
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
      const res = await api.get<{
        data: {
          data: NotificationItem[];
          unreadCount: number;
        };
      }>("/notifications?limit=25");

      const payload = (res as unknown as { data?: { data?: NotificationItem[]; unreadCount?: number } })?.data || res;
      const notifList = (payload as { data?: NotificationItem[] })?.data || (Array.isArray(payload) ? payload : []);
      const count = (payload as { unreadCount?: number })?.unreadCount ?? notifList.filter((n) => !n.isRead).length;

      setNotifications(notifList);
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

  const handleMarkAsRead = async (id: string, link?: string | null) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (link) {
        setIsOpen(false);
        router.push(link);
      }
    } catch {
      // ignore
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsLoading(true);
    try {
      await api.post("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "ASSIGNMENT":
        return <UserPlus className="w-4 h-4 text-indigo-400" />;
      case "COMMENT_ADDED":
        return <MessageSquare className="w-4 h-4 text-emerald-400" />;
      case "STATUS_CHANGED":
        return <RefreshCw className="w-4 h-4 text-amber-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2 rounded-lg border border-slate-800 bg-slate-900/90 hover:bg-slate-800/80 text-slate-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
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
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950 text-rose-300 border border-rose-800">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={isLoading}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
                  <Inbox className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-300">All caught up!</p>
                <p className="text-[11px] text-slate-500">
                  When new tasks are assigned or comments are added, they will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleMarkAsRead(item.id, item.link)}
                  className={`p-3 transition-colors cursor-pointer flex items-start gap-3 ${
                    item.isRead
                      ? "hover:bg-slate-850/50 opacity-75"
                      : "bg-indigo-950/20 hover:bg-indigo-950/30 border-l-2 border-indigo-500"
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 shrink-0 mt-0.5">
                    {getIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-white truncate">
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-snug line-clamp-2">
                      {item.message}
                    </p>

                    {item.link && (
                      <div className="pt-0.5 flex items-center gap-1 text-[11px] text-indigo-400 font-medium">
                        <span>View issue</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  {!item.isRead && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
