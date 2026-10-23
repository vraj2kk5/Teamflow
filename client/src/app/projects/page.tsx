"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, ApiClientError } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Modal } from "../../components/ui/Modal";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { Avatar } from "../../components/ui/Avatar";
import {
  FolderKanban,
  Plus,
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  Bug,
  Calendar,
  ArrowRight,
} from "lucide-react";

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
  const { role } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Create Project Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const canCreate = role === "ADMIN" || role === "PROJECT_MANAGER";

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ data: ProjectItem[] }>("/projects", {
        q: search || undefined,
        status: statusFilter || undefined,
      });
      setProjects(Array.isArray(res) ? res : (res as unknown as { data?: ProjectItem[] })?.data || []);
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FolderKanban className="w-6 h-6 text-indigo-400" />
            <span>Projects</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage projects, monitor completion health, and collaborate with your team
          </p>
        </div>

        {canCreate && (
          <Button onClick={() => setIsModalOpen(true)} size="md">
            <Plus className="w-4 h-4 mr-1" />
            <span>New Project</span>
          </Button>
        )}
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
          title="No projects found"
          description={
            search || statusFilter
              ? "No projects match your current filters. Try resetting search or status."
              : "No projects in this organization yet. Create one to get started."
          }
          actionLabel={canCreate ? "Create Project" : undefined}
          onAction={canCreate ? () => setIsModalOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
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
                      <CardTitle className="group-hover:text-indigo-400 transition-colors">
                        {project.name}
                      </CardTitle>
                      {project.description && (
                        <CardDescription className="line-clamp-2 mt-1">
                          {project.description}
                        </CardDescription>
                      )}
                    </div>
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
                  </CardHeader>

                  <CardContent className="space-y-4 pt-3">
                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-400 font-medium">
                        <span>Completion</span>
                        <span className="text-white font-semibold">
                          {project.stats.completionPercentage}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${project.stats.completionPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-center text-xs">
                      <div>
                        <div className="text-white font-semibold">{project.stats.totalIssues}</div>
                        <div className="text-[10px] text-slate-400">Issues</div>
                      </div>
                      <div>
                        <div className="text-rose-400 font-semibold">{project.stats.openBugs}</div>
                        <div className="text-[10px] text-slate-400">Bugs</div>
                      </div>
                      <div>
                        <div className={project.stats.overdueCount > 0 ? "text-rose-400 font-semibold" : "text-slate-400 font-semibold"}>
                          {project.stats.overdueCount}
                        </div>
                        <div className="text-[10px] text-slate-400">Overdue</div>
                      </div>
                    </div>
                  </CardContent>
                </div>

                <CardFooter className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center -space-x-1.5 overflow-hidden">
                    {project.memberships.slice(0, 4).map((m) => (
                      <Avatar
                        key={m.user.id}
                        name={m.user.name}
                        avatarUrl={m.user.avatarUrl}
                        size="sm"
                        className="ring-2 ring-slate-900"
                      />
                    ))}
                    {project.memberships.length > 4 && (
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-[10px] flex items-center justify-center font-bold text-slate-300 ring-2 ring-slate-900">
                        +{project.memberships.length - 4}
                      </span>
                    )}
                  </div>

                  <span className="flex items-center gap-1 group-hover:text-indigo-400 transition-colors">
                    <span>View Board</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Project"
        description="Add a new project to your organization to track tasks and bugs"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-300">
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

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
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
    </div>
  );
}
