"use client";

import React, { useState, useEffect } from "react";
import { api, ApiClientError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { Badge } from "../../components/ui/Badge";
import {
  Settings,
  Building2,
  Shield,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Lock,
  CheckCircle2,
  Briefcase,
  UserCheck,
  Info,
} from "lucide-react";

export default function SettingsPage() {
  const { user, organization, role, refreshUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [orgName, setOrgName] = useState(organization?.name || "");
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    if (organization?.name) {
      setOrgName(organization.name);
    }
  }, [organization?.name]);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [pwdErrors, setPwdErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const isAdmin = role === "ADMIN";

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !orgName.trim()) return;

    setIsSavingOrg(true);
    try {
      await api.patch(`/organizations/${organization.id}`, { name: orgName.trim() });
      toastSuccess("Organization name updated");
      await refreshUser();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to update organization");
      }
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleCopyCode = () => {
    if (!organization?.inviteCode) return;
    navigator.clipboard.writeText(organization.inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleRotateCode = async () => {
    if (!organization) return;
    setIsRotating(true);
    try {
      await api.post(`/organizations/${organization.id}/invite-code/rotate`);
      toastSuccess("Invite code rotated successfully");
      await refreshUser();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to rotate code");
      }
    } finally {
      setIsRotating(false);
    }
  };

  const validatePasswordForm = () => {
    const errs: typeof pwdErrors = {};
    if (!currentPassword) errs.currentPassword = "Current password is required";
    if (!newPassword) errs.newPassword = "New password is required";
    else if (newPassword.length < 8) errs.newPassword = "Password must be at least 8 characters";
    if (newPassword !== confirmPassword) {
      errs.confirmPassword = "New passwords do not match";
    }
    setPwdErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;

    setIsChangingPassword(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });

      toastSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Password Update Failed");
      } else {
        toastError("Failed to update password. Please check your current password.", "Error");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <span>Workspace Settings</span>
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Manage workspace organization details, permissions, and your account security credentials
        </p>
      </div>

      {/* Main Grid Layout: Left Summary/Permissions vs Right Configuration Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Workspace Profile Card */}
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                  {organization?.name || "Workspace"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                  {organization?.slug}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Your Access Level</span>
                <Badge
                  size="sm"
                  variant={
                    role === "ADMIN"
                      ? "primary"
                      : role === "PROJECT_MANAGER"
                      ? "purple"
                      : "neutral"
                  }
                  className="font-semibold"
                >
                  {role === "PROJECT_MANAGER" ? "Project Manager" : role}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Workspace Status</span>
                <Badge size="sm" variant="success">
                  Active
                </Badge>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {role === "ADMIN" ? (
                <span>
                  <strong>Full Administrator:</strong> You can edit the workspace name, manage invite codes, delete projects, and oversee all team activities.
                </span>
              ) : role === "PROJECT_MANAGER" ? (
                <span>
                  <strong>Project Manager:</strong> You can create and manage assigned projects, add team members, and assign project tasks.
                </span>
              ) : (
                <span>
                  <strong>Standard Member:</strong> You can view assigned projects, report bugs, and update the status of your assigned tasks.
                </span>
              )}
            </div>
          </Card>

          {/* Invite Code Card - ONLY visible to Admin */}
          {isAdmin && organization?.inviteCode && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Organization Invite Code
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Share this unique invite code with new members so they can join your workspace.
              </p>

              <div className="flex items-center gap-2 pt-1">
                <span className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 text-center select-all">
                  {organization.inviteCode}
                </span>

                <Button size="sm" variant="outline" onClick={handleCopyCode} title="Copy code">
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRotateCode}
                  isLoading={isRotating}
                  title="Generate a new code"
                >
                  <RefreshCw className="w-4 h-4 text-slate-400 hover:text-slate-900 dark:hover:text-white" />
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Right Column: Settings and Password Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Organization Details Card */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Workspace Information</span>
              </CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Update your workspace name and branding across all team dashboards"
                  : "Overview of your current workspace and membership details"}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5">
              {isAdmin ? (
                <form onSubmit={handleSaveOrg} className="space-y-4 max-w-md">
                  <Input
                    label="Organization Name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    required
                  />

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Organization Slug
                    </label>
                    <input
                      disabled
                      value={organization?.slug || ""}
                      className="w-full rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm text-slate-500 select-all"
                    />
                    <p className="text-[11px] text-slate-400">
                      Unique URL identifier assigned to your workspace
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button type="submit" size="sm" isLoading={isSavingOrg}>
                      Save Organization Name
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4 max-w-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                        Workspace Name
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {organization?.name}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                        Organization Slug
                      </span>
                      <span className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {organization?.slug}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-slate-600 dark:text-slate-300">
                    <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>
                      Only workspace Administrators can rename the organization. Contact your Administrator to request workspace changes.
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card className="overflow-hidden" id="password">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Change Password</span>
              </CardTitle>
              <CardDescription>
                Update your account password securely with real-time verification
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5">
              {passwordSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Password updated successfully!</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <PasswordInput
                  label="Current Password"
                  placeholder="Enter your current password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (pwdErrors.currentPassword) {
                      setPwdErrors((prev) => ({ ...prev, currentPassword: undefined }));
                    }
                  }}
                  error={pwdErrors.currentPassword}
                  required
                  autoComplete="current-password"
                  disabled={isChangingPassword}
                />

                <PasswordInput
                  label="New Password"
                  placeholder="Enter new strong password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (pwdErrors.newPassword) {
                      setPwdErrors((prev) => ({ ...prev, newPassword: undefined }));
                    }
                  }}
                  error={pwdErrors.newPassword}
                  helperText="Must be at least 8 characters long"
                  required
                  autoComplete="new-password"
                  disabled={isChangingPassword}
                />

                <PasswordInput
                  label="Confirm New Password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (pwdErrors.confirmPassword) {
                      setPwdErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                  error={pwdErrors.confirmPassword}
                  required
                  autoComplete="new-password"
                  disabled={isChangingPassword}
                />

                <div className="pt-2">
                  <Button type="submit" size="sm" isLoading={isChangingPassword}>
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
