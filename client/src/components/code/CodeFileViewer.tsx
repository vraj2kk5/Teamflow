"use client";

import React, { useState, useEffect, useRef } from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { api } from "../../lib/api";
import {
  FileCode2,
  Download,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FolderCode,
  Layers,
} from "lucide-react";

export interface CodeFileViewerProps {
  filePath?: string | null;
  lineNumber?: number | null;
  codeSnippet?: string | null;
  errorLog?: string | null;
  title?: string;
  projectId?: string | null;
  repositoryUrl?: string | null;
  defaultBranch?: string | null;
}

interface LoadedFileState {
  relativePath: string;
  fileName: string;
  content: string;
  lineCount: number;
  repositoryUrl?: string | null;
  defaultBranch?: string | null;
}

export function CodeFileViewer({
  filePath: initialFilePath,
  lineNumber: initialLineNumber,
  codeSnippet,
  errorLog,
  title = "Problematic Code File & Line Location",
  projectId,
  repositoryUrl: propRepoUrl,
  defaultBranch: propDefaultBranch,
}: CodeFileViewerProps) {
  const [copied, setCopied] = useState<"path" | "code" | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [fileData, setFileData] = useState<LoadedFileState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const targetLineRef = useRef<HTMLTableRowElement | null>(null);

  // Extract path and line from errorLog if not directly provided
  const parsedFromLog = React.useMemo(() => {
    if (initialFilePath) return { path: initialFilePath, line: initialLineNumber || null };
    if (!errorLog) return { path: null, line: null };

    // Match stack trace patterns like (client/src/...:42:15) or at .../Component.tsx:42
    const traceMatch = errorLog.match(/(?:at\s+[\w$.]+\s+\()?(?:[A-Za-z]:[\\/])?([a-zA-Z0-9_\-./\\]+\.(?:tsx|ts|jsx|js|prisma|sql)):(\d+)/i);
    if (traceMatch) {
      let extracted = traceMatch[1].replace(/\\/g, "/");
      const clientIdx = extracted.indexOf("client/src/");
      const serverIdx = extracted.indexOf("server/src/");
      const prismaIdx = extracted.indexOf("server/prisma/");
      if (clientIdx !== -1) extracted = extracted.substring(clientIdx);
      else if (serverIdx !== -1) extracted = extracted.substring(serverIdx);
      else if (prismaIdx !== -1) extracted = extracted.substring(prismaIdx);

      return {
        path: extracted,
        line: parseInt(traceMatch[2], 10),
      };
    }
    return { path: null, line: null };
  }, [initialFilePath, initialLineNumber, errorLog]);

  const effectivePath = parsedFromLog.path;
  const effectiveLine = parsedFromLog.line;

  // Fetch the source file content from the server
  useEffect(() => {
    if (!effectivePath) {
      if (codeSnippet) {
        setFileData({
          relativePath: "snippet.txt",
          fileName: "Code Snippet",
          content: codeSnippet,
          lineCount: codeSnippet.split("\n").length,
        });
      }
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);

    const params: Record<string, string> = { path: effectivePath };
    if (projectId) params.projectId = projectId;

    api
      .get<LoadedFileState | { data: LoadedFileState }>(`/issues/code-file`, params)
      .then((res: any) => {
        if (!isMounted) return;
        const data: LoadedFileState = res?.data || res;
        setFileData(data);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        // If file not in repo, fallback to codeSnippet if available
        if (codeSnippet) {
          setFileData({
            relativePath: effectivePath,
            fileName: effectivePath.split("/").pop() || "source.ts",
            content: codeSnippet,
            lineCount: codeSnippet.split("\n").length,
          });
        } else {
          setLoadError(err?.message || "File could not be loaded from project repository");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [effectivePath, codeSnippet, projectId]);

  // Scroll to target line when expanded or loaded
  useEffect(() => {
    if (targetLineRef.current && isExpanded) {
      targetLineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isExpanded, fileData]);

  if (!effectivePath && !codeSnippet && !fileData) {
    return null;
  }

  // Determine Architecture Layer
  const layer = effectivePath?.startsWith("client/")
    ? "Frontend (Client)"
    : effectivePath?.startsWith("server/prisma/")
    ? "Database & Models"
    : effectivePath?.startsWith("server/")
    ? "Backend (API)"
    : "Source Code";

  const layerBadgeVariant =
    layer === "Frontend (Client)"
      ? "primary"
      : layer === "Backend (API)"
      ? "success"
      : layer === "Database & Models"
      ? "purple"
      : "neutral";

  const handleCopyPath = () => {
    if (!effectivePath) return;
    navigator.clipboard.writeText(effectivePath);
    setCopied("path");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCopyCode = () => {
    if (!fileData?.content) return;
    navigator.clipboard.writeText(fileData.content);
    setCopied("code");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownload = () => {
    if (fileData?.content) {
      const blob = new Blob([fileData.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileData.fileName || "source-file.txt";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else if (effectivePath) {
      const downloadUrl = `/api/issues/code-file/download?path=${encodeURIComponent(effectivePath)}${
        projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""
      }`;
      window.open(downloadUrl, "_blank");
    }
  };

  // Build GitHub deep link if repository is linked
  const effectiveRepoUrl = fileData?.repositoryUrl || propRepoUrl;
  const effectiveBranch = fileData?.defaultBranch || propDefaultBranch || "main";

  let gitHubFileUrl: string | null = null;
  if (effectiveRepoUrl && effectivePath) {
    const ghMatch = effectiveRepoUrl.match(/(?:github\.com\/|^)([\w.-]+)\/([\w.-]+?)(?:\.git|\/|$)/i);
    if (ghMatch) {
      const owner = ghMatch[1];
      const repo = ghMatch[2];
      gitHubFileUrl = `https://github.com/${owner}/${repo}/blob/${effectiveBranch}/${effectivePath}${
        effectiveLine ? `#L${effectiveLine}` : ""
      }`;
    }
  }

  // Build VS Code deep link
  const vsCodeUrl = effectivePath
    ? `vscode://file/${effectivePath.startsWith("/") ? effectivePath : `/${effectivePath}`}${
        effectiveLine ? `:${effectiveLine}` : ""
      }`
    : null;

  const lines = fileData?.content ? fileData.content.split("\n") : [];
  const displayLines = isExpanded ? lines : lines.slice(0, 30);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Top Header Card */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileCode2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {fileData?.fileName || effectivePath?.split("/").pop() || "Affected Code File"}
              </h4>
              <Badge variant={layerBadgeVariant} size="sm">
                {layer}
              </Badge>
              {effectiveLine && (
                <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  Line #{effectiveLine}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate select-all">
                {effectivePath || "Code snippet provided"}
              </span>
              {effectivePath && (
                <button
                  type="button"
                  onClick={handleCopyPath}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-0.5 transition-colors"
                  title="Copy relative file path"
                >
                  {copied === "path" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: GitHub Link, Download, Copy, VS Code */}
        <div className="flex items-center gap-2 shrink-0">
          {/* View on GitHub */}
          {gitHubFileUrl && (
            <a
              href={gitHubFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white border border-slate-700 h-8 transition-colors shadow-sm"
              title="Open file and line directly on GitHub"
            >
              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">View on GitHub</span>
            </a>
          )}

          {/* Download File Button */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleDownload}
            disabled={!fileData?.content && !effectivePath}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-1.5 h-8 flex items-center gap-1.5 shadow-sm"
            title="Download the full file to your machine"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download File</span>
          </Button>

          {/* Copy Code */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyCode}
            disabled={!fileData?.content}
            className="text-xs py-1.5 h-8 flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
            title="Copy code to clipboard"
          >
            {copied === "code" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </Button>

          {/* Open in local VS Code */}
          {vsCodeUrl && (
            <a
              href={vsCodeUrl}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 h-8 transition-colors"
              title="Open directly in local Visual Studio Code"
            >
              <FolderCode className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Open in VS Code</span>
            </a>
          )}
        </div>
      </div>

      {/* Code Content Container */}
      <div className="relative">
        {isLoading && (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading source file content from workspace...</span>
          </div>
        )}

        {loadError && !fileData && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/40 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {loadError}. Path: <code className="font-mono">{effectivePath}</code>
            </span>
          </div>
        )}

        {fileData && (
          <div className="overflow-x-auto max-h-[480px] bg-slate-900 text-slate-200 font-mono text-xs leading-relaxed select-text">
            <table className="w-full border-collapse">
              <tbody>
                {displayLines.map((line, idx) => {
                  const lineNum = idx + 1;
                  const isTargetLine = effectiveLine === lineNum;

                  return (
                    <tr
                      key={lineNum}
                      ref={isTargetLine ? targetLineRef : undefined}
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isTargetLine
                          ? "bg-amber-500/20 dark:bg-amber-500/25 border-l-4 border-amber-500"
                          : ""
                      }`}
                    >
                      {/* Line Number Column */}
                      <td
                        className={`py-0.5 px-3 select-none text-right w-12 font-mono text-[11px] ${
                          isTargetLine
                            ? "text-amber-400 font-bold bg-amber-500/30"
                            : "text-slate-500 bg-slate-950/60"
                        }`}
                      >
                        {isTargetLine ? `➜ ${lineNum}` : lineNum}
                      </td>

                      {/* Line Code */}
                      <td
                        className={`py-0.5 px-4 whitespace-pre font-mono ${
                          isTargetLine ? "text-amber-200 font-semibold" : "text-slate-300"
                        }`}
                      >
                        {line || " "}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Expand / Collapse Footer */}
        {lines.length > 30 && (
          <div className="p-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {isExpanded ? lines.length : Math.min(30, lines.length)} of {lines.length} lines
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs h-7 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Show Less</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Expand Full File ({lines.length} lines)</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
