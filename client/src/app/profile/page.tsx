"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, ApiClientError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Badge } from "../../components/ui/Badge";
import { Avatar } from "../../components/ui/Avatar";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import {
  User,
  Briefcase,
  Mail,
  Calendar,
  Edit3,
  CheckCircle2,
  Bug,
  Activity,
  ArrowRight,
  Lock,
} from "lucide-react";
import { formatDate, cn } from "../../lib/utils";

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
  createdAt: string;
  stats: {
    assignedCount: number;
    reportedCount: number;
    resolvedCount: number;
  };
}

interface IssueSnippet {
  id: string;
  key: string;
  title: string;
  type: "TASK" | "BUG";
  status: string;
  priority: string;
  project: {
    id: string;
    name: string;
  };
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [assignedIssues, setAssignedIssues] = useState<IssueSnippet[]>([]);
  const [reportedIssues, setReportedIssues] = useState<IssueSnippet[]>([]);
  const [activeTab, setActiveTab] = useState<"assigned" | "reported">("assigned");
  const [isLoading, setIsLoading] = useState(true);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editBio, setEditBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const [profData, assignedData, reportedData] = await Promise.all([
        api.get<UserProfileData>("/users/me"),
        api.get<IssueSnippet[]>("/users/me/issues?relation=assigned"),
        api.get<IssueSnippet[]>("/users/me/issues?relation=reported"),
      ]);

      setProfile(profData);
      setEditName(profData.name);
      setEditJobTitle(profData.jobTitle || "");
      setEditBio(profData.bio || "");
      setAssignedIssues(assignedData || []);
      setReportedIssues(reportedData || []);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to load profile");
      }
    } finally {
      setIsLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setIsSaving(true);
    try {
      await api.patch("/users/me", {
        name: editName.trim(),
        jobTitle: editJobTitle.trim() || null,
        bio: editBio.trim() || null,
      });

      toastSuccess("Profile updated successfully!");
      setIsEditModalOpen(false);
      await refreshUser();
      fetchProfile();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to update profile");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const currentIssues = activeTab === "assigned" ? assignedIssues : reportedIssues;

  return (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Avatar name={profile.name} avatarUrl={profile.avatarUrl} size="xl" className="ring-4 ring-slate-800" />
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{profile.name}</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{profile.email}</span>
                </span>
                {profile.jobTitle && (
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{profile.jobTitle}</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Joined {formatDate(profile.createdAt)}</span>
                </span>
              </div>
              {profile.bio && (
                <p className="text-xs text-slate-600 dark:text-slate-300 pt-1 leading-relaxed max-w-xl">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/settings#password">
              <Button size="sm" variant="outline">
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                <span>Change Password</span>
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={() => setIsEditModalOpen(true)}>
              <Edit3 className="w-3.5 h-3.5 mr-1.5" />
              <span>Edit Profile</span>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 text-center">
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{profile.stats.assignedCount}</div>
            <div className="text-xs text-slate-400 mt-0.5">Assigned Tasks</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-400">{profile.stats.reportedCount}</div>
            <div className="text-xs text-slate-400 mt-0.5">Reported Issues</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400">{profile.stats.resolvedCount}</div>
            <div className="text-xs text-slate-400 mt-0.5">Resolved Tasks</div>
          </div>
        </div>
      </Card>

      {/* Issues Tabs */}
      <Card>
        <div className="flex items-center gap-4 px-6 pt-4 border-b border-slate-800 text-sm font-semibold">
          <button
            onClick={() => setActiveTab("assigned")}
            className={cn(
              "pb-3 border-b-2 transition-all flex items-center gap-2",
              activeTab === "assigned"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            <span>Assigned Tasks</span>
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {assignedIssues.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("reported")}
            className={cn(
              "pb-3 border-b-2 transition-all flex items-center gap-2",
              activeTab === "reported"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            )}
          >
            <span>Reported Issues</span>
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {reportedIssues.length}
            </span>
          </button>
        </div>

        <CardContent className="p-4 space-y-2">
          {currentIssues.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 italic">
              No issues found in this category.
            </div>
          ) : (
            currentIssues.map((issue) => (
              <Link
                key={issue.id}
                href={`/issues/${issue.id}`}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 hover:border-indigo-400 dark:hover:border-slate-700 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <span className="font-mono text-xs font-semibold text-indigo-400 shrink-0">
                    {issue.key}
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors truncate">
                    {issue.title}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={issue.type === "BUG" ? "danger" : "primary"} size="sm">
                    {issue.type}
                  </Badge>
                  <Badge
                    size="sm"
                    variant={issue.status === "DONE" ? "success" : "neutral"}
                  >
                    {issue.status.replace("_", " ")}
                  </Badge>
                  <span className="text-xs text-slate-400">{issue.project.name}</span>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile"
        description="Update your personal details visible to team members"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Full Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Job Title"
            placeholder="e.g. Senior Frontend Engineer"
            value={editJobTitle}
            onChange={(e) => setEditJobTitle(e.target.value)}
          />

          <Textarea
            label="Bio"
            placeholder="Tell your team about your role, skills, or timezone..."
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            rows={3}
            maxLength={500}
            showCount
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Save Profile
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
