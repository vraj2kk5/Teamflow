"use client";

import React, { useState } from "react";
import { CodeLocatorCard, AffectedFileLocation } from "./CodeLocatorCard";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { api } from "../../lib/api";
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Wrench,
  ListOrdered,
  Copy,
  Check,
  RotateCw,
} from "lucide-react";

interface AIAnalysisResult {
  suggestedPriority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  rootCauseAnalysis: string;
  suggestedFix: string;
  suggestedStepsToReproduce: string[];
  reproductionConfidence: number;
  aiEngine: string;
  affectedFiles?: AffectedFileLocation[];
}

interface AIBugAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: {
    title?: string;
    description?: string;
    errorLog?: string;
    stepsToReproduce?: string;
    expectedResult?: string;
    actualResult?: string;
  };
  onApplyDiagnosis?: (suggested: {
    priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    resolutionNotes?: string;
    stepsToReproduce?: string;
  }) => void;
}

export function AIBugAnalysisModal({
  isOpen,
  onClose,
  initialData,
  onApplyDiagnosis,
}: AIBugAnalysisModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [copiedFix, setCopiedFix] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await api.post<{ data: AIAnalysisResult }>("/issues/ai-analyze", initialData);
      setResult(res.data);
    } catch (err: any) {
      setError(err?.message || "Failed to analyze bug with AI engine");
    } finally {
      setIsAnalyzing(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !result && !isAnalyzing) {
      runAnalysis();
    }
  }, [isOpen]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFix(true);
    setTimeout(() => setCopiedFix(false), 2000);
  };

  const priorityColors: Record<string, string> = {
    CRITICAL: "border-rose-500/30 text-rose-400 bg-rose-500/10",
    HIGH: "border-orange-500/30 text-orange-400 bg-orange-500/10",
    MEDIUM: "border-amber-500/30 text-amber-400 bg-amber-500/10",
    LOW: "border-blue-500/30 text-blue-400 bg-blue-500/10",
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Bug Diagnosis & Root Cause Analysis"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Header Engine Banner */}
        <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-indigo-950/60 to-purple-950/60 border border-indigo-800/40 rounded-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                {result?.aiEngine || "Deep Full-Stack Diagnostics Engine"}
              </h4>
              <p className="text-xs text-indigo-300/80">
                Automated error log parsing & remediation
              </p>
            </div>
          </div>
          {result && (
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-300">
              {result.reproductionConfidence}% Confidence
            </Badge>
          )}
        </div>

        {/* Loading State */}
        {isAnalyzing && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              <Cpu className="w-5 h-5 text-indigo-400 absolute inset-0 m-auto" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white">Inspecting stack trace & logs...</p>
              <p className="text-xs text-slate-400 mt-1">Cross-referencing ORM, HTTP & runtime crash patterns</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isAnalyzing && (
          <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h5 className="text-sm font-semibold text-rose-300">Analysis Error</h5>
              <p className="text-xs text-rose-300/80 mt-1">{error}</p>
              <button
                onClick={runAnalysis}
                className="mt-3 text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" /> Retry Diagnostics
              </button>
            </div>
          </div>
        )}

        {/* Result View */}
        {result && !isAnalyzing && (
          <div className="space-y-4">
            {/* Meta Row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">Diagnosis:</span>
              <Badge
                variant="outline"
                className={`font-semibold ${priorityColors[result.suggestedPriority]}`}
              >
                Suggested Priority: {result.suggestedPriority}
              </Badge>
              <Badge variant="outline" className="border-slate-700 bg-slate-800 text-slate-300">
                Category: {result.category}
              </Badge>
            </div>

            {/* Root Cause Analysis */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Root Cause Analysis
              </h5>
              <p className="text-sm text-slate-300 leading-relaxed">
                {result.rootCauseAnalysis}
              </p>
            </div>

            {/* Suggested Fix */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  Recommended Action & Code Fix
                </h5>
                <button
                  onClick={() => copyToClipboard(result.suggestedFix)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  {copiedFix ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedFix ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300/90 overflow-x-auto whitespace-pre-wrap">
                {result.suggestedFix}
              </pre>
            </div>

            {/* Suggested Steps To Reproduce */}
            {result.suggestedStepsToReproduce && result.suggestedStepsToReproduce.length > 0 && (
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5" />
                  Step-by-Step Reproduction Path
                </h5>
                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-300">
                  {result.suggestedStepsToReproduce.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Pinpointed Code Locations */}
            {result.affectedFiles && result.affectedFiles.length > 0 && (
              <CodeLocatorCard files={result.affectedFiles} />
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              {onApplyDiagnosis && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onApplyDiagnosis({
                      priority: result.suggestedPriority,
                      resolutionNotes: result.suggestedFix,
                      stepsToReproduce: result.suggestedStepsToReproduce.join("\n"),
                    });
                    onClose();
                  }}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Apply Priority & Fix to Issue
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
