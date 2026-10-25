"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Modal } from "../../../components/ui/Modal";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Skeleton } from "../../../components/ui/Skeleton";
import { Avatar } from "../../../components/ui/Avatar";
import { EmptyState } from "../../../components/ui/EmptyState";
import { KanbanBoard } from "../../../components/board/KanbanBoard";
import { IssueItem } from "../../../components/board/KanbanCard";
import {
  FolderKanban,
  LayoutGrid,
  List,
  Bug,
  Users,
  Settings,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Clock,
  ArrowLeft,
  Copy,
  Check,
  KeyRound,
  RefreshCw,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { cn, formatDate } from "../../../lib/utils";
import { clientCache } from "../../../lib/cache";

interface ProjectDetail {
  id: string;
  name: string;
  description?: string | null;
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
  ownerId: string;
  inviteCode?: string | null;
  owner: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  memberships: {
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string | null;
      jobTitle?: string | null;
    };
  }[];
  stats: {
    totalIssues: number;
    doneIssues: number;
    completionPercentage: number;
    openBugs: number;
    overdueCount: number;
  };
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const router = useRouter();
  const { user, role } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [project, setProject] = useState<ProjectDetail | null>(() =>
    clientCache.get<ProjectDetail>(`/projects/${projectId}`)
  );
  const [issues, setIssues] = useState<IssueItem[]>(() =>
    clientCache.get<IssueItem[]>(`/projects/${projectId}/issues`) || []
  );
  const [orgMembers, setOrgMembers] = useState<{ id: string; user: { id: string; name: string; email: string } }[]>([]);
  const [activeTab, setActiveTab] = useState<"board" | "list" | "bugs" | "members" | "settings">("board");
  const [isLoading, setIsLoading] = useState(() => !clientCache.get<ProjectDetail>(`/projects/${projectId}`));
  const [accessError, setAccessError] = useState<string | null>(null);

  // Create Issue Modal State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [issueType, setIssueType] = useState<"TASK" | "BUG">("TASK");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueDesc, setIssueDesc] = useState("");
  const [issuePriority, setIssuePriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [issueAssigneeId, setIssueAssigneeId] = useState("");
  const [issueDueDate, setIssueDueDate] = useState("");
  const [issueEstHours, setIssueEstHours] = useState("");
  const [issueAttachments, setIssueAttachments] = useState<File[]>([]);
  const issueFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [issueFormError, setIssueFormError] = useState("");

  // Add Member Modal State
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Clipboard paste listener to paste screenshot without saving to disk first
  useEffect(() => {
    if (!isIssueModalOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith("image/"));
      if (imageItems.length === 0) return;

      const pastedFiles: File[] = [];
      imageItems.forEach((item, index) => {
        const file = item.getAsFile();
        if (file) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const ext = file.type.split("/")[1] || "png";
          const namedFile = new File(
            [file],
            `pasted-screenshot-${timestamp}-${index + 1}.${ext}`,
            { type: file.type }
          );
          pastedFiles.push(namedFile);
        }
      });

      if (pastedFiles.length > 0) {
        setIssueAttachments((prev) => [...prev, ...pastedFiles]);
        toastSuccess(
          pastedFiles.length === 1
            ? "Screenshot pasted from clipboard!"
            : `${pastedFiles.length} screenshots pasted from clipboard!`
        );
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isIssueModalOpen, toastSuccess]);

  // Settings / Delete State
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState<ProjectDetail["status"]>("ACTIVE");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);

  const canManage = role === "ADMIN" || role === "PROJECT_MANAGER" || project?.ownerId === user?.id;

  const fetchProjectData = useCallback(async () => {
    if (!project) {
      setIsLoading(true);
    }
    setAccessError(null);
    try {
      const [projData, issuesData] = await Promise.all([
        api.getCached<ProjectDetail>(`/projects/${projectId}`),
        api.getCached<{ data: IssueItem[] }>("/issues", { projectId, pageSize: 100 }),
      ]);

      setProject(projData);
      setEditName(projData.name);
      setEditDesc(projData.description || "");
      setEditStatus(projData.status);
      const rawIssues = Array.isArray(issuesData)
        ? issuesData
        : (issuesData as { data?: IssueItem[] })?.data || [];
      setIssues(rawIssues);
      clientCache.set(`/projects/${projectId}`, projData);
      clientCache.set(`/projects/${projectId}/issues`, rawIssues);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 403 || err.message.toLowerCase().includes("not a member")) {
          setAccessError(err.message || "You are not a member of this project");
        } else {
          toastError(err.message, "Failed to load project");
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toastError]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  // Load organization members for adding to project
  const fetchOrgMembers = async () => {
    try {
      const res = await api.get<{ id: string; user: { id: string; name: string; email: string } }[]>(
        "/organizations/current/members"
      );
      const list = Array.isArray(res) ? res : (res as { data?: { id: string; user: { id: string; name: string; email: string } }[] })?.data || [];
      setOrgMembers(list);
    } catch {
      // ignore
    }
  };

  const handleCopyInviteCode = (code?: string | null) => {
    const val = code || project?.inviteCode;
    if (!val) return;
    navigator.clipboard.writeText(val);
    setIsCopied(true);
    toastSuccess("Project invitation code copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRegenerateInviteCode = async () => {
    if (!projectId) return;
    setIsRegeneratingCode(true);
    try {
      const res = await api.post<{ inviteCode: string }>(`/projects/${projectId}/regenerate-invite-code`);
      const newCode = (res as { inviteCode?: string })?.inviteCode || (res as { data?: { inviteCode?: string } })?.data?.inviteCode;
      if (newCode && project) {
        setProject({ ...project, inviteCode: newCode });
      } else {
        fetchProjectData();
      }
      toastSuccess("Project invitation code regenerated!");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to regenerate invitation code");
      }
    } finally {
      setIsRegeneratingCode(false);
    }
  };

  const handleStatusChange = async (issueId: string, newStatus: IssueItem["status"]) => {
    // Optimistic UI update
    setIssues((prev) =>
      prev.map((i) => (i.id === issueId ? { ...i, status: newStatus } : i))
    );

    try {
      await api.patch(`/issues/${issueId}/status`, { status: newStatus });
      toastSuccess("Status updated");
    } catch (err: unknown) {
      // Rollback on failure
      fetchProjectData();
      if (err instanceof ApiClientError) {
        toastError(err.message, "Could not update status");
      }
    }
  };

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim()) {
      setIssueFormError("Title is required");
      return;
    }
    if (!issueDesc.trim()) {
      setIssueFormError("Description is required");
      return;
    }

    setIsCreatingIssue(true);
    setIssueFormError("");
    try {
      const createdRes = await api.post<{ id: string }>("/issues", {
        projectId,
        type: issueType,
        title: issueTitle.trim(),
        description: issueDesc.trim(),
        priority: issuePriority,
        assigneeId: issueType === "BUG" ? undefined : (issueAssigneeId || undefined),
        dueDate: issueDueDate ? new Date(issueDueDate).toISOString() : undefined,
        estimatedHours: issueEstHours ? parseFloat(issueEstHours) : undefined,
      });

      const newIssueId = (createdRes as any)?.id || (createdRes as any)?.data?.id;
      if (newIssueId && issueAttachments.length > 0) {
        for (const file of issueAttachments) {
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
        issueAttachments.length > 0
          ? `${issueType === "BUG" ? "Bug report" : "Task"} created with ${issueAttachments.length} attachment(s)!`
          : `${issueType === "BUG" ? "Bug report" : "Task"} created!`
      );
      setIsIssueModalOpen(false);
      setIssueTitle("");
      setIssueDesc("");
      setIssuePriority("MEDIUM");
      setIssueAssigneeId("");
      setIssueDueDate("");
      setIssueEstHours("");
      setIssueAttachments([]);
      fetchProjectData();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setIssueFormError(err.message);
      } else {
        setIssueFormError("Failed to create issue");
      }
    } finally {
      setIsCreatingIssue(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setIsAddingMember(true);
    try {
      await api.post(`/projects/${projectId}/members`, { userId: selectedUserId });
      toastSuccess("Member added to project!");
      setIsMemberModalOpen(false);
      setSelectedUserId("");
      fetchProjectData();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to add member");
      }
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    try {
      await api.delete(`/projects/${projectId}/members/${memberUserId}`);
      toastSuccess("Member removed from project");
      fetchProjectData();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to remove member");
      }
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await api.patch(`/projects/${projectId}`, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        status: editStatus,
      });
      toastSuccess("Project settings saved");
      fetchProjectData();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to update project");
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/projects/${projectId}`);
      toastSuccess("Project deleted");
      router.push("/projects");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to delete project");
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (accessError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/80 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-2">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Project Access Restricted</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {accessError}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            You are only allowed to see projects you have been assigned to. Contact your Project Manager or Admin to be added to this project.
          </p>
          <div className="pt-3 flex flex-col sm:flex-row gap-2 justify-center">
            <Link href="/projects">
              <Button variant="primary" size="sm" className="w-full sm:w-auto">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                <span>Back to My Projects</span>
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <span>Dashboard</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <EmptyState
          icon={FolderKanban}
          title="Project not found"
          description="The requested project does not exist or you do not have permission to access it."
          actionLabel="Back to My Projects"
          onAction={() => router.push("/projects")}
        />
      </div>
    );
  }

  const bugIssues = issues.filter((i) => i.type === "BUG");

  return (
    <div className="space-y-6">
      {/* Back to projects link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Projects</span>
      </Link>

      {/* Project Overview Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{project.name}</h1>
              <Badge
                variant={
                  project.status === "ACTIVE"
                    ? "success"
                    : project.status === "ON_HOLD"
                    ? "warning"
                    : project.status === "COMPLETED"
                    ? "primary"
                    : "neutral"
                }
              >
                {project.status.replace("_", " ")}
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">{project.description}</p>
            )}

            {project.inviteCode && (
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Invite Code:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 tracking-wider select-all">
                  {project.inviteCode}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyInviteCode()}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Copy project invitation code"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>

          {canManage && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <Button
                size="md"
                variant="outline"
                onClick={() => {
                  setIssueType("TASK");
                  setIsIssueModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                <span>New Task</span>
              </Button>

              <Button
                size="md"
                variant="ghost"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60"
                title="Delete this project"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                <span>Delete Project</span>
              </Button>
            </div>
          )}
        </div>

        {/* Health Metrics & Member Avatars */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800/80">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Completion</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{project.stats.completionPercentage}%</div>
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${project.stats.completionPercentage}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Total Issues</span>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{project.stats.totalIssues}</div>
            <span className="text-[11px] text-slate-500">{project.stats.doneIssues} completed</span>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Open Bugs</span>
            <div className="text-xl font-bold text-rose-400">{project.stats.openBugs}</div>
            <span className="text-[11px] text-slate-500">Requires triage</span>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Overdue</span>
            <div className={cn("text-xl font-bold", project.stats.overdueCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white")}>
              {project.stats.overdueCount}
            </div>
            <span className="text-[11px] text-slate-500">Past target date</span>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto">
        <button
          onClick={() => setActiveTab("board")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2",
            activeTab === "board"
              ? "border-indigo-600 text-indigo-600 dark:text-white bg-indigo-50/60 dark:bg-slate-900/50"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Kanban Board</span>
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {issues.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("list")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2",
            activeTab === "list"
              ? "border-indigo-600 text-indigo-600 dark:text-white bg-indigo-50/60 dark:bg-slate-900/50"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          <List className="w-4 h-4" />
          <span>List View</span>
        </button>

        <button
          onClick={() => setActiveTab("bugs")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2",
            activeTab === "bugs"
              ? "border-indigo-600 text-indigo-600 dark:text-white bg-indigo-50/60 dark:bg-slate-900/50"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          <Bug className="w-4 h-4 text-rose-400" />
          <span>Bugs</span>
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-rose-950/80 text-rose-300 border border-rose-800/80">
            {bugIssues.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("members")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2",
            activeTab === "members"
              ? "border-indigo-600 text-indigo-600 dark:text-white bg-indigo-50/60 dark:bg-slate-900/50"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          <Users className="w-4 h-4" />
          <span>Members</span>
          <span className="px-1.5 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {project.memberships.length}
          </span>
        </button>

        {canManage && (
          <button
            onClick={() => setActiveTab("settings")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2",
              activeTab === "settings"
                ? "border-indigo-600 text-indigo-600 dark:text-white bg-indigo-50/60 dark:bg-slate-900/50"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            )}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        )}
      </div>

      {/* Tab 1: Kanban Board */}
      {activeTab === "board" && (
        <KanbanBoard issues={issues} onStatusChange={handleStatusChange} />
      )}

      {/* Tab 2: List View */}
      {activeTab === "list" && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {issues.length === 0 ? (
            <EmptyState
              icon={List}
              title="No issues created yet"
              description="Create tasks or bug reports to populate this project"
              actionLabel={canManage ? "New Task" : "Report Bug"}
              onAction={() => {
                setIssueType(canManage ? "TASK" : "BUG");
                setIsIssueModalOpen(true);
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5">Key</th>
                    <th className="px-4 py-3.5">Title</th>
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
                      onClick={() => router.push(`/issues/${i.id}`)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-indigo-400 font-medium">
                        {i.key}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white max-w-md truncate">
                        {i.title}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={i.type === "BUG" ? "danger" : "primary"} size="sm">
                          {i.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
                        {i.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={i.assignee.name} avatarUrl={i.assignee.avatarUrl} size="sm" />
                            <span className="text-xs text-slate-300">{i.assignee.name}</span>
                          </div>
                        ) : i.type === "BUG" ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            <Users className="w-3 h-3 text-emerald-500" />
                            <span>All Members</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {i.dueDate ? formatDate(i.dueDate) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Bugs View */}
      {activeTab === "bugs" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Visual bug reports captured for <span className="font-semibold text-slate-900 dark:text-white">{project.name}</span>
            </p>
            <Button
              size="sm"
              variant="outline"
              className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800"
              onClick={() => router.push(`/bug-reports/new?projectId=${project.id}`)}
            >
              <Bug className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
              <span>Record / Report Bug</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bugIssues.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  icon={Bug}
                  title="No bugs reported in this project"
                  description="All clear! Use 'Report Bug' to submit an issue with screen and voice recording."
                />
              </div>
            ) : (
              bugIssues.map((bug) => (
                <Link key={bug.id} href={`/issues/${bug.id}`} className="block group">
                  <Card variant="interactive" className="h-full border-slate-200 dark:border-rose-950/40 hover:border-rose-400 dark:hover:border-rose-800/80 bg-white dark:bg-slate-900">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Bug className="w-4 h-4 text-rose-400" />
                        <span className="text-xs font-mono font-semibold text-slate-400">{bug.key}</span>
                      </div>
                      <Badge size="sm" variant={bug.status === "DONE" ? "success" : "danger"}>
                        {bug.status.replace("_", " ")}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-300 transition-colors line-clamp-2">
                        {bug.title}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-2">{bug.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Members View */}
      {activeTab === "members" && (
        <div className="space-y-4">
          {/* Project Invitation Code Banner */}
          <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Project Invitation Code</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Share this code with organization members to let them self-join this project.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 tracking-wider shadow-sm select-all">
                {project.inviteCode || "Generating..."}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopyInviteCode()}
                className="border-indigo-300 dark:border-indigo-700"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1 text-indigo-600 dark:text-indigo-400" />}
                <span>{isCopied ? "Copied" : "Copy"}</span>
              </Button>
              {canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRegenerateInviteCode}
                  isLoading={isRegeneratingCode}
                  title="Generate a new invitation code"
                  className="text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  <span>Regenerate</span>
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Users assigned to work on this project
            </p>
            {canManage && (
              <Button
                size="sm"
                onClick={() => {
                  fetchOrgMembers();
                  setIsMemberModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Add Member</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {project.memberships.map((m) => (
              <Card key={m.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={m.user.name} avatarUrl={m.user.avatarUrl} size="md" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{m.user.name}</span>
                      {m.user.id === project.ownerId && (
                        <Badge size="sm" variant="warning" className="text-[10px]">
                          Owner
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{m.user.email}</div>
                  </div>
                </div>

                {canManage && m.user.id !== project.ownerId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveMember(m.user.id)}
                    className="text-rose-400 hover:bg-rose-950/40 hover:text-rose-300"
                    title="Remove from project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Settings View (PM/Admin) */}
      {activeTab === "settings" && canManage && (
        <div className="max-w-2xl space-y-6">
          <Card>
            <form onSubmit={handleSaveSettings}>
              <CardHeader>
                <CardTitle>Project Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Project Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
                <Textarea
                  label="Description"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                />
                <Select
                  label="Project Status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as ProjectDetail["status"])}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "ON_HOLD", label: "On Hold" },
                    { value: "COMPLETED", label: "Completed" },
                    { value: "ARCHIVED", label: "Archived" },
                  ]}
                />
                <div className="pt-2">
                  <Button type="submit" isLoading={isSavingSettings}>
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>

          <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20">
            <CardHeader>
              <CardTitle className="text-rose-700 dark:text-rose-400">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Deleting this project permanently removes all its tasks, bug reports, comments, attachments, and logs. This action cannot be undone.
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                Delete Project
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Issue Modal */}
      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        title={issueType === "BUG" ? "Report a Bug" : "Create New Task"}
        description={`Add a new item to ${project.name}`}
      >
        <form onSubmit={handleCreateIssue} className="space-y-4">
          {issueFormError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {issueFormError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {canManage ? (
              <Select
                label="Issue Type"
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as "TASK" | "BUG")}
                options={[
                  { value: "TASK", label: "Task" },
                  { value: "BUG", label: "Bug Report" },
                ]}
              />
            ) : (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Issue Type
                </label>
                <div className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-slate-700">
                  Bug Report
                </div>
              </div>
            )}
            <Select
              label="Priority"
              value={issuePriority}
              onChange={(e) => setIssuePriority(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")}
              options={[
                { value: "LOW", label: "Low" },
                { value: "MEDIUM", label: "Medium" },
                { value: "HIGH", label: "High" },
                { value: "CRITICAL", label: "Critical" },
              ]}
            />
          </div>

          <Input
            label="Title"
            placeholder={issueType === "BUG" ? "e.g. Video player fails on mobile Safari" : "e.g. Design authentication pages"}
            value={issueTitle}
            onChange={(e) => setIssueTitle(e.target.value)}
            required
            autoFocus
          />

          <Textarea
            label="Description"
            placeholder="Detailed requirements or context..."
            value={issueDesc}
            onChange={(e) => setIssueDesc(e.target.value)}
            rows={4}
            required
          />

          {issueType === "TASK" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Assignee"
                value={issueAssigneeId}
                onChange={(e) => setIssueAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {project.memberships.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </option>
                ))}
              </Select>

              <Input
                label="Due Date"
                type="date"
                value={issueDueDate}
                onChange={(e) => setIssueDueDate(e.target.value)}
              />

              <Input
                label="Est. Hours"
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 4.5"
                value={issueEstHours}
                onChange={(e) => setIssueEstHours(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Collaborative Bug Solving
                  </span>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 leading-relaxed">
                    Bugs are not assigned to a single person. All project members can review, investigate, and help resolve this bug.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Due Date (Optional)"
                  type="date"
                  value={issueDueDate}
                  onChange={(e) => setIssueDueDate(e.target.value)}
                />
                <Input
                  label="Est. Hours (Optional)"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g. 2.0"
                  value={issueEstHours}
                  onChange={(e) => setIssueEstHours(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Media Attachments Section */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Media Attachments (Optional)
            </label>
            <div
              onClick={() => issueFileInputRef.current?.click()}
              className="p-3.5 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
            >
              <Upload className="w-5 h-5 mx-auto text-slate-400 group-hover:text-indigo-500 transition-colors mb-1" />
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                Click to attach files or press <span className="font-semibold text-indigo-600 dark:text-indigo-400 underline underline-offset-2">Ctrl+V</span> to paste screenshot
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                PNG, JPG, WebP, MP4, WebM up to 100MB (clipboard screenshot supported)
              </p>
              <input
                ref={issueFileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    setIssueAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
                  }
                }}
              />
            </div>

            {issueAttachments.length > 0 && (
              <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto">
                {issueAttachments.map((file, idx) => {
                  const isImage = file.type.startsWith("image/");
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 text-xs gap-2"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {isImage ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-7 h-7 rounded object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <Paperclip className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        )}
                        <span className="truncate text-slate-800 dark:text-slate-200 font-medium">
                          {file.name}
                        </span>
                        <span className="text-slate-400 text-[10px] shrink-0">
                          ({file.size / (1024 * 1024) < 1
                            ? `${Math.round(file.size / 1024)} KB`
                            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setIssueAttachments((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-slate-400 hover:text-rose-500 p-1 transition-colors shrink-0"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsIssueModalOpen(false)}
              disabled={isCreatingIssue}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isCreatingIssue}>
              Create {issueType === "BUG" ? "Bug Report" : "Task"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Project Member Modal */}
      <Modal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        title="Add Member to Project"
        description={`Select an organization member to grant access to ${project.name}`}
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <Select
            label="Select Member"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
          >
            <option value="">Choose a team member...</option>
            {orgMembers
              .filter((om) => !project.memberships.some((pm) => pm.user.id === om.user.id))
              .map((om) => (
                <option key={om.user.id} value={om.user.id}>
                  {om.user.name} ({om.user.email})
                </option>
              ))}
          </Select>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Admins and Project Managers can assign members directly, or share the Project Invitation Code (<strong>{project.inviteCode}</strong>) for them to join.
          </p>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsMemberModalOpen(false)}
              disabled={isAddingMember}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isAddingMember} disabled={!selectedUserId}>
              Add to Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Project Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteProject}
        title={`Delete "${project.name}"?`}
        message="Are you sure you want to delete this project? All associated tasks, bug reports, and media will be permanently deleted."
        confirmText="Yes, Delete Project"
        isLoading={isDeleting}
      />
    </div>
  );
}
