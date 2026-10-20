"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { PANEL_CLASS } from "@/components/filing/form-card";
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { bulkApi, type BatchView } from "./api";
import { CaseWorkspace } from "./case-workspace";
import { useGujarat } from "./court-guard";

/**
 * One bulk case on a page of its own: the same case view as the batch's window, Details
 * and Review, moving through the batch in place. The address follows the case on screen
 * without reloading, so moving on is instant.
 */
export function BulkCaseFile({
  batchId,
  caseId,
}: {
  batchId: string;
  caseId: string;
}) {
  const ready = useGujarat();
  const [batch, setBatch] = React.useState<BatchView | null>(null);
  const [index, setIndex] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    bulkApi
      .get(batchId)
      .then((b) => {
        if (!live) return;
        setBatch(b);
        setIndex(
          Math.max(
            0,
            b.cases.findIndex((c) => c.id === caseId),
          ),
        );
      })
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [batchId, caseId]);

  if (!ready) return null;

  const onIndex = (k: number) => {
    setIndex(k);
    if (batch)
      window.history.replaceState(
        null,
        "",
        `/filings/bulk/${batchId}/cases/${batch.cases[k].id}`,
      );
  };

  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col gap-4",
        PAGE_GROUND,
        PAGE_GUTTER,
      )}
    >
      <Link
        href={`/filings/bulk/${batchId}?tab=scrutiny`}
        className="flex w-fit items-center gap-1 text-body-compact text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        {batch ? `Batch ${batch.number}` : "Batch"}
      </Link>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : batch && index !== null ? (
        <Card
          className={cn(
            PANEL_CLASS,
            "h-[calc(100dvh-10rem)] gap-0 overflow-hidden py-0",
          )}
        >
          <CaseWorkspace
            batch={batch}
            setBatch={setBatch}
            index={index}
            onIndex={onIndex}
            title={(t) => (
              <h1
                className={cn(
                  PAGE_TITLE,
                  "truncate text-title-s text-foreground",
                )}
              >
                {t}
              </h1>
            )}
            className="h-full"
          />
        </Card>
      ) : (
        <Skeleton className="h-[calc(100dvh-10rem)] w-full rounded-xl" />
      )}
    </div>
  );
}
