"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { Avatar } from "../../components/ui/Avatar";
import { Modal } from "../../components/ui/Modal";
import { Textarea } from "../../components/ui/Textarea";
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  Search,
  Filter,
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
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

interface ProjectOption {
  id: string;
  name: string;
}

function IssuesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  // Read URL query params
  const initialQ = searchParams.get("q") || "";
  const initialProject = searchParams.get("projectId") || "";
  const initialStatus = searchParams.get("status") || "";
  const initialPriority = searchParams.get("priority") || "";
  const initialAssignee = searchParams.get("assigneeId") || "";
  const initialType = searchParams.get("type") || "";
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
  const [modalType, setModalType] = useState<"TASK" | "BUG">("TASK");
  const [modalProjId, setModalProjId] = useState("");
  const [modalTitle, setModalTitle] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [modalPriority, setModalPriority] = useState("MEDIUM");
  const [modalDueDate, setModalDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

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
    router.replace(`/issues${queryString ? `?${queryString}` : ""}`);
  }, [q, projectId, status, priority, assigneeId, type, overdue, page, router]);

  // Fetch Projects List for select filter
  useEffect(() => {
    api.get<{ data: ProjectOption[] }>("/projects").then((res) => {
      setProjects(res.data || []);
      if (res.data?.length > 0 && !modalProjId) {
        setModalProjId(res.data[0].id);
      }
    }).catch(() => {});
  }, [modalProjId]);

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
    setType("");
    setOverdue(false);
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(q || projectId || status || priority || assigneeId || type || overdue);

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
      await api.post("/issues", {
        projectId: modalProjId,
        type: modalType,
        title: modalTitle.trim(),
        description: modalDesc.trim(),
        priority: modalPriority,
        dueDate: modalDueDate ? new Date(modalDueDate).toISOString() : undefined,
      });

      toastSuccess(`${modalType === "BUG" ? "Bug report" : "Task"} created!`);
      setIsModalOpen(false);
      setModalTitle("");
      setModalDesc("");
      setModalDueDate("");
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
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <AlertCircle className="w-6 h-6 text-indigo-400" />
            <span>Issues</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Global view of all tasks and bugs across projects ({totalCount} found)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="md"
            variant="outline"
            onClick={() => {
              setModalType("TASK");
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            <span>New Task</span>
          </Button>

          <Button
            size="md"
            variant="primary"
            onClick={() => {
              setModalType("BUG");
              setIsModalOpen(true);
            }}
            className="bg-rose-600 hover:bg-rose-700"
          >
            <Bug className="w-4 h-4 mr-1" />
            <span>Report a Bug</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
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
              {projects.map((p) => (
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
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
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
                  : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white"
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
                  : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white"
              )}
            >
              Assigned to Me
            </button>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
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
          icon={AlertCircle}
          title="No issues found"
          description={
            hasActiveFilters
              ? "No issues match your selected filters. Try clearing some criteria."
              : "No issues exist in this organization yet. Create a task or report a bug."
          }
          actionLabel={hasActiveFilters ? "Reset Filters" : "Create Task"}
          onAction={hasActiveFilters ? handleResetFilters : () => setIsModalOpen(true)}
        />
      ) : (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
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
              <tbody className="divide-y divide-slate-800/60">
                {issues.map((i) => (
                  <tr
                    key={i.id}
                    onClick={() => router.push(`/issues/${i.id}`)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3.5 font-mono text-xs text-indigo-400 font-semibold">
                      {i.key}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-white max-w-sm truncate group-hover:text-indigo-300 transition-colors">
                      {i.title}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">
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
                          <span className="text-xs text-slate-300">{i.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">
                      {i.dueDate ? formatDate(i.dueDate) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
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
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-300">
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
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>

            <Select
              label="Type"
              value={modalType}
              onChange={(e) => setModalType(e.target.value as "TASK" | "BUG")}
            >
              <option value="TASK">Task</option>
              <option value="BUG">Bug Report</option>
            </Select>
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
              Create Issue
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function IssuesPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 rounded-2xl" /></div>}>
      <IssuesView />
    </Suspense>
  );
}
