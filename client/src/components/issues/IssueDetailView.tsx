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
import {
  AlertCircle,
  Bug,
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
} from "lucide-react";
import { MediaPlayer } from "../media/MediaPlayer";
import { formatDate, formatDateTime } from "../../lib/utils";

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

  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedLog, setCopiedLog] = useState(false);

  // Comments state
  const [commentBody, setCommentBody] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Delete state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Attachment state
  const attachmentInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  const handleDirectAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

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

  const fetchIssue = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<IssueDetail>(`/issues/${id}`);
      setIssue(data);

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

  const handleStatusChange = async (newStatus: IssueDetail["status"]) => {
    if (!issue) return;
    try {
      await api.patch<{ data: IssueDetail }>(`/issues/${id}/status`, {
        status: newStatus,
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

          {/* Media Attachments Section */}
          <Card className="space-y-4">
            <CardHeader className="pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold text-base">Media Attachments ({issue.attachments.length})</span>
                </div>
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
              </div>
            </CardHeader>

            {issue.attachments.length === 0 ? (
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
              <div className="space-y-4">
                {issue.attachments.map((att) => {
                  const canDeleteAtt =
                    role === "ADMIN" ||
                    role === "PROJECT_MANAGER" ||
                    att.uploadedBy.id === user?.id;

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
                <span>Discussion ({issue.comments.length})</span>
              </CardTitle>
            </CardHeader>

            <div className="space-y-4">
              {issue.comments.map((comment) => (
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
              {issue.activityLogs.map((log) => (
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

              {/* Priority Select */}
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

              {/* Assignee Select */}
              <Select
                label="Assignee"
                value={issue.assignee?.id || ""}
                onChange={(e) => handleAssigneeChange(e.target.value)}
              >
                <option value="">Unassigned</option>
                {issue.project.memberships
                  .filter((m) => {
                    const orgRole = m.user.memberships?.[0]?.role;
                    return orgRole !== "ADMIN";
                  })
                  .map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  ))}
              </Select>
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
    </div>
  );
}
