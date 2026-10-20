import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "neutral"
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "purple"
    | "cyan";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "neutral",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full tracking-wide select-none",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        variant === "neutral" && "bg-slate-800 text-slate-300 border border-slate-700",
        variant === "primary" && "bg-indigo-950/80 text-indigo-300 border border-indigo-800",
        variant === "success" && "bg-emerald-950/80 text-emerald-300 border border-emerald-800",
        variant === "warning" && "bg-amber-950/80 text-amber-300 border border-amber-800",
        variant === "danger" && "bg-rose-950/80 text-rose-300 border border-rose-800",
        variant === "purple" && "bg-purple-950/80 text-purple-300 border border-purple-800",
        variant === "cyan" && "bg-cyan-950/80 text-cyan-300 border border-cyan-800",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
