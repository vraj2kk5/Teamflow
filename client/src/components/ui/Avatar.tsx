import React from "react";
import { cn } from "../../lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
}

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColor(name?: string): string {
  const colors = [
    "bg-indigo-600 text-white",
    "bg-emerald-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-cyan-600 text-white",
    "bg-purple-600 text-white",
    "bg-blue-600 text-white",
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Avatar({
  className,
  name,
  avatarUrl,
  size = "md",
  ...props
}: AvatarProps) {
  const initials = getInitials(name);
  const colorClass = getColor(name);

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-full font-semibold shrink-0 select-none overflow-hidden",
        size === "sm" && "w-6 h-6 text-[10px]",
        size === "md" && "w-8 h-8 text-xs",
        size === "lg" && "w-10 h-10 text-sm",
        size === "xl" && "w-14 h-14 text-lg",
        colorClass,
        className
      )}
      title={name}
      {...props}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name || "Avatar"}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
