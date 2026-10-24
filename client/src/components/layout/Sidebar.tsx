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

interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname();
  const { organization, role } = useAuth();

  const filteredNavItems = navItems.filter((item) => {
    // Admins assign tasks to team members but do not perform tasks, so hide "My Tasks"
    if (item.href === "/my-tasks" && role === "ADMIN") {
      return false;
    }
    return true;
  });

  return (
    <aside
      className={cn(
        "w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/80 flex flex-col h-full select-none transition-colors",
        className
      )}
    >
      {/* Brand & Organization */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 space-y-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2.5 group"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight leading-none block">
              TeamFlow
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono">
              Workspace
            </span>
          </div>
        </Link>

        {organization && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 truncate">
              <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                {organization.name}
              </span>
            </div>
            {role && (
              <Badge
                size="sm"
                variant={
                  role === "ADMIN"
                    ? "primary"
                    : role === "PROJECT_MANAGER"
                    ? "purple"
                    : "neutral"
                }
                className="text-[9px] uppercase tracking-wider px-1.5 py-0 shrink-0"
              >
                {role === "PROJECT_MANAGER" ? "PM" : role}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive ? "text-white" : "text-slate-500 dark:text-slate-400"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
