"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Badge } from "../../components/ui/Badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { Avatar } from "../../components/ui/Avatar";
import { Modal } from "../../components/ui/Modal";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import {
  FolderKanban,
  Plus,
  Search,
  ArrowRight,
  KeyRound,
  Copy,
  Trash2,
} from "lucide-react";
import { clientCache } from "../../lib/cache";

interface ProjectStats {
  totalIssues: number;
  doneIssues: number;
  completionPercentage: number;
  openBugs: number;
  overdueCount: number;
}

interface ProjectItem {
  id: string;
  name: string;
  description?: string | null;
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
  inviteCode?: string | null;
  owner: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  memberships: {
    user: {
      id: string;
      name: string;
      avatarUrl?: string | null;
    };
  }[];
  stats: ProjectStats;
  createdAt: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { role } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [projects, setProjects] = useState<ProjectItem[]>(() =>
    clientCache.get<ProjectItem[]>("/projects") || []
  );
  const [isLoading, setIsLoading] = useState(() => !clientCache.get<ProjectItem[]>("/projects"));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Create Project Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Join Project Modal State
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Delete Project State
  const [deletingProject, setDeletingProject] = useState<ProjectItem | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  const canCreate = role === "ADMIN" || role === "PROJECT_MANAGER";

  const fetchProjects = useCallback(async () => {
    if (projects.length === 0) {
      setIsLoading(true);
    }
    try {
      const res = await api.getCached<{ data: ProjectItem[] }>("/projects", {
        q: search || undefined,
        status: statusFilter || undefined,
      });
      const list = Array.isArray(res) ? res : (res as unknown as { data?: ProjectItem[] })?.data || [];
      setProjects(list);
      clientCache.set("/projects", list);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to load projects");
      }
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, toastError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Project name is required");
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    try {
      await api.post("/projects", {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
      });
      toastSuccess("Project created successfully!");
      setIsModalOpen(false);
      setName("");
      setDescription("");
      setStatus("ACTIVE");
      fetchProjects();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
      } else {
        setFormError("An unexpected error occurred while creating project");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setJoinError("Invitation code is required");
      return;
    }

    setIsJoining(true);
    setJoinError("");
    try {
      const res = await api.post<{ id: string; name: string; alreadyMember: boolean }>("/projects/join", {
        inviteCode: joinCode.trim().toUpperCase(),
      });
      const data = (res as { data?: { id: string; name: string; alreadyMember: boolean } })?.data || res;

      if (data.alreadyMember) {
        toastSuccess(`You are already a member of "${data.name}"`);
      } else {
        toastSuccess(`Successfully joined project "${data.name}"!`);
      }

      setIsJoinModalOpen(false);
      setJoinCode("");
      router.push(`/projects/${data.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setJoinError(err.message);
      } else {
        setJoinError("Failed to join project. Check the code and try again.");
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProject) return;
    setIsDeletingProject(true);
    try {
      await api.delete(`/projects/${deletingProject.id}`);
      toastSuccess(`Project "${deletingProject.name}" deleted`);
      setProjects((prev) => prev.filter((p) => p.id !== deletingProject.id));
      setDeletingProject(null);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to delete project");
      } else {
        toastError("Failed to delete project");
      }
    } finally {
      setIsDeletingProject(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <FolderKanban className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <span>Projects</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage projects, monitor completion health, and collaborate with your team
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setIsJoinModalOpen(true)}
            variant="outline"
            size="md"
            className="border-slate-300 dark:border-slate-700"
          >
            <KeyRound className="w-4 h-4 mr-1 text-indigo-600 dark:text-indigo-400" />
            <span>Join with Code</span>
          </Button>

          {canCreate && (
            <Button onClick={() => setIsModalOpen(true)} size="md">
              <Plus className="w-4 h-4 mr-1" />
              <span>New Project</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Search projects by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "", label: "All Statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "ON_HOLD", label: "On Hold" },
              { value: "COMPLETED", label: "Completed" },
              { value: "ARCHIVED", label: "Archived" },
            ]}
          />
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={role === "MEMBER" ? "No assigned projects" : "No projects found"}
          description={
            search || statusFilter
              ? "No projects match your current filters. Try resetting search or status."
              : role === "MEMBER"
              ? "You haven't been assigned to any projects yet. Enter an invitation code or ask your Project Manager/Admin to add you."
              : "No projects in this organization yet. Create one to get started."
          }
          actionLabel="Join with Code"
          onAction={() => setIsJoinModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(Array.isArray(projects) ? projects : []).map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block group"
            >
              <Card
                variant="interactive"
                className="h-full flex flex-col justify-between group-hover:border-indigo-500/50 transition-all duration-200"
              >
                <div>
                  <CardHeader className="items-start pb-2">
                    <div className="flex-1 pr-2">
                      <CardTitle className="group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {project.name}
                      </CardTitle>
                      {project.description && (
                        <CardDescription className="line-clamp-2 mt-1">
                          {project.description}
                        </CardDescription>
                      )}

                      {/* Invite Code Pill */}
                      {project.inviteCode && (
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigator.clipboard.writeText(project.inviteCode!);
                            toastSuccess(`Copied invite code: ${project.inviteCode}`);
                          }}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer mt-2"
                          title="Click to copy project invite code"
                        >
                          <KeyRound className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span>{project.inviteCode}</span>
                          <Copy className="w-2.5 h-2.5 text-slate-400 group-hover:text-indigo-400 shrink-0" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        size="sm"
                        variant={
                          project.status === "ACTIVE"
                            ? "success"
                            : project.status === "ON_HOLD"
                            ? "warning"
                            : project.status === "COMPLETED"
                            ? "primary"
                            : "neutral"
                        }
                      >
                        {project.status.replace("_", " ")}
                      </Badge>

                      {canCreate && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeletingProject(project);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors"
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-3">
                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span>Completion</span>
                        <span className="text-slate-900 dark:text-white font-semibold">
                          {project.stats.completionPercentage}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${project.stats.completionPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-center text-xs">
                      <div>
                        <div className="text-slate-900 dark:text-white font-semibold">{project.stats.totalIssues}</div>
                        <div className="text-[10px] text-slate-400">Issues</div>
                      </div>
                      <div>
                        <div className="text-rose-600 dark:text-rose-400 font-semibold">{project.stats.openBugs}</div>
                        <div className="text-[10px] text-slate-400">Bugs</div>
                      </div>
                      <div>
                        <div className={project.stats.overdueCount > 0 ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-slate-600 dark:text-slate-400 font-semibold"}>
                          {project.stats.overdueCount}
                        </div>
                        <div className="text-[10px] text-slate-400">Overdue</div>
                      </div>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center -space-x-1.5 overflow-hidden">
                    {project.memberships.slice(0, 4).map((m) => (
                      <Avatar
                        key={m.user.id}
                        name={m.user.name}
                        avatarUrl={m.user.avatarUrl}
                        size="sm"
                        className="ring-2 ring-white dark:ring-slate-900"
                      />
                    ))}
                    {project.memberships.length > 4 && (
                      <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900">
                        +{project.memberships.length - 4}
                      </span>
                    )}
                  </div>

                  <span className="flex items-center gap-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    <span>View Board</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Join Project with Invitation Code Modal */}
      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        title="Join Project with Invitation Code"
        description="Enter the unique project code shared by your Project Manager or Admin"
      >
        <form onSubmit={handleJoinProject} className="space-y-4">
          {joinError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {joinError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Project Invitation Code
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="e.g. PRJ-82F750C1"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 pl-10 pr-3.5 py-2 font-mono text-sm uppercase tracking-wider text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Entering a valid project code will grant you member access and add it to your assigned projects.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsJoinModalOpen(false)}
              disabled={isJoining}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isJoining}>
              Join Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Project"
        description="Add a new project to your organization to track tasks and bugs"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <Input
            label="Project Name"
            placeholder="e.g. Mobile App Redesign"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Description (Optional)"
            placeholder="Brief purpose or goals of the project..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Select
            label="Initial Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "ON_HOLD", label: "On Hold" },
            ]}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Project Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingProject)}
        onClose={() => setDeletingProject(null)}
        onConfirm={handleDeleteProject}
        title={`Delete "${deletingProject?.name}"?`}
        message="Are you sure you want to delete this project? All associated tasks, bug reports, and media will be permanently deleted. This action cannot be undone."
        confirmText="Yes, Delete Project"
        isLoading={isDeletingProject}
      />
    </div>
  );
}
