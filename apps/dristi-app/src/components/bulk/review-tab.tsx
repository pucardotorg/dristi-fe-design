"use client";

import * as React from "react";

import type { FilingDraft } from "@/lib/filing/types";
import { CourtDocument } from "@/components/filing/sections/preview/court-document";
import { FilingFooter } from "@/components/filing/filing-footer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { CaseView } from "./api";
import type { BatchCtx } from "./batch-screen";
import { CaseList } from "./case-list";
import { detailFlags } from "./scrutiny-tab";

/**
 * Review: each open case read as the single filing shows it before signing, its synopsis
 * and complaint, one at a time. Every case is loaded once, so moving on is instant; a case
 * that needs changing goes back to Case details.
 */
export function ReviewTab({ batch, go }: BatchCtx) {
  const open = batch.cases.filter(
    (c) => c.stage === "held" || c.stage === "ready",
  );
  const [drafts, setDrafts] = React.useState<Record<
    string,
    FilingDraft
  > | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    fetch(`/api/bulk/batches/${batch.id}/drafts`, { cache: "no-store" })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok)
          throw new Error(json.error ?? "The cases could not be loaded.");
        if (live) setDrafts(json.drafts);
      })
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
    // The drafts change only when the batch does.
  }, [batch.id, batch.cases]);

  if (!open.length)
    return (
      <Alert>
        <AlertDescription>Nothing to review.</AlertDescription>
      </Alert>
    );

  const c = open.find((x) => x.id === selectedId) ?? open[0];
  const at = open.indexOf(c);
  // Complete cases can be signed now, without waiting for the rest.
  const ready = batch.cases.filter(
    (x) => x.stage === "ready" && x.flags.length === 0,
  ).length;
  const stateOf = (x: CaseView) => {
    const f = detailFlags(x);
    const holds = f.filter((y) => y.level === "hold").length;
    return { holds, checks: f.length - holds };
  };
  const move = (k: number) => {
    setSelectedId(open[k].id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-6">
        <CaseList
          cases={open}
          selectedId={c.id}
          onSelect={setSelectedId}
          stateOf={stateOf}
        />
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body-compact text-muted-foreground tabular-nums">
              {at + 1} of {open.length}
            </span>
            <Button
              variant="ghost"
              className="ml-auto"
              onClick={() => go("scrutiny", c.id)}
            >
              Edit in Case details
            </Button>
          </div>
          {drafts?.[c.id] ? (
            <CourtDocument draft={drafts[c.id]} />
          ) : (
            <Skeleton className="h-[70vh] w-full rounded-xl" />
          )}
        </div>
      </div>
      <FilingFooter
        showSaveState={false}
        onBack={at > 0 ? () => move(at - 1) : undefined}
        backLabel="Previous case"
        // Two ways on from any case: the next case, or signing the cases already complete
        // (only those; the rest stay). With none complete, Sign says why instead.
        extra={
          at < open.length - 1 ? (
            <Button variant="outline" size="lg" onClick={() => move(at + 1)}>
              Next case
            </Button>
          ) : null
        }
        continueLabel={
          ready
            ? `Sign ${ready} complete case${ready === 1 ? "" : "s"}`
            : "Sign"
        }
        continueBlocked={!ready}
        continueHint="No case is complete yet"
        onContinue={() => {
          if (ready) go("sign");
        }}
        className="-mx-6 -mb-6 md:-mx-8 md:-mb-8"
      />
    </div>
  );
}
