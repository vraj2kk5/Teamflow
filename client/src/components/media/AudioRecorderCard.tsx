"use client";

import React from "react";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { Button } from "../ui/Button";
import { Mic, Square, Pause, Play, RotateCcw, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { formatDuration, formatBytes, cn } from "../../lib/utils";

interface AudioRecorderCardProps {
  onAttach: (file: File, durationSeconds: number) => void;
  isAttached: boolean;
  onRemoveAttached?: () => void;
}

export function AudioRecorderCard({
  onAttach,
  isAttached,
  onRemoveAttached,
}: AudioRecorderCardProps) {
  const {
    status,
    duration,
    audioBlob,
    audioUrl,
    error,
    mimeType,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    retakeRecording,
    discardRecording,
  } = useAudioRecorder(600); // 10 min limit

  const handleAttach = () => {
    if (!audioBlob) return;
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
    const file = new File([audioBlob], `voice-note-${Date.now()}.${ext}`, {
      type: mimeType,
    });
    onAttach(file, duration);
  };

  return (
    <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Voice Note / Audio Explanation</h4>
            <p className="text-xs text-slate-400">Describe steps, expected vs actual behavior (max 10 min)</p>
          </div>
        </div>

        {/* Live indicator & Timer */}
        {status === "recording" && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-mono font-semibold animate-pulse" aria-live="polite">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>REC {formatDuration(duration)}</span>
          </div>
        )}

        {status === "paused" && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 text-xs font-mono font-semibold" aria-live="polite">
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
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={startRecording}
          className="border-slate-700"
        >
          <Mic className="w-3.5 h-3.5 mr-1 text-indigo-400" />
          <span>Start Audio Recording</span>
        </Button>
      )}

      {/* Controls: Requesting state */}
      {status === "requesting" && (
        <div className="text-xs text-slate-400 flex items-center gap-2 py-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          <span>Waiting for microphone permission in your browser...</span>
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
            <span>Finish Recording</span>
          </Button>
        </div>
      )}

      {/* Preview & Attach: Stopped state */}
      {status === "stopped" && audioUrl && !isAttached && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-3">
            <audio src={audioUrl} controls className="w-full max-w-md h-10 rounded-lg" />
            <span className="text-xs text-slate-400 font-mono shrink-0">
              {audioBlob && formatBytes(audioBlob.size)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="primary" onClick={handleAttach}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>Attach to Bug Report</span>
            </Button>

            <Button type="button" size="sm" variant="ghost" onClick={retakeRecording}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              <span>Retake</span>
            </Button>

            <Button type="button" size="sm" variant="ghost" onClick={discardRecording} className="text-rose-400 hover:text-rose-300">
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
            <span>Voice note attached ({formatDuration(duration)})</span>
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
