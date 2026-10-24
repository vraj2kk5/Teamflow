"use client";

import React, { Suspense } from "react";
import { IssuesView } from "../../components/issues/IssuesHub";
import { Skeleton } from "../../components/ui/Skeleton";

export default function IssuesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <IssuesView pageMode="ISSUES" />
    </Suspense>
  );
}
