"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiClientError } from "../../../lib/api";
import { useToast } from "../../../components/ui/Toast";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { AudioRecorderCard } from "../../../components/media/AudioRecorderCard";
import { AIBugAnalysisModal } from "../../../components/issues/AIBugAnalysisModal";
import { ScreenRecorderCard } from "../../../components/media/ScreenRecorderCard";
import { ImageDropzone } from "../../../components/media/ImageDropzone";
import { formatBytes } from "../../../lib/utils";
import {
  Bug,
  Sparkles,
  ArrowLeft,
  Terminal,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Mic,
  Video,
  Image as ImageIcon,
  Send,
  ExternalLink,
} from "lucide-react";

interface ProjectOption {
  id: string;
  name: string;
  key?: string;
}

interface AttachedMediaItem {
  id: string;
  file: File;
  kind: "AUDIO" | "VIDEO" | "IMAGE";
  durationSeconds?: number;
  status: "idle" | "uploading" | "success" | "error";
  progress: number;
  errorMessage?: string;
}

export default function NewBugReportPage() {
  const router = useRouter();
  const { success: toastSuccess, error: toastError } = useToast();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Form Fields
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("HIGH");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [actualResult, setActualResult] = useState("");
  const [errorLog, setErrorLog] = useState("");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Media Attachments
  const [attachedFiles, setAttachedFiles] = useState<AttachedMediaItem[]>([]);
  const [rawImages, setRawImages] = useState<File[]>([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdIssue, setCreatedIssue] = useState<{ id: string; key: string } | null>(null);
  const [overallSuccess, setOverallSuccess] = useState(false);

  // Load user's projects
  useEffect(() => {
    async function loadProjects() {
      setIsLoadingProjects(true);
      try {
        const res = await api.get<ProjectOption[]>("/projects?allOrgProjects=true&pageSize=100");
        const list = Array.isArray(res) ? res : (res as unknown as { data?: ProjectOption[] })?.data || [];
        setProjects(Array.isArray(list) ? list : []);

        const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const queryProjId = urlParams ? urlParams.get("projectId") : null;

        if (queryProjId && list.some((p) => p.id === queryProjId)) {
          setProjectId(queryProjId);
        } else if (list.length > 0) {
          setProjectId((prev) => prev || list[0].id);
        }
      } catch (err: unknown) {
        if (err instanceof ApiClientError) {
          toastError(err.message, "Failed to load projects");
        }
      } finally {
        setIsLoadingProjects(false);
      }
    }
    loadProjects();
  }, [toastError]);

  // Audio callback
  const handleAttachAudio = (file: File, durationSeconds: number) => {
    const id = `audio-${Date.now()}`;
    setAttachedFiles((prev) => [
      ...prev.filter((item) => item.kind !== "AUDIO"), // keep only latest audio
      {
        id,
        file,
        kind: "AUDIO",
        durationSeconds,
        status: "idle",
        progress: 0,
      },
    ]);
    toastSuccess("Voice note attached to report");
  };

  const handleRemoveAudio = () => {
    setAttachedFiles((prev) => prev.filter((item) => item.kind !== "AUDIO"));
  };

  // Screen video callback
  const handleAttachVideo = (file: File, durationSeconds: number) => {
    const id = `video-${Date.now()}`;
    setAttachedFiles((prev) => [
      ...prev.filter((item) => item.kind !== "VIDEO"), // keep only latest screen video
      {
        id,
        file,
        kind: "VIDEO",
        durationSeconds,
        status: "idle",
        progress: 0,
      },
    ]);
    toastSuccess("Screen recording attached to report");
  };

  const handleRemoveVideo = () => {
    setAttachedFiles((prev) => prev.filter((item) => item.kind !== "VIDEO"));
  };

  // Image files sync
  const handleImagesChange = (newImages: File[]) => {
    setRawImages(newImages);
    setAttachedFiles((prev) => {
      // Keep non-image files
      const nonImages = prev.filter((item) => item.kind !== "IMAGE");
      // Map current raw images
      const imageItems: AttachedMediaItem[] = newImages.map((file) => ({
        id: `img-${file.name}-${file.size}-${file.lastModified}`,
        file,
        kind: "IMAGE",
        status: "idle",
        progress: 0,
      }));
      return [...nonImages, ...imageItems];
    });
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachedFiles((prev) => prev.filter((item) => item.id !== id));
    // also update rawImages if it was an image
    setRawImages((prev) =>
      prev.filter((f) => `img-${f.name}-${f.size}-${f.lastModified}` !== id)
    );
  };

  // Upload single file with progress
  const uploadSingleFile = async (
    issueId: string,
    item: AttachedMediaItem
  ): Promise<boolean> => {
    // update state to uploading
    setAttachedFiles((prev) =>
      prev.map((f) =>
        f.id === item.id ? { ...f, status: "uploading", progress: 0, errorMessage: undefined } : f
      )
    );

    const formData = new FormData();
    formData.append("file", item.file);
    formData.append("kind", item.kind);
    if (item.durationSeconds) {
      formData.append("durationSeconds", String(Math.round(item.durationSeconds)));
    }

    try {
      await api.uploadWithProgress(
        `/issues/${issueId}/attachments`,
        formData,
        (percent) => {
          setAttachedFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, progress: percent } : f))
          );
        }
      );

      setAttachedFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: "success", progress: 100 } : f
        )
      );
      return true;
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : "Upload failed";
      setAttachedFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: "error", errorMessage: msg } : f
        )
      );
      return false;
    }
  };

  // Retry a single failed upload
  const handleRetryUpload = async (item: AttachedMediaItem) => {
    if (!createdIssue) return;
    await uploadSingleFile(createdIssue.id, item);
  };

  // Main Submit handler (Two-Step Flow)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectId) {
      toastError("Please select a target project");
      return;
    }
    if (!title.trim() || title.trim().length < 3) {
      toastError("Title must be at least 3 characters");
      return;
    }
    if (!description.trim()) {
      toastError("Please provide a description of the bug");
      return;
    }

    setIsSubmitting(true);
    let targetIssue = createdIssue;

    try {
      // Step 1: Create Issue Record (if not already created in a previous attempt)
      if (!targetIssue) {
        const issuePayload = {
          projectId,
          title: title.trim(),
          description: description.trim(),
          type: "BUG" as const,
          priority,
          stepsToReproduce: stepsToReproduce.trim() || undefined,
          expectedResult: expectedResult.trim() || undefined,
          actualResult: actualResult.trim() || undefined,
          errorLog: errorLog.trim() || undefined,
        };

        const res = await api.post<{ id: string; key: string }>("/issues", issuePayload);
        targetIssue = { id: res.id, key: res.key };
        setCreatedIssue(targetIssue);
        toastSuccess(`Bug created as ${targetIssue.key}! Starting media uploads...`);
      }

      // Step 2: Upload Attachments sequentially
      const pendingFiles = attachedFiles.filter((item) => item.status !== "success");
      let allPassed = true;

      for (const item of pendingFiles) {
        const ok = await uploadSingleFile(targetIssue.id, item);
        if (!ok) {
          allPassed = false;
        }
      }

      if (allPassed) {
        setOverallSuccess(true);
        toastSuccess("Bug report and all attachments saved successfully!");
      } else {
        toastError(
          "Some attachments failed to upload. Click Retry on the failed items below."
        );
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to submit bug report");
      } else {
        toastError("An unexpected error occurred during submission");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasAudioAttached = attachedFiles.some((f) => f.kind === "AUDIO");
  const hasVideoAttached = attachedFiles.some((f) => f.kind === "VIDEO");

  // Success view if finished completely
  if (overallSuccess && createdIssue) {
    return (
      <div className="max-w-2xl mx-auto py-12 space-y-6">
        <Card className="p-8 text-center space-y-5 border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-emerald-950/20 shadow-xl dark:shadow-none">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/60 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Bug Report Submitted Successfully!
          </h2>

          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
            Issue <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">{createdIssue.key}</span>{" "}
            has been logged with all visual diagnostics, recordings, and error traces.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={`/issues/${createdIssue.id}`}>
              <Button variant="primary" className="w-full sm:w-auto shadow-sm">
                <span>View Bug Detail ({createdIssue.key})</span>
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </Link>

            <Button
              variant="outline"
              onClick={() => {
                setOverallSuccess(false);
                setCreatedIssue(null);
                setTitle("");
                setDescription("");
                setStepsToReproduce("");
                setExpectedResult("");
                setActualResult("");
                setErrorLog("");
                setAttachedFiles([]);
                setRawImages([]);
              }}
              className="w-full sm:w-auto"
            >
              <span>Report Another Bug</span>
            </Button>

            <Link href="/issues?type=BUG">
              <Button variant="secondary" className="w-full sm:w-auto">
                <span>Back to Issues</span>
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar / Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/issues?type=BUG"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Issues</span>
        </Link>

        {createdIssue && (
          <Badge variant="primary" size="sm" className="font-mono">
            Logging under {createdIssue.key}
          </Badge>
        )}
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Report a Bug</h1>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAIModalOpen(true)}
              className="border-indigo-500/50 bg-indigo-950/30 text-indigo-300 hover:bg-indigo-500/20 text-xs py-1.5 h-8 flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>✨ AI Root Cause Diagnosis</span>
            </Button>
          </div>
          <Badge variant="danger" size="sm">
            <Bug className="w-3 h-3 mr-1 inline" />
            Visual Bug Reporting
          </Badge>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Record your screen or voice, paste terminal errors, and attach screenshots so teammates can reproduce and fix the bug quickly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Core Information */}
        <Card className="space-y-4">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base text-slate-900 dark:text-white">1. Core Bug Information</CardTitle>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Target Project <span className="text-rose-500">*</span>
              </label>
              {isLoadingProjects ? (
                <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
              ) : projects.length === 0 ? (
                <p className="text-xs text-rose-500">
                  You do not belong to any projects yet. Ask an admin to add you.
                </p>
              ) : (
                <Select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={!!createdIssue || isSubmitting}
                  required
                >
                  {(Array.isArray(projects) ? projects : []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Severity / Priority <span className="text-rose-500">*</span>
              </label>
              <Select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")
                }
                disabled={!!createdIssue || isSubmitting}
              >
                <option value="CRITICAL">🔴 Critical (Blocks work / Crash)</option>
                <option value="HIGH">🟠 High (Major function broken)</option>
                <option value="MEDIUM">🟡 Medium (Normal bug)</option>
                <option value="LOW">🔵 Low (Minor polish / Typos)</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Bug Title <span className="text-rose-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Audio recorder crashes when user denies microphone permission"
              disabled={!!createdIssue || isSubmitting}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Description / Summary <span className="text-rose-500">*</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a concise description of what went wrong..."
              rows={3}
              disabled={!!createdIssue || isSubmitting}
              required
            />
          </div>
        </Card>

        {/* AI Diagnostic & Auto-Fill Assistant */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-800/40 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">AI Bug Triage & Code Locator</h4>
              <p className="text-xs text-indigo-300/80">
                Paste an error message or describe the issue to automatically predict priority, root cause & failing files.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAIModalOpen(true)}
            className="border-indigo-500/50 bg-indigo-900/40 text-indigo-200 hover:bg-indigo-500/30 text-xs font-semibold py-1.5 h-9 shrink-0 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Analyze with AI</span>
          </Button>
        </div>

        {/* Step 2: Diagnostic & Reproduction Details */}
        <Card className="space-y-4">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base text-slate-900 dark:text-white">
              2. Reproduction Steps & Diagnostic Details
            </CardTitle>
          </CardHeader>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Steps to Reproduce
            </label>
            <Textarea
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              placeholder="1. Go to '/bug-reports'&#10;2. Click on 'Record Screen'&#10;3. Select current tab and observe console error"
              rows={3}
              disabled={!!createdIssue || isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Expected Result
              </label>
              <Textarea
                value={expectedResult}
                onChange={(e) => setExpectedResult(e.target.value)}
                placeholder="What did you expect to happen?"
                rows={2}
                disabled={!!createdIssue || isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Actual Result
              </label>
              <Textarea
                value={actualResult}
                onChange={(e) => setActualResult(e.target.value)}
                placeholder="What actually occurred instead?"
                rows={2}
                disabled={!!createdIssue || isSubmitting}
              />
            </div>
          </div>

          {/* Error Log / Stack Trace */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Error Message or Stack Trace (Escaped Plain Text)</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Preserves exact spaces and line breaks
              </span>
            </div>
            <textarea
              value={errorLog}
              onChange={(e) => setErrorLog(e.target.value)}
              placeholder="Paste terminal errors, API response failures, or stack traces here..."
              rows={4}
              disabled={!!createdIssue || isSubmitting}
              className="w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-xs font-mono text-rose-600 dark:text-rose-300 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </Card>

        {/* Step 3: Media Capture (Audio, Video, Images) */}
        <Card className="space-y-6">
          <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base text-slate-900 dark:text-white flex items-center justify-between">
              <span>3. Visual & Audio Media Capture</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                {attachedFiles.length} item(s) attached
              </span>
            </CardTitle>
          </CardHeader>

          {/* Screen Recorder */}
          <ScreenRecorderCard
            onAttach={handleAttachVideo}
            isAttached={hasVideoAttached}
            onRemoveAttached={handleRemoveVideo}
          />

          {/* Voice Recorder */}
          <AudioRecorderCard
            onAttach={handleAttachAudio}
            isAttached={hasAudioAttached}
            onRemoveAttached={handleRemoveAudio}
          />

          {/* Screenshot Dropzone */}
          <div>
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Screenshots (PNG, JPEG, WebP - Drag & Drop or Ctrl+V)
            </h4>
            <ImageDropzone
              images={rawImages}
              onChange={handleImagesChange}
              maxFiles={5}
              maxSizeMb={5}
            />
          </div>
        </Card>

        {/* Attached Files List & Upload Progress Queue */}
        {attachedFiles.length > 0 && (
          <Card className="space-y-3">
            <CardHeader className="pb-2 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <span>Ready for Submission ({attachedFiles.length})</span>
              </CardTitle>
            </CardHeader>

            <div className="space-y-2">
              {attachedFiles.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                      {item.kind === "AUDIO" ? (
                        <Mic className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      ) : item.kind === "VIDEO" ? (
                        <Video className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
                        {item.file.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.kind} • {formatBytes(item.file.size)}
                        {item.durationSeconds ? ` • ${Math.round(item.durationSeconds)}s` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {/* Status / Progress Indicator */}
                    {item.status === "uploading" && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-2 rounded-full transition-all duration-200"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                          {item.progress}%
                        </span>
                      </div>
                    )}

                    {item.status === "success" && (
                      <Badge variant="success" size="sm">
                        <CheckCircle2 className="w-3 h-3 mr-1 inline" />
                        Uploaded
                      </Badge>
                    )}

                    {item.status === "error" && (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-rose-500 dark:text-rose-400 truncate max-w-[150px]">
                          {item.errorMessage || "Failed"}
                        </span>
                        {createdIssue && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRetryUpload(item)}
                            className="h-7 text-xs"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            <span>Retry</span>
                          </Button>
                        )}
                      </div>
                    )}

                    {item.status === "idle" && !isSubmitting && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveAttachment(item.id)}
                        className="text-slate-400 hover:text-rose-500 h-7 px-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/bug-reports">
            <Button variant="ghost" disabled={isSubmitting}>
              <span>Cancel</span>
            </Button>
          </Link>

          <Button
            type="submit"
            variant="danger"
            isLoading={isSubmitting}
            disabled={isSubmitting || isLoadingProjects || projects.length === 0}
            className="shadow-lg shadow-rose-600/25 px-6"
          >
            <Send className="w-4 h-4 mr-2" />
            <span>
              {isSubmitting
                ? "Submitting Bug & Uploading Media..."
                : createdIssue
                ? "Retry Pending Uploads"
                : `Submit Bug Report (${attachedFiles.length} files)`}
            </span>
          </Button>
        </div>
      </form>
      {/* AI Bug Analysis & Code Locator Modal */}
      <AIBugAnalysisModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        initialData={{
          title,
          description,
          errorLog,
          stepsToReproduce,
          expectedResult,
          actualResult,
        }}
        onApplyDiagnosis={(suggested) => {
          if (suggested.priority) {
            setPriority(suggested.priority);
          }
          if (suggested.resolutionNotes) {
            setDescription((prev) =>
              prev
                ? `${prev}\n\n[AI Root Cause & Fix]:\n${suggested.resolutionNotes}`
                : `[AI Root Cause & Fix]:\n${suggested.resolutionNotes}`
            );
          }
          if (suggested.stepsToReproduce && !stepsToReproduce) {
            setStepsToReproduce(suggested.stepsToReproduce);
          }
          toastSuccess("AI suggested priority, diagnosis & steps applied to form!");
        }}
      />
    </div>
  );
}
