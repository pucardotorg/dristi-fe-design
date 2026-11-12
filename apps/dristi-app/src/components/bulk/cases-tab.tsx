"use client";

import * as React from "react";

import { FilingFooter } from "@/components/filing/filing-footer";

import { BatchFooter } from "./batch-footer";
import { caseState } from "./batch-marks";
import type { BatchCtx } from "./batch-screen";
import { CheckCounts } from "./check-step";

/**
 * The Cases step revisited: its Check as it was before Create, the counts of what Case
 * details asks for (owner, 2026-11-11: a step reopens as itself; 2026-11-12: not a second
 * case list). The cases themselves are worked on in Case details, where Continue goes.
 */
export function CasesTab({ batch, go }: BatchCtx) {
  const pending = batch.cases.filter((c) => c.stage !== "filed");
  const filed = batch.cases.length - pending.length;
  const states = pending.map(caseState);

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
        <CheckCounts
          created
          total={pending.length}
          fix={states.filter((x) => x === "fix").length}
          check={states.filter((x) => x === "check").length}
        />
      ) : (
        <p className="text-body-compact text-muted-foreground">Every case in this batch is filed.</p>
      )}
      <BatchFooter>
        <FilingFooter showSaveState={false} onBack={() => go("common")} onContinue={() => go("scrutiny")} />
      </BatchFooter>
    </div>
  );
}
