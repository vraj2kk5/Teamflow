import React from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none",
          // Sizes
          size === "sm" && "px-3 py-1.5 text-xs gap-1.5",
          size === "md" && "px-4 py-2 text-sm gap-2",
          size === "lg" && "px-5 py-2.5 text-base gap-2.5",
          // Variants
          variant === "primary" &&
            "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 shadow-sm",
          variant === "secondary" &&
            "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700 focus:ring-slate-500 border",
          variant === "outline" &&
            "border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-indigo-500",
          variant === "ghost" &&
            "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-slate-500",
          variant === "danger" &&
            "bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500 shadow-sm",
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
