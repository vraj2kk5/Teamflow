"use client";

import React, { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { Skeleton } from "../ui/Skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  BarChart3,
  Users,
  Zap,
  RefreshCw,
} from "lucide-react";

interface AnalyticsData {
  summary: {
    totalIssues: number;
    completedIssues: number;
    openIssues: number;
    completionPercentage: number;
    totalEstimatedHours: number;
    completedHours: number;
    avgResolutionDays: number;
  };
  burndown: {
    date: string;
    actualRemaining: number;
    idealRemaining: number;
    completed: number;
  }[];
  velocityWeekly: {
    week: string;
    tasks: number;
    bugs: number;
    total: number;
  }[];
  priorityDistribution: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  memberStats: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    total: number;
    done: number;
    inProgress: number;
    todo: number;
    velocityRate: number;
  }[];
}

export function ProjectAnalyticsView({ projectId }: { projectId: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: AnalyticsData }>(`/projects/${projectId}/analytics`);
      setData(res.data);
    } catch (err: any) {
      setError(err?.message || "Failed to load project analytics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [projectId]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-800/40 rounded-xl border border-slate-700/50" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-800/40 rounded-xl border border-slate-700/50" />
          <div className="h-80 bg-slate-800/40 rounded-xl border border-slate-700/50" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white">Analytics Unavailable</h3>
        <p className="text-sm text-slate-400 mt-1 mb-4">{error || "Could not retrieve sprint metrics."}</p>
        <button
          onClick={fetchAnalytics}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  const { summary, burndown, velocityWeekly, priorityDistribution, memberStats } = data;

  // Max value for SVG Burndown scaling
  const maxBurndown = Math.max(
    1,
    ...burndown.map((b) => Math.max(b.actualRemaining, b.idealRemaining))
  );

  // Max value for Weekly Velocity scaling
  const maxWeekly = Math.max(1, ...velocityWeekly.map((v) => v.total));

  return (
    <div className="space-y-6">
      {/* 1. Header Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Completion Velocity */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Sprint Completion
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{summary.completionPercentage}%</span>
            <span className="text-xs text-slate-400">
              ({summary.completedIssues}/{summary.totalIssues} tasks)
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${summary.completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Burned Hours */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Estimated Hours Burned
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{summary.completedHours}h</span>
            <span className="text-xs text-slate-400">/ {summary.totalEstimatedHours}h planned</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {summary.totalEstimatedHours > 0
              ? `${Math.round((summary.completedHours / summary.totalEstimatedHours) * 100)}% effort delivered`
              : "No estimates entered"}
          </p>
        </div>

        {/* Average Resolution Speed */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Avg. Resolution Cycle
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{summary.avgResolutionDays}</span>
            <span className="text-xs text-slate-400">days / issue</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">From creation to DONE state</p>
        </div>

        {/* Active Backlog */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Open Work Items
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{summary.openIssues}</span>
            <span className="text-xs text-slate-400">remaining</span>
          </div>
          <div className="mt-2 flex gap-1.5">
            <span className="text-[11px] text-rose-400 font-medium">
              {priorityDistribution.CRITICAL} Critical
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-[11px] text-amber-400 font-medium">
              {priorityDistribution.HIGH} High
            </span>
          </div>
        </div>
      </div>

      {/* 2. Charts Row: Burndown & Weekly Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 14-Day Sprint Burndown Chart */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                14-Day Sprint Burndown
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Remaining scope vs. ideal trajectory</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-3 h-0.5 bg-dashed bg-slate-500 inline-block border-t-2 border-dashed border-slate-500" />
                Ideal Guideline
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Actual Remaining
              </span>
            </div>
          </div>

          {/* SVG Burndown Graph */}
          <div className="h-56 w-full relative pt-4">
            <svg viewBox="0 0 500 180" className="w-full h-full overflow-visible">
              {/* Horizontal Grid lines */}
              {[0, 45, 90, 135].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="500"
                  y2={y}
                  stroke="#334155"
                  strokeDasharray="3 3"
                  strokeWidth="0.5"
                />
              ))}

              {/* Ideal Burndown Line */}
              <line
                x1="0"
                y1="10"
                x2="500"
                y2="160"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* Actual Burndown Polyline */}
              {burndown.length > 1 && (
                <>
                  <defs>
                    <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Area fill */}
                  <polygon
                    points={`0,160 ${burndown
                      .map((pt, idx) => {
                        const x = (idx / (burndown.length - 1)) * 500;
                        const y = 160 - (pt.actualRemaining / maxBurndown) * 150;
                        return `${x},${y}`;
                      })
                      .join(" ")} 500,160`}
                    fill="url(#burnGrad)"
                  />

                  {/* Stroke Line */}
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={burndown
                      .map((pt, idx) => {
                        const x = (idx / (burndown.length - 1)) * 500;
                        const y = 160 - (pt.actualRemaining / maxBurndown) * 150;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />

                  {/* Data Points */}
                  {burndown.map((pt, idx) => {
                    const x = (idx / (burndown.length - 1)) * 500;
                    const y = 160 - (pt.actualRemaining / maxBurndown) * 150;
                    return (
                      <g key={idx} className="group">
                        <circle
                          cx={x}
                          cy={y}
                          r="3.5"
                          className="fill-slate-900 stroke-emerald-400 stroke-2 hover:r-5 transition-all cursor-pointer"
                        />
                      </g>
                    );
                  })}
                </>
              )}
            </svg>

            {/* X-axis date labels */}
            <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-1">
              <span>{burndown[0]?.date}</span>
              <span>{burndown[Math.floor(burndown.length / 2)]?.date}</span>
              <span>{burndown[burndown.length - 1]?.date} (Today)</span>
            </div>
          </div>
        </div>

        {/* Weekly Sprint Velocity Chart */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Weekly Throughput Velocity
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Tasks delivered vs. bugs resolved</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-indigo-500" /> Tasks
              </span>
              <span className="flex items-center gap-1.5 text-rose-400 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-rose-500" /> Bugs
              </span>
            </div>
          </div>

          <div className="h-56 flex items-end justify-around gap-6 pt-6 pb-2">
            {velocityWeekly.map((item, idx) => {
              const taskHeight = maxWeekly > 0 ? (item.tasks / maxWeekly) * 140 : 0;
              const bugHeight = maxWeekly > 0 ? (item.bugs / maxWeekly) * 140 : 0;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 max-w-[64px]">
                  <span className="text-xs font-semibold text-white">{item.total}</span>
                  <div className="w-full flex items-end justify-center gap-1.5 h-36">
                    {/* Tasks bar */}
                    <div
                      className="w-1/2 bg-indigo-500 hover:bg-indigo-400 rounded-t-md transition-all duration-300"
                      style={{ height: `${Math.max(4, taskHeight)}px` }}
                      title={`${item.tasks} tasks completed`}
                    />
                    {/* Bugs bar */}
                    <div
                      className="w-1/2 bg-rose-500 hover:bg-rose-400 rounded-t-md transition-all duration-300"
                      style={{ height: `${Math.max(4, bugHeight)}px` }}
                      title={`${item.bugs} bugs resolved`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">{item.week}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Team Member Velocity & Workload Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">Member Workload & Delivery Velocity</h3>
          </div>
          <span className="text-xs text-slate-400">{memberStats.length} project collaborators</span>
        </div>

        <div className="divide-y divide-slate-800/60">
          {memberStats.map((member) => (
            <div
              key={member.id}
              className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar name={member.name} src={member.avatarUrl} size="md" />
                <div>
                  <h4 className="text-sm font-semibold text-white">{member.name}</h4>
                  <p className="text-xs text-slate-400">
                    {member.total} assigned • {member.done} completed • {member.inProgress} active
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="w-32 hidden sm:block">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">Delivery</span>
                    <span className="font-semibold text-emerald-400">{member.velocityRate}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${member.velocityRate}%` }}
                    />
                  </div>
                </div>

                <Badge
                  variant={member.done > 0 ? "success" : "default"}
                  className="font-medium shrink-0"
                >
                  {member.done} Delivered
                </Badge>
              </div>
            </div>
          ))}

          {memberStats.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No members assigned to this project yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
