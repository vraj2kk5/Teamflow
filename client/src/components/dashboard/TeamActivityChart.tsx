"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { api, ApiClientError } from "../../lib/api";
import { useToast } from "../ui/Toast";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";
import { Skeleton } from "../ui/Skeleton";
import {
  BarChart3,
  CheckCircle2,
  Bug,
  Users,
  Calendar,
  Filter,
  Search,
  ArrowUpRight,
  Sparkles,
  TrendingUp,
  UserCheck,
  RotateCcw,
} from "lucide-react";
import { formatDate, cn } from "../../lib/utils";

interface CompletedIssueItem {
  id: string;
  key: string;
  title: string;
  type: string;
  priority: string;
  resolvedAt: string;
  assignee: {
    id: string;
    name: string;
    avatarUrl: string | null;
    email?: string;
  } | null;
  reporter: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  project: {
    id: string;
    name: string;
  };
}

interface TimelineDay {
  date: string;
  label: string;
  tasksCount: number;
  bugsCount: number;
  totalCount: number;
  items: CompletedIssueItem[];
}

interface MemberStat {
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    email: string;
    jobTitle: string | null;
  };
  role: string;
  completedCount: number;
  tasksCount: number;
  bugsCount: number;
  activeCount: number;
  completedIssues: CompletedIssueItem[];
}

interface AnalyticsResponse {
  timeframeDays: number;
  startDate: string;
  endDate: string;
  summary: {
    totalCompleted: number;
    tasksCompleted: number;
    bugsResolved: number;
    activeContributors: number;
  };
  timeline: TimelineDay[];
  memberStats: MemberStat[];
  unassignedCompleted: CompletedIssueItem[];
  recentCompleted: CompletedIssueItem[];
}

export function TeamActivityChart() {
  const { error: toastError } = useToast();
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Interactive filters
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "TASK" | "BUG">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredDay, setHoveredDay] = useState<TimelineDay | null>(null);

  const fetchAnalytics = useCallback(async (timeframe: number) => {
    setIsLoading(true);
    try {
      const res = await api.get<AnalyticsResponse>(`/dashboard/analytics?days=${timeframe}`);
      setData(res);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to load team activity analytics");
      }
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchAnalytics(days);
  }, [days, fetchAnalytics]);

  // Filtered completed items for the activity log table
  const filteredCompletedItems = useMemo(() => {
    if (!data) return [];
    let items = data.recentCompleted;

    if (selectedMemberId) {
      items = items.filter((item) => item.assignee?.id === selectedMemberId);
    }

    if (typeFilter !== "ALL") {
      items = items.filter((item) => item.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.key.toLowerCase().includes(query) ||
          item.project.name.toLowerCase().includes(query) ||
          (item.assignee?.name && item.assignee.name.toLowerCase().includes(query))
      );
    }

    return items;
  }, [data, selectedMemberId, typeFilter, searchQuery]);

  // Compute maximum daily total for responsive SVG scaling
  const maxDayCount = useMemo(() => {
    if (!data || !data.timeline.length) return 5;
    const maxVal = Math.max(...data.timeline.map((d) => d.totalCount));
    return Math.max(maxVal, 4);
  }, [data]);

  const selectedMemberName = useMemo(() => {
    if (!selectedMemberId || !data) return null;
    const m = data.memberStats.find((s) => s.user.id === selectedMemberId);
    return m ? m.user.name : "Selected Member";
  }, [selectedMemberId, data]);

  if (isLoading && !data) {
    return (
      <Card className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-8 w-44 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-xl w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="overflow-hidden border-slate-200/90 dark:border-slate-800/80 shadow-sm">
      {/* Header & Controls */}
      <CardHeader className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4 space-y-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Team Work Velocity & Completion Graph
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                What tasks and bug fixes team members have completed over the past {days} days
              </p>
            </div>
          </div>
        </div>

        {/* Timeframe Selector Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 self-start md:self-auto">
          {([7, 14, 30] as const).map((t) => (
            <button
              key={t}
              onClick={() => setDays(t)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                days === t
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              {t} Days
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* Quick KPI Stat Strips */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Completed Work</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {data.summary.totalCompleted}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Across all assigned projects
            </p>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
            <div className="flex items-center justify-between text-xs text-indigo-600 dark:text-indigo-400 mb-1">
              <span>Tasks Finished</span>
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
              {data.summary.tasksCompleted}
            </div>
            <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">
              Feature & sprint tasks
            </p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
            <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 mb-1">
              <span>Bugs Resolved</span>
              <Bug className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {data.summary.bugsResolved}
            </div>
            <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
              Verified fixes shipped
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>Active Contributors</span>
              <Users className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {data.summary.activeContributors}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Members with completions
            </p>
          </div>
        </div>

        {/* The Visual SVG Graph */}
        <div className="rounded-2xl bg-gradient-to-b from-white to-slate-50/80 dark:from-slate-950 dark:to-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-6 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Daily Completion Velocity
              </h3>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                (Hover over bars to inspect details)
              </span>
            </div>

            {/* Graph Legend */}
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-indigo-600 dark:bg-indigo-500" />
                <span className="text-slate-600 dark:text-slate-400">Tasks</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500" />
                <span className="text-slate-600 dark:text-slate-400">Bugs</span>
              </div>
            </div>
          </div>

          {/* SVG Chart Area */}
          <div className="relative w-full pt-4 pb-2">
            <div className="h-56 sm:h-64 w-full flex items-end gap-2 sm:gap-4 px-2 sm:px-4">
              {data.timeline.map((day, idx) => {
                const total = day.totalCount;
                const taskPct = maxDayCount > 0 ? (day.tasksCount / maxDayCount) * 100 : 0;
                const bugPct = maxDayCount > 0 ? (day.bugsCount / maxDayCount) * 100 : 0;
                const isHovered = hoveredDay?.date === day.date;

                return (
                  <div
                    key={day.date}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className="relative flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                  >
                    {/* Top count badge on hover or if non-zero */}
                    <div
                      className={cn(
                        "mb-1.5 text-[11px] font-bold transition-all duration-200",
                        total > 0
                          ? isHovered
                            ? "text-indigo-600 dark:text-indigo-400 scale-110"
                            : "text-slate-600 dark:text-slate-400"
                          : "text-transparent"
                      )}
                    >
                      {total}
                    </div>

                    {/* Stacked Vertical Bar */}
                    <div className="w-full max-w-[38px] flex flex-col justify-end rounded-t-lg overflow-hidden bg-slate-100 dark:bg-slate-800/50 transition-all duration-300 group-hover:brightness-110">
                      {total === 0 ? (
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-t-xs" />
                      ) : (
                        <>
                          {/* Bugs portion (Top of stack) */}
                          {day.bugsCount > 0 && (
                            <div
                              style={{ height: `${bugPct}%` }}
                              className="w-full bg-emerald-500 transition-all duration-500 min-h-[4px]"
                            />
                          )}
                          {/* Tasks portion (Bottom of stack) */}
                          {day.tasksCount > 0 && (
                            <div
                              style={{ height: `${taskPct}%` }}
                              className="w-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500 min-h-[4px]"
                            />
                          )}
                        </>
                      )}
                    </div>

                    {/* Bottom Day Label */}
                    <div
                      className={cn(
                        "mt-2 text-[10px] sm:text-xs text-center transition-colors truncate max-w-full font-medium",
                        isHovered
                          ? "text-indigo-600 dark:text-indigo-400 font-bold"
                          : "text-slate-500 dark:text-slate-400"
                      )}
                    >
                      {days === 30 ? (idx % 3 === 0 ? day.label.split(", ")[1] : "") : day.label.split(", ")[1] || day.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hover Tooltip floating panel */}
            {hoveredDay && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-900 text-white dark:bg-slate-800 shadow-xl border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-semibold">{hoveredDay.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge size="sm" variant="primary" className="bg-indigo-500/20 text-indigo-300 border-indigo-400/30">
                      {hoveredDay.tasksCount} Tasks
                    </Badge>
                    <Badge size="sm" variant="success" className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
                      {hoveredDay.bugsCount} Bugs
                    </Badge>
                  </div>
                </div>

                {hoveredDay.items.length === 0 ? (
                  <p className="text-xs text-slate-400 italic pt-2">
                    No items marked completed on this day.
                  </p>
                ) : (
                  <div className="pt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {hoveredDay.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-800/80 dark:bg-slate-900/60"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span
                            className={cn(
                              "font-mono font-bold text-[11px]",
                              item.type === "BUG" ? "text-rose-400" : "text-indigo-400"
                            )}
                          >
                            {item.key}
                          </span>
                          <span className="truncate text-slate-200">{item.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Avatar
                            name={item.assignee?.name || "Unassigned"}
                            avatarUrl={item.assignee?.avatarUrl}
                            size="sm"
                            className="w-4 h-4 text-[9px]"
                          />
                          <span className="text-[11px] text-slate-300 font-medium">
                            {item.assignee?.name?.split(" ")[0] || "Unassigned"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Team Member Contribution Breakdown Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Team Member Output & Workload Breakdown
              </h3>
            </div>
            {selectedMemberId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMemberId(null)}
                className="text-xs text-indigo-600 dark:text-indigo-400 h-7 px-2"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Clear Person Filter
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.memberStats.map((member) => {
              const isSelected = selectedMemberId === member.user.id;
              const completedPct =
                data.summary.totalCompleted > 0
                  ? Math.round((member.completedCount / data.summary.totalCompleted) * 100)
                  : 0;

              return (
                <div
                  key={member.user.id}
                  onClick={() =>
                    setSelectedMemberId(isSelected ? null : member.user.id)
                  }
                  className={cn(
                    "p-3.5 rounded-xl border transition-all cursor-pointer select-none group",
                    isSelected
                      ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 shadow-sm ring-2 ring-indigo-500/20"
                      : "bg-white hover:bg-slate-50 dark:bg-slate-900/60 dark:hover:bg-slate-800/60 border-slate-200/90 dark:border-slate-800"
                  )}
                >
                  <div className="flex items-center justify-between gap-2.5 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        name={member.user.name}
                        avatarUrl={member.user.avatarUrl}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {member.user.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {member.user.jobTitle || member.role}
                        </p>
                      </div>
                    </div>

                    <Badge
                      size="sm"
                      variant={isSelected ? "primary" : "neutral"}
                      className="shrink-0 font-semibold"
                    >
                      {member.completedCount} done
                    </Badge>
                  </div>

                  {/* Relative completion share progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden my-2">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isSelected ? "bg-indigo-600 dark:bg-indigo-400" : "bg-indigo-500/70"
                      )}
                      style={{ width: `${completedPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {member.tasksCount}
                      </span>{" "}
                      tasks &bull;{" "}
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {member.bugsCount}
                      </span>{" "}
                      bugs
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">
                      {member.activeCount} in progress
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed "What task what person has done" Log Table */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Completed Task Log
              </h3>
              {selectedMemberName && (
                <Badge variant="primary" size="sm">
                  Filtered: {selectedMemberName}
                </Badge>
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({filteredCompletedItems.length} items)
              </span>
            </div>

            {/* Filter Buttons & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type pills */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                {(["ALL", "TASK", "BUG"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-medium transition-colors",
                      typeFilter === t
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {t === "ALL" ? "All" : t === "TASK" ? "Tasks" : "Bugs"}
                  </button>
                ))}
              </div>

              {/* Search query input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search completed tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 w-40 sm:w-52"
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/60 shadow-2xs">
            {filteredCompletedItems.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  No completed tasks found matching the selected timeframe and filters.
                </p>
                {(selectedMemberId || typeFilter !== "ALL" || searchQuery) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedMemberId(null);
                      setTypeFilter("ALL");
                      setSearchQuery("");
                    }}
                    className="text-xs text-indigo-600 dark:text-indigo-400"
                  >
                    Reset all filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-96 overflow-y-auto">
                {filteredCompletedItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-850/60 transition-colors group"
                  >
                    {/* Left: Task Identity & Title */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 pr-2">
                      <div className="shrink-0 mt-0.5 sm:mt-0">
                        {item.type === "BUG" ? (
                          <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
                            <Bug className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/issues/${item.id}`}
                            className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            {item.key}
                          </Link>
                          <span className="text-xs text-slate-400">&bull;</span>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {item.project.name}
                          </span>
                        </div>
                        <Link
                          href={`/issues/${item.id}`}
                          className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1 mt-0.5"
                        >
                          {item.title}
                        </Link>
                      </div>
                    </div>

                    {/* Right: Person and Completed Date */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pl-9 sm:pl-0">
                      {/* Assignee who completed it */}
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={item.assignee?.name || "Unassigned"}
                          avatarUrl={item.assignee?.avatarUrl}
                          size="sm"
                        />
                        <div className="text-left">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                            {item.assignee?.name || "Unassigned"}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            Completed by
                          </p>
                        </div>
                      </div>

                      {/* Date Badge */}
                      <div className="text-right">
                        <Badge size="sm" variant="neutral" className="text-[11px] font-mono">
                          {formatDate(item.resolvedAt)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
