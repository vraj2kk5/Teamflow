"use client";

import React, { useState } from "react";
import { Badge } from "../ui/Badge";
import {
  FileCode2,
  ExternalLink,
  Copy,
  Check,
  FolderGit2,
  Terminal,
  Layers,
  ArrowRight,
} from "lucide-react";

export interface AffectedFileLocation {
  layer: "Frontend (Client)" | "Backend (API)" | "Database & Models" | "Architecture & Config";
  relativePath: string;
  fileName: string;
  lineNumber?: number;
  columnNumber?: number;
  vsCodeUrl: string;
  gitHubUrl: string;
  reason: string;
  confidence: "EXACT_STACK_TRACE" | "AI_INFERRED";
}

interface CodeLocatorCardProps {
  files: AffectedFileLocation[];
  title?: string;
}

export function CodeLocatorCard({ files, title = "Pinpointed Code & File Locations" }: CodeLocatorCardProps) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  if (!files || files.length === 0) return null;

  const handleCopy = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const layerColors: Record<AffectedFileLocation["layer"], { bg: string; text: string; border: string }> = {
    "Frontend (Client)": {
      bg: "bg-blue-500/10 dark:bg-blue-950/40",
      text: "text-blue-600 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-800/60",
    },
    "Backend (API)": {
      bg: "bg-emerald-500/10 dark:bg-emerald-950/40",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200 dark:border-emerald-800/60",
    },
    "Database & Models": {
      bg: "bg-purple-500/10 dark:bg-purple-950/40",
      text: "text-purple-600 dark:text-purple-400",
      border: "border-purple-200 dark:border-purple-800/60",
    },
    "Architecture & Config": {
      bg: "bg-amber-500/10 dark:bg-amber-950/40",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800/60",
    },
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <FileCode2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              {title}
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-transparent">
                {files.length} {files.length === 1 ? "file" : "files"}
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Direct deep link to the file and line number in your local IDE & repository
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
        {files.map((file, idx) => {
          const colors = layerColors[file.layer] || layerColors["Frontend (Client)"];
          const isCopied = copiedPath === file.relativePath;

          return (
            <div
              key={idx}
              className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              {/* File Info */}
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${colors.bg} ${colors.text} ${colors.border}`}
                  >
                    {file.layer}
                  </span>

                  {file.confidence === "EXACT_STACK_TRACE" && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                      <Terminal className="w-2.5 h-2.5" />
                      Exact Stack Trace Line
                    </span>
                  )}

                  {file.lineNumber && (
                    <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-transparent px-1.5 py-0.5 rounded">
                      Line #{file.lineNumber}
                    </span>
                  )}
                </div>

                {/* Path */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-slate-900 dark:text-white font-medium break-all select-all">
                    {file.relativePath}
                  </span>
                  <button
                    onClick={() => handleCopy(file.relativePath)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors p-1"
                    title="Copy relative file path"
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{file.reason}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
                {/* 1-Click Open in VS Code */}
                <a
                  href={file.vsCodeUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-500 text-white transition-colors shadow-sm"
                  title="Open directly in local Visual Studio Code"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Open in VS Code</span>
                </a>

                {/* View on GitHub */}
                <a
                  href={file.gitHubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
                  title="View on GitHub repository"
                >
                  <FolderGit2 className="w-3.5 h-3.5" />
                  <span>GitHub</span>
                  <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
