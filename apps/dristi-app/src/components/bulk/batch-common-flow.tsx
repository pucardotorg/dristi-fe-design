"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import { useCourt } from "@/components/court/court-provider";
import { StatusLine } from "@/components/feedback";
import { Skeleton } from "@/components/ui/skeleton";

import { bulkApi, setBulkAiMode, type BatchView } from "./api";
import { useGujarat } from "./court-guard";
import { BulkSetupFlow } from "./setup-flow";

/**
 * A created batch's Common details: the setup's own sections, opened on what was filled
 * and locked, under the batch's steps. Coming back to a step shows the step, never a
 * summary of it (owner, 2026-11-11).
 */
export function BatchCommonFlow({ batchId, children }: { batchId: string; children: React.ReactNode }) {
  const ready = useGujarat();
  const { profile } = useCourt();
  const ai = aiModeFrom(useSearchParams().get("ai"), profile.aiMode);
  setBulkAiMode(ai);
  const [batch, setBatch] = React.useState<BatchView | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!ready) return;
    bulkApi.get(batchId).then(setBatch, (e: Error) => setError(e.message));
  }, [ready, batchId]);

  if (error) {
    return (
      <div className="flex w-full flex-1 flex-col gap-6 px-6 py-6 lg:px-12">
        <StatusLine tone="error" still title="This batch could not be opened">
          {error}
        </StatusLine>
      </div>
    );
  }
  if (!batch) {
    return (
      <div className="flex w-full flex-1 flex-col gap-6 px-6 py-6 lg:px-12">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }
  return (
    <BulkSetupFlow setupId={`common-${batch.id}`} batch={batch}>
      {children}
    </BulkSetupFlow>
  );
}
