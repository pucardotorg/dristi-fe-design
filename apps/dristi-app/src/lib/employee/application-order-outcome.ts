/**
 * What a triggered order does to the applications it decides (owner, 2026-10-14: the
 * order's workflow steps must reach the application).
 *
 * An order decides an application through its workflow items — *Accept application*,
 * *Reject application*, *Dismiss application* — each carrying the `applicationId` it
 * answers. When the order is **triggered** (signed, and its workflow complete —
 * `pending-orders.ts`), each of those items is applied to the application in
 * `lib/applications/store.ts`: dismissed, accepted (running the type's own workflow) or
 * rejected, with the order's words as its linked order.
 *
 * Pure, so the rule can be tested; `components/employee/use-application-order-triggers.ts`
 * applies it.
 */

import {
  acceptanceNeedsHearingDate,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";

import type { ComposerBlock } from "./order-composer";
import type { OrderDraft } from "./order-draft";

export type ApplicationOrderKind = "accept" | "reject" | "dismiss";

export type ApplicationOrderOutcome = {
  applicationId: string;
  kind: ApplicationOrderKind;
};

const KIND_OF_ITEM: Partial<Record<string, ApplicationOrderKind>> = {
  "accept-application": "accept",
  "reject-application": "reject",
  "dismiss-application": "dismiss",
};

/** Every application this order decides, and how — one per application, first wins. */
export function applicationOrderOutcomes(
  blocks: readonly ComposerBlock[],
): ApplicationOrderOutcome[] {
  const seen = new Set<string>();
  const outcomes: ApplicationOrderOutcome[] = [];
  for (const block of blocks) {
    if (block.kind !== "item" || !block.applicationId) continue;
    const kind = KIND_OF_ITEM[block.type];
    if (!kind || seen.has(block.applicationId)) continue;
    seen.add(block.applicationId);
    outcomes.push({ applicationId: block.applicationId, kind });
  }
  return outcomes;
}

/**
 * Whether the application is still where this outcome can act on it: a dismissal before
 * onboarding, an acceptance or rejection while it waits for a decision. Anything else —
 * already decided, or never this store's — is left alone, which is also what keeps a
 * triggered order from acting twice.
 */
export function outcomeApplies(
  outcome: ApplicationOrderOutcome,
  application: LifecycleApplication,
): boolean {
  return outcome.kind === "dismiss"
    ? application.status === "pending-review"
    : application.status === "pending-decision";
}

/**
 * The new hearing date an acceptance carries, for a type whose acceptance reschedules
 * the hearing (Postpone, Advance): the order's own next hearing.
 */
export function outcomeHearingDate(
  outcome: ApplicationOrderOutcome,
  application: LifecycleApplication,
  draft: Pick<OrderDraft, "next" | "nextDate">,
): string | undefined {
  if (outcome.kind !== "accept" || !acceptanceNeedsHearingDate(application.type)) {
    return undefined;
  }
  return draft.next === "list" && draft.nextDate ? draft.nextDate : undefined;
}
