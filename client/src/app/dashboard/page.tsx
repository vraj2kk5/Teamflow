"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Avatar } from "../../components/ui/Avatar";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bug,
  Activity,
  Flame,
  Calendar,
  ArrowRight,
  Sparkles,
  Users,
} from "lucide-react";
import { formatDate, formatDateTime, cn } from "../../lib/utils";

interface DashboardData {
  stats: {
    totalProjects: number;
    openTasks: number;
    inProgressIssues: number;
    inReviewIssues: number;
    completedIssues: number;
    openBugs: number;
    highPriorityOpen: number;
    overdueIssues: number;
  };
  projectHealth: {
    id: string;
    name: string;
    status: string;
    totalIssues: number;
    doneIssues: number;
    completionPercentage: number;
    openBugs: number;
    overdueCount: number;
  }[];
  recentActivity: {
    id: string;
    action: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    actor: {
      id: string;
      name: string;
      avatarUrl?: string | null;
    };
    project?: {
      id: string;
      name: string;
    } | null;
    issue?: {
      id: string;
      key: string;
      title: string;
      type: string;
    } | null;
  }[];
  myAssignedIssues: {
    id: string;
    key: string;
    title: string;
    priority: string;
    status: string;
    type: string;
    dueDate?: string | null;
    project: {
      id: string;
      name: string;
    };
  }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, organization, role } = useAuth();
  const { error: toastError } = useToast();

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<DashboardData>("/dashboard");
      setData(res);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to load dashboard metrics");
      }
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  const { stats, projectHealth, recentActivity, myAssignedIssues } = data;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Welcome back, {user?.name || "Developer"}
            </h1>
            <Badge variant="primary" size="sm">
              <Sparkles className="w-3 h-3 mr-1 inline" />
              {role}
            </Badge>
          </div>
          <p className="text-sm text-slate-300">
            Workspace: <span className="font-semibold text-white">{organization?.name}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/my-tasks")}
          >
            <span>My Tasks</span>
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => router.push("/bug-reports/new")}
            className="bg-rose-600 hover:bg-rose-700"
          >
            <Bug className="w-3.5 h-3.5 mr-1" />
            <span>Report a Bug</span>
          </Button>
        </div>
      </div>

      {/* Real Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-slate-400">Total Projects</CardTitle>
            <FolderKanban className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.totalProjects}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Active across organization</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-slate-400">Open Tasks</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">{stats.openTasks}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">{stats.inProgressIssues} in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-slate-400">Open Bugs</CardTitle>
            <Bug className="w-4 h-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-400">{stats.openBugs}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Reported & unresolved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase text-slate-400">Overdue Items</CardTitle>
            <Clock className={cn("w-4 h-4", stats.overdueIssues > 0 ? "text-rose-400" : "text-slate-400")} />
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", stats.overdueIssues > 0 ? "text-rose-400" : "text-white")}>
              {stats.overdueIssues}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{stats.completedIssues} tasks completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Split: Project Health & Assigned Work vs Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Health Progress Breakdown */}
          <Card className="space-y-4">
            <CardHeader className="pb-2 border-b border-slate-800">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Project Progress & Health</span>
                <Link href="/projects" className="text-xs font-normal text-indigo-400 hover:underline">
                  View All
                </Link>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
              {projectHealth.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  No projects in this organization yet.
                </p>
              ) : (
                projectHealth.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="block p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FolderKanban className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                          {p.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs shrink-0">
                        {p.openBugs > 0 && (
                          <Badge size="sm" variant="danger">
                            {p.openBugs} {p.openBugs === 1 ? "bug" : "bugs"}
                          </Badge>
                        )}
                        <span className="font-semibold text-white">{p.completionPercentage}%</span>
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${p.completionPercentage}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2">
                      <span>{p.doneIssues} of {p.totalIssues} issues resolved</span>
                      {p.overdueCount > 0 ? (
                        <span className="text-rose-400 font-semibold">{p.overdueCount} overdue</span>
                      ) : (
                        <span className="text-slate-500">On schedule</span>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* My Assigned Work Quick Table */}
          <Card className="space-y-4">
            <CardHeader className="pb-2 border-b border-slate-800">
              <CardTitle className="text-base flex items-center justify-between">
                <span>My Assigned Work</span>
                <Link href="/my-tasks" className="text-xs font-normal text-indigo-400 hover:underline">
                  View All
                </Link>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-2 pt-1">
              {myAssignedIssues.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  You have no pending assigned tasks. Good job!
                </p>
              ) : (
                myAssignedIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/issues/${issue.id}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="font-mono text-xs font-semibold text-indigo-400 shrink-0">
                        {issue.key}
                      </span>
                      <span className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors truncate">
                        {issue.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        size="sm"
                        variant={
                          issue.priority === "CRITICAL"
                            ? "danger"
                            : issue.priority === "HIGH"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {issue.priority}
                      </Badge>
                      <span className="text-xs text-slate-400">{issue.project.name}</span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Recent Activity Feed */}
        <div className="space-y-6">
          <Card className="space-y-4">
            <CardHeader className="pb-2 border-b border-slate-800">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span>Recent Activity</span>
                </span>
                <Link href="/activity" className="text-xs font-normal text-indigo-400 hover:underline">
                  Full Log
                </Link>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 pt-1">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  No recent activity logged.
                </p>
              ) : (
                recentActivity.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar name={log.actor.name} avatarUrl={log.actor.avatarUrl} size="sm" />
                        <span className="font-semibold text-white">{log.actor.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>

                    <p className="text-slate-300 pl-8">
                      {log.action.replace(/_/g, " ").toLowerCase()}{" "}
                      {log.issue && (
                        <Link
                          href={`/issues/${log.issue.id}`}
                          className="font-medium text-indigo-400 hover:underline"
                        >
                          {log.issue.key}
                        </Link>
                      )}
                      {log.project && !log.issue && (
                        <Link
                          href={`/projects/${log.project.id}`}
                          className="font-medium text-indigo-400 hover:underline"
                        >
                          {log.project.name}
                        </Link>
                      )}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
