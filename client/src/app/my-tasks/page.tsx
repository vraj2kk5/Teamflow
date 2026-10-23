"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, ApiClientError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { CheckSquare, Bug, CheckCircle2, Clock, Calendar, ArrowRight } from "lucide-react";
import { formatDate, cn } from "../../lib/utils";

interface MyTaskItem {
  id: string;
  key: string;
  title: string;
  description: string;
  type: "TASK" | "BUG";
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate?: string | null;
  project: {
    id: string;
    name: string;
  };
}

export default function MyTasksPage() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [tasks, setTasks] = useState<MyTaskItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ data: MyTaskItem[] }>("/issues", {
        assigneeId: "me",
        status: filterStatus || undefined,
        type: filterType || undefined,
        pageSize: 100,
      });
      setTasks(Array.isArray(res) ? res : (res as unknown as { data?: MyTaskItem[] })?.data || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to load assigned tasks");
      }
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterType, toastError]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleStatusChange = async (issueId: string, newStatus: MyTaskItem["status"]) => {
    try {
      await api.patch(`/issues/${issueId}/status`, { status: newStatus });
      toastSuccess("Status updated");
      setTasks((prev) =>
        prev.map((t) => (t.id === issueId ? { ...t, status: newStatus } : t))
      );
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Could not update status");
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-indigo-400" />
            <span>My Tasks</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Issues and visual bug reports assigned specifically to you ({tasks.length} tasks)
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-36"
            options={[
              { value: "", label: "All Statuses" },
              { value: "TODO", label: "To Do" },
              { value: "IN_PROGRESS", label: "In Progress" },
              { value: "IN_REVIEW", label: "In Review" },
              { value: "DONE", label: "Done" },
            ]}
          />

          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-32"
            options={[
              { value: "", label: "All Types" },
              { value: "TASK", label: "Tasks" },
              { value: "BUG", label: "Bugs" },
            ]}
          />
        </div>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks assigned to you"
          description={
            filterStatus || filterType
              ? "No tasks match your selected filters."
              : "You have zero open tasks or bugs assigned to you right now."
          }
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isOverdue =
              task.dueDate &&
              new Date(task.dueDate) < new Date() &&
              task.status !== "DONE";

            return (
              <Card
                key={task.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5">
                    {task.type === "BUG" ? (
                      <span className="p-1 rounded bg-rose-950/80 text-rose-400 border border-rose-800/80 block">
                        <Bug className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="p-1 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-800/80 block">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">{task.key}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-400 font-medium">{task.project.name}</span>
                      <Badge
                        size="sm"
                        variant={
                          task.priority === "CRITICAL"
                            ? "danger"
                            : task.priority === "HIGH"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {task.priority}
                      </Badge>
                    </div>

                    <Link
                      href={`/issues/${task.id}`}
                      className="block text-sm font-semibold text-white hover:text-indigo-300 transition-colors truncate"
                    >
                      {task.title}
                    </Link>

                    {task.dueDate && (
                      <div
                        className={cn(
                          "flex items-center gap-1 text-[11px]",
                          isOverdue ? "text-rose-400 font-semibold" : "text-slate-500"
                        )}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>Due: {formatDate(task.dueDate)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <Select
                    value={task.status}
                    onChange={(e) =>
                      handleStatusChange(task.id, e.target.value as MyTaskItem["status"])
                    }
                    className="w-36 text-xs py-1"
                    options={[
                      { value: "TODO", label: "To Do" },
                      { value: "IN_PROGRESS", label: "In Progress" },
                      { value: "IN_REVIEW", label: "In Review" },
                      { value: "DONE", label: "Done" },
                    ]}
                  />

                  <Link
                    href={`/issues/${task.id}`}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                    title="View details"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
