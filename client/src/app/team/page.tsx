"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api, ApiClientError } from "../../lib/api";
import { useAuth, UserRole } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  Users,
  UserPlus,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { formatDate } from "../../lib/utils";

interface OrgMember {
  id: string;
  userId: string;
  role: UserRole;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    jobTitle?: string | null;
    createdAt: string;
  };
}

export default function TeamPage() {
  const { user, organization, role, refreshUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [members, setMembers] = useState<OrgMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  // Add Member Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<UserRole>("MEMBER");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Delete Member State
  const [memberToRemove, setMemberToRemove] = useState<OrgMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Rotate Code State
  const [isRotating, setIsRotating] = useState(false);

  const isAdmin = role === "ADMIN";
  const canAdd = role === "ADMIN" || role === "PROJECT_MANAGER";

  const fetchMembers = useCallback(async () => {
    if (!organization) return;
    setIsLoading(true);
    try {
      const res = await api.get<{ data: OrgMember[] }>(
        `/organizations/${organization.id}/members`
      );
      const list = Array.isArray(res) ? res : (res as unknown as { data?: OrgMember[] })?.data || [];
      setMembers(Array.isArray(list) ? list : []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to load team members");
      }
    } finally {
      setIsLoading(false);
    }
  }, [organization, toastError]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

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
      await api.post(`/organizations/${organization.id}/rotate-invite`);
      await refreshUser();
      toastSuccess("Invite code rotated successfully");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to rotate code");
      }
    } finally {
      setIsRotating(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) {
      setAddError("Email is required");
      return;
    }

    setIsAdding(true);
    setAddError("");
    try {
      await api.post(`/organizations/${organization?.id}/members`, {
        email: addEmail.trim(),
        role: addRole,
      });
      toastSuccess(`Invited ${addEmail} as ${addRole}`);
      setIsAddModalOpen(false);
      setAddEmail("");
      setAddRole("MEMBER");
      fetchMembers();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setAddError(err.message);
      } else {
        setAddError("Failed to add member");
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: UserRole) => {
    // Optimistic UI update
    setMembers((prev) =>
      prev.map((m) => (m.userId === targetUserId ? { ...m, role: newRole } : m))
    );

    try {
      await api.patch(`/organizations/${organization?.id}/members/${targetUserId}`, {
        role: newRole,
      });
      toastSuccess("Member role updated");
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to update role");
      }
      fetchMembers(); // revert on failure
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove || !organization) return;

    setIsRemoving(true);
    try {
      await api.delete(
        `/organizations/${organization.id}/members/${memberToRemove.userId}`
      );
      toastSuccess(`Removed ${memberToRemove.user.name} from organization`);
      setMemberToRemove(null);
      fetchMembers();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to remove member");
      }
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
            <span>Team & Members</span>
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage organization members, assign roles, and share invite codes
          </p>
        </div>

        {canAdd && (
          <Button onClick={() => setIsAddModalOpen(true)} size="md">
            <UserPlus className="w-4 h-4 mr-1.5" />
            <span>Add Member</span>
          </Button>
        )}
      </div>

      {/* Invite Code Card */}
      <Card className="bg-gradient-to-r from-indigo-50/90 via-white to-slate-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 border border-indigo-100 dark:border-indigo-950/60 shadow-sm p-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Organization Invite Code</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              New team members can enter this code during registration to automatically join{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{organization?.name}</span> as a MEMBER.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-indigo-200 dark:border-slate-800 font-mono text-sm font-bold text-indigo-700 dark:text-indigo-300 tracking-wider shadow-sm">
              {organization?.inviteCode || "None"}
            </span>

            <Button size="sm" variant="outline" onClick={handleCopyCode} title="Copy code">
              {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </Button>

            {isAdmin && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRotateCode}
                isLoading={isRotating}
                title="Rotate code (invalidates old code)"
              >
                <RefreshCw className="w-4 h-4 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Members Table */}
      <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-white">
            Organization Members ({members.length})
          </CardTitle>
        </CardHeader>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">Member</th>
                  <th className="px-4 py-3.5">Job Title</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Joined</th>
                  {isAdmin && <th className="px-4 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {(Array.isArray(members) ? members : []).map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.user.name} avatarUrl={m.user.avatarUrl} size="md" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{m.user.name}</span>
                            {m.userId === user?.id && (
                              <Badge size="sm" variant="neutral" className="text-[10px]">
                                You
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{m.user.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {m.user.jobTitle || "—"}
                    </td>

                    <td className="px-4 py-3">
                      {isAdmin && m.userId !== user?.id ? (
                        <Select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.userId, e.target.value as UserRole)}
                          className="w-36 text-xs py-1"
                          options={[
                            { value: "MEMBER", label: "Member" },
                            { value: "PROJECT_MANAGER", label: "PM" },
                            { value: "ADMIN", label: "Admin" },
                          ]}
                        />
                      ) : (
                        <Badge
                          size="sm"
                          variant={
                            m.role === "ADMIN"
                              ? "danger"
                              : m.role === "PROJECT_MANAGER"
                              ? "warning"
                              : "neutral"
                          }
                        >
                          {m.role === "ADMIN" ? "Admin" : m.role === "PROJECT_MANAGER" ? "PM" : "Member"}
                        </Badge>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(m.createdAt)}
                    </td>

                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {m.userId !== user?.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setMemberToRemove(m)}
                            className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-300"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Team Member"
        description="Enter the email address of a registered user to add them to this organization"
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <Input
            label="User Email"
            type="email"
            placeholder="colleague@example.com"
            value={addEmail}
            onChange={(e) => {
              setAddEmail(e.target.value);
              setAddError("");
            }}
            error={addError}
            required
            autoFocus
          />

          <Select
            label="Organization Role"
            value={addRole}
            onChange={(e) => setAddRole(e.target.value as UserRole)}
            options={[
              { value: "MEMBER", label: "Member (Can view & create assigned issues)" },
              { value: "PROJECT_MANAGER", label: "Project Manager (Can create projects & manage issues)" },
              { value: "ADMIN", label: "Admin (Full organization control & member management)" },
            ]}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isAdding}>
              Add to Organization
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Removal Dialog */}
      <ConfirmDialog
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${memberToRemove?.user.name} (${memberToRemove?.user.email}) from this organization? They will lose access to all projects and issues in this workspace.`}
        confirmText="Remove Member"
        variant="danger"
        isLoading={isRemoving}
      />
    </div>
  );
}
