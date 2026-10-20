"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { RecorderStatus } from "./useAudioRecorder";

const VIDEO_MIME_PREFERENCES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
  "video/mp4",
];

export function useScreenRecorder(maxDurationSeconds = 300) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mimeTypeRef = useRef<string>("video/webm");

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia)
    ) {
      setIsSupported(false);
    }
  }, []);

  const cleanupStreams = useCallback(() => {
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (combinedStreamRef.current) {
      combinedStreamRef.current.getTracks().forEach((t) => t.stop());
      combinedStreamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupStreams();
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [cleanupStreams, videoUrl]);

  const selectSupportedMimeType = (): string => {
    if (typeof MediaRecorder === "undefined") return "video/webm";
    for (const mime of VIDEO_MIME_PREFERENCES) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return "";
  };

  const startRecording = useCallback(
    async (includeMic = false) => {
      setError(null);
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
        setVideoBlob(null);
      }
      setDuration(0);
      chunksRef.current = [];

      if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
        setStatus("error");
        setError(
          "Screen recording is not supported on this device/browser. Please upload a video recording instead."
        );
        return;
      }

      setStatus("requesting");

      try {
        // 1. Request Display Stream
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: "monitor",
          },
          audio: false,
        });
        displayStreamRef.current = displayStream;

        let combinedTracks: MediaStreamTrack[] = [...displayStream.getVideoTracks()];

        // 2. Optional Microphone Audio Stream
        if (includeMic && navigator.mediaDevices.getUserMedia) {
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
              },
            });
            micStreamRef.current = micStream;
            combinedTracks = [...combinedTracks, ...micStream.getAudioTracks()];
          } catch (micErr: unknown) {
            console.warn("Microphone access was denied; proceeding with screen video only", micErr);
          }
        }

        const combinedStream = new MediaStream(combinedTracks);
        combinedStreamRef.current = combinedStream;

        // Listen for user clicking "Stop sharing" in browser native UI
        const videoTrack = displayStream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            stopRecording();
          };
        }

        const selectedMime = selectSupportedMimeType();
        const options: MediaRecorderOptions = {
          videoBitsPerSecond: 1500000, // 1.5 Mbps for smooth crisp reproduction
        };
        if (selectedMime) {
          options.mimeType = selectedMime;
        }

        const recorder = new MediaRecorder(combinedStream, options);
        mediaRecorderRef.current = recorder;
        mimeTypeRef.current = recorder.mimeType || selectedMime || "video/webm";

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          cleanupStreams();
          const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
          if (blob.size < 500) {
            setError("Recording ended too quickly or contains no data. Please try again.");
            setStatus("error");
            return;
          }
          setVideoBlob(blob);
          const url = URL.createObjectURL(blob);
          setVideoUrl(url);
          setStatus("stopped");
        };

        recorder.onerror = () => {
          cleanupStreams();
          setError("Screen recording error occurred.");
          setStatus("error");
        };

        recorder.start(1000); // 1-second chunks
        setStatus("recording");

        timerRef.current = setInterval(() => {
          setDuration((prev) => {
            if (prev + 1 >= maxDurationSeconds) {
              stopRecording();
              return maxDurationSeconds;
            }
            return prev + 1;
          });
        }, 1000);
      } catch (err: unknown) {
        cleanupStreams();
        const errorObj = err as Error;
        // User cancelling the screen picker prompt is a silent cancel
        if (errorObj.name === "AbortError" || errorObj.name === "NotAllowedError") {
          setStatus("idle");
          return;
        }
        setStatus("error");
        setError(`Could not start screen recording: ${errorObj.message}`);
      }
    },
    [videoUrl, cleanupStreams, maxDurationSeconds]
  );

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === "recording") {
      if (typeof mediaRecorderRef.current.pause === "function") {
        mediaRecorderRef.current.pause();
        setStatus("paused");
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    }
  }, [status]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === "paused") {
      if (typeof mediaRecorderRef.current.resume === "function") {
        mediaRecorderRef.current.resume();
        setStatus("recording");
        timerRef.current = setInterval(() => {
          setDuration((prev) => {
            if (prev + 1 >= maxDurationSeconds) {
              stopRecording();
              return maxDurationSeconds;
            }
            return prev + 1;
          });
        }, 1000);
      }
    }
  }, [status, maxDurationSeconds]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && (status === "recording" || status === "paused")) {
      mediaRecorderRef.current.stop();
    }
  }, [status]);

  const retakeRecording = useCallback(
    (includeMic = false) => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
      }
      setVideoBlob(null);
      setDuration(0);
      setError(null);
      setStatus("idle");
      startRecording(includeMic);
    },
    [videoUrl, startRecording]
  );

  const discardRecording = useCallback(() => {
    cleanupStreams();
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }
    setVideoBlob(null);
    setDuration(0);
    setError(null);
    setStatus("idle");
  }, [videoUrl, cleanupStreams]);

  return {
    status,
    duration,
    videoBlob,
    videoUrl,
    error,
    isSupported,
    mimeType: mimeTypeRef.current,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    retakeRecording,
    discardRecording,
  };
}
