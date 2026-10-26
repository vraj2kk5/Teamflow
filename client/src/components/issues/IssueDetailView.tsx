"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../ui/Toast";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { Card, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { Skeleton } from "../ui/Skeleton";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Modal } from "../ui/Modal";
import {
  AlertCircle,
  Bug,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  User as UserIcon,
  Copy,
  Check,
  Trash2,
  MessageSquare,
  ArrowLeft,
  Activity,
  FileText,
  Terminal,
  Paperclip,
  Upload,
  Plus,
  Users,
} from "lucide-react";
import { MediaPlayer } from "../media/MediaPlayer";
import { AIBugAnalysisModal } from "./AIBugAnalysisModal";
import { CodeLocatorCard, AffectedFileLocation } from "./CodeLocatorCard";
import { useRealtime, RealtimeMessage } from "../../hooks/useRealtime";
import { formatDate, formatDateTime } from "../../lib/utils";
import { clientCache } from "../../lib/cache";

export interface IssueDetail {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string;
  type: "TASK" | "BUG";
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate?: string | null;
  estimatedHours?: number | null;
  stepsToReproduce?: string | null;
  expectedResult?: string | null;
  actualResult?: string | null;
  errorLog?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
    memberships: {
      user: {
        id: string;
        name: string;
        email: string;
        avatarUrl?: string | null;
        memberships?: { role: string }[];
      };
    }[];
  };
  reporter: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
  attachments: {
    id: string;
    originalFilename: string;
    mimeType: string;
    kind: "AUDIO" | "VIDEO" | "IMAGE";
    sizeBytes: number;
    durationSeconds?: number | null;
    createdAt: string;
    uploadedBy: {
      id: string;
      name: string;
    };
  }[];
  comments: {
    id: string;
    authorId: string;
    body: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      avatarUrl?: string | null;
    };
  }[];
  activityLogs: {
    id: string;
    action: string;
    metadata: Record<string, unknown>;
    createdAt: string;
    actor: {
      id: string;
      name: string;
      avatarUrl?: string | null;
    };
  }[];
}

interface IssueDetailViewProps {
  id: string;
  expectedType?: "TASK" | "BUG";
}

export function IssueDetailView({ id, expectedType }: IssueDetailViewProps) {
  const router = useRouter();
  const { user, role } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [issue, setIssue] = useState<IssueDetail | null>(() => {
    const cached = clientCache.get<IssueDetail>(`/issues/${id}`);
    if (cached) return cached;
    const preview = clientCache.getIssuePreview<any>(id);
    if (preview) {
      return {
        id: preview.id,
        projectId: preview.project?.id || preview.projectId || "",
        key: preview.key || "",
        title: preview.title || "",
        description: preview.description || "",
        type: preview.type || expectedType || "TASK",
        status: preview.status || "TODO",
        priority: preview.priority || "MEDIUM",
        dueDate: preview.dueDate,
        project: {
          id: preview.project?.id || preview.projectId || "",
          name: preview.project?.name || "",
          memberships: Array.isArray(preview.project?.memberships) ? preview.project.memberships : [],
        },
        reporter: preview.reporter || { id: "", name: "", email: "" },
        assignee: preview.assignee || null,
        attachments: Array.isArray(preview.attachments) ? preview.attachments : [],
        comments: Array.isArray(preview.comments) ? preview.comments : [],
        activityLogs: Array.isArray(preview.activityLogs) ? preview.activityLogs : [],
        createdAt: preview.createdAt || new Date().toISOString(),
        updatedAt: preview.updatedAt || new Date().toISOString(),
      };
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(() => !issue);
  const [copiedLog, setCopiedLog] = useState(false);

  // Comments state
  const [commentBody, setCommentBody] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Delete state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [affectedFiles, setAffectedFiles] = useState<AffectedFileLocation[]>([]);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionInput, setResolutionInput] = useState("");

  // Attachment state
  const attachmentInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const isBug = (issue?.type || expectedType) === "BUG";
  const isReporter = issue?.reporter.id === user?.id;
  const isAssignee = issue?.assignee?.id === user?.id;
  const isAdmin = role === "ADMIN";

  const canAddAttachment = isBug
    ? isReporter
    : isReporter || isAssignee || isAdmin;

  const handleDirectAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!canAddAttachment) {
      toastError(
        isBug
          ? "Only the user who reported this bug can add attachments"
          : "You do not have permission to add attachments to this task",
        "Permission Denied"
      );
      return;
    }

    setIsUploadingAttachment(true);
    let successCount = 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        await api.uploadWithProgress(`/issues/${id}/attachments`, formData);
        successCount++;
      }
      toastSuccess(
        successCount === 1
          ? "Attachment uploaded successfully"
          : `${successCount} attachments uploaded successfully`
      );
      fetchIssue();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Upload Failed");
      } else {
        toastError("Failed to upload attachment", "Error");
      }
    } finally {
      setIsUploadingAttachment(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    }
  };

  const issueRef = React.useRef(issue);
  useEffect(() => {
    issueRef.current = issue;
  }, [issue]);

  const fetchIssue = useCallback(async () => {
    if (!issueRef.current) {
      setIsLoading(true);
    }
    try {
      const data = await api.getCached<IssueDetail>(`/issues/${id}`);
      if (data) {
        setIssue({
          ...data,
          project: {
            ...data.project,
            memberships: Array.isArray(data.project?.memberships) ? data.project.memberships : [],
          },
          attachments: Array.isArray(data.attachments) ? data.attachments : [],
          comments: Array.isArray(data.comments) ? data.comments : [],
          activityLogs: Array.isArray(data.activityLogs) ? data.activityLogs : [],
        });
        clientCache.set(`/issues/${id}`, data);
      }

      // Route alignment: if user is on /issues/:id but it's a TASK, automatically route to /tasks/:id
      if (typeof window !== "undefined") {
        if (data.type === "TASK" && window.location.pathname.startsWith("/issues/")) {
          router.replace(`/tasks/${data.id}`);
        } else if (data.type === "BUG" && window.location.pathname.startsWith("/tasks/")) {
          router.replace(`/issues/${data.id}`);
        }
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to load item");
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, router, toastError]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  // Clipboard paste listener to paste & upload screenshot directly to task
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      if (!canAddAttachment) return;
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith("image/"));
      if (imageItems.length === 0) return;

      // Don't intercept if user is pasting text in an input or textarea
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        if (e.clipboardData.getData("text/plain")) return;
      }

      setIsUploadingAttachment(true);
      let successCount = 0;
      try {
        for (let i = 0; i < imageItems.length; i++) {
          const file = imageItems[i].getAsFile();
          if (!file) continue;
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const ext = file.type.split("/")[1] || "png";
          const namedFile = new File(
            [file],
            `pasted-screenshot-${timestamp}-${i + 1}.${ext}`,
            { type: file.type }
          );
          const formData = new FormData();
          formData.append("file", namedFile);
          await api.uploadWithProgress(`/issues/${id}/attachments`, formData);
          successCount++;
        }
        if (successCount > 0) {
          toastSuccess(
            successCount === 1
              ? "Screenshot pasted & uploaded successfully!"
              : `${successCount} screenshots pasted & uploaded!`
          );
          fetchIssue();
        }
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          toastError(err.message, "Upload Failed");
        } else {
          toastError("Failed to upload pasted screenshot", "Error");
        }
      } finally {
        setIsUploadingAttachment(false);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [id, fetchIssue, toastSuccess, toastError]);

  const isTask = (issue?.type || expectedType) === "TASK";

  const handleStatusChange = async (newStatus: IssueDetail["status"], resolutionNotes?: string) => {
    if (!issue) return;
    if (newStatus === "DONE" && resolutionNotes === undefined) {
      setResolutionInput(issue.resolutionNotes || "");
      setIsResolveModalOpen(true);
      return;
    }
    try {
      await api.patch<{ data: IssueDetail }>(`/issues/${id}/status`, {
        status: newStatus,
        resolutionNotes: resolutionNotes || undefined,
      });
      setIssue((prev) =>
        prev
          ? {
              ...prev,
              status: newStatus,
              resolvedAt: newStatus === "DONE" ? new Date().toISOString() : null,
            }
          : null
      );
      toastSuccess(`Status changed to ${newStatus.replace("_", " ")}`);
      fetchIssue();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to update status");
      }
    }
  };

  const handlePriorityChange = async (newPriority: IssueDetail["priority"]) => {
    if (!issue) return;
    if (isBug && !isReporter) {
      toastError("Only the user who reported this bug can update its priority", "Permission Denied");
      return;
    }
    try {
      await api.patch(`/issues/${id}`, { priority: newPriority });
      setIssue((prev) => (prev ? { ...prev, priority: newPriority } : null));
      toastSuccess(`Priority set to ${newPriority}`);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to update priority");
      }
    }
  };

  const handleAssigneeChange = async (newAssigneeId: string) => {
    if (!issue) return;
    try {
      await api.patch(`/issues/${id}`, {
        assigneeId: newAssigneeId ? newAssigneeId : null,
      });
      toastSuccess("Assignee updated");
      fetchIssue();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to update assignee");
      }
    }
  };

  
  // Automatically identify and locate problematic files for this issue
  useEffect(() => {
    if (!issue) return;
    api
      .post<{ data: AffectedFileLocation[] }>("/issues/locate-files", {
        title: issue.title,
        description: issue.description,
        errorLog: issue.errorLog,
        actualResult: issue.actualResult,
      })
      .then((res) => {
        if (res.data) setAffectedFiles(res.data);
      })
      .catch(() => {
        // Non-critical background enhancement
      });
  }, [issue?.id, issue?.errorLog, issue?.title, issue?.description, issue?.actualResult]);

  const handleCopyErrorLog = () => {
    if (!issue?.errorLog) return;
    navigator.clipboard.writeText(issue.errorLog);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;

    setIsSubmittingComment(true);
    try {
      await api.post(`/issues/${id}/comments`, { body: commentBody.trim() });
      setCommentBody("");
      toastSuccess("Comment posted");
      fetchIssue();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to post comment");
      }
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteIssue = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/issues/${id}`);
      toastSuccess(`${isTask ? "Task" : "Issue"} deleted`);
      router.push(isTask ? "/tasks" : "/issues");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, `Failed to delete ${isTask ? "task" : "issue"}`);
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const canDelete =
    role === "ADMIN" ||
    role === "PROJECT_MANAGER" ||
    issue?.reporter.id === user?.id;

  if (isLoading || !issue) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-12 w-3/4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-96 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Links */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={isTask ? "/tasks" : "/issues"}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {isTask ? "Tasks" : "Issues"}</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-700">•</span>
          <Link
            href={`/projects/${issue.projectId}`}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {issue.project.name}
          </Link>
        </div>

        <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAIModalOpen(true)}
              className="border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/20 text-xs flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>AI Root Cause Diagnosis</span>
            </Button>
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="text-rose-400 hover:bg-rose-950/40 hover:text-rose-300"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                <span>Delete {isTask ? "Task" : "Issue"}</span>
              </Button>
            )}
          </div>
      </div>

      {/* Main Grid: Left Details vs Right Attributes Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-bold text-indigo-400 text-sm">{issue.key}</span>
              <span className="text-slate-600">•</span>
              <Badge variant={issue.type === "BUG" ? "danger" : "primary"}>
                {issue.type === "BUG" ? (
                  <Bug className="w-3 h-3 mr-1 inline" />
                ) : (
                  <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                )}
                {issue.type}
              </Badge>
              <Badge
                variant={
                  issue.status === "DONE"
                    ? "success"
                    : issue.status === "IN_PROGRESS"
                    ? "warning"
                    : issue.status === "IN_REVIEW"
                    ? "purple"
                    : "neutral"
                }
              >
                {issue.status.replace("_", " ")}
              </Badge>
              <Badge
                variant={
                  issue.priority === "CRITICAL"
                    ? "danger"
                    : issue.priority === "HIGH"
                    ? "warning"
                    : issue.priority === "MEDIUM"
                    ? "primary"
                    : "neutral"
                }
              >
                {issue.priority} Priority
              </Badge>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug">
              {issue.title}
            </h1>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Description
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {issue.description}
              </p>
            </div>
          </Card>

          {/* Resolution Summary Callout */}
          {issue.status === "DONE" && (
            <Card className="border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Resolved {issue.resolvedAt ? `on ${formatDate(issue.resolvedAt)}` : ""}</span>
              </div>
              {issue.resolutionNotes && (
                <div className="pt-1 text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-white block mb-1">
                    Resolution / Root Cause Summary:
                  </span>
                  <div className="whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-900/80 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/40 text-slate-800 dark:text-slate-200">
                    {issue.resolutionNotes}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Bug Details Card (if BUG) */}
          {issue.type === "BUG" && (
            <Card className="border-rose-950/60 space-y-4">
              <CardHeader className="pb-2 border-b border-slate-200 dark:border-slate-800">
                <CardTitle className="text-base text-rose-400 flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  <span>Bug Diagnostic Information</span>
                </CardTitle>
              </CardHeader>

              {issue.stepsToReproduce && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Steps to Reproduce
                  </h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-slate-50 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    {issue.stepsToReproduce}
                  </p>
                </div>
              )}

              {(issue.expectedResult || issue.actualResult) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {issue.expectedResult && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                        Expected Result
                      </h4>
                      <p className="text-xs text-emerald-950 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-3 rounded-lg">
                        {issue.expectedResult}
                      </p>
                    </div>
                  )}
                  {issue.actualResult && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1">
                        Actual Result
                      </h4>
                      <p className="text-xs text-rose-950 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-3 rounded-lg">
                        {issue.actualResult}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Error Log Section (Escaped Plain Text Only) */}
              {issue.errorLog && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Error Message / Stack Trace</span>
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyErrorLog}
                      className="text-xs py-1 h-auto"
                    >
                      {copiedLog ? (
                        <>
                          <Check className="w-3 h-3 mr-1 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" />
                          <span>Copy Log</span>
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-rose-600 dark:text-rose-300 overflow-x-auto max-h-80 select-all leading-relaxed whitespace-pre-wrap">
                    {issue.errorLog}
                  </pre>
                </div>
              )}
            </Card>
          )}

          {/* Pinpointed Code & File Locations */}
          {affectedFiles.length > 0 && (
            <CodeLocatorCard files={affectedFiles} />
          )}

          {/* Media Attachments Section */}
          <Card className="space-y-4">
            <CardHeader className="pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-base">Media Attachments ({issue.attachments.length})</span>
                </div>
                {canAddAttachment && (
                  <div>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*,video/*,audio/*"
                      onChange={handleDirectAttachmentUpload}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => attachmentInputRef.current?.click()}
                      isLoading={isUploadingAttachment}
                      className="h-8 text-xs font-medium"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      <span>Add Attachment</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            {issue.attachments.length === 0 ? (
              canAddAttachment ? (
                <div
                  onClick={() => attachmentInputRef.current?.click()}
                  className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group"
                >
                  <Upload className="w-6 h-6 mx-auto text-slate-400 group-hover:text-indigo-500 transition-colors mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Click to upload or press <span className="text-indigo-600 dark:text-indigo-400 underline underline-offset-2">Ctrl+V</span> to paste screenshot
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Upload or paste screenshots, screen recordings, mockups, or audio notes
                  </p>
                </div>
              ) : (
                <div className="p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                  <Paperclip className="w-6 h-6 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No media attachments
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {isBug
                      ? "Only the user who reported this bug can attach screenshots or recordings."
                      : "No attachments added to this task."}
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-4">
                {(issue.attachments || []).map((att) => {
                  const canDeleteAtt = isBug
                    ? att.uploadedBy.id === user?.id || isReporter
                    : att.uploadedBy.id === user?.id || isReporter || isAdmin;

                  return (
                    <div
                      key={att.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {att.originalFilename}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {att.kind} •{" "}
                            {att.sizeBytes / (1024 * 1024) < 1
                              ? `${Math.round(att.sizeBytes / 1024)} KB`
                              : `${(att.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}
                            {att.durationSeconds ? ` • ${Math.round(att.durationSeconds)}s` : ""}{" "}
                            • Uploaded by {att.uploadedBy.name}
                          </p>
                        </div>
                        {canDeleteAtt && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              if (!confirm("Are you sure you want to delete this attachment?")) return;
                              try {
                                await api.delete(`/attachments/${att.id}`);
                                toastSuccess("Attachment deleted");
                                fetchIssue();
                              } catch (err: unknown) {
                                if (err instanceof ApiClientError) {
                                  toastError(err.message, "Failed to delete attachment");
                                }
                              }
                            }}
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 h-7 px-2 text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            <span>Delete</span>
                          </Button>
                        )}
                      </div>

                      <MediaPlayer
                        attachmentId={att.id}
                        kind={att.kind}
                        filename={att.originalFilename}
                        mimeType={att.mimeType}
                        initialAccessUrl={(att as any).accessUrl}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Comments Discussion Thread */}
          <Card className="space-y-4">
            <CardHeader className="pb-2 border-b border-slate-200 dark:border-slate-800">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <span>Discussion ({(issue.comments || []).length})</span>
              </CardTitle>
            </CardHeader>

            <div className="space-y-4">
              {(issue.comments || []).map((comment) => (
                <div
                  key={comment.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80"
                >
                  <Avatar name={comment.author.name} avatarUrl={comment.author.avatarUrl} size="sm" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">
                        {comment.author.name}
                      </span>
                      <span className="text-[11px] text-slate-500">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {comment.body}
                    </p>
                  </div>
                </div>
              ))}

              {/* Add Comment Form */}
              <form onSubmit={handleAddComment} className="pt-2 space-y-3">
                <Textarea
                  placeholder="Leave a comment or discussion point..."
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  rows={3}
                  required
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={isSubmittingComment}
                    disabled={!commentBody.trim()}
                  >
                    Post Comment
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          {/* Activity Timeline */}
          <Card className="space-y-4">
            <CardHeader className="pb-2 border-b border-slate-200 dark:border-slate-800">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span>Activity Timeline</span>
              </CardTitle>
            </CardHeader>

            <div className="space-y-3">
              {(issue.activityLogs || []).map((log) => (
                <div key={log.id} className="flex items-center gap-3 text-xs">
                  <Avatar name={log.actor.name} avatarUrl={log.actor.avatarUrl} size="sm" />
                  <div className="flex-1">
                    <span className="font-semibold text-slate-900 dark:text-white">{log.actor.name} </span>
                    <span className="text-slate-400">{log.action.replace("_", " ").toLowerCase()}</span>
                  </div>
                  <span
                    className="text-[11px] text-slate-500 shrink-0"
                    title={formatDateTime(log.createdAt)}
                  >
                    {formatDate(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Sidebar Attributes */}
        <div className="space-y-5">
          <Card className="space-y-4">
            <CardHeader className="pb-2 border-b border-slate-200 dark:border-slate-800">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {isTask ? "Task Attributes" : "Issue Attributes"}
              </CardTitle>
            </CardHeader>

            <div className="space-y-3">
              {/* Status Select */}
              <Select
                label="Status"
                value={issue.status}
                onChange={(e) => handleStatusChange(e.target.value as IssueDetail["status"])}
                options={[
                  { value: "TODO", label: "To Do" },
                  { value: "IN_PROGRESS", label: "In Progress" },
                  { value: "IN_REVIEW", label: "In Review" },
                  { value: "DONE", label: "Done" },
                ]}
              />

              {/* Priority Select (Editable only by reporter if bug) */}
              {isBug && !isReporter ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Priority
                  </label>
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm">
                    <Badge
                      variant={
                        issue.priority === "CRITICAL"
                          ? "danger"
                          : issue.priority === "HIGH"
                          ? "orange"
                          : issue.priority === "MEDIUM"
                          ? "warning"
                          : "neutral"
                      }
                    >
                      {issue.priority}
                    </Badge>
                    <span className="text-[11px] text-slate-500 italic">
                      Locked (defined by reporter: {issue.reporter.name})
                    </span>
                  </div>
                </div>
              ) : (
                <Select
                  label="Priority"
                  value={issue.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as IssueDetail["priority"])}
                  options={[
                    { value: "LOW", label: "Low" },
                    { value: "MEDIUM", label: "Medium" },
                    { value: "HIGH", label: "High" },
                    { value: "CRITICAL", label: "Critical" },
                  ]}
                />
              )}

              {/* If Task: Single Assignee. If Bug: Collaborative / Open to All Project Members */}
              {isTask ? (
                <Select
                  label="Assignee"
                  value={issue.assignee?.id || ""}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {(Array.isArray(issue.project?.memberships) ? issue.project.memberships : [])
                    .filter((m) => {
                      const orgRole = m.user?.memberships?.[0]?.role;
                      return orgRole !== "ADMIN";
                    })
                    .map((m, idx) => (
                      <option key={m.user?.id || idx} value={m.user?.id}>
                        {m.user?.name || "Member"}
                      </option>
                    ))}
                </Select>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Assigned To
                  </label>
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                    <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                        Open to All Project Members
                      </span>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 leading-relaxed">
                        Any member of {issue.project.name} can investigate, add diagnostic recordings, and mark this bug as resolved.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Reporter</span>
                <span className="font-semibold text-slate-900 dark:text-white">{issue.reporter.name}</span>
              </div>

              {issue.dueDate && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Due Date</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatDate(issue.dueDate)}</span>
                </div>
              )}

              {issue.estimatedHours && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Estimate</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {issue.estimatedHours} hrs
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Created</span>
                <span className="text-slate-700 dark:text-slate-300">{formatDate(issue.createdAt)}</span>
              </div>

              {issue.resolvedAt && (
                <div className="flex justify-between text-emerald-400">
                  <span>Resolved</span>
                  <span className="font-semibold">{formatDate(issue.resolvedAt)}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Resolve / Root Cause Documentation Modal */}
      <Modal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        title={isTask ? "Complete Task" : "Resolve Bug & Document Root Cause"}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isTask
              ? "Optionally add completion notes or summary before marking this task as Done."
              : "Document how this bug was solved, the root cause, or fix details so other team members can reference it."}
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              {isTask ? "Completion Notes (Optional)" : "Root Cause & Resolution Notes"}
            </label>
            <Textarea
              value={resolutionInput}
              onChange={(e) => setResolutionInput(e.target.value)}
              placeholder={
                isTask
                  ? "E.g., Finished implementing the flow, tested edge cases, and deployed..."
                  : "E.g., Root cause was race condition in state update. Fixed by debouncing input and adding transactional lock..."
              }
              rows={4}
              className="text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsResolveModalOpen(false);
                handleStatusChange("DONE", "");
              }}
            >
              Skip Notes & Mark Done
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setIsResolveModalOpen(false);
                handleStatusChange("DONE", resolutionInput.trim());
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              <span>Mark as Done</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteIssue}
        title={`Delete ${isTask ? "task" : "issue"} ${issue.key}?`}
        message={`Are you sure you want to delete this ${isTask ? "task" : "issue"}? Comments, attachments, and logs will be permanently removed.`}
        confirmText={`Yes, Delete ${isTask ? "Task" : "Issue"}`}
        isLoading={isDeleting}
      />
      {/* AI Bug Analysis & Diagnostics Modal */}
      <AIBugAnalysisModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        initialData={{
          title: issue?.title,
          description: issue?.description,
          errorLog: issue?.errorLog || undefined,
          stepsToReproduce: issue?.stepsToReproduce || undefined,
          expectedResult: issue?.expectedResult || undefined,
          actualResult: issue?.actualResult || undefined,
        }}
        onApplyDiagnosis={async (suggested) => {
          if (suggested.priority) {
            if (isBug && !isReporter) {
              toastError("Bug priority is locked to the original reporter", "Permission Notice");
            } else {
              await handlePriorityChange(suggested.priority);
            }
          }
          if (suggested.resolutionNotes) {
            setResolutionNotes(suggested.resolutionNotes);
          }
          toastSuccess("AI diagnosis applied!");
        }}
      />
    </div>
  );
}
