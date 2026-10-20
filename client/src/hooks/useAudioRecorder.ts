"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

const AUDIO_MIME_PREFERENCES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/wav",
];

export function useAudioRecorder(maxDurationSeconds = 600) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mimeTypeRef = useRef<string>("audio/webm");

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupStream();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [cleanupStream, audioUrl]);

  const selectSupportedMimeType = (): string => {
    if (typeof MediaRecorder === "undefined") return "audio/webm";
    for (const mime of AUDIO_MIME_PREFERENCES) {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    }
    return "";
  };

  const startRecording = useCallback(async () => {
    setError(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      setAudioBlob(null);
    }
    setDuration(0);
    chunksRef.current = [];

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("error");
      setError("Audio recording is not supported in this browser. Please upload an audio file instead.");
      return;
    }

    setStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const selectedMime = selectSupportedMimeType();
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 64000, // compact 64 kbps voice recording
      };
      if (selectedMime) {
        options.mimeType = selectedMime;
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      mimeTypeRef.current = recorder.mimeType || selectedMime || "audio/webm";

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        cleanupStream();
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        if (blob.size < 100) {
          setError("Recorded audio was too short or empty. Please try recording again.");
          setStatus("error");
          return;
        }
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setStatus("stopped");
      };

      recorder.onerror = () => {
        cleanupStream();
        setError("Audio recording error occurred.");
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
      cleanupStream();
      setStatus("error");
      const errorObj = err as Error;
      if (errorObj.name === "NotAllowedError" || errorObj.name === "PermissionDeniedError") {
        setError("Microphone permission was denied. Please allow microphone access in your browser settings.");
      } else if (errorObj.name === "NotFoundError" || errorObj.name === "DevicesNotFoundError") {
        setError("No microphone device was detected on your system.");
      } else if (errorObj.name === "NotReadableError") {
        setError("Microphone is currently in use by another application.");
      } else {
        setError(`Failed to start microphone: ${errorObj.message}`);
      }
    }
  }, [audioUrl, cleanupStream, maxDurationSeconds]);

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

  const retakeRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setDuration(0);
    setError(null);
    setStatus("idle");
    startRecording();
  }, [audioUrl, startRecording]);

  const discardRecording = useCallback(() => {
    cleanupStream();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setDuration(0);
    setError(null);
    setStatus("idle");
  }, [audioUrl, cleanupStream]);

  return {
    status,
    duration,
    audioBlob,
    audioUrl,
    error,
    mimeType: mimeTypeRef.current,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    retakeRecording,
    discardRecording,
  };
}
