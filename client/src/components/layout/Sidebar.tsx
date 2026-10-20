"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  AlertCircle,
  Bug,
  Users,
  Activity,
  User,
  Settings,
  ShieldCheck,
  Briefcase,
  Building2,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/Badge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Tasks", href: "/my-tasks", icon: CheckSquare },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Issues", href: "/issues", icon: AlertCircle },
  { label: "Bug Reports", href: "/bug-reports", icon: Bug },
  { label: "Team", href: "/team", icon: Users },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { organization, role } = useAuth();

  return (
    <aside
      className={cn(
        "w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col h-full select-none",
        className
      )}
    >
      {/* Brand & Organization */}
      <div className="p-5 border-b border-slate-800/80">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 text-white font-bold text-lg tracking-tight group"
          onClick={onNavigate}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
            <Briefcase className="w-4 h-4" />
          </div>
          <span>TeamFlow</span>
        </Link>

        {organization && (
          <div className="mt-4 p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-xs font-medium text-slate-200 truncate">
                {organization.name}
              </span>
            </div>
            {role && (
              <Badge
                size="sm"
                variant={
                  role === "ADMIN"
                    ? "danger"
                    : role === "PROJECT_MANAGER"
                    ? "warning"
                    : "neutral"
                }
                className="text-[10px] shrink-0"
              >
                {role === "ADMIN" ? "Admin" : role === "PROJECT_MANAGER" ? "PM" : "Member"}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive ? "text-white" : "text-slate-400"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>PostgreSQL & Storage Active</span>
        </div>
        <ShieldCheck className="w-4 h-4 text-slate-400" />
      </div>
    </aside>
  );
}
