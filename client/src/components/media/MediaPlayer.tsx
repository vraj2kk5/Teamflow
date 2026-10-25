"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api, ApiClientError } from "../../lib/api";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { Play, AlertCircle, RefreshCw, X } from "lucide-react";

interface MediaPlayerProps {
  attachmentId: string;
  kind: "AUDIO" | "VIDEO" | "IMAGE";
  filename: string;
  mimeType: string;
  initialAccessUrl?: string | null;
}

export function MediaPlayer({
  attachmentId,
  kind,
  filename,
  initialAccessUrl,
}: MediaPlayerProps) {
  const [accessUrl, setAccessUrl] = useState<string | null>(() => {
    if (!initialAccessUrl) return null;
    let finalUrl = initialAccessUrl;
    if (finalUrl.startsWith("/")) {
      const apiOrigin = process.env.NEXT_PUBLIC_API_URL
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, "")
        : "http://localhost:5000";
      finalUrl = `${apiOrigin}${finalUrl}`;
    }
    return finalUrl;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(() => Boolean(initialAccessUrl));
  const [error, setError] = useState<string | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const fetchAccessUrl = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ accessUrl: string; expiresIn: number }>(
        `/attachments/${attachmentId}/access`
      );
      let finalUrl = res.accessUrl;
      if (finalUrl.startsWith("/")) {
        const apiOrigin = process.env.NEXT_PUBLIC_API_URL
          ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, "")
          : "http://localhost:5000";
        finalUrl = `${apiOrigin}${finalUrl}`;
      }
      setAccessUrl(finalUrl);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError("Failed to generate streaming access token");
      }
    } finally {
      setIsLoading(false);
    }
  }, [attachmentId]);

  // For images, load access URL on mount if not already provided; for audio/video, load on user play or on demand
  useEffect(() => {
    if (kind === "IMAGE" && !accessUrl) {
      fetchAccessUrl();
    }
  }, [kind, accessUrl, fetchAccessUrl]);

  const handlePlayClick = () => {
    setHasStarted(true);
    fetchAccessUrl();
  };

  return (
    <div className="rounded-xl overflow-hidden bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 space-y-2 shadow-sm">
      <div className="flex items-center justify-between text-xs pb-1">
        <span className="font-semibold text-slate-800 dark:text-white truncate max-w-sm">{filename}</span>
        <div className="flex items-center gap-2">
          {accessUrl && (
            <a
              href={accessUrl}
              download={filename}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
            >
              Download
            </a>
          )}
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {kind}
          </span>
        </div>
      </div>

      {error ? (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={fetchAccessUrl} className="text-xs h-7">
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            <span>Retry</span>
          </Button>
        </div>
      ) : isLoading ? (
        <Skeleton className={kind === "VIDEO" ? "h-64 rounded-lg" : "h-12 rounded-lg"} />
      ) : kind === "IMAGE" ? (
        accessUrl ? (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={accessUrl}
              alt={filename}
              onClick={() => setIsLightboxOpen(true)}
              className="max-h-80 w-auto rounded-lg object-contain cursor-zoom-in hover:opacity-95 transition-opacity"
            />

            {/* Click to Enlarge Lightbox Modal */}
            {isLightboxOpen && (
              <div
                className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
                onClick={() => setIsLightboxOpen(false)}
              >
                <button
                  onClick={() => setIsLightboxOpen(false)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700"
                >
                  <X className="w-6 h-6" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={accessUrl}
                  alt={filename}
                  className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
                />
              </div>
            )}
          </div>
        ) : null
      ) : kind === "AUDIO" ? (
        !hasStarted ? (
          <Button size="sm" variant="outline" onClick={handlePlayClick} className="w-full">
            <Play className="w-3.5 h-3.5 mr-1 text-indigo-600 dark:text-indigo-400 fill-current" />
            <span>Load Audio Player</span>
          </Button>
        ) : accessUrl ? (
          <audio src={accessUrl} controls autoPlay preload="auto" className="w-full h-10" />
        ) : null
      ) : kind === "VIDEO" ? (
        !hasStarted ? (
          <div
            onClick={handlePlayClick}
            className="h-56 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-500/60 transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform">
              <Play className="w-5 h-5 ml-0.5 fill-current" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Play Screen Recording</span>
          </div>
        ) : accessUrl ? (
          <div className="rounded-lg overflow-hidden bg-black max-w-2xl">
            <video
              src={accessUrl}
              controls
              autoPlay
              playsInline
              preload="auto"
              className="w-full max-h-96 object-contain"
            />
          </div>
        ) : null
      ) : null}
    </div>
  );
}
