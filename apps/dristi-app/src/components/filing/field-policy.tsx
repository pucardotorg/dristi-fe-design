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
import type { LucideIcon } from "lucide-react";

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
  /**
   * No footer Back: the host's breadcrumb is the way up (bulk's case flow, where a footer
   * Back would only step to the previous section of a case nobody walks in order).
   */
  noBack?: boolean;
  /**
   * Why the section's Continue can't go ahead yet, or `null` when it can. A single filing
   * lets a section be left incomplete and catches it at preview; bulk filing's Common
   * details can't, because one gap there becomes the same fix on every case.
   */
  holdContinue?: string | null;
  /**
   * The host's own content under the section's title, above its form: bulk filing lists
   * what is open in the section there, next to the fields it is about.
   */
  underTitle?: React.ReactNode;
  /**
   * The host's own content after the section's form: bulk filing asks its batch-wide ADR
   * question under the complainants (BLK-05).
   */
  belowForm?: React.ReactNode;
  /**
   * Which groups of the list of documents to show, when the host collects only some of
   * them here. Bulk filing's setup shows the complainants' documents alone; each case's
   * own are uploaded per case.
   */
  documentGroups?: (groupId: string) => boolean;
  /**
   * Steps of the host's own, listed in the sections rail after the filing's, in the same
   * rows: bulk filing's upload continues past the sections it borrows (the Excel file,
   * matching, review) without leaving the filing's frame.
   */
  hostSteps?: { group: string; steps: HostStep[] };
  /**
   * `false` where the host reads nothing from an uploaded document, so there is no source
   * to show: the source rail, "View source document" and the per-field source buttons are
   * left out. Bulk filing's Common details enters the batch's parties by hand.
   */
  sources?: false;
  /**
   * The page column sits in the middle of the screen. Bulk filing's setup has no sections
   * rail and no source rail, so a left-aligned column would leave the right half empty.
   */
  centered?: true;
  /**
   * The source rail opens only when asked for, as a sheet, instead of docking as a column
   * wherever there is room. Bulk filing's open case: a section docking it and the next not
   * reflowed the whole case from one section to the next (round-3 audit).
   */
  sourcesOnDemand?: true;
  /**
   * `false` where every case is filed by an advocate, so "appearing in person?" is not a
   * question: bulk filing (round-3 audit). Still shown on a complainant already marked as
   * appearing in person, so that state is never hidden.
   */
  partyInPerson?: false;
  /**
   * The list of documents names each group by its party with its own count, and the
   * footer's "N required documents still needed" is a control: it marks every missing
   * required row as a field error and takes you to the first. Bulk filing first (owner,
   * 2026-11-10); the single filing adopts it by dropping this flag.
   */
  guideMissing?: true;
  /**
   * The footer counts the required fields still empty on screen, as a button that marks
   * them and goes to the first (`missing-fields.tsx`). Bulk filing's Common details, where
   * the batch's parties are typed in by hand (owner, 2026-11-10).
   */
  guideFields?: true;
  /**
   * A whole-section lock says its reason the host's own way (under the title, through
   * `underTitle`) instead of as a notice above the page header, so the title sits where
   * it does on every other screen. Bulk filing's Common details after the batch exists.
   */
  lockReasonUnderTitle?: true;
};

/** A host step in the sections rail. */
export type HostStep = {
  id: string;
  title: string;
  icon: LucideIcon;
  href: string;
  active: boolean;
  done?: boolean;
  /** Not reachable yet (nothing to match before a file is read); listed for orientation. */
  disabled?: boolean;
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

/** The host has no source documents here (`FieldPolicy.sources`). */
export function useSourcesOnDemand(): boolean {
  return React.useContext(FieldPolicyContext)?.sourcesOnDemand === true;
}

export function useSourcesOff(): boolean {
  return React.useContext(FieldPolicyContext)?.sources === false;
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
