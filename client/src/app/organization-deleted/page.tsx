"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, Organization, UserRole } from "../../contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  CheckCircle2,
  Building,
  KeyRound,
  ArrowRight,
  LogOut,
  Layers,
  Sparkles,
} from "lucide-react";

function OrganizationDeletedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deletedName = searchParams.get("name") || "Your organization";

  const { user, allOrganizations, switchOrganization, logout } = useAuth();
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const handleSwitch = async (orgId: string) => {
    setSwitchingId(orgId);
    try {
      await switchOrganization(orgId);
      router.push("/dashboard");
    } catch {
      setSwitchingId(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors">
      <div className="max-w-xl w-full space-y-6">
        {/* Status Confirmation Card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden bg-white dark:bg-slate-900">
          <div className="p-6 text-center space-y-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Organization Deleted
            </h1>

            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              <strong className="text-slate-900 dark:text-white">{deletedName}</strong> and all of its associated projects, tasks, comments, and member associations have been permanently removed.
            </p>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* If user belongs to other organizations, let them choose explicitly */}
            {allOrganizations && allOrganizations.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Your Other Workspaces
                  </h3>
                </div>

                <div className="space-y-2">
                  {allOrganizations.map((org) => (
                    <div
                      key={org.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {org.name}
                          </p>
                          <Badge
                            size="sm"
                            variant={
                              org.role === "ADMIN"
                                ? "primary"
                                : org.role === "PROJECT_MANAGER"
                                ? "purple"
                                : "neutral"
                            }
                            className="text-[10px]"
                          >
                            {org.role === "PROJECT_MANAGER" ? "PM" : org.role}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {org.slug}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleSwitch(org.id)}
                        isLoading={switchingId === org.id}
                        className="shrink-0"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* General Actions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Next Actions
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-900 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-left space-y-2 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Create New Organization
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Start a fresh workspace as an Administrator
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-900 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-left space-y-2 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Join with Invite Code
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Join an existing organization with your team&apos;s code
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Sign Out Option */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-center">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out of TeamFlow</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OrganizationDeletedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OrganizationDeletedContent />
    </Suspense>
  );
}
