import React from "react";
import { cn } from "../../lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "rectangular" | "circular";
}

export function Skeleton({
  className,
  variant = "rectangular",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-slate-200 dark:bg-slate-800/80",
        variant === "text" && "h-4 rounded",
        variant === "rectangular" && "rounded-lg",
        variant === "circular" && "rounded-full",
        className
      )}
      {...props}
    />
  );
}
