import React from "react";
import Link from "next/link";
import { Button } from "../components/ui/Button";
import { FileQuestion, ArrowLeft, Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-indigo-950/80 border border-indigo-800/80 text-indigo-400 flex items-center justify-center mx-auto">
          <FileQuestion className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">
            404 Error
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Page Not Found
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The resource, project, or issue you are looking for does not exist or you do not have permission to access it.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="primary" className="w-full">
              <Home className="w-4 h-4 mr-2" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>

          <Link href="/projects" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Projects</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
