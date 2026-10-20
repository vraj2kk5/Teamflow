"use client";

import React, { useState } from "react";
import { api, ApiClientError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Settings, Building2, Shield, KeyRound, Copy, Check, RefreshCw } from "lucide-react";

export default function SettingsPage() {
  const { user, organization, role, refreshUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [orgName, setOrgName] = useState(organization?.name || "");
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

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

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-indigo-400" />
          <span>Workspace Settings</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage organization settings, credentials, and account details
        </p>
      </div>

      {/* Organization Settings (Admin) */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span>Organization Details</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <form onSubmit={handleSaveOrg} className="space-y-4">
            <Input
              label="Organization Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={!isAdmin}
              helperText={!isAdmin ? "Only organization Admins can rename the organization" : undefined}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Organization Slug
              </label>
              <input
                disabled
                value={organization?.slug || ""}
                className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-slate-400 select-all"
              />
            </div>

            {isAdmin && (
              <Button type="submit" size="sm" isLoading={isSavingOrg}>
                Save Organization Name
              </Button>
            )}
          </form>

          {/* Invite Code Section */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Invite Code
            </label>
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-sm font-bold text-indigo-300">
                {organization?.inviteCode || "None"}
              </span>

              <Button size="sm" variant="outline" onClick={handleCopyCode}>
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </Button>

              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRotateCode}
                  isLoading={isRotating}
                  title="Rotate code"
                >
                  <RefreshCw className="w-4 h-4 text-slate-400 hover:text-white" />
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Share this code with colleagues so they can join your workspace as a Member.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>Account Security & Session</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-4 space-y-3 text-sm">
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-400">Signed in as</span>
            <span className="font-semibold text-white">{user?.email}</span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-400">Organization Role</span>
            <Badge variant={role === "ADMIN" ? "danger" : role === "PROJECT_MANAGER" ? "warning" : "neutral"}>
              {role}
            </Badge>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-400">Session Security</span>
            <span className="text-emerald-400 font-medium">HttpOnly Secure JWT Cookie</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
