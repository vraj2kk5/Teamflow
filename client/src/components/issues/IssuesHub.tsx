"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../ui/Toast";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Badge } from "../ui/Badge";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import { Avatar } from "../ui/Avatar";
import { Modal } from "../ui/Modal";
import { Textarea } from "../ui/Textarea";
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  ListTodo,
  Search,
  Filter,
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { formatDate, cn } from "../../lib/utils";

interface IssueRow {
  id: string;
  key: string;
  title: string;
  type: "TASK" | "BUG";
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate?: string | null;
  project: {
    id: string;
    name: string;
  };
  reporter: {
    id: string;
    name: string;
  };
  assignee?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
  _count: {
    comments: number;
    attachments: number;
  };
}

interface ProjectMemberOption {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    memberships?: { role: string }[];
  };
}

interface ProjectOption {
  id: string;
  name: string;
  memberships?: ProjectMemberOption[];
}

export interface IssuesViewProps {
  pageMode?: "TASKS" | "ISSUES";
}

export function IssuesView({ pageMode = "ISSUES" }: IssuesViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, role } = useAuth();
  const canCreateTask = role === "ADMIN" || role === "PROJECT_MANAGER";
  const { success: toastSuccess, error: toastError } = useToast();

  const isTasksMode = pageMode === "TASKS";

  // Read URL query params
  const initialQ = searchParams.get("q") || "";
  const initialProject = searchParams.get("projectId") || "";
  const initialStatus = searchParams.get("status") || "";
  const initialPriority = searchParams.get("priority") || "";
  const initialAssignee = searchParams.get("assigneeId") || "";
  const initialType = searchParams.get("type") || (isTasksMode ? "TASK" : "BUG");
  const initialOverdue = searchParams.get("overdue") === "true";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);

  const [q, setQ] = useState(initialQ);
  const [projectId, setProjectId] = useState(initialProject);
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState(initialPriority);
  const [assigneeId, setAssigneeId] = useState(initialAssignee);
  const [type, setType] = useState(initialType);
  const [overdue, setOverdue] = useState(initialOverdue);
  const [page, setPage] = useState(initialPage);

  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // New Issue Modal
  const [isModalOpen, setIsModalOpen] = useState(searchParams.get("create") === "true");
  const [modalType, setModalType] = useState<"TASK" | "BUG">(
    searchParams.get("modalType") === "BUG" ? "BUG" : "TASK"
  );
  const [modalProjId, setModalProjId] = useState(initialProject || "");
  const [modalTitle, setModalTitle] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [modalPriority, setModalPriority] = useState("MEDIUM");
  const [modalDueDate, setModalDueDate] = useState("");
  const [modalAssigneeId, setModalAssigneeId] = useState("");
  const [modalAttachments, setModalAttachments] = useState<File[]>([]);
  const modalFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const currentModalProject = useMemo(() => {
    return (Array.isArray(projects) ? projects : []).find((p) => p.id === modalProjId);
  }, [projects, modalProjId]);

  const eligibleAssignees = useMemo(() => {
    if (!currentModalProject?.memberships) return [];
    // Administrators cannot be assigned tasks to perform; only team members / PMs
    return currentModalProject.memberships
      .filter((m: ProjectMemberOption) => {
        const orgRole = m.user.memberships?.[0]?.role;
        return orgRole !== "ADMIN";
      })
      .map((m: ProjectMemberOption) => m.user);
  }, [currentModalProject]);

  // Reset assignee if it no longer belongs to the selected project
  useEffect(() => {
    if (modalAssigneeId && !eligibleAssignees.some((u) => u.id === modalAssigneeId)) {
      setModalAssigneeId("");
    }
  }, [modalProjId, eligibleAssignees, modalAssigneeId]);

  // Update URL params
  const updateUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (projectId) params.set("projectId", projectId);
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (assigneeId) params.set("assigneeId", assigneeId);
    if (type) params.set("type", type);
    if (overdue) params.set("overdue", "true");
    if (page > 1) params.set("page", String(page));

    const queryString = params.toString();
    const basePath = isTasksMode ? "/tasks" : "/issues";
    router.replace(`${basePath}${queryString ? `?${queryString}` : ""}`);
  }, [q, projectId, status, priority, assigneeId, type, overdue, page, router, isTasksMode]);

  // Fetch Projects List for select filter and modals
  useEffect(() => {
    let isMounted = true;
    api
      .get<{ data: ProjectOption[] }>("/projects", { pageSize: 100 })
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res) ? res : (res as unknown as { data?: ProjectOption[] })?.data || [];
        const safeList = Array.isArray(list) ? list : [];
        setProjects(safeList);
        setModalProjId((prev) => {
          if (prev && safeList.some((p) => p.id === prev)) return prev;
          if (projectId && safeList.some((p) => p.id === projectId)) return projectId;
          return safeList[0]?.id || "";
        });
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const openNewIssueModal = (defaultType: "TASK" | "BUG" = "TASK") => {
    setModalType(defaultType);
    setModalError("");
    setModalTitle("");
    setModalDesc("");
    setModalDueDate("");
    setModalAssigneeId("");
    setModalAttachments([]);
    if ((!modalProjId || !projects.some((p) => p.id === modalProjId)) && projects.length > 0) {
      setModalProjId(projectId && projects.some((p) => p.id === projectId) ? projectId : projects[0].id);
    }
    setIsModalOpen(true);
  };

  // Fetch issues
  const fetchIssues = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{
        data: IssueRow[];
        pagination: { total: number; totalPages: number; page: number };
      }>("/issues", {
        q: q || undefined,
        projectId: projectId || undefined,
        status: status || undefined,
        priority: priority || undefined,
        assigneeId: assigneeId || undefined,
        type: type || undefined,
        overdue: overdue ? "true" : undefined,
        page,
        pageSize: 15,
      });

      setIssues(Array.isArray(res) ? res : (res as unknown as { data?: IssueRow[] })?.data || []);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalCount(res.pagination.total || 0);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to load issues");
      }
    } finally {
      setIsLoading(false);
    }
  }, [q, projectId, status, priority, assigneeId, type, overdue, page, toastError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateUrl();
      fetchIssues();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchIssues, updateUrl]);

  const handleResetFilters = () => {
    setQ("");
    setProjectId("");
    setStatus("");
    setPriority("");
    setAssigneeId("");
    setType(isTasksMode ? "TASK" : "BUG");
    setOverdue(false);
    setPage(1);
  };

  const hasActiveFilters = isTasksMode
    ? Boolean(q || projectId || status || priority || assigneeId || overdue || (type && type !== "TASK"))
    : Boolean(q || projectId || status || priority || assigneeId || overdue || (type && type !== "BUG"));

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalProjId) {
      setModalError("Please select a project");
      return;
    }
    if (!modalTitle.trim()) {
      setModalError("Title is required");
      return;
    }
    if (!modalDesc.trim()) {
      setModalError("Description is required");
      return;
    }

    setIsSubmitting(true);
    setModalError("");
    try {
      const createdRes = await api.post<{ id: string }>("/issues", {
        projectId: modalProjId,
        type: modalType,
        title: modalTitle.trim(),
        description: modalDesc.trim(),
        priority: modalPriority,
        assigneeId: modalAssigneeId || undefined,
        dueDate: modalDueDate ? new Date(modalDueDate).toISOString() : undefined,
      });

      const newIssueId = (createdRes as any)?.id || (createdRes as any)?.data?.id;
      if (newIssueId && modalAttachments.length > 0) {
        for (const file of modalAttachments) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            await api.uploadWithProgress(`/issues/${newIssueId}/attachments`, formData);
          } catch (uploadErr) {
            console.error("Failed to upload attachment", uploadErr);
          }
        }
      }

      toastSuccess(
        modalAttachments.length > 0
          ? `${modalType === "BUG" ? "Bug report" : "Task"} created with ${modalAttachments.length} attachment(s)!`
          : `${modalType === "BUG" ? "Bug report" : "Task"} created!`
      );
      setIsModalOpen(false);
      setModalTitle("");
      setModalDesc("");
      setModalDueDate("");
      setModalAssigneeId("");
      setModalAttachments([]);
      fetchIssues();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setModalError(err.message);
      } else {
        setModalError("Failed to create issue");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            {isTasksMode ? (
              <>
                <ListTodo className="w-6 h-6 text-indigo-500" />
                <span>Tasks</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-6 h-6 text-rose-500" />
                <span>Issues & Bug Reports</span>
              </>
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isTasksMode
              ? `Global view of all tasks across projects (${totalCount} found)`
              : `Global view of all reported bugs and defect issues across projects (${totalCount} found)`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isTasksMode ? (
            canCreateTask && (
              <Button
                size="md"
                variant="primary"
                onClick={() => openNewIssueModal("TASK")}
              >
                <Plus className="w-4 h-4 mr-1" />
                <span>New Task</span>
              </Button>
            )
          ) : (
            <Link href="/bug-reports/new">
              <Button
                size="md"
                variant="primary"
                className="bg-rose-600 hover:bg-rose-700"
              >
                <Bug className="w-4 h-4 mr-1" />
                <span>Report a Bug</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Segmented Quick Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        {isTasksMode ? (
          <>
            <button
              type="button"
              onClick={() => {
                setStatus("");
                setOverdue(false);
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0",
                !status && !overdue
                  ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <ListTodo className="w-4 h-4" />
              <span>All Tasks</span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-mono",
                  !status && !overdue
                    ? "bg-indigo-200 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                {!status && !overdue ? totalCount : "•"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatus("TODO");
                setOverdue(false);
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0",
                status === "TODO"
                  ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <span>To Do</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatus("IN_PROGRESS");
                setOverdue(false);
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0",
                status === "IN_PROGRESS"
                  ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <span>In Progress</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatus("DONE");
                setOverdue(false);
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0",
                status === "DONE"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Done</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setStatus("");
                setPriority("");
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0",
                !status && !priority
                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <Bug className="w-4 h-4 text-rose-500" />
              <span>All Issues & Bugs</span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-mono",
                  !status && !priority
                    ? "bg-rose-200 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                )}
              >
                {!status && !priority ? totalCount : "•"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatus("TODO");
                setPriority("");
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0",
                status === "TODO"
                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <span>Open Bugs</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPriority("HIGH");
                setStatus("");
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0",
                priority === "HIGH"
                  ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <span>High / Critical</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStatus("DONE");
                setPriority("");
                setPage(1);
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0",
                status === "DONE"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Resolved</span>
            </button>
          </>
        )}
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search by title, description, or key (e.g. TF-1)..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            <Select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setPage(1);
              }}
              className="w-40"
            >
              <option value="">All Projects</option>
              {(Array.isArray(projects) ? projects : []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>

            <Select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="w-32"
            >
              <option value="">All Types</option>
              <option value="TASK">Tasks</option>
              <option value="BUG">Bugs</option>
            </Select>

            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-36"
            >
              <option value="">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
            </Select>

            <Select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
              className="w-32"
            >
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>

            <Select
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
                setPage(1);
              }}
              className="w-36"
            >
              <option value="">All Assignees</option>
              <option value="me">Assigned to Me</option>
            </Select>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setOverdue(!overdue);
                setPage(1);
              }}
              className={cn(
                "px-2.5 py-1 rounded-full font-medium transition-colors border",
                overdue
                  ? "bg-rose-950/80 text-rose-300 border-rose-800"
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Overdue Only
            </button>

            <button
              onClick={() => {
                setAssigneeId(assigneeId === "me" ? "" : "me");
                setPage(1);
              }}
              className={cn(
                "px-2.5 py-1 rounded-full font-medium transition-colors border",
                assigneeId === "me"
                  ? "bg-indigo-950/80 text-indigo-300 border-indigo-800"
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Assigned to Me
            </button>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Issues Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <EmptyState
          icon={isTasksMode ? ListTodo : Bug}
          title={
            hasActiveFilters
              ? isTasksMode
                ? "No tasks match your filters"
                : "No issues match your filters"
              : isTasksMode
              ? "No tasks found"
              : "No issues or bugs found"
          }
          description={
            hasActiveFilters
              ? "Try resetting or clearing some filter criteria."
              : isTasksMode
              ? "No tasks have been created in this organization yet."
              : "All clear! No bugs or defect issues have been reported in this organization."
          }
          actionLabel={
            hasActiveFilters
              ? "Reset Filters"
              : isTasksMode
              ? canCreateTask
                ? "Create Task"
                : undefined
              : "Report a Bug"
          }
          onAction={
            hasActiveFilters
              ? handleResetFilters
              : isTasksMode
              ? canCreateTask
                ? () => openNewIssueModal("TASK")
                : undefined
              : () => router.push("/bug-reports/new")
          }
        />
      ) : (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">Key</th>
                  <th className="px-4 py-3.5">Title</th>
                  <th className="px-4 py-3.5">Project</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Priority</th>
                  <th className="px-4 py-3.5">Assignee</th>
                  <th className="px-4 py-3.5">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {issues.map((i) => (
                  <tr
                    key={i.id}
                    onClick={() =>
                      router.push(
                        i.type === "TASK" || isTasksMode
                          ? `/tasks/${i.id}`
                          : `/issues/${i.id}`
                      )
                    }
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3.5 font-mono text-xs text-indigo-400 font-semibold">
                      {i.key}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-white max-w-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{i.title}</span>
                        {i._count?.attachments > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 shrink-0"
                            title={`${i._count.attachments} visual attachment(s)`}
                          >
                            <Paperclip className="w-2.5 h-2.5" />
                            <span>{i._count.attachments}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                      {i.project.name}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge variant={i.type === "BUG" ? "danger" : "primary"} size="sm">
                        {i.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        size="sm"
                        variant={
                          i.status === "DONE"
                            ? "success"
                            : i.status === "IN_PROGRESS"
                            ? "warning"
                            : i.status === "IN_REVIEW"
                            ? "purple"
                            : "neutral"
                        }
                      >
                        {i.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        size="sm"
                        variant={
                          i.priority === "CRITICAL"
                            ? "danger"
                            : i.priority === "HIGH"
                            ? "warning"
                            : i.priority === "MEDIUM"
                            ? "primary"
                            : "neutral"
                        }
                      >
                        {i.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      {i.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar name={i.assignee.name} avatarUrl={i.assignee.avatarUrl} size="sm" />
                          <span className="text-xs text-slate-700 dark:text-slate-300">{i.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                      {i.dueDate ? formatDate(i.dueDate) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  <span>Previous</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Issue Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalType === "BUG" ? "Report a Bug" : "Create New Task"}
        description="Add a task or issue to your organization"
      >
        <form onSubmit={handleCreateIssue} className="space-y-4">
          {modalError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Project"
              value={modalProjId}
              onChange={(e) => setModalProjId(e.target.value)}
              required
            >
              {projects.length === 0 ? (
                <option value="" disabled>
                  Loading projects...
                </option>
              ) : (
                <>
                  {!modalProjId && (
                    <option value="" disabled>
                      Select a project...
                    </option>
                  )}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </>
              )}
            </Select>

            {canCreateTask ? (
              <Select
                label="Type"
                value={modalType}
                onChange={(e) => setModalType(e.target.value as "TASK" | "BUG")}
              >
                <option value="TASK">Task</option>
                <option value="BUG">Bug Report</option>
              </Select>
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Type
                </label>
                <div className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-700">
                  Bug Report
                </div>
              </div>
            )}
          </div>

          <Input
            label="Title"
            placeholder="Issue summary..."
            value={modalTitle}
            onChange={(e) => setModalTitle(e.target.value)}
            required
            autoFocus
          />

          <Textarea
            label="Description"
            placeholder="Details, steps, or requirements..."
            value={modalDesc}
            onChange={(e) => setModalDesc(e.target.value)}
            rows={4}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={modalPriority}
              onChange={(e) => setModalPriority(e.target.value)}
              options={[
                { value: "LOW", label: "Low" },
                { value: "MEDIUM", label: "Medium" },
                { value: "HIGH", label: "High" },
                { value: "CRITICAL", label: "Critical" },
              ]}
            />
            <Input
              label="Due Date (Optional)"
              type="date"
              value={modalDueDate}
              onChange={(e) => setModalDueDate(e.target.value)}
            />
          </div>

          <Select
            label="Give / Assign Task To"
            value={modalAssigneeId}
            onChange={(e) => setModalAssigneeId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {eligibleAssignees.map((u: ProjectMemberOption["user"]) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </Select>

          {/* Media Attachments Section */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Media Attachments (Optional)
            </label>
            <div
              onClick={() => modalFileInputRef.current?.click()}
              className="p-3.5 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
            >
              <Upload className="w-5 h-5 mx-auto text-slate-400 group-hover:text-indigo-500 transition-colors mb-1" />
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                Click to attach files (Screenshots, screen recordings, mockups, or audio)
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                PNG, JPG, WebP, MP4, WebM up to 100MB
              </p>
              <input
                ref={modalFileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    setModalAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }
                }}
              />
            </div>

            {modalAttachments.length > 0 && (
              <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto">
                {modalAttachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate text-slate-800 dark:text-slate-200 font-medium">
                        {file.name}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        ({file.size / (1024 * 1024) < 1
                          ? `${Math.round(file.size / 1024)} KB`
                          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setModalAttachments((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {modalType === "BUG" ? "Report Bug" : "Create Task"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
