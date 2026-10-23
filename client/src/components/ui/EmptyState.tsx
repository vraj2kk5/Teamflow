import React from "react";
import { cn } from "../../lib/utils";
import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "./Button";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40",
        className
      )}
    >
      <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 mb-4">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description && (
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
