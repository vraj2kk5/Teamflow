"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Button } from "../components/ui/Button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client-side crash
    console.error("Uncaught application error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-5 shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Something went wrong
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            An unexpected error occurred while rendering this page. You can try reloading or return to the dashboard.
          </p>
        </div>

        {error.message && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-left">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Error Details:</span>
            <p className="text-xs font-mono text-rose-600 dark:text-rose-300 mt-0.5 break-words">
              {error.message}
            </p>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button variant="primary" onClick={reset} className="w-full sm:w-auto">
            <RefreshCw className="w-4 h-4 mr-2" />
            <span>Try Again</span>
          </Button>

          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full">
              <Home className="w-4 h-4 mr-2" />
              <span>Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
