"use client";

import { Breadcrumbs, type Crumb } from "@/components/shell/chrome";
import { useCaseNumber } from "@/components/court/court-provider";

/**
 * The trail for anything that lives under one case: `Cases › the case › here`.
 *
 * The case is named by its number — the one identifier that is short, stable and
 * printed on every paper the person holds — and it links back to the case file
 * whenever a further crumb follows it, so a person three levels in can step out one
 * level rather than all the way to the list. The top bar supplies the Cases root and
 * links it, because publishing any crumb at all is what turns the root into a link.
 */
export function CaseBreadcrumbs({
  caseId,
  caseNumber: storedCaseNumber,
  trail = [],
}: {
  caseId: string;
  caseNumber: string;
  /** Anything under the case — a section, a form. Absent on the case's own overview. */
  trail?: Crumb[];
}) {
  const caseNumber = useCaseNumber()(storedCaseNumber);
  const crumbs: Crumb[] = [
    trail.length
      ? {
          label: caseNumber,
          href: `/cases/${encodeURIComponent(caseId)}`,
          mono: true,
        }
      : { label: caseNumber, mono: true },
    ...trail,
  ];
  return <Breadcrumbs crumbs={crumbs} />;
}
