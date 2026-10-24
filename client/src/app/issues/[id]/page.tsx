"use client";

import React, { use } from "react";
import { IssueDetailView } from "../../../components/issues/IssueDetailView";

export default function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  return <IssueDetailView id={resolvedParams.id} expectedType="BUG" />;
}
