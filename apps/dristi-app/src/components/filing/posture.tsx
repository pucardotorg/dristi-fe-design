"use client";

/**
 * Correction posture — the e-filing form, re-entered after a scrutiny return.
 *
 * The screen that clears a scrutiny return *is* this form (brief D2): same steps, same
 * section components, same validation. Only the posture of each field changes — locked
 * (the officer did not flag it), flagged, or resolved. So rather than forking ten section
 * components into a "defects only" mini-form, the sections opt in here:
 *
 *   · `FormField name="ifsc"` says which key a field writes, so a defect can find it.
 *   · `<CorrectionInstance value={i}>` says which cheque / complainant is on screen.
 *   · `useCorrectionInstanceRequest` lets the queue drive the section's own tab state.
 *
 * Outside a correction the context is `null` and every hook here is a no-op, so the
 * ordinary filing flow renders exactly as it did.
 *
 * The frame that wraps a flagged field is *supplied* by the correction screen rather
 * than imported: this module stays a contract between the two, and the filing components
 * never learn what a scrutiny queue looks like.
 */

import * as React from "react";

import type { StepId } from "@/lib/filing/types";
import { PolicyLock, useFieldPolicy } from "@/components/filing/field-policy";
import type { Defect } from "@/lib/tasks/types";

export type CorrectionValue = {
  /** The step the centre pane is showing. */
  step: StepId;
  /** The defect flagged on this field, if any. */
  defectAt: (step: StepId, instance: number, field: string) => Defect | null;
  /** The defect flagged on a whole document, by intake slot key. */
  defectForSlot: (step: StepId, slotKey: string) => Defect | null;
  /** What the filing currently holds for a defect's target — the resolution is derived from it. */
  valueOf: (defect: Defect) => string | undefined;
  /** The defect the queue is currently on — its frame carries the focus. */
  activeDefect: number | null;
  setActiveDefect: (n: number | null) => void;
  /** The queue asking a repeating section to switch to another instance. */
  instanceRequest: { step: StepId; instance: number; nonce: number } | null;
  /**
   * Whether the record shows the whole filing, or only what scrutiny flagged.
   *
   * Off by default: eight flagged fields scattered through a thirteen-section form is a
   * needle-in-haystack read, so the record opens showing just the needles. The toggle in
   * the page header brings the rest back — at reduced opacity — for the advocate who wants
   * the surrounding context (owner, 2026-08-21).
   */
  showAll: boolean;
  /**
   * A document slot lending the panel its file picker.
   *
   * The flagged row is display-only and replacement happens in the panel's card (v3.2), but
   * the picker belongs to the slot that owns the upload. So the slot registers its own
   * `onChoose` here on mount and the card calls it back — which keeps the file-handling in
   * one place instead of threading a second uploader through the panel.
   */
  registerReplace: (slotKey: string, choose: () => void) => () => void;
  replaceFor: (slotKey: string) => (() => void) | undefined;
};

const CorrectionContext = React.createContext<CorrectionValue | null>(null);

export function CorrectionProvider({
  value,
  children,
}: {
  value: CorrectionValue;
  children: React.ReactNode;
}) {
  return <CorrectionContext.Provider value={value}>{children}</CorrectionContext.Provider>;
}

/** The correction posture, or `null` in the ordinary filing flow. */
export function useCorrection(): CorrectionValue | null {
  return React.useContext(CorrectionContext);
}

export function useInCorrection(): boolean {
  return React.useContext(CorrectionContext) !== null;
}

/* ───────────────────────────── Which instance ───────────────────────────── */

const InstanceContext = React.createContext(0);

/**
 * Which repeating record the fields below belong to — cheque 2, complainant 1. Without
 * it "IFSC is wrong" is ambiguous the moment there are two cheques (brief §2, problem 2).
 */
export function CorrectionInstance({
  value,
  children,
}: {
  value: number;
  children: React.ReactNode;
}) {
  // A part a host has set for every case (bulk filing's complainant) is locked here.
  const reason = useFieldPolicy()?.lockedAt(value) ?? null;
  return (
    <InstanceContext.Provider value={value}>
      {reason ? <PolicyLock reason={reason}>{children}</PolicyLock> : children}
    </InstanceContext.Provider>
  );
}

export function useCorrectionInstance(): number {
  return React.useContext(InstanceContext);
}

/**
 * Let the queue drive a repeating section's own tab state: clicking "Cheque 2 › Bank
 * branch" selects that tab before it moves focus to the field. A no-op outside a
 * correction, and only ever fires for its own step.
 */
export function useCorrectionInstanceRequest(
  step: StepId,
  select: (instance: number) => void
): void {
  const correction = useCorrection();
  const request = correction?.instanceRequest ?? null;
  const selectRef = React.useRef(select);

  React.useEffect(() => {
    selectRef.current = select;
  });

  React.useEffect(() => {
    if (!request || request.step !== step) return;
    selectRef.current(request.instance);
  }, [request, step]);
}

/* ───────────────────────────── The lock ───────────────────────────── */

const LockContext = React.createContext(false);

/**
 * Everything the officer did not flag is disabled — a correction round is not an edit
 * round (brief D3, owner-settled on O5). The lock is set once by `FormField` and read by
 * every control that could otherwise be typed into, so no section has to thread a
 * `disabled` prop through its own fields.
 *
 * The *reason* lives in the section's notice as text, not in a tooltip on a dead control:
 * a disabled control is not focusable, so a hover tip would be unreachable
 * (`ACCESSIBILITY.md` §7).
 */
export function FieldLock({ locked, children }: { locked: boolean; children: React.ReactNode }) {
  return <LockContext.Provider value={locked}>{children}</LockContext.Provider>;
}

export function useFieldLock(): boolean {
  return React.useContext(LockContext);
}

/** `disabled` for a control: whatever the section asked for, or the correction lock. */
export function useLockedDisabled(disabled?: boolean): boolean {
  return useFieldLock() || !!disabled;
}

/* ───────────────────────────── The flagged field ───────────────────────────── */

type ReadOnlyValue = {
  readOnly: boolean;
  /**
   * The element that says what the flag *is* and where it is answered — the inset's first
   * line. The read-only control points at it with `aria-describedby`, so a screen reader
   * hears "read only" together with "Open" and, when the row is two-up, the field it
   * belongs to. "Read-only" on its own tells someone the control is shut and nothing
   * about where to act (`ACCESSIBILITY.md` §4/§5).
   */
  hintId?: string;
};

const ReadOnlyContext = React.createContext<ReadOnlyValue>({ readOnly: false });

/**
 * The flagged field is **read-only, not disabled** (brief §15.5, unchanged in v3.2).
 *
 * *Locked = disabled. Flagged = read-only.* Two states, two mechanisms, both honest. A
 * disabled control is not focusable (`ACCESSIBILITY.md` §4/§5) and this value is the
 * subject of the exchange, so it has to stay reachable by keyboard and readable by a
 * screen reader — it simply cannot be typed over. The correction is made in the panel's
 * card, so every changed value in a correction round has a named author.
 */
export function FieldReadOnly({
  readOnly,
  hintId,
  children,
}: {
  readOnly: boolean;
  hintId?: string;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ readOnly, hintId }), [readOnly, hintId]);
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>;
}

export function useFieldReadOnly(): boolean {
  return React.useContext(ReadOnlyContext).readOnly;
}

/** The id of the line a flagged control should be described by, if it is flagged. */
export function useFieldReadOnlyHint(): string | undefined {
  const { readOnly, hintId } = React.useContext(ReadOnlyContext);
  return readOnly ? hintId : undefined;
}
