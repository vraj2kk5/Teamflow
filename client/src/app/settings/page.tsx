"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
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
  Trash2,
  AlertTriangle,
} from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { user, organization, role, refreshUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [orgName, setOrgName] = useState(organization?.name || "");
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  // Delete Organization State (Admin only)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);

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

  const handleDeleteOrg = async () => {
    if (!organization || deleteConfirmName.trim() !== organization.name.trim()) return;

    setIsDeletingOrg(true);
    try {
      await api.delete(`/organizations/${organization.id}`);
      toastSuccess(`Organization "${organization.name}" was permanently deleted.`);
      setIsDeleteDialogOpen(false);

      // Refresh user profile to check remaining organizations
      const me = await api.get<{ allOrganizations?: Array<{ id: string }> }>("/auth/me");
      await refreshUser();

      if (me?.allOrganizations && me.allOrganizations.length > 0) {
        router.push("/dashboard");
      } else {
        // No remaining organizations, route to register to create/join one
        router.push("/register");
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to delete organization");
      } else {
        toastError("Could not delete organization. Please try again.", "Error");
      }
    } finally {
      setIsDeletingOrg(false);
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

          {/* Danger Zone: Delete Organization (Admin Only) */}
          {isAdmin && (
            <Card className="overflow-hidden border-rose-200 dark:border-rose-900/60 shadow-sm">
              <CardHeader className="pb-3 border-b border-rose-100 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20">
                <CardTitle className="text-base flex items-center gap-2 text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Danger Zone</span>
                </CardTitle>
                <CardDescription className="text-rose-600/80 dark:text-rose-400/80">
                  Destructive operations for organization administrators
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Delete this Organization
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                      Permanently remove <strong className="text-slate-700 dark:text-slate-300">{organization?.name}</strong> along with all of its projects, tasks, comments, and member associations.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      setDeleteConfirmName("");
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    <span>Delete Organization</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Organization Deletion */}
      <Modal
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          if (!isDeletingOrg) setIsDeleteDialogOpen(false);
        }}
        title="Delete Organization"
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-800 dark:text-rose-200">
                Warning: This action is permanent and cannot be undone.
              </p>
              <p className="leading-relaxed text-rose-700 dark:text-rose-300">
                All projects, tasks, bug reports, file attachments, and activity logs under{" "}
                <strong className="underline">{organization?.name}</strong> will be permanently deleted.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              To confirm, type the organization name{" "}
              <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded select-all">
                {organization?.name}
              </span>{" "}
              below:
            </label>
            <Input
              placeholder={organization?.name || "Enter organization name"}
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              disabled={isDeletingOrg}
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="ghost"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeletingOrg}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteOrg}
              isLoading={isDeletingOrg}
              disabled={deleteConfirmName.trim() !== (organization?.name || "").trim()}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              <span>Permanently Delete Organization</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
