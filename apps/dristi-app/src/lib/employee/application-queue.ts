/**
 * Applications — the court's one queue for the application lifecycle.
 *
 * Onboard applications and Decide on applications were two rail items for two stages of
 * one thing (owner, 2026-10-07). They are one screen now, cut by where an application
 * stands, and the bench works it like a cause list: what is due **today** first.
 *
 * - **To onboard** — a Review application task due today or earlier (`ALC-03`).
 * - **To decide** — a Decide application task due today or earlier (`ALC-09`, `ALC-21`).
 * - **Upcoming** — either task listed for a later day: a deferred review, or a decision
 *   listed ahead. Never the default; the bench looks ahead only when it wants to
 *   (Anshumanth, 2026-10-08).
 * - **Closed** — accepted, rejected or dismissed in the last 30 days; anything older is
 *   in the **archive** (owner, 2026-10-07).
 *
 * An application whose order is drafted and waiting for the magistrate's signature is in
 * none of the working lists. Orders are signed in Sign orders, not here (owner,
 * 2026-10-08: "we already have a side tab in the product to deal with signing of orders").
 * Under All it stands in its own band so it is never lost.
 */

import type { LifecycleApplication } from "@/lib/applications/lifecycle";
import { addDays } from "@/lib/applications/lifecycle";
import { formatCaseDate } from "@/lib/cases/types";

import { caseOf, causeTitleOf, dueState, type DueState } from "./application-tasks";

export type ApplicationQueueId =
  | "onboard"
  | "decide"
  | "signing"
  | "later"
  | "closed"
  | "archive";

/** Closed applications stay in Closed this long, then move to the archive. */
export const ARCHIVE_AFTER_DAYS = 30;

/** Where an application stands, or `null` for one the court has nothing to do with yet. */
export function queueOf(
  app: LifecycleApplication,
  today: string,
): ApplicationQueueId | null {
  if (
    app.status === "accepted" ||
    app.status === "rejected" ||
    app.status === "dismissed"
  ) {
    const closedOn = app.linkedOrder?.signedOn ?? app.updatedOn;
    return closedOn < addDays(today, -ARCHIVE_AFTER_DAYS) ? "archive" : "closed";
  }
  if (app.pendingOrder) return "signing";
  if (app.status === "pending-review" && app.review) {
    return app.review.dueOn <= today ? "onboard" : "later";
  }
  if (app.status === "pending-decision" && app.decide) {
    return app.decide.dueOn <= today ? "decide" : "later";
  }
  return null;
}

export type ApplicationView = "all" | "onboard" | "decide" | "later" | "closed";

export type ApplicationViewEntry = {
  id: ApplicationView;
  label: string;
  /** The pill's tooltip — what the list holds, in the bench's words. */
  hint: string;
  /** Counts mean work: only the two lists the bench owes today carry one. */
  counted: boolean;
};

export const APPLICATION_VIEWS: ApplicationViewEntry[] = [
  {
    id: "all",
    label: "All open",
    hint: "Every application still open, grouped by where it stands",
    counted: false,
  },
  {
    id: "onboard",
    label: "To onboard",
    hint: "New applications to onboard, defer or dismiss today. Each arrives the working day after it is filed.",
    counted: true,
  },
  {
    id: "decide",
    label: "To decide",
    hint: "Onboarded applications listed for today, plus any overdue, waiting for an order accepting or rejecting them",
    counted: true,
  },
  {
    id: "later",
    label: "Upcoming",
    hint: "Applications listed for a later day: reviews deferred and applications listed for a future date",
    counted: false,
  },
  {
    id: "closed",
    label: "Closed",
    hint: "Accepted, rejected or dismissed in the last 30 days",
    counted: false,
  },
];

/** The bands of All, in the order the bench works them. */
export const OPEN_BANDS: { id: ApplicationQueueId; label: string }[] = [
  { id: "onboard", label: "To onboard today" },
  { id: "decide", label: "To decide today" },
  { id: "signing", label: "Order awaiting signature" },
  { id: "later", label: "Upcoming" },
];

const OPEN: ApplicationQueueId[] = OPEN_BANDS.map((band) => band.id);

/** The day an application is due in its list — what the list sorts by. */
export function dueOn(app: LifecycleApplication): string {
  return (
    app.review?.dueOn ??
    app.decide?.dueOn ??
    app.pendingOrder?.draftedOn ??
    app.linkedOrder?.signedOn ??
    app.updatedOn
  );
}

/**
 * The applications in one view, in the order the bench takes them: soonest due first,
 * and under All grouped by band. Closed and the archive read newest first.
 */
export function applicationsIn(
  apps: LifecycleApplication[],
  view: ApplicationView | "archive",
  today: string,
): LifecycleApplication[] {
  const inView = apps.filter((app) => {
    const queue = queueOf(app, today);
    if (!queue) return false;
    if (view === "all") return OPEN.includes(queue);
    return queue === view;
  });
  if (view === "closed" || view === "archive") {
    return inView.sort((a, b) => dueOn(b).localeCompare(dueOn(a)));
  }
  return inView.sort((a, b) => {
    const band =
      OPEN.indexOf(queueOf(a, today) as ApplicationQueueId) -
      OPEN.indexOf(queueOf(b, today) as ApplicationQueueId);
    return band || dueOn(a).localeCompare(dueOn(b));
  });
}

export function countIn(
  apps: LifecycleApplication[],
  view: ApplicationView | "archive",
  today: string,
): number {
  return applicationsIn(apps, view, today).length;
}

/** All, cut into its bands. Empty bands are left out. */
export function bandsOf(
  rows: LifecycleApplication[],
  today: string,
): { id: ApplicationQueueId; label: string; rows: LifecycleApplication[] }[] {
  return OPEN_BANDS.map((band) => ({
    ...band,
    rows: rows.filter((app) => queueOf(app, today) === band.id),
  })).filter((band) => band.rows.length > 0);
}

/** Search matches the case, the parties, the application type and either number. */
export function matchesQuery(app: LifecycleApplication, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const record = caseOf(app);
  return [
    app.typeLabel,
    causeTitleOf(app),
    record?.caseNumber ?? "",
    app.applicationNumber ?? "",
    app.temporaryId ?? "",
  ].some((value) => value.toLowerCase().includes(needle));
}

/* ─────────────────────────── what a row and a fact say ─────────────────────────── */

export function shortDate(day: string): string {
  const [, m, d] = day.slice(0, 10).split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;
}

export type StatusLine = {
  /** The state in words — read first, foreground. */
  word: string;
  /** Under it, muted: the day, or the objection. */
  detail?: string;
  /** Overdue or due today, for the badge beside the word. */
  due?: DueState;
};

/** Where an application stands, in the words the list says it. */
export function statusLine(app: LifecycleApplication, today: string): StatusLine {
  const queue = queueOf(app, today);
  if (queue === "closed" || queue === "archive") {
    const word =
      app.status === "accepted"
        ? "Accepted"
        : app.status === "rejected"
          ? "Rejected"
          : "Dismissed";
    return {
      word,
      detail: app.linkedOrder
        ? `${shortDate(app.linkedOrder.signedOn)} · ${app.linkedOrder.id}`
        : undefined,
    };
  }
  if (queue === "signing") {
    return {
      word: "Order awaiting signature",
      detail: `${orderKindLabel(app.pendingOrder!.kind)} · in Sign orders`,
    };
  }
  if (app.status === "pending-review" && app.review) {
    if (queue === "later") {
      return { word: `Review deferred to ${shortDate(app.review.dueOn)}`, detail: "Not onboarded yet" };
    }
    return {
      word: app.review.dueOn !== app.review.defaultDueOn ? "Back after deferral" : "Awaiting onboarding",
      detail: `Due ${shortDate(app.review.dueOn)}`,
      due: dueState(app.review.dueOn, today),
    };
  }
  if (app.status === "pending-decision" && app.decide) {
    return {
      word: `Listed for ${shortDate(app.decide.dueOn)}`,
      detail: objectionLine(app, today),
      due: queue === "decide" ? dueState(app.decide.dueOn, today) : undefined,
    };
  }
  return { word: "" };
}

export function orderKindLabel(kind: "dismiss" | "accept" | "reject"): string {
  return kind === "dismiss"
    ? "Dismissal"
    : kind === "accept"
      ? "Accepting"
      : "Rejecting";
}

/** The objection, as the list and the facts say it (`ALC-11`–`ALC-13`, `ALC-23`). */
export function objectionLine(app: LifecycleApplication, today: string): string {
  if (app.status === "pending-review") return "Not called for yet";
  if (app.decide?.mode === "now" || !app.objectionsInvited) return "No objection called for";
  if (app.objectionId) return "Objection received";
  if (app.objectionDueBy && app.objectionDueBy < today) return "No objection received";
  return app.objectionDueBy ? `Objection due by ${shortDate(app.objectionDueBy)}` : "No objection called for";
}

/** "Wednesday, 7 October 2026" — the day the bench is working, beside the title. */
export function todayLabel(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("en-IN", { weekday: "long" });
  return `${weekday}, ${formatCaseDate(today)}`;
}
