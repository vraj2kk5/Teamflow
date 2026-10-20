"use client";

import React, { useState } from "react";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { Button } from "../ui/Button";
import {
  Monitor,
  Mic,
  Square,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { formatDuration, formatBytes, cn } from "../../lib/utils";

interface ScreenRecorderCardProps {
  onAttach: (file: File, durationSeconds: number) => void;
  isAttached: boolean;
  onRemoveAttached?: () => void;
}

export function ScreenRecorderCard({
  onAttach,
  isAttached,
  onRemoveAttached,
}: ScreenRecorderCardProps) {
  const [includeMic, setIncludeMic] = useState(true);

  const {
    status,
    duration,
    videoBlob,
    videoUrl,
    error,
    isSupported,
    mimeType,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    retakeRecording,
    discardRecording,
  } = useScreenRecorder(300); // 5 min limit

  const handleStart = () => {
    startRecording(includeMic);
  };

  const handleAttach = () => {
    if (!videoBlob) return;
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const file = new File([videoBlob], `screen-recording-${Date.now()}.${ext}`, {
      type: mimeType,
    });
    onAttach(file, duration);
  };

  if (!isSupported) {
    return (
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-slate-400">
          <Monitor className="w-4 h-4 text-slate-500" />
          <h4 className="text-sm font-semibold text-slate-300">Screen Recording</h4>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Browser screen capture is not supported on this device/mobile operating system. You can upload pre-recorded videos using the file attachments section instead.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
            <Monitor className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Screen & Video Reproduction</h4>
            <p className="text-xs text-slate-400">Record your tab, window, or display while reproducing the bug (max 5 min)</p>
          </div>
        </div>

        {/* Live indicator & Timer */}
        {status === "recording" && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-mono font-semibold animate-pulse self-start sm:self-auto" aria-live="polite">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>RECORDING {formatDuration(duration)}</span>
          </div>
        )}

        {status === "paused" && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 text-xs font-mono font-semibold self-start sm:self-auto" aria-live="polite">
            <span>PAUSED {formatDuration(duration)}</span>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Controls: Idle state */}
      {status === "idle" && !isAttached && (
        <div className="space-y-3 pt-1">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeMic}
              onChange={(e) => setIncludeMic(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-indigo-400" />
              <span>Include my microphone audio with screen recording</span>
            </span>
          </label>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleStart}
            className="border-slate-700"
          >
            <Monitor className="w-3.5 h-3.5 mr-1 text-indigo-400" />
            <span>Record Screen</span>
          </Button>
        </div>
      )}

      {/* Controls: Requesting state */}
      {status === "requesting" && (
        <div className="text-xs text-slate-400 flex items-center gap-2 py-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          <span>Select screen, window, or tab to share in your browser prompt...</span>
        </div>
      )}

      {/* Controls: Recording / Paused state */}
      {(status === "recording" || status === "paused") && (
        <div className="flex items-center gap-2">
          {status === "recording" ? (
            <Button type="button" size="sm" variant="outline" onClick={pauseRecording}>
              <Pause className="w-3.5 h-3.5 mr-1" />
              <span>Pause</span>
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={resumeRecording}>
              <Play className="w-3.5 h-3.5 mr-1" />
              <span>Resume</span>
            </Button>
          )}

          <Button type="button" size="sm" variant="danger" onClick={stopRecording}>
            <Square className="w-3.5 h-3.5 mr-1 fill-current" />
            <span>Stop Recording</span>
          </Button>
        </div>
      )}

      {/* Preview & Attach: Stopped state */}
      {status === "stopped" && videoUrl && !isAttached && (
        <div className="space-y-3 pt-2">
          <div className="rounded-xl overflow-hidden bg-black border border-slate-800 max-w-xl">
            <video src={videoUrl} controls className="w-full max-h-72 object-contain" />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Duration: {formatDuration(duration)}</span>
            <span>Size: {videoBlob && formatBytes(videoBlob.size)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="primary" onClick={handleAttach}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>Attach Video to Report</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => retakeRecording(includeMic)}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              <span>Retake</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={discardRecording}
              className="text-rose-400 hover:text-rose-300"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>Discard</span>
            </Button>
          </div>
        </div>
      )}

      {/* Attached State Notice */}
      {isAttached && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Screen recording attached ({formatDuration(duration)})</span>
          </div>

          {onRemoveAttached && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRemoveAttached}
              className="text-xs py-1 h-auto text-rose-400 hover:text-rose-300"
            >
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
