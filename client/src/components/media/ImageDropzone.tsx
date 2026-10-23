"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Image as ImageIcon, X, Upload, AlertCircle } from "lucide-react";
import { formatBytes } from "../../lib/utils";

interface ImageDropzoneProps {
  images: File[];
  onChange: (images: File[]) => void;
  maxFiles?: number;
  maxSizeMb?: number;
}

export function ImageDropzone({
  images,
  onChange,
  maxFiles = 5,
  maxSizeMb = 5,
}: ImageDropzoneProps) {
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<{ id: string; url: string; file: File }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate previews and clean up old object URLs
  useEffect(() => {
    const newPreviews = images.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      url: URL.createObjectURL(file),
      file,
    }));

    setPreviews(newPreviews);

    return () => {
      newPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [images]);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      setError(null);
      const validFiles: File[] = [];

      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];

        if (!file.type.startsWith("image/")) {
          setError(`File "${file.name}" is not an image. Only PNG, JPEG, WebP, GIF are allowed.`);
          continue;
        }

        if (file.type.includes("svg")) {
          setError("SVG image files are not permitted for security reasons.");
          continue;
        }

        if (file.size > maxSizeMb * 1024 * 1024) {
          setError(`"${file.name}" exceeds the ${maxSizeMb} MB limit (${formatBytes(file.size)}).`);
          continue;
        }

        validFiles.push(file);
      }

      if (images.length + validFiles.length > maxFiles) {
        setError(`Maximum of ${maxFiles} screenshots allowed per bug report.`);
        return;
      }

      onChange([...images, ...validFiles]);
    },
    [images, maxFiles, maxSizeMb, onChange]
  );

  // Paste from clipboard support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData || !e.clipboardData.items) return;
      const items = e.clipboardData.items;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            const namedFile = new File([file], `pasted-screenshot-${Date.now()}.png`, {
              type: file.type,
            });
            pastedFiles.push(namedFile);
          }
        }
      }

      if (pastedFiles.length > 0) {
        addFiles(pastedFiles);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addFiles]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (index: number) => {
    const updated = [...images];
    updated.splice(index, 1);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Screenshots & Diagrams ({images.length}/{maxFiles})
        </label>
        <span className="text-[11px] text-slate-500">
          Paste (Ctrl+V) from clipboard supported
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Dropzone Box */}
      {images.length < maxFiles && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500/60 rounded-xl p-5 text-center cursor-pointer transition-colors bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/80 group"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
            }}
          />
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              <Upload className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Drop screenshot here, or{" "}
              <span className="text-indigo-600 dark:text-indigo-400 underline">browse files</span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              PNG, JPG, WebP, GIF up to {maxSizeMb} MB each
            </p>
          </div>
        </div>
      )}

      {/* Previews Grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {previews.map((preview, index) => (
            <div
              key={preview.id}
              className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 aspect-video flex items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.url}
                alt={`Screenshot ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(index);
                }}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/80 text-white hover:bg-rose-600 transition-colors"
                title="Remove screenshot"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
