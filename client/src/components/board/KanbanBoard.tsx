"use client";

import React from "react";
import { KanbanCard, IssueItem } from "./KanbanCard";
import { Circle, Clock, Eye, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface KanbanBoardProps {
  issues: IssueItem[];
  onStatusChange: (issueId: string, newStatus: IssueItem["status"]) => void;
}

const columns: {
  id: IssueItem["status"];
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  headerColor: string;
}[] = [
  {
    id: "TODO",
    title: "To Do",
    icon: Circle,
    headerColor: "text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700",
  },
  {
    id: "IN_PROGRESS",
    title: "In Progress",
    icon: Clock,
    headerColor: "text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800/60",
  },
  {
    id: "IN_REVIEW",
    title: "In Review",
    icon: Eye,
    headerColor: "text-indigo-700 dark:text-indigo-400 bg-indigo-100/80 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800/60",
  },
  {
    id: "DONE",
    title: "Done",
    icon: CheckCircle2,
    headerColor: "text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800/60",
  },
];

export function KanbanBoard({ issues, onStatusChange }: KanbanBoardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {columns.map((col) => {
        const Icon = col.icon;
        const columnIssues = issues.filter((i) => i.status === col.id);

        return (
          <div
            key={col.id}
            className="flex flex-col rounded-2xl bg-slate-100/80 dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/80 p-3 min-h-[500px] transition-colors"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 px-2 border-b border-slate-200 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-200">{col.title}</h4>
              </div>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-semibold border",
                  col.headerColor
                )}
              >
                {columnIssues.length}
              </span>
            </div>

            {/* Cards List */}
            <div className="flex-1 pt-3 space-y-3 overflow-y-auto">
              {columnIssues.length === 0 ? (
                <div className="h-32 rounded-xl border border-dashed border-slate-300 dark:border-slate-800/80 flex items-center justify-center text-xs text-slate-400 dark:text-slate-600">
                  No issues
                </div>
              ) : (
                columnIssues.map((issue) => (
                  <KanbanCard
                    key={issue.id}
                    issue={issue}
                    onStatusChange={onStatusChange}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
