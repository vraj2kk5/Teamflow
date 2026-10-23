"use client";

import React, { useState, useId } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface PasswordCondition {
  id: string;
  label: string;
  met: boolean;
}

export function evaluatePassword(pwd: string): PasswordCondition[] {
  return [
    {
      id: "length",
      label: "At least 8 characters",
      met: pwd.length >= 8,
    },
    {
      id: "uppercase",
      label: "One uppercase letter (A-Z)",
      met: /[A-Z]/.test(pwd),
    },
    {
      id: "lowercase",
      label: "One lowercase letter (a-z)",
      met: /[a-z]/.test(pwd),
    },
    {
      id: "number",
      label: "One number (0-9)",
      met: /[0-9]/.test(pwd),
    },
    {
      id: "special",
      label: "One special character (!@#$%...)",
      met: /[^A-Za-z0-9]/.test(pwd),
    },
  ];
}

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  helperText?: string;
  showConditions?: boolean;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      className,
      label = "Password",
      error,
      helperText,
      value = "",
      showConditions = false,
      required,
      id,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const pwdString = typeof value === "string" ? value : "";
    const conditions = evaluatePassword(pwdString);
    const metCount = conditions.filter((c) => c.met).length;

    // Strength calculations
    const getStrength = () => {
      if (pwdString.length === 0) return { label: "", color: "", percent: 0 };
      if (metCount <= 2) return { label: "Weak", color: "bg-rose-500", text: "text-rose-500", percent: 33 };
      if (metCount <= 4) return { label: "Medium", color: "bg-amber-500", text: "text-amber-500", percent: 66 };
      return { label: "Strong", color: "bg-emerald-500", text: "text-emerald-500", percent: 100 };
    };

    const strength = getStrength();
    const shouldDisplayConditions = showConditions && (isFocused || pwdString.length > 0);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
          >
            {label}
            {required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            type={showPassword ? "text" : "password"}
            value={value}
            required={required}
            onChange={onChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              "w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-3.5 py-2 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-950",
              error && "border-rose-500 focus:ring-rose-500",
              className
            )}
            {...props}
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>}

        {/* Real-time Password Conditions Panel */}
        {shouldDisplayConditions && (
          <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 space-y-2.5 animate-in fade-in duration-200">
            {/* Strength Meter Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Password Strength</span>
                {strength.label && (
                  <span className={cn("font-bold", strength.text)}>{strength.label}</span>
                )}
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={cn("h-full transition-all duration-300 rounded-full", strength.color)}
                  style={{ width: `${strength.percent}%` }}
                />
              </div>
            </div>

            {/* Checklist Conditions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
              {conditions.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "flex items-center gap-1.5 text-xs transition-colors",
                    c.met
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  {c.met ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600" />
                    </span>
                  )}
                  <span className="truncate">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
