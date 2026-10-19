/**
 * The case history beside the order — order screen E's Case history tab (`ORD-15`):
 * the case's history (View Case §12), with the orders passed on the case in it.
 *
 * Built from what the hearing overview already holds — plus two example events on one
 * demo listing (`EXAMPLE_LATER_EVENTS`): the court's
 * events (`caseTimeline`) and the sittings with the order passed at each
 * (`hearingSittings`). A sitting that recorded an update and passed no order
 * (`directed: false`) is not an order and not an event in the catalogue, so it is left
 * out — whether it belongs here is open.
 *
 * Chronological, oldest first, as the case happened: the panel scrolls to the last order
 * rather than putting it on top.
 */

import type { CaseTimelineStep } from "./hearing-overview";
import type { HearingSitting } from "./hearing-overview";

/**
 * An order's text is shown whole up to this many characters — about four lines at the
 * panel's width. Longer, it is cut and the order opens in full on its own.
 */
export const ORDER_EXCERPT_LIMIT = 240;

/**
 * Events in the catalogue that are an order, and the order's document in the case
 * file's Orders section — the order the event links to.
 */
const ORDER_EVENT_DOCS: Partial<Record<string, string>> = {
  "cognizance-taken": "order-cognizance",
  "summons-issued": "order-issuing-summons",
};

/**
 * The kinds of entry the history can be narrowed to — the filter's options, in the order
 * it lists them. Read off each entry rather than the catalogue, which this build does not
 * hold: a new kind of event is a new entry here.
 */
export const HISTORY_TYPES = [
  { value: "order", label: "Orders" },
  { value: "application", label: "Applications" },
  { value: "document", label: "Documents" },
  { value: "process", label: "Process" },
  { value: "party", label: "Parties" },
  { value: "case", label: "Case filing" },
] as const;

export type HistoryType = (typeof HISTORY_TYPES)[number]["value"];

/** Which kind each catalogue event in the court's record is. */
const EVENT_TYPES: Partial<Record<string, HistoryType>> = {
  "case-filed": "case",
  "case-registered": "case",
  "summons-delivered": "process",
  "accused-joined": "party",
  "bail-onboarded": "application",
};

/**
 * **Example events, added for this prototype only** (owner, 2026-10-19: "add a couple of
 * items so that the order is not the latest thing"). Two things that followed the last
 * order on the demo listing `h-241`, so the history shows the last order is not always the
 * last entry. Not a court record; nothing else in the app reads them.
 */
const EXAMPLE_LATER_EVENTS: Partial<
  Record<string, { id: string; on: string; label: string; type: HistoryType }[]>
> = {
  "h-241": [
    {
      id: "example-exemption-onboarded",
      on: "2026-08-27",
      label: "Application - Exemption from appearance onboarded",
      type: "application",
    },
    {
      id: "example-return-memo-filed",
      on: "2026-09-03",
      label: "Document - Original bank return memo filed",
      type: "document",
    },
  ],
};

export type OrderHistoryEntry = {
  id: string;
  on: string;
  label: string;
  kind: "event" | "order";
  type: HistoryType | "other";
  /** Where an event opens, as the case history links it (a new tab). */
  href?: string;
  note?: string;
  /** An order's own words, when the record holds them. */
  text?: string;
  /** An order that is a document in the case file, opened from there. */
  caseFileDoc?: string;
  /** The case's last order. */
  last?: boolean;
};

export function orderCaseHistory(
  events: readonly CaseTimelineStep[],
  sittings: readonly HearingSitting[],
  /** The listing, for the prototype's example events. */
  listingId?: string,
): OrderHistoryEntry[] {
  const entries: OrderHistoryEntry[] = [
    ...events
      .filter((step): step is CaseTimelineStep & { on: string } => !!step.on)
      .map((step): OrderHistoryEntry => {
        const doc = ORDER_EVENT_DOCS[step.id];
        return doc
          ? {
              id: step.id,
              on: step.on,
              label: step.label,
              kind: "order",
              type: "order",
              caseFileDoc: doc,
            }
          : {
              id: step.id,
              on: step.on,
              label: step.label,
              kind: "event",
              type: EVENT_TYPES[step.id] ?? "other",
              href: step.href,
              note: step.note,
            };
      }),
    ...(listingId ? (EXAMPLE_LATER_EVENTS[listingId] ?? []) : []).map(
      (event): OrderHistoryEntry => ({ ...event, kind: "event" }),
    ),
    /* Sittings come newest first; the history reads oldest first. */
    ...sittings
      .filter((sitting) => sitting.directed)
      .toReversed()
      .map(
        (sitting): OrderHistoryEntry => ({
          id: `order-${sitting.on}`,
          on: sitting.on,
          label: `Order of the day · ${sitting.purpose}`,
          kind: "order",
          type: "order",
          text: sitting.order,
        }),
      ),
  ];

  /* Oldest first; on one day, an order after the events that led to it. The sort is
     stable, so each source keeps its own order otherwise. */
  const sorted = entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        a.entry.on.localeCompare(b.entry.on) ||
        (a.entry.kind === b.entry.kind
          ? a.index - b.index
          : a.entry.kind === "order"
            ? 1
            : -1),
    )
    .map(({ entry }) => entry);

  const last = sorted.findLast((entry) => entry.kind === "order");
  return sorted.map((entry) =>
    entry === last ? { ...entry, last: true } : entry,
  );
}

/**
 * An order's text for the list: whole when it fits the limit, else cut at the last word
 * before it with an ellipsis. `cut` says whether anything was left out.
 */
export function orderExcerpt(
  text: string,
  limit = ORDER_EXCERPT_LIMIT,
): { text: string; cut: boolean } {
  const whole = text.trim();
  if (whole.length <= limit) return { text: whole, cut: false };
  const head = whole.slice(0, limit);
  const space = head.lastIndexOf(" ");
  const kept = (space > limit / 2 ? head.slice(0, space) : head).replace(
    /[\s,;:.–-]+$/,
    "",
  );
  return { text: `${kept}…`, cut: true };
}
