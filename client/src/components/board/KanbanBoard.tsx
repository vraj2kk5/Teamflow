"use client";

import React, { useState } from "react";
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeDropCol, setActiveDropCol] = useState<IssueItem["status"] | null>(null);

  const handleDragOver = (e: React.DragEvent, colId: IssueItem["status"]) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (activeDropCol !== colId) {
      setActiveDropCol(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colId: IssueItem["status"]) => {
    // Only clear if leaving the column element itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (activeDropCol === colId) {
      setActiveDropCol(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: IssueItem["status"]) => {
    e.preventDefault();
    setActiveDropCol(null);
    setDraggingId(null);
    const issueId = e.dataTransfer.getData("text/plain") || draggingId;
    if (issueId) {
      onStatusChange(issueId, targetStatus);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {columns.map((col) => {
        const Icon = col.icon;
        const columnIssues = issues.filter((i) => i.status === col.id);
        const isTarget = activeDropCol === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={(e) => handleDragLeave(e, col.id)}
            onDrop={(e) => handleDrop(e, col.id)}
            className={cn(
              "flex flex-col rounded-2xl bg-slate-100/80 dark:bg-slate-950 border p-3 min-h-[500px] transition-all duration-150",
              isTarget
                ? "border-dashed border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 scale-[1.01]"
                : "border-slate-200/90 dark:border-slate-800/80"
            )}
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

            {/* Drop Target Indicator when Dragging Over */}
            {isTarget && (
              <div className="mt-3 p-2.5 rounded-xl border-2 border-dashed border-indigo-400 dark:border-indigo-500 bg-indigo-100/40 dark:bg-indigo-900/30 text-center text-xs font-medium text-indigo-700 dark:text-indigo-300 animate-pulse">
                Drop to move to {col.title}
              </div>
            )}

            {/* Cards List */}
            <div className="flex-1 pt-3 space-y-3 overflow-y-auto">
              {columnIssues.length === 0 ? (
                <div className="h-32 rounded-xl border border-dashed border-slate-300 dark:border-slate-800/80 flex items-center justify-center text-xs text-slate-400 dark:text-slate-600">
                  {isTarget ? "Release to drop here" : "No issues"}
                </div>
              ) : (
                columnIssues.map((issue) => (
                  <KanbanCard
                    key={issue.id}
                    issue={issue}
                    onStatusChange={onStatusChange}
                    isDragging={draggingId === issue.id}
                    onDragStart={(id) => setDraggingId(id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setActiveDropCol(null);
                    }}
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
