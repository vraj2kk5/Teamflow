"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Card, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import {
  CheckCircle2,
  Building,
  KeyRound,
  ArrowRight,
  LogOut,
  Layers,
  Sparkles,
  Plus,
  X,
} from "lucide-react";
import { ApiClientError } from "../../lib/api";

function OrganizationDeletedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deletedName = searchParams.get("name") || "Your organization";

  const { allOrganizations, switchOrganization, createOrganization, joinOrganization, logout } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<"create" | "join" | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSwitch = async (orgId: string) => {
    setSwitchingId(orgId);
    try {
      await switchOrganization(orgId);
      router.push("/dashboard");
    } catch {
      setSwitchingId(null);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      toastError("Please enter an organization name", "Validation Error");
      return;
    }

    setIsSubmitting(true);
    try {
      await createOrganization(newOrgName.trim());
      toastSuccess("Organization created successfully!");
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Creation Failed");
      } else {
        toastError("Failed to create organization. Please try again.", "Error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toastError("Please enter a valid invite code", "Validation Error");
      return;
    }

    setIsSubmitting(true);
    try {
      await joinOrganization(inviteCode.trim().toUpperCase());
      toastSuccess("Joined organization successfully!");
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Join Failed");
      } else {
        toastError("Failed to join organization. Please check the code.", "Error");
      }
    } finally {
      setIsSubmitting(false);
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
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
              <Building className="w-7 h-7" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {deletedName !== "Previous Workspace" && deletedName !== "Your organization"
                ? "Organization Deleted"
                : "No Active Workspace"}
            </h1>

            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              {deletedName !== "Previous Workspace" && deletedName !== "Your organization" ? (
                <>
                  <strong className="text-slate-900 dark:text-white">{deletedName}</strong> and all of its associated projects, tasks, comments, and member associations have been permanently removed.
                </>
              ) : (
                "You are currently not part of an active workspace. Choose an option below to continue."
              )}
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

            {/* Next Actions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Create or Join a Workspace
                </h3>
              </div>

              {/* Action Toggle Cards */}
              {!activeMode && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveMode("create")}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-slate-900 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-left space-y-2 transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Create New Organization
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Start a brand-new workspace as Administrator
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMode("join")}
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
                        Join an existing team with an invite code
                      </p>
                    </div>
                  </button>
                </div>
              )}

              {/* Inline Form: Create Organization */}
              {activeMode === "create" && (
                <form
                  onSubmit={handleCreateOrg}
                  className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Create New Organization
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveMode(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Organization Name
                    </label>
                    <Input
                      placeholder="e.g. Acme Corp or Design Team"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveMode(null)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={isSubmitting}
                    >
                      Create & Continue &rarr;
                    </Button>
                  </div>
                </form>
              )}

              {/* Inline Form: Join with Invite Code */}
              {activeMode === "join" && (
                <form
                  onSubmit={handleJoinOrg}
                  className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      Join with Organization Invite Code
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveMode(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Invite Code
                    </label>
                    <Input
                      placeholder="e.g. TF-8F3A2C1B"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      className="font-mono uppercase tracking-wider"
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveMode(null)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={isSubmitting}
                    >
                      Join & Continue &rarr;
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Sign Out Option */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-center">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
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
