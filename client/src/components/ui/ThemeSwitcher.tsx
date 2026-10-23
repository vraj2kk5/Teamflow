"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTheme, Theme } from "../../contexts/ThemeContext";
import { Sun, Moon, Laptop, Check } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options: { label: string; value: Theme; icon: React.ComponentType<{ className?: string }> }[] = [
    { label: "Light", value: "light", icon: Sun },
    { label: "Dark", value: "dark", icon: Moon },
    { label: "System", value: "system", icon: Laptop },
  ];

  // Active icon on button
  const ActiveIcon = theme === "system" ? Laptop : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-2.5 rounded-lg border border-slate-800 bg-slate-900/90 hover:bg-slate-800/80 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        title={`Current theme: ${theme} (${resolvedTheme})`}
        aria-label="Toggle theme"
      >
        <ActiveIcon className="w-3.5 h-3.5 text-indigo-400" />
        <span className="capitalize hidden sm:inline">{theme}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-1 text-xs text-slate-200 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
            Theme Mode
          </div>

          <div className="p-1 space-y-0.5">
            {options.map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.value;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setTheme(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                      : "hover:bg-slate-800/70 text-slate-300 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-indigo-400" : "text-slate-400"}`} />
                    <span>{opt.label}</span>
                  </div>

                  {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
