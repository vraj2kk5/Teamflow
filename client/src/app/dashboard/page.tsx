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
  Bug,
  Activity,
  Sparkles,
  Plus,
} from "lucide-react";
import { formatDate, cn } from "../../lib/utils";
import { TeamActivityChart } from "../../components/dashboard/TeamActivityChart";

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
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-white to-slate-50 dark:from-indigo-950/70 dark:via-slate-900 dark:to-slate-900 border border-indigo-100 dark:border-indigo-800/40 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Welcome back, {user?.name || "Developer"}
            </h1>
            <Badge variant="primary" size="sm">
              <Sparkles className="w-3 h-3 mr-1 inline" />
              {role}
            </Badge>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Workspace:{" "}
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {organization?.name}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {role !== "ADMIN" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/my-tasks")}
            >
              <span>My Tasks</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/tasks?create=true")}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Give / New Task</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="primary"
            onClick={() => router.push("/bug-reports/new")}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            <Bug className="w-3.5 h-3.5 mr-1" />
            <span>Report a Bug</span>
          </Button>
        </div>
      </div>

      {/* Real Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1 border-0 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              Total Projects
            </CardTitle>
            <FolderKanban className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.totalProjects}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Active across organization
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 border-0 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              Open Tasks
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.openTasks}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {stats.inProgressIssues} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 border-0 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              Open Bugs
            </CardTitle>
            <Bug className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {stats.openBugs}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Reported & unresolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 border-0 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
              Overdue Items
            </CardTitle>
            <Clock
              className={cn(
                "w-4 h-4",
                stats.overdueIssues > 0
                  ? "text-rose-500 dark:text-rose-400"
                  : "text-slate-400"
              )}
            />
          </CardHeader>
          <CardContent className="pt-0">
            <div
              className={cn(
                "text-2xl font-bold",
                stats.overdueIssues > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-900 dark:text-white"
              )}
            >
              {stats.overdueIssues}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {stats.completedIssues} tasks completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Team Work & Completion Analytics Graph */}
      <TeamActivityChart />

      {/* Main Split: Project Health & Assigned Work vs Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Health Progress Breakdown */}
          <Card className="space-y-4">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                Project Progress & Health
              </CardTitle>
              <Link
                href="/projects"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View All
              </Link>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
              {projectHealth.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  No projects in this organization yet.
                </p>
              ) : (
                projectHealth.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="block p-4 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-950/60 dark:hover:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/80 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FolderKanban className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {p.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs shrink-0">
                        {p.openBugs > 0 && (
                          <Badge size="sm" variant="danger">
                            {p.openBugs} {p.openBugs === 1 ? "bug" : "bugs"}
                          </Badge>
                        )}
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {p.completionPercentage}%
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${p.completionPercentage}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                      <span>
                        {p.doneIssues} of {p.totalIssues} issues resolved
                      </span>
                      {p.overdueCount > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">
                          {p.overdueCount} overdue
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">
                          On schedule
                        </span>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* My Assigned Work Quick Table (or Tasks Needing Assignment for Admin) */}
          <Card className="space-y-4">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
                {role === "ADMIN" ? "Tasks Needing Assignment" : "My Assigned Work"}
              </CardTitle>
              <Link
                href={role === "ADMIN" ? "/issues" : "/my-tasks"}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View All
              </Link>
            </CardHeader>

            <CardContent className="space-y-2.5 pt-0">
              {myAssignedIssues.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  {role === "ADMIN"
                    ? "All tasks are currently assigned to team members."
                    : "You have no pending assigned tasks. Good job!"}
                </p>
              ) : (
                myAssignedIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/issues/${issue.id}`}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/90 dark:bg-slate-950/60 dark:hover:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/80 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">
                        {issue.key}
                      </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
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
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {issue.project.name}
                      </span>
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
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span>Recent Activity</span>
              </CardTitle>
              <Link
                href="/activity"
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Full Log
              </Link>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4 text-center">
                  No recent activity logged.
                </p>
              ) : (
                recentActivity.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-950/50 border border-slate-200/90 dark:border-slate-800/60 space-y-1.5 text-xs transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={log.actor.name}
                          avatarUrl={log.actor.avatarUrl}
                          size="sm"
                        />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {log.actor.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 pl-8">
                      {log.action.replace(/_/g, " ").toLowerCase()}{" "}
                      {log.issue && (
                        <Link
                          href={`/issues/${log.issue.id}`}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {log.issue.key}
                        </Link>
                      )}
                      {log.project && !log.issue && (
                        <Link
                          href={`/projects/${log.project.id}`}
                          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
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
