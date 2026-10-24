"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "../../components/ui/Skeleton";

export default function BugReportsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/issues?type=BUG");
  }, [router]);

  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
