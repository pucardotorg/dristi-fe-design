/**
 * Application tasks — the court side of the application lifecycle.
 *
 * Every application filed (signed and paid) on the citizen side raises a **Review
 * application** task due the next working day; onboarding it raises a **Decide
 * application** task (`handovers/application-lifecycle.md`, `ALC-03`, `ALC-21`). Both
 * read the same record from `lib/applications/store.ts`, so what an advocate files in
 * this browser is what the bench sees here. Nothing is seeded: the queue holds only
 * what has actually been filed.
 */
import { decodeDraft } from "@/lib/applications/form-codec";
import {
  formatCaseDate,
  partiesLabel,
  type CaseRecord,
} from "@/lib/cases/types";
import { buildGeneratedApplication } from "@/lib/cases/application-document";
import { CASES } from "@/lib/cases/fixtures";
import {
  suggestedDate,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";
import { isSittingDay, shiftDay } from "@/lib/employee/hearings";

import type { CourtApplicationDocument } from "@/components/employee/application-review-dialog";

export function caseOf(app: LifecycleApplication): CaseRecord | undefined {
  return CASES.find((record) => record.id === app.caseId);
}

export function causeTitleOf(app: LifecycleApplication): string {
  const record = caseOf(app);
  return record ? partiesLabel(record) : app.caseId;
}

/**
 * The next hearing of each sample application's case, in days from today — the
 * `nextHearingInDays` convention of `lib/employee/cases.ts`, so the dates stay a few
 * sitting days ahead on any day the sandbox is opened. The case fixtures carry fixed
 * hearing dates that have long passed, which left every application with "None listed".
 * `null` is a case with no hearing fixed: c-1003 keeps it, so a To onboard application
 * still shows what the bench sees when there is nothing to suggest.
 */
const NEXT_HEARING_IN_DAYS: Record<string, number | null> = {
  "c-1001": 3,
  "c-1002": 9,
  "c-1003": null,
  "c-1004": 6,
  "c-1005": 4,
  "c-1006": 12,
};

/**
 * The case's next hearing, as a day after `on` — or `undefined` when none is listed.
 * Rolled forward to a sitting day, so the suggestion is never a day the court is shut.
 * Cases outside the sample table fall back to the fixture's own next hearing, if it is
 * still ahead.
 */
export function nextHearingOf(
  app: LifecycleApplication,
  on: string,
): string | undefined {
  if (app.caseId in NEXT_HEARING_IN_DAYS) {
    const days = NEXT_HEARING_IN_DAYS[app.caseId];
    if (days === null) return undefined;
    let day = shiftDay(on, Math.max(1, days));
    while (!isSittingDay(day)) day = shiftDay(day, 1);
    return day;
  }
  return suggestedDate(caseOf(app)?.nextHearing?.on, on);
}

/** The application as paper, from what the filer entered. */
export function courtDocumentOf(
  app: LifecycleApplication,
): CourtApplicationDocument | null {
  const record = caseOf(app);
  if (!record) return null;
  const generated = buildGeneratedApplication(decodeDraft(app.form), record, app.side);
  if (!generated) return null;
  return {
    ...generated,
    dated: formatCaseDate(app.submittedOn ?? app.createdOn),
  };
}

export type DueState = "overdue" | "today" | "later";

export function dueState(dueOn: string, today: string): DueState {
  if (dueOn < today) return "overdue";
  if (dueOn === today) return "today";
  return "later";
}
