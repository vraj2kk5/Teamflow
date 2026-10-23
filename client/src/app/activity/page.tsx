"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api, ApiClientError } from "../../lib/api";
import { useToast } from "../../components/ui/Toast";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card";
import { Avatar } from "../../components/ui/Avatar";
import { Skeleton } from "../../components/ui/Skeleton";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";
import { Activity, ChevronLeft, ChevronRight, FolderKanban, AlertCircle, Bug } from "lucide-react";
import { formatDate, formatDateTime } from "../../lib/utils";

interface ActivityLogItem {
  id: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
  };
  project?: {
    id: string;
    name: string;
  } | null;
  issue?: {
    id: string;
    key: string;
    title: string;
    type: string;
  } | null;
}

export default function ActivityPage() {
  const { error: toastError } = useToast();

  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{
        data: ActivityLogItem[];
        pagination: { total: number; totalPages: number; page: number };
      }>("/activity", {
        page,
        pageSize: 25,
      });

      const list = Array.isArray(res) ? res : (res as unknown as { data?: ActivityLogItem[] })?.data || [];
      setLogs(Array.isArray(list) ? list : []);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalCount(res.pagination.total || 0);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        toastError(err.message, "Failed to load activity logs");
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, toastError]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Activity className="w-6 h-6 text-indigo-400" />
          <span>Audit & Activity Feed</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Complete transparent timeline of events across your organization ({totalCount} total entries)
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-base">Organization Activity Timeline</CardTitle>
        </CardHeader>

        <CardContent className="pt-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No activity recorded yet"
              description="Actions performed across projects, issues, and memberships will appear here."
            />
          ) : (
            <div className="divide-y divide-slate-800/60">
              {(Array.isArray(logs) ? logs : []).map((log) => (
                <div key={log.id} className="py-3.5 flex items-start gap-3.5 text-xs">
                  <Avatar name={log.actor.name} avatarUrl={log.actor.avatarUrl} size="md" />

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{log.actor.name}</span>
                      <span className="text-[11px] text-slate-500" title={formatDateTime(log.createdAt)}>
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>

                    <p className="text-slate-300 leading-relaxed">
                      <span className="font-medium text-indigo-400">
                        {log.action.replace(/_/g, " ").toLowerCase()}
                      </span>{" "}
                      {log.issue && (
                        <span>
                          on issue{" "}
                          <Link
                            href={`/issues/${log.issue.id}`}
                            className="font-semibold text-white hover:text-indigo-300 transition-colors"
                          >
                            [{log.issue.key}] {log.issue.title}
                          </Link>
                        </span>
                      )}
                      {log.project && !log.issue && (
                        <span>
                          on project{" "}
                          <Link
                            href={`/projects/${log.project.id}`}
                            className="font-semibold text-white hover:text-indigo-300 transition-colors"
                          >
                            {log.project.name}
                          </Link>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 mt-4">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  <span>Previous</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
