"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "../../../lib/api";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Avatar } from "../../../components/ui/Avatar";
import { Skeleton } from "../../../components/ui/Skeleton";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
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
} from "lucide-react";
import { MediaPlayer } from "../../../components/media/MediaPlayer";
import { formatDate, formatDateTime } from "../../../lib/utils";

interface IssueDetail {
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

export default function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const issueId = resolvedParams.id;

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

  const fetchIssue = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<IssueDetail>(`/issues/${issueId}`);
      setIssue(data);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to load issue");
      }
    } finally {
      setIsLoading(false);
    }
  }, [issueId, toastError]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  const handleStatusChange = async (newStatus: IssueDetail["status"]) => {
    if (!issue) return;
    try {
      const updated = await api.patch<{ data: IssueDetail }>(`/issues/${issueId}/status`, {
        status: newStatus,
      });
      setIssue((prev) => (prev ? { ...prev, status: newStatus, resolvedAt: newStatus === "DONE" ? new Date().toISOString() : null } : null));
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
      await api.patch(`/issues/${issueId}`, { priority: newPriority });
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
      await api.patch(`/issues/${issueId}`, {
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
      await api.post(`/issues/${issueId}/comments`, { body: commentBody.trim() });
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
      await api.delete(`/issues/${issueId}`);
      toastSuccess("Issue deleted");
      router.push("/issues");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to delete issue");
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
      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href={`/projects/${issue.projectId}`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {issue.project.name}</span>
        </Link>

        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-rose-400 hover:bg-rose-950/40 hover:text-rose-300"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            <span>Delete Issue</span>
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
                {issue.type === "BUG" ? <Bug className="w-3 h-3 mr-1 inline" /> : <CheckCircle2 className="w-3 h-3 mr-1 inline" />}
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Description
              </h3>
              <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
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
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                        Expected Result
                      </h4>
                      <p className="text-xs text-slate-300 bg-emerald-950/20 border border-emerald-900/40 p-3 rounded-lg">
                        {issue.expectedResult}
                      </p>
                    </div>
                  )}
                  {issue.actualResult && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1">
                        Actual Result
                      </h4>
                      <p className="text-xs text-slate-300 bg-rose-950/20 border border-rose-900/40 p-3 rounded-lg">
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
                  {/* Monospaced scrollable box rendered as pure plain text */}
                  <pre className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-rose-600 dark:text-rose-300 overflow-x-auto max-h-80 select-all leading-relaxed whitespace-pre-wrap">
                    {issue.errorLog}
                  </pre>
                </div>
              )}
            </Card>
          )}

          {/* Media Attachments Section (Visual Bug Reporting) */}
          <Card className="space-y-4">
            <CardHeader className="pb-2 border-b border-slate-200 dark:border-slate-800">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-indigo-400" />
                  <span>Media Attachments ({issue.attachments.length})</span>
                </div>
              </CardTitle>
            </CardHeader>

            {issue.attachments.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                No screen or voice recordings or screenshots attached.
              </p>
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
                            {att.kind} • {(att.sizeBytes / (1024 * 1024) < 1)
                              ? `${Math.round(att.sizeBytes / 1024)} KB`
                              : `${(att.sizeBytes / (1024 * 1024)).toFixed(1)} MB`}
                            {att.durationSeconds ? ` • ${Math.round(att.durationSeconds)}s` : ""}
                            {" "}• Uploaded by {att.uploadedBy.name}
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
                <div key={comment.id} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                  <Avatar name={comment.author.name} avatarUrl={comment.author.avatarUrl} size="sm" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">{comment.author.name}</span>
                      <span className="text-[11px] text-slate-500">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{comment.body}</p>
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
                  <Button type="submit" size="sm" isLoading={isSubmittingComment} disabled={!commentBody.trim()}>
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
                  <span className="text-[11px] text-slate-500 shrink-0" title={formatDateTime(log.createdAt)}>
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
                Issue Attributes
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
                  <span className="font-semibold text-slate-900 dark:text-white">{issue.estimatedHours} hrs</span>
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
        title={`Delete issue ${issue.key}?`}
        message="Are you sure you want to delete this issue? Comments, attachments, and logs will be permanently removed."
        confirmText="Yes, Delete Issue"
        isLoading={isDeleting}
      />
    </div>
  );
}
