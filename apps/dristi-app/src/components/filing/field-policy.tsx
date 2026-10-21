"use client";

/**
 * What a host says about the fields of the draft on screen, when the draft is opened from
 * somewhere other than the filing flow itself. Bulk filing opens each case in these same
 * sections and needs two things from them:
 *
 *   · Issues: what its checks found, shown under the field as a field error (`FormField`
 *     with a `name`, inside `CorrectionInstance` for repeating parts), and counted on the
 *     section's row in the rail.
 *   · Locks: a part set for the whole batch (its complainant, its advocates) reads as a
 *     value and cannot be typed over in one case. A repeating part locks per instance
 *     (`CorrectionInstance`); a whole section locks at `FilingMain`.
 *
 * Unlike the scrutiny correction posture (`posture.tsx`), nothing else is locked: the case
 * stays the ordinary, editable filing. Outside a host the context is `null` and every hook
 * here is a no-op.
 */

import * as React from "react";

import type { StepId } from "@/lib/filing/types";
import { SectionNotice } from "@/components/filing/notices";

export type FieldPolicy = {
  /** The step on screen. */
  step: StepId | null;
  /** The issue to show under a field of this step, if any. */
  issueAt: (instance: number, name: string) => string | null;
  /**
   * Why a part of this step cannot be changed here, or `null` when it can. `instance` is
   * `null` for the section as a whole.
   */
  lockedAt: (instance: number | null) => React.ReactNode | null;
  /** Open issues in a step, for its row in the rail. */
  countFor: (step: StepId) => number;
  /**
   * Where the footer's primary action goes instead of the section's own Continue, or
   * `null` to leave it. Bulk filing sends a case with nothing left here to the next
   * section or case that needs something, rather than through every clean section.
   */
  next?: { label: string; href: string; status?: React.ReactNode } | null;
};

const FieldPolicyContext = React.createContext<FieldPolicy | null>(null);

export function FieldPolicyProvider({
  value,
  children,
}: {
  value: FieldPolicy;
  children: React.ReactNode;
}) {
  return <FieldPolicyContext.Provider value={value}>{children}</FieldPolicyContext.Provider>;
}

export function useFieldPolicy(): FieldPolicy | null {
  return React.useContext(FieldPolicyContext);
}

/**
 * A locked part: why, said once above it, and every control inside it disabled. A
 * `fieldset` disables native controls and the DS's button-based ones alike, so no section
 * has to thread a `disabled` prop through its fields; `contents` keeps it out of layout.
 */
export function PolicyLock({
  reason,
  children,
}: {
  reason: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <SectionNotice>{reason}</SectionNotice>
      <fieldset disabled className="contents">
        {children}
      </fieldset>
    </>
  );
}
