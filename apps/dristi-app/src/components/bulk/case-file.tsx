"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { draftTitle } from "@/lib/filing/selectors";
import type { FilingDraft } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import { CourtDocument } from "@/components/filing/sections/preview/court-document";
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_SUBTITLE,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useGujarat } from "./court-guard";

type CaseFile = {
  batchNumber: string;
  reference: string;
  draft: FilingDraft;
  prev: string | null;
  next: string | null;
  index: number;
  total: number;
};

/**
 * One bulk case, whole, as the single filing shows a case: the same court document,
 * read from the case's draft. Previous and next walk the batch.
 */
export function BulkCaseFile({
  batchId,
  caseId,
}: {
  batchId: string;
  caseId: string;
}) {
  const ready = useGujarat();
  const [file, setFile] = React.useState<CaseFile | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    fetch(`/api/bulk/batches/${batchId}/cases/${caseId}`, { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok)
          throw new Error(json.error ?? "This case could not be opened.");
        if (live) setFile(json);
      })
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [batchId, caseId]);

  if (!ready) return null;
  const back = `/filings/bulk/${batchId}?tab=scrutiny`;

  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col gap-6",
        PAGE_GROUND,
        PAGE_GUTTER,
      )}
    >
      <header className="flex flex-col gap-3">
        <Link
          href={back}
          className="flex w-fit items-center gap-1 text-body-compact text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          {file ? `Batch ${file.batchNumber}` : "Batch"}
        </Link>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className={cn(PAGE_TITLE, "text-foreground")}>
              {file ? draftTitle(file.draft) : "Case file"}
            </h1>
            {file ? (
              <p className={cn(PAGE_SUBTITLE, "tabular-nums")}>
                {file.reference} · case {file.index + 1} of {file.total}
              </p>
            ) : null}
          </div>
          {file ? (
            <div className="ml-auto flex gap-2">
              {file.prev ? (
                <Button asChild variant="outline">
                  <Link href={`/filings/bulk/${batchId}/cases/${file.prev}`}>
                    <ChevronLeftIcon data-icon="inline-start" aria-hidden />
                    Previous case
                  </Link>
                </Button>
              ) : null}
              {file.next ? (
                <Button asChild variant="outline">
                  <Link href={`/filings/bulk/${batchId}/cases/${file.next}`}>
                    Next case
                    <ChevronRightIcon data-icon="inline-end" aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : file ? (
        <div className="mx-auto w-full max-w-4xl">
          <CourtDocument draft={file.draft} />
        </div>
      ) : (
        <Skeleton className="mx-auto h-[60vh] w-full max-w-4xl rounded-xl" />
      )}
    </div>
  );
}
