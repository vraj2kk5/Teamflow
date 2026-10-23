"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, ApiClientError } from "../../lib/api";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Avatar } from "../../components/ui/Avatar";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  Bug,
  Plus,
  Search,
  Filter,
  Mic,
  Video,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { formatRelativeTime } from "../../lib/utils";

interface BugItem {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  type: "BUG";
  createdAt: string;
  project: {
    id: string;
    name: string;
  };
  reporter: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  assignee?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
  attachments?: {
    id: string;
    kind: "AUDIO" | "VIDEO" | "IMAGE";
  }[];
}

interface ProjectOption {
  id: string;
  name: string;
}

export default function BugReportsPage() {
  const { error: toastError } = useToast();
  const [bugs, setBugs] = useState<BugItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [priority, setPriority] = useState<string>("ALL");
  const [projectId, setProjectId] = useState<string>("ALL");
  const [hasMediaOnly, setHasMediaOnly] = useState<boolean>(false);

  // Fetch projects for filter dropdown
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await api.get<ProjectOption[]>("/projects");
        const list = Array.isArray(res) ? res : (res as unknown as { data?: ProjectOption[] })?.data || [];
        setProjects(Array.isArray(list) ? list : []);
      } catch {
        // silent fallback
      }
    }
    loadProjects();
  }, []);

  // Fetch bugs
  const fetchBugs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number | boolean | undefined | null> = {
        type: "BUG",
      };
      if (search.trim()) params.search = search.trim();
      if (status !== "ALL") params.status = status;
      if (priority !== "ALL") params.priority = priority;
      if (projectId !== "ALL") params.projectId = projectId;

      const res = await api.get<{
        issues: BugItem[];
        pagination: { total: number; page: number; limit: number };
      }>("/issues", params);

      setBugs(
        Array.isArray(res)
          ? res
          : (res as unknown as { data?: BugItem[] })?.data ||
            (res as unknown as { issues?: BugItem[] })?.issues ||
            []
      );
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to load bug reports");
      }
    } finally {
      setIsLoading(false);
    }
  }, [search, status, priority, projectId, toastError]);

  useEffect(() => {
    fetchBugs();
  }, [fetchBugs]);

  // Derived filter for media if checked
  const filteredBugs = bugs.filter((b) => {
    if (!hasMediaOnly) return true;
    return b.attachments && b.attachments.length > 0;
  });

  // Bug stats
  const totalBugs = bugs.length;
  const openBugs = bugs.filter((b) => b.status === "TODO" || b.status === "IN_PROGRESS").length;
  const criticalBugs = bugs.filter((b) => b.priority === "CRITICAL" && b.status !== "DONE").length;
  const bugsWithMedia = bugs.filter((b) => b.attachments && b.attachments.length > 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Visual Bug Reports</h1>
            <Badge variant="danger" size="sm">
              <Bug className="w-3 h-3 mr-1 inline" />
              Live Tracker
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Capture, diagnose, and resolve issues with screen recordings, voice memos, and stack traces.
          </p>
        </div>

        <Link href="/bug-reports/new">
          <Button variant="danger" className="w-full sm:w-auto shadow-lg shadow-rose-600/20">
            <Plus className="w-4 h-4 mr-2" />
            <span>Report a Bug</span>
          </Button>
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Bugs</span>
            <Bug className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{totalBugs}</p>
          <span className="text-[11px] text-slate-500">Across current projects</span>
        </Card>

        <Card className="p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between text-amber-400 text-xs">
            <span>Open & In Progress</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-300 mt-2">{openBugs}</p>
          <span className="text-[11px] text-slate-500">Awaiting resolution</span>
        </Card>

        <Card className="p-4 border-rose-200 dark:border-rose-950/80 bg-rose-50/70 dark:bg-rose-950/20 shadow-sm">
          <div className="flex items-center justify-between text-rose-400 text-xs">
            <span>Critical Severity</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-300 mt-2">{criticalBugs}</p>
          <span className="text-[11px] text-rose-400/80">Requires immediate fix</span>
        </Card>

        <Card className="p-4 border-indigo-200 dark:border-indigo-950/80 bg-indigo-50/70 dark:bg-indigo-950/20 shadow-sm">
          <div className="flex items-center justify-between text-indigo-400 text-xs">
            <span>Visual Evidence</span>
            <Video className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-indigo-300 mt-2">{bugsWithMedia}</p>
          <span className="text-[11px] text-indigo-400/80">With screen / voice notes</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 space-y-3 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="DONE">Done</option>
          </Select>

          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="text-xs"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </Select>

          <Select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="text-xs"
          >
            <option value="ALL">All Projects</option>
            {(Array.isArray(projects) ? projects : []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
            <input
              type="checkbox"
              checked={hasMediaOnly}
              onChange={(e) => setHasMediaOnly(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 focus:ring-0"
            />
            <span>Only show bugs with media attachments (screen recording, audio, screenshots)</span>
          </label>
        </div>
      </Card>

      {/* Bugs List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : filteredBugs.length === 0 ? (
        <Card className="py-12">
          <EmptyState
            icon={Bug}
            title="No bug reports found"
            description={
              search || status !== "ALL" || priority !== "ALL"
                ? "Try clearing some filters to see more results."
                : "Great news! No bugs currently reported in your projects."
            }
            actionLabel="Report a Bug"
            onAction={() => (window.location.href = "/bug-reports/new")}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filteredBugs.map((bug) => {
            const hasAudio = bug.attachments?.some((a) => a.kind === "AUDIO");
            const hasVideo = bug.attachments?.some((a) => a.kind === "VIDEO");
            const hasImage = bug.attachments?.some((a) => a.kind === "IMAGE");

            return (
              <Link
                key={bug.id}
                href={`/issues/${bug.id}`}
                className="group block p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/90 hover:border-rose-400 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  {/* Left info */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-rose-400">
                        {bug.key}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs text-slate-400 font-medium truncate max-w-[150px]">
                        {bug.project.name}
                      </span>
                      <Badge
                        size="sm"
                        variant={
                          bug.priority === "CRITICAL"
                            ? "danger"
                            : bug.priority === "HIGH"
                            ? "warning"
                            : bug.priority === "MEDIUM"
                            ? "primary"
                            : "neutral"
                        }
                      >
                        {bug.priority}
                      </Badge>
                      <Badge
                        size="sm"
                        variant={
                          bug.status === "DONE"
                            ? "success"
                            : bug.status === "IN_PROGRESS"
                            ? "warning"
                            : bug.status === "IN_REVIEW"
                            ? "purple"
                            : "neutral"
                        }
                      >
                        {bug.status.replace("_", " ")}
                      </Badge>
                    </div>

                    <h3 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {bug.title}
                    </h3>

                    {bug.description && (
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {bug.description}
                      </p>
                    )}
                  </div>

                  {/* Right metadata: media tags + reporter + arrow */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {/* Media indicator badges */}
                    <div className="flex items-center gap-1.5">
                      {hasVideo && (
                        <span
                          title="Screen recording attached"
                          className="p-1.5 rounded-md bg-indigo-950/80 border border-indigo-800 text-indigo-400"
                        >
                          <Video className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {hasAudio && (
                        <span
                          title="Voice memo attached"
                          className="p-1.5 rounded-md bg-amber-950/80 border border-amber-800 text-amber-400"
                        >
                          <Mic className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {hasImage && (
                        <span
                          title="Screenshots attached"
                          className="p-1.5 rounded-md bg-emerald-950/80 border border-emerald-800 text-emerald-400"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    {/* Reporter Avatar */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Avatar
                        name={bug.reporter.name}
                        avatarUrl={bug.reporter.avatarUrl}
                        size="sm"
                      />
                      <span className="hidden md:inline text-xs">{bug.reporter.name}</span>
                    </div>

                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      {formatRelativeTime(bug.createdAt)}
                    </span>

                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
