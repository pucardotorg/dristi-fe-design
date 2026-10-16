/**
 * The Application item in an application's order data (owner, 2026-10-16).
 *
 * An order on an application always carries it: it is in the order data the moment the
 * magistrate opens the order, and the steno cannot mark the order data complete until it
 * is answered. It is its own record on the draft rather than a catalogue item — its
 * questions turn on one another, which the catalogue's fields do not.
 *
 * The questions, in order:
 * 1. **Onboard the application?** Yes or no; yes to begin with. An application already
 *    onboarded answers yes and cannot be changed.
 * 2. **Was a decision passed on the application?** Yes or no.
 *    - Yes → **What was decided?** from `APPLICATION_DECISIONS`; and, when the
 *      application's type has a workflow of its own, **Was that workflow triggered?**
 *    - No → **Does the other party need to respond?** (yes → a date to respond by), and
 *      **When should the application be brought forward again?**
 */

import { acceptanceNeedsHearingDate } from "@/lib/applications/lifecycle";

export type YesNo = "yes" | "no";

export type ApplicationDecisionId =
  | "allowed"
  | "partly-allowed"
  | "disallowed"
  | "disallowed-with-cost"
  | "disposed";

/** What a decision on an application can be — the owner's list, with Allowed beside Partly allowed. */
export const APPLICATION_DECISIONS: {
  id: ApplicationDecisionId;
  label: string;
}[] = [
  { id: "allowed", label: "Allowed" },
  { id: "partly-allowed", label: "Partly allowed" },
  { id: "disallowed", label: "Disallowed" },
  { id: "disallowed-with-cost", label: "Disallowed with cost" },
  { id: "disposed", label: "Disposed" },
];

export type ApplicationOutcome = {
  onboard: YesNo;
  decided: YesNo | "";
  decision: ApplicationDecisionId | "";
  workflowTriggered: YesNo | "";
  responseNeeded: YesNo | "";
  /** ISO day, or "". */
  respondBy: string;
  /** ISO day, or "". */
  bringForwardOn: string;
};

/** What the item opens on: onboard yes, nothing else answered. */
export function initialApplicationOutcome(): ApplicationOutcome {
  return {
    onboard: "yes",
    decided: "",
    decision: "",
    workflowTriggered: "",
    responseNeeded: "",
    respondBy: "",
    bringForwardOn: "",
  };
}

/**
 * The workflow an application's type sets moving when it is decided, by its catalogue
 * name — or none. Advance and Postpone move the next hearing (`acceptanceNeedsHearingDate`);
 * the rest are read off the order catalogue's item of the same purpose. [DERIVED] — to be
 * confirmed against the application-type configuration.
 */
export function applicationWorkflow(type: string): string | null {
  if (acceptanceNeedsHearingDate(type)) return "Rescheduling of hearing";
  switch (type) {
    case "bail":
      return "Acceptance of bail";
    case "settlement":
      return "Case settlement";
    case "transfer":
      return "Case transfer";
    case "withdrawal":
      return "Withdrawal of case";
    default:
      return null;
  }
}

/** The questions still unanswered, in the order they are asked. */
export function applicationOutcomeGaps(
  outcome: ApplicationOutcome,
  hasWorkflow: boolean,
): string[] {
  const gaps: string[] = [];
  if (!outcome.decided) gaps.push("Decision passed");
  if (outcome.decided === "yes") {
    if (!outcome.decision) gaps.push("Decision");
    if (hasWorkflow && !outcome.workflowTriggered)
      gaps.push("Workflow triggered");
  }
  if (outcome.decided === "no") {
    if (!outcome.responseNeeded) gaps.push("Response needed");
    if (outcome.responseNeeded === "yes" && !outcome.respondBy) {
      gaps.push("Respond by");
    }
    if (!outcome.bringForwardOn) gaps.push("Bring forward on");
  }
  return gaps;
}

/**
 * Change one answer, clearing what it hides — a decision answered and then taken back
 * leaves no decision behind it.
 */
export function setApplicationOutcome(
  outcome: ApplicationOutcome,
  change: Partial<ApplicationOutcome>,
): ApplicationOutcome {
  const next = { ...outcome, ...change };
  if (next.decided !== "yes") {
    next.decision = "";
    next.workflowTriggered = "";
  }
  if (next.decided !== "no") {
    next.responseNeeded = "";
    next.respondBy = "";
    next.bringForwardOn = "";
  }
  if (next.responseNeeded !== "yes") next.respondBy = "";
  return next;
}
