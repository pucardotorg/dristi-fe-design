"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { FilingFooter } from "@/components/filing/filing-footer";

import { caseFlowHref } from "./api";
import { BatchFooter } from "./batch-footer";
import { caseState } from "./batch-marks";
import type { BatchCtx } from "./batch-screen";
import { CaseRows, type CaseRow } from "./case-rows";
import { LimitPassed } from "./case-list-tools";
import { CaseBadge, STATE, STATE_ORDER } from "./stage";

/** The filters, in the order the steps meet them; a filter with nothing in it is left out. */
const FILTERS = STATE_ORDER.filter((s) => s !== "filed").map((id) => ({ id, label: STATE[id].word }));

/**
 * The Cases step revisited: its Check, the same list it was before Create, now with where
 * each case stands (owner, 2026-11-11: a step reopens as itself, not as another view). A
 * case opens in its sections. Filed cases are listed under Filed.
 */
export function CasesTab({ batch, go }: BatchCtx) {
  const ai = useSearchParams().get("ai");
  const pending = batch.cases.filter((c) => c.stage !== "filed");
  const filed = batch.cases.length - pending.length;
  // Each case in exactly one filter, so the filters add up to All (owner's screenshot,
  // 2026-11-11: To fix 2, Missing documents 10, To check 10 under All 12).
  const rows: CaseRow[] = pending.map((c) => ({
    key: c.id,
    reference: c.reference,
    accused: c.accused || c.title,
    cheque: c.cheque,
    cheques: c.cheques,
    amount: c.amount,
    state: caseState(c),
    status: <CaseBadge c={c} />,
    extra: <LimitPassed c={c} />,
    href: caseFlowHref(batch.id, c, undefined, ai),
  }));

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
        <CaseRows rows={rows} filters={FILTERS} label="Cases in this batch" searchId="cases-search" />
      ) : (
        <p className="text-body-compact text-muted-foreground">Every case in this batch is filed.</p>
      )}
      <BatchFooter>
        <FilingFooter
          showSaveState={false}
          onBack={() => go("common")}
          onContinue={() => go("scrutiny")}
        />
      </BatchFooter>
    </div>
  );
}
