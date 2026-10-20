"use client";

import React from "react";
import { useAuth } from "../../contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { FolderKanban, AlertCircle, Bug, Users, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const { user, organization, role } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-900/50 via-slate-900 to-slate-900 border border-indigo-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Welcome back, {user?.name || "Developer"}
            </h1>
            <Badge variant="primary" size="sm">
              <Sparkles className="w-3 h-3 mr-1 inline" />
              {role}
            </Badge>
          </div>
          <p className="text-sm text-slate-300">
            Workspace: <span className="font-semibold text-white">{organization?.name}</span>
          </p>
        </div>
      </div>

      {/* Overview Grid Placeholder while Phase 2 & 3 are constructed */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-400">Total Projects</CardTitle>
            <FolderKanban className="w-4 h-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0</div>
            <p className="text-xs text-slate-500 mt-1">Ready for projects creation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-400">Open Tasks</CardTitle>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0</div>
            <p className="text-xs text-slate-500 mt-1">Assigned to team</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-400">Visual Bug Reports</CardTitle>
            <Bug className="w-4 h-4 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">0</div>
            <p className="text-xs text-slate-500 mt-1">Screen & voice recordings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-400">Team Members</CardTitle>
            <Users className="w-4 h-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">1</div>
            <p className="text-xs text-slate-500 mt-1">Active in this workspace</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
