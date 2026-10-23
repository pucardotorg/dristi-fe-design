/**
 * The case history with one line per thing, not one line per event (owner, 2026-10-23).
 *
 * A process or an application collects many events from the catalogue (PUCAR Dashboard
 * 2027 — Events/Case Updates) over its life: a summons is issued, paid for, sent, returned,
 * reissued, delivered. Here those are one **thread** — a single line that sits at its
 * latest event, so it moves up the history each time it changes (owner, 2026-10-23),
 * carries a status read off that event, and opens to the events themselves. Nothing is overwritten: the steps are the events, kept in full.
 *
 * Orders carry a short summary of what they decided; the order's own text is read whole
 * on its own. An order that started or decided a thread names it.
 *
 * Every other catalogue event stays a line of its own. Reschedule Requested and Hearing
 * Rescheduled are left out (owner, 2026-10-23).
 *
 * **Demo data.** Built from what the cause list already holds — the court's events
 * (`caseTimeline`) and the sittings (`hearingSittings`) — plus a process and application
 * story placed between them. The steps of a summons that was returned and reissued, the
 * bail order, the bond and the exemption and production applications are prototype examples, not a court
 * record.
 */

import type { CaseTimelineStep, HearingSitting } from "./hearing-overview";
import { shiftDay } from "./hearings";
import type { HistoryType } from "./order-case-history";

export type ThreadTone = "success" | "destructive" | "warning" | "info";

/** One catalogue event inside a thread. */
export type ThreadStep = {
  on: string;
  label: string;
  /** The order behind the step, when an order caused it. */
  orderId?: string;
};

export type HistoryRow =
  | {
      kind: "event";
      id: string;
      on: string;
      label: string;
      type: HistoryType | "other";
      href?: string;
      note?: string;
    }
  | {
      kind: "order";
      id: string;
      on: string;
      /** The catalogue's event for the order, its title filled in. */
      label: string;
      type: "orders";
      /** What the order decided, in a line or two. */
      summary: string;
      /** The order in the case's Orders tab, opened in a new browser tab. */
      href: string;
      /** Threads this order started or decided. */
      affects: { id: string; label: string }[];
      last?: boolean;
    }
  | {
      kind: "thread";
      id: string;
      /** When the thing began. The line sits at its latest step (`threadUpdatedOn`). */
      on: string;
      label: string;
      entity: "Process" | "Application";
      type: HistoryType;
      status: string;
      tone: ThreadTone;
      /** Still waiting on something. */
      open: boolean;
      /** Where it is kept in the case view — Applications, or Notice/Process status. */
      href: string;
      /** Oldest first, as they happened; the list shows them newest first. */
      steps: ThreadStep[];
    };

type OrderRow = Extract<HistoryRow, { kind: "order" }>;
type ThreadRow = Extract<HistoryRow, { kind: "thread" }>;

/**
 * Every listing opens the one demo case, as the rest of the cause list does
 * (`HEARING_DEMO_CASE`, `hearing-overview.ts`). An order or application this history
 * has a match for in that case opens on it; one it has none for opens the tab.
 */
const DEMO_CASE = "/employee/cases/c-1001";
const ORDERS_TAB = `${DEMO_CASE}?section=orders-and-notifications`;
const orderHref = (id?: string) =>
  id ? `${ORDERS_TAB}&order=${encodeURIComponent(id)}` : ORDERS_TAB;
const applicationHref = (id: string) =>
  `${DEMO_CASE}?section=applications&application=${encodeURIComponent(id)}`;
const PROCESS_TAB = `${DEMO_CASE}?section=notice-process-status`;
/**
 * The demo case's orders that a sitting's order opens on, newest sitting first: its
 * hearing orders, so the link always lands on an order. Not the sitting's own order —
 * the demo case holds none of the cause list's sittings.
 */
const SITTING_ORDER_IDS = [
  "KL-DUMMY-001386-2026-OR14",
  "KL-DUMMY-001386-2025-OR10",
  "KL-DUMMY-001386-2025-OR6",
  "KL-DUMMY-001386-2025-OR3",
];

const SUMMONS_ORDER_ID = "order-issue-of-summons";
const COGNIZANCE_ORDER_ID = "order-cognizance";
const BAIL_ORDER_ID = "order-bail";

/** Summaries for the demo sittings' orders, by the order's text. */
const SITTING_SUMMARIES: Record<string, string> = {
  "Accused appeared through counsel and moved for bail. Posted for plea.":
    "Accused appeared through counsel. Posted for plea.",
  "Particulars of the offence read over and explained to the accused, who pleaded not guilty. Posted for evidence of the complainant.":
    "Accused pleaded not guilty. Posted for the complainant's evidence.",
  "Proof affidavit of PW-1 filed and Exhibits P1 to P6 marked. Posted for cross-examination.":
    "PW-1's affidavit filed, Exhibits P1–P6 marked. Posted for cross-examination.",
  "PW-1 was examined in chief and partly cross-examined. Further cross-examination was deferred at the request of counsel for the accused. The complainant was directed to keep PW-2 present and produce the original bank return memo on the next posting date.":
    "PW-1 partly cross-examined; deferred at the accused's request. Complainant to bring PW-2 and the original return memo.",
};

/** A summary for an order with none written: its first sentence. */
function summaryOf(text: string): string {
  return (
    SITTING_SUMMARIES[text] ?? text.match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? text
  );
}

function at(from: string, days: number, notAfter?: string): string {
  const day = shiftDay(from, Math.max(0, Math.round(days)));
  return notAfter && day > notAfter ? notAfter : day;
}

/**
 * The summons: issued by order, paid for, posted, sent. Delivered when the record says
 * so — and when the gap allows, returned once and reissued first, so a thread shows
 * more than a straight run. Not yet delivered, it is still out.
 */
function summonsThread(
  accused: string,
  issuedOn: string,
  deliveredOn: string | undefined,
): ThreadRow {
  const steps: ThreadStep[] = [
    { on: issuedOn, label: "Summons Issued", orderId: SUMMONS_ORDER_ID },
    {
      on: at(issuedOn, 2, deliveredOn),
      label: "Payment for Summons Completed",
    },
    {
      on: at(issuedOn, 3, deliveredOn),
      label: "RPAD Envelope for Summons Submitted",
    },
    { on: at(issuedOn, 4, deliveredOn), label: "Summons Sent" },
  ];
  const base = {
    kind: "thread" as const,
    id: "process-summons",
    on: issuedOn,
    label: `Summons to ${accused}`,
    entity: "Process" as const,
    type: "process" as const,
    href: PROCESS_TAB,
  };

  if (!deliveredOn) {
    return { ...base, status: "Sent", tone: "info", open: true, steps };
  }

  const gap = (Date.parse(deliveredOn) - Date.parse(issuedOn)) / 86_400_000;
  if (gap >= 16) {
    steps.push(
      {
        on: at(issuedOn, gap * 0.45),
        label: "Summons Status Updated - Not Delivered",
      },
      { on: at(issuedOn, gap * 0.5), label: "Summons Reissued" },
      { on: at(issuedOn, gap * 0.55), label: "Summons Sent" },
    );
  }
  steps.push({ on: deliveredOn, label: "Summons Status Updated - Delivered" });
  return { ...base, status: "Delivered", tone: "success", open: false, steps };
}

/** Bail: filed with the appearance, onboarded, allowed by an order the day after. */
function bailThread(filedOn: string, onboardedOn: string): ThreadRow {
  return {
    kind: "thread",
    id: "application-bail",
    on: filedOn,
    label: "Application - Bail",
    entity: "Application",
    type: "submissions",
    href: applicationHref("sub-1001-bail"),
    status: "Accepted",
    tone: "success",
    open: false,
    steps: [
      { on: filedOn, label: "Application - Bail filed" },
      { on: onboardedOn, label: "Application - Bail onboarded" },
      {
        on: shiftDay(onboardedOn, 1),
        label: "Application - Bail 1 Accepted",
        orderId: BAIL_ORDER_ID,
      },
    ],
  };
}

/**
 * The demo listing's applications still waiting on the court: one onboarded, and one
 * filed after the last order, so the last order is not the top line (owner, 2026-10-23).
 */
const PRODUCTION_THREAD: ThreadRow = {
  kind: "thread",
  id: "application-production",
  on: "2026-09-08",
  label: "Application - Production of documents",
  entity: "Application",
  type: "submissions",
  href: applicationHref("sub-1001-accused-production"),
  status: "Filed",
  tone: "info",
  open: true,
  steps: [
    { on: "2026-09-08", label: "Application - Production of documents filed" },
  ],
};

const EXEMPTION_THREAD: ThreadRow = {
  kind: "thread",
  id: "application-exemption",
  on: "2026-08-24",
  label: "Application - Exemption from appearance",
  entity: "Application",
  type: "submissions",
  href: applicationHref("sub-1001-exemption"),
  status: "Onboarded",
  tone: "info",
  open: true,
  steps: [
    {
      on: "2026-08-24",
      label: "Application - Exemption from appearance filed",
    },
    {
      on: "2026-08-27",
      label: "Application - Exemption from appearance onboarded",
    },
  ],
};

/** Events that stay lines of their own, by catalogue category. */
const EVENT_TYPES: Partial<Record<string, HistoryType>> = {
  "case-filed": "filing",
  "case-registered": "filing",
  "accused-joined": "parties",
};

export function groupedCaseHistory(
  events: readonly CaseTimelineStep[],
  sittings: readonly HearingSitting[],
  accused: string,
  /** The listing, for the prototype's examples that belong to one case. */
  listingId?: string,
): HistoryRow[] {
  const dated = events.filter(
    (step): step is CaseTimelineStep & { on: string } => !!step.on,
  );
  const on = (id: string) => dated.find((step) => step.id === id)?.on;
  const rows: HistoryRow[] = [];

  for (const step of dated) {
    if (step.id in EVENT_TYPES) {
      rows.push({
        kind: "event",
        id: step.id,
        on: step.on,
        label: step.label,
        type: EVENT_TYPES[step.id] ?? "other",
        href: step.href,
        note: step.note,
      });
    }
  }

  const cognizanceOn = on("cognizance-taken");
  if (cognizanceOn) {
    rows.push({
      kind: "order",
      id: COGNIZANCE_ORDER_ID,
      on: cognizanceOn,
      label: "Cognizance Taken",
      type: "orders",
      summary:
        "Cognizance taken of the offence. Process to issue to the accused.",
      href: orderHref("KL-DUMMY-001386-2025-OR1"),
      affects: [],
    });
  }

  const issuedOn = on("summons-issued");
  if (issuedOn) {
    const summons = summonsThread(accused, issuedOn, on("summons-delivered"));
    rows.push(summons, {
      kind: "order",
      id: SUMMONS_ORDER_ID,
      on: issuedOn,
      label: "Order Issued - Issue of Summons",
      type: "orders",
      summary:
        "Summons to issue to the accused by RPAD. Complainant to pay the process fee.",
      href: orderHref("KL-DUMMY-001386-2025-OR2"),
      affects: [{ id: summons.id, label: summons.label }],
    });
  }

  const joinedOn = on("accused-joined");
  const onboardedOn = on("bail-onboarded");
  if (joinedOn && onboardedOn) {
    const bail = bailThread(joinedOn, onboardedOn);
    const allowedOn = shiftDay(onboardedOn, 1);
    rows.push(
      bail,
      {
        kind: "order",
        id: BAIL_ORDER_ID,
        on: allowedOn,
        label: "Order Issued - Bail",
        type: "orders",
        summary:
          "Bail allowed on the accused executing a bond with one surety.",
        href: orderHref("KL-DUMMY-001386-2025-OR4"),
        affects: [{ id: bail.id, label: bail.label }],
      },
      {
        kind: "event",
        id: "bail-bond-executed",
        on: shiftDay(allowedOn, 2),
        label: "Bail Bond Executed",
        type: "submissions",
      },
    );
  }

  /* Sittings come newest first; the sort below orders everything. A sitting that passed
     no order is not an event in the catalogue. */
  sittings
    .filter((s) => s.directed)
    .forEach((sitting, index) => {
      rows.push({
        kind: "order",
        id: `order-${sitting.on}`,
        on: sitting.on,
        label: `Order Issued - ${sitting.purpose}`,
        type: "orders",
        summary: summaryOf(sitting.order),
        href: orderHref(SITTING_ORDER_IDS[index]),
        affects: [],
      });
    });

  if (listingId === "h-241") {
    rows.push(EXEMPTION_THREAD, PRODUCTION_THREAD, {
      kind: "event",
      id: "example-documents-submitted",
      on: "2026-09-03",
      label: "Documents Submitted by Complainant",
      type: "submissions",
    });
  }

  /* Newest first (owner, 2026-10-23: "the most recent at the top"), a thread by its
     latest step. On one day an order sits above what led to it, and a thread the order
     moved above that order. Stable otherwise. */
  const at = (row: HistoryRow) =>
    row.kind === "thread" ? threadUpdatedOn(row) : row.on;
  const rank = (row: HistoryRow) =>
    row.kind === "event" ? 0 : row.kind === "order" ? 1 : 2;
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        at(b.row).localeCompare(at(a.row)) ||
        rank(b.row) - rank(a.row) ||
        b.index - a.index,
    )
    .map(({ row }) => row);

  const last = sorted.find((row): row is OrderRow => row.kind === "order");
  return sorted.map((row) => (row === last ? { ...row, last: true } : row));
}

/** The day a thread last changed. */
export function threadUpdatedOn(thread: ThreadRow): string {
  return thread.steps.at(-1)?.on ?? thread.on;
}

/**
 * A complaint at cognizance: only its filing has happened — filed, forwarded to the
 * magistrate, registered — so its history is those three lines, newest first. Dated back
 * from the days it has waited on the register (`daysSinceRegistered`), the anchor the
 * cognizance queue dates everything from. **Demo spacing**, not a court record.
 */
export function cognizanceHistory(
  matter: { id: string; daysSinceRegistered: number },
  today: string,
): HistoryRow[] {
  const registeredOn = shiftDay(today, -matter.daysSinceRegistered);
  const event = (id: string, on: string, label: string): HistoryRow => ({
    kind: "event",
    id: `${matter.id}-${id}`,
    on,
    label,
    type: "filing",
  });
  return [
    event("registered", registeredOn, "Case Registered"),
    event(
      "forwarded",
      shiftDay(registeredOn, -1),
      "Case Forwarded to Magistrate",
    ),
    event("filed", shiftDay(registeredOn, -4), "Case Filed"),
  ];
}
