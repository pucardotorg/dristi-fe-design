"use client";

import * as React from "react";

import { FilingFooter } from "@/components/filing/filing-footer";

import { BatchFooter } from "./batch-footer";
import { caseState, detailFlags } from "./batch-marks";
import type { BatchCtx } from "./batch-screen";
import { CheckSummary, type SummaryCase } from "./check-step";

/**
 * The Cases step revisited: its Check as it was before Create, a summary of what Case
 * details asks for (owner, 2026-11-11: a step reopens as itself; 2026-11-12: not a second
 * case list). The cases themselves are worked on in Case details, where Continue goes.
 */
export function CasesTab({ batch, go }: BatchCtx) {
  const pending = batch.cases.filter((c) => c.stage !== "filed");
  const filed = batch.cases.length - pending.length;
  const summary: SummaryCase[] = pending.map((c) => {
    const s = caseState(c);
    return { state: s === "fix" || s === "check" ? s : "done", flags: detailFlags(c) };
  });

  return (
    <div className="flex flex-col gap-4">
      {filed ? (
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {filed} filed, listed under{" "}
          <button type="button" className="underline" onClick={() => go("filed")}>
            Filed
          </button>
          .
        </p>
      ) : null}
      {pending.length ? (
        // Continue is the way to Case details; a second link to it would repeat the footer.
        <CheckSummary cases={summary} />
      ) : (
        <p className="text-body-compact text-muted-foreground">Every case in this batch is filed.</p>
      )}
      <BatchFooter>
        <FilingFooter showSaveState={false} onBack={() => go("common")} onContinue={() => go("scrutiny")} />
      </BatchFooter>
    </div>
  );
}
