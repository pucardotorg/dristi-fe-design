/**
 * What a triggered order's Application item does to the application (owner, 2026-10-21:
 * onboarding is an order, not a system action — "all that data about when it will be
 * decided, call for objections, etc. becomes the order data").
 *
 * The item's answers (`application-outcome.ts`) are read once the order is triggered —
 * signed, and its order data complete — and move the application the way the lifecycle's
 * own steps would. [DERIVED] — the mapping below is this build's reading, to be confirmed:
 *
 * | Onboard | Decided | What happens |
 * |---|---|---|
 * | No  | Yes | Dismissed before onboarding, whatever the decision's word |
 * | No  | No  | Not onboarded; its review comes back on the bring-forward date |
 * | Yes | Yes | Numbered, then closed: Allowed / Partly allowed → accepted; Disallowed (with or without cost) → rejected; Disposed → dismissed |
 * | Yes | No  | Numbered (or already), listed for the bring-forward date; a response asked for opens the other side's objection, due on the respond-by date |
 *
 * Every order applied is recorded on the application (`orders`), which is also what keeps
 * one order from being applied twice.
 *
 * Pure, so the rule can be tested; `application-order-triggers.tsx` applies it.
 */

import type {
  ApplicationStatus,
  LifecycleApplication,
  PassedOrder,
} from "@/lib/applications/lifecycle";

import {
  APPLICATION_DECISIONS,
  applicationOutcomeGaps,
  type ApplicationDecisionId,
  type ApplicationOutcome,
} from "./application-outcome";

/** The order as it was signed: its key in Pending orders, number, title and words. */
export type SignedApplicationOrder = Omit<PassedOrder, "summary">;

const CLOSES: Record<ApplicationDecisionId, ApplicationStatus> = {
  allowed: "accepted",
  "partly-allowed": "accepted",
  disallowed: "rejected",
  "disallowed-with-cost": "rejected",
  disposed: "dismissed",
};

function decisionLabel(id: ApplicationDecisionId | ""): string {
  return APPLICATION_DECISIONS.find((entry) => entry.id === id)?.label ?? "";
}

/** "29 Oct" — the summary's short date. */
function short(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/** Whether this order has already been applied to the application. */
export function orderApplied(
  app: LifecycleApplication,
  key: string,
): boolean {
  return (app.orders ?? []).some((order) => order.key === key);
}

/**
 * The application after its order. `null` when there is nothing to do: already applied,
 * the item not fully answered, or the application past where an order can move it.
 */
export function applyApplicationOutcome(
  app: LifecycleApplication,
  outcome: ApplicationOutcome,
  order: SignedApplicationOrder,
  {
    allotNumber,
    workflow,
    hearingOn,
  }: {
    /** The court number, allotted only when the order onboards it. */
    allotNumber: () => string;
    /** The type's workflow, by name, or none. */
    workflow: string | null;
    /** The order's next hearing, for a workflow that reschedules it. */
    hearingOn?: string;
  },
): LifecycleApplication | null {
  if (orderApplied(app, order.key)) return null;
  if (app.status !== "pending-review" && app.status !== "pending-decision") {
    return null;
  }
  const onboarded = app.status === "pending-decision";
  const answers: ApplicationOutcome = onboarded
    ? { ...outcome, onboard: "yes" }
    : outcome;
  if (applicationOutcomeGaps(answers, Boolean(workflow)).length > 0) return null;

  const on = order.signedOn;
  const patch: Partial<LifecycleApplication> = {};
  const lines: string[] = [];

  /* Onboard first, so a decision in the same order closes a numbered application. */
  if (answers.onboard === "yes" && !onboarded) {
    patch.applicationNumber = allotNumber();
    patch.onboardedOn = on;
    patch.review = undefined;
    lines.push(`Onboarded as ${patch.applicationNumber}`);
  }

  if (answers.decided === "yes") {
    const status =
      answers.onboard === "no" ? "dismissed" : CLOSES[answers.decision || "disposed"];
    const label = decisionLabel(answers.decision);
    Object.assign(patch, {
      status,
      review: undefined,
      decide: undefined,
      objectionDueBy: undefined,
      pendingOrder: undefined,
      decisionLabel: label,
      linkedOrder: {
        id: order.id,
        kind:
          status === "accepted" ? "accept" : status === "rejected" ? "reject" : "dismiss",
        text: order.text,
        signedOn: on,
      },
      workflowResult:
        answers.workflowTriggered === "yes" && workflow
          ? hearingOn
            ? `${workflow}: hearing on ${short(hearingOn)}`
            : workflow
          : undefined,
    } satisfies Partial<LifecycleApplication>);
    lines.push(answers.onboard === "no" ? `Dismissed (${label})` : label);
  } else if (answers.onboard === "no") {
    /* Not onboarded, nothing decided: the review comes back on the date given. */
    patch.review = {
      defaultDueOn: app.review?.defaultDueOn ?? answers.bringForwardOn,
      dueOn: answers.bringForwardOn,
    };
    lines.push(`Not onboarded; review on ${short(answers.bringForwardOn)}`);
  } else {
    const respond = answers.responseNeeded === "yes";
    Object.assign(patch, {
      status: "pending-decision",
      decide: { dueOn: answers.bringForwardOn, mode: "date" },
      objectionsInvited: respond || app.objectionsInvited,
      objectionDueBy: respond ? answers.respondBy : app.objectionDueBy,
    } satisfies Partial<LifecycleApplication>);
    lines.push(
      `Listed for ${short(answers.bringForwardOn)}${
        respond ? `; response by ${short(answers.respondBy)}` : ""
      }`,
    );
  }

  const summary = lines
    .map((line, index) => (index === 0 ? line : line[0].toLowerCase() + line.slice(1)))
    .join("; ");
  return {
    ...app,
    ...patch,
    orders: [...(app.orders ?? []), { ...order, summary }],
    updatedOn: on,
    history: [...app.history, { on, text: `Order ${order.id}: ${summary}` }],
  };
}
