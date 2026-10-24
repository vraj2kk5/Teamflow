"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  Clock,
  Calendar,
  MoreVertical,
} from "lucide-react";
import { Badge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { cn, formatDate } from "../../lib/utils";

export interface IssueItem {
  id: string;
  key: string;
  title: string;
  description: string;
  type: "TASK" | "BUG";
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate?: string | null;
  assignee?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
  reporter?: {
    id: string;
    name: string;
  } | null;
  project?: {
    id: string;
    name: string;
  };
  _count?: {
    comments: number;
    attachments: number;
  };
}

interface KanbanCardProps {
  issue: IssueItem;
  onStatusChange: (issueId: string, newStatus: IssueItem["status"]) => void;
  isDragging?: boolean;
  onDragStart?: (issueId: string) => void;
  onDragEnd?: () => void;
}

export function KanbanCard({
  issue,
  onStatusChange,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: KanbanCardProps) {
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const isOverdue =
    issue.dueDate &&
    new Date(issue.dueDate) < new Date() &&
    issue.status !== "DONE";

  const statuses: { value: IssueItem["status"]; label: string }[] = [
    { value: "TODO", label: "To Do" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "IN_REVIEW", label: "In Review" },
    { value: "DONE", label: "Done" },
  ];

  return (
    <div
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", issue.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(issue.id);
      }}
      onDragEnd={() => onDragEnd?.()}
      className={cn(
        "group rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:border-indigo-400 dark:hover:border-slate-700 hover:shadow-md transition-all space-y-3 cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-40 scale-95 border-dashed border-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/20"
      )}
    >
      {/* Top Header: Key, Type, Priority, Status Dropdown */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {issue.type === "BUG" ? (
            <span className="p-1 rounded bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80" title="Bug Report">
              <Bug className="w-3.5 h-3.5" />
            </span>
          ) : (
            <span className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80" title="Task">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          )}
          <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">{issue.key}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge
            size="sm"
            variant={
              issue.priority === "CRITICAL"
                ? "danger"
                : issue.priority === "HIGH"
                ? "warning"
                : issue.priority === "MEDIUM"
                ? "primary"
                : "neutral"
            }
          >
            {issue.priority}
          </Badge>

          {/* Accessible Status Selector for Touch & Keyboard */}
          <div className="relative">
            <select
              aria-label={`Change status for ${issue.key}`}
              value={issue.status}
              disabled={isChangingStatus}
              onChange={async (e) => {
                setIsChangingStatus(true);
                try {
                  await onStatusChange(issue.id, e.target.value as IssueItem["status"]);
                } finally {
                  setIsChangingStatus(false);
                }
              }}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  Move to: {s.label}
                </option>
              ))}
            </select>
            <button
              className="p-1 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Move card to status"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Title */}
      <Link
        href={`/issues/${issue.id}`}
        className="block text-sm font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2"
      >
        {issue.title}
      </Link>

      {/* Footer: Due Date & Assignee */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
        {issue.dueDate ? (
          <div
            className={cn(
              "flex items-center gap-1 text-[11px]",
              isOverdue ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-slate-500 dark:text-slate-400"
            )}
            title={isOverdue ? "Overdue" : "Due Date"}
          >
            <Calendar className="w-3 h-3" />
            <span>{formatDate(issue.dueDate)}</span>
          </div>
        ) : (
          <span className="text-slate-400 dark:text-slate-600 text-[11px]">No due date</span>
        )}

        <div className="flex items-center gap-1.5">
          {issue.assignee ? (
            <Avatar
              name={issue.assignee.name}
              avatarUrl={issue.assignee.avatarUrl}
              size="sm"
            />
          ) : (
            <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">Unassigned</span>
          )}
        </div>
      </div>
    </div>
  );
}
