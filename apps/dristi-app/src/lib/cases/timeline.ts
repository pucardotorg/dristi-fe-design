import { hearingRecords } from "./hearing-record";
import { type CaseSection } from "./sections";
import { formatCaseDate, type CaseRecord } from "./types";

export type CaseTimelineStatus = "past" | "current" | "future";

/**
 * Placeholder vocabulary. The real set has to come from the source system —
 * the workflow steps and CIS event codes that actually emit these events —
 * so nothing here is rendered. It exists to key an event to its origin; the
 * one string a reader sees is `label`.
 */
export type CaseTimelineEventType =
  | "application.submitted"
  | "case.disposed"
  | "case.registered"
  | "cheque.dishonoured"
  | "document.filed"
  | "hearing.appearance"
  | "hearing.held"
  | "hearing.part-heard"
  | "hearing.plea-recorded"
  | "memo.received"
  | "notice.dispatch-proof"
  | "notice.issued"
  | "order.cognizance"
  | "order.hearing-scheduled"
  | "summons.issued";

/** An event is a date plus one string. `ref` is set only where it resolves. */
export type CaseTimelineEvent = {
  id: string;
  type: CaseTimelineEventType;
  label: string;
  ref?: CaseSection;
  /** A hearing's business of the day, as the case peek shows it. */
  botd?: string;
};

export type CaseTimelineDay = {
  on: string;
  dateLabel: string;
  status: CaseTimelineStatus;
  events: CaseTimelineEvent[];
};

export type CaseTimelineModel = {
  days: CaseTimelineDay[];
  firstDateLabel: string;
  latestDateLabel: string;
};

type DatedEvent = CaseTimelineEvent & { on: string };

const FEATURED_CASE_ID = "c-1001";

/**
 * A complete, clearly identified dummy history for the featured review case.
 * It stops at the case's current evidence stage. Upcoming listings belong on
 * Hearings, not in this history. Other fixture cases only use facts already
 * present on their CaseRecord.
 */
export function caseTimelineModel(
  record: CaseRecord,
  now: number
): CaseTimelineModel {
  const events = withBusinessOfTheDay(
    record,
    record.id === FEATURED_CASE_ID ? featuredEvents(record) : recordEvents(record)
  ).filter((event) => hasOccurred(event.on, now));
  const grouped = groupByDate(events);
  const currentDate = latestOccurredDate(grouped, now);
  const days = grouped.map((day) => ({
    ...day,
    status:
      new Date(`${day.on}T00:00:00`).getTime() > now
        ? ("future" as const)
        : day.on === currentDate
          ? ("current" as const)
          : ("past" as const),
  }));
  const oldest = days.at(-1)?.on;
  const latest = days[0]?.on;

  return {
    days,
    firstDateLabel: oldest ? formatCaseDate(oldest) : "Not available",
    latestDateLabel: latest ? formatCaseDate(latest) : "Not available",
  };
}

function featuredEvents(record: CaseRecord): DatedEvent[] {
  return [
    {
      id: "hearing-date-order",
      on: "2026-08-10",
      type: "order.hearing-scheduled",
      label: record.nextHearing
        ? `Next evidence hearing scheduled for ${formatCaseDate(record.nextHearing.on)}`
        : "Next evidence hearing scheduled",
      ref: "orders-and-notifications",
    },
    {
      id: "pw1-part-heard",
      on: record.previousHearingOn ?? "2026-07-29",
      type: "hearing.part-heard",
      label: "Evidence of complainant part-heard",
      ref: "hearings",
    },
    {
      id: "pw2-account-records",
      on: "2026-07-24",
      type: "document.filed",
      label: "PW-2 account records filed",
      ref: "documents",
    },
    {
      id: "proof-of-liability",
      on: "2026-07-22",
      type: "document.filed",
      label: "Proof of debt or liability filed",
      ref: "documents",
    },
    {
      id: "pw1-chief-affidavit",
      on: "2026-07-20",
      type: "document.filed",
      label: "PW-1 chief affidavit filed",
      ref: "documents",
    },
    {
      id: "complainant-exhibit-index",
      on: "2026-07-20",
      type: "document.filed",
      label: "Complainant exhibit index P1–P6 filed",
      ref: "documents",
    },
    {
      id: "production-application",
      on: "2026-07-16",
      type: "application.submitted",
      label: "Application for production of documents submitted",
      ref: "applications",
    },
    {
      id: "plea-recorded",
      on: "2026-07-01",
      type: "hearing.plea-recorded",
      label: "Plea recorded",
      ref: "hearings",
    },
    {
      id: "accused-appearance",
      on: "2026-06-25",
      type: "hearing.appearance",
      label: "Accused entered appearance",
      ref: "hearings",
    },
    {
      id: "summons-issued",
      on: "2026-06-23",
      type: "summons.issued",
      label: "Summons issued to the accused",
      ref: "orders-and-notifications",
    },
    {
      id: "cognizance-order",
      on: "2026-06-23",
      type: "order.cognizance",
      label: "Cognizance taken",
      ref: "orders-and-notifications",
    },
    {
      id: "case-filed",
      on: record.filedOn,
      type: "case.registered",
      label: `Complaint filed and registered as ${record.caseNumber}`,
    },
    {
      id: "proof-of-service",
      on: "2026-05-28",
      type: "notice.dispatch-proof",
      label: "Proof of dispatch of legal demand notice recorded",
      ref: "documents",
    },
    {
      id: "demand-notice",
      on: "2026-05-25",
      type: "notice.issued",
      label: "Legal demand notice issued",
      ref: "documents",
    },
    {
      id: "return-memo",
      on: "2026-05-20",
      type: "memo.received",
      label: "Cheque return memo received",
      ref: "documents",
    },
    {
      id: "cheque-dishonoured",
      on: "2026-05-18",
      type: "cheque.dishonoured",
      label: "Cheque dishonoured",
    },
  ];
}

function recordEvents(record: CaseRecord): DatedEvent[] {
  const events: DatedEvent[] = [
    {
      id: `${record.id}-filed`,
      on: record.filedOn,
      type: "case.registered",
      label: `Complaint filed and registered as ${record.caseNumber}`,
    },
  ];

  /* Every hearing on record, named by its purpose, as the case peek lists
     them (owner, Oct 8: History said only "Hearing held"). Without a
     hearings record, the one sitting the case itself knows of. */
  const hearings = hearingRecords(record);
  if (hearings.length > 0) {
    for (const hearing of hearings) {
      events.push({
        id: `${record.id}-hearing-${hearing.id}`,
        on: hearing.on,
        type: "hearing.held",
        label: hearing.purpose,
        ref: "hearings",
      });
    }
  } else if (record.previousHearingOn) {
    events.push({
      id: `${record.id}-latest-hearing`,
      on: record.previousHearingOn,
      type: "hearing.held",
      label: "Hearing held",
      ref: "hearings",
    });
  }

  if (record.disposal) {
    events.push({
      id: `${record.id}-disposed`,
      on: record.disposal.on,
      type: "case.disposed",
      label: "Case disposed",
      ref: "orders-and-notifications",
    });
  }

  return events;
}

/**
 * The business of the day on each hearing that has one: on the first
 * hearing event of that day, read off the same hearing record the case peek
 * reads, so the two never tell different stories.
 */
function withBusinessOfTheDay(
  record: CaseRecord,
  events: DatedEvent[]
): DatedEvent[] {
  const botdByDay = new Map(
    hearingRecords(record)
      .filter((hearing) => hearing.summary)
      .map((hearing) => [hearing.on, hearing.summary!])
  );
  const given = new Set<string>();
  return events.map((event) => {
    if (!event.type.startsWith("hearing.") || given.has(event.on)) return event;
    const botd = botdByDay.get(event.on);
    if (!botd) return event;
    given.add(event.on);
    return { ...event, botd };
  });
}

function groupByDate(events: DatedEvent[]): Omit<CaseTimelineDay, "status">[] {
  const grouped = new Map<string, CaseTimelineEvent[]>();
  for (const event of events) {
    const { on, ...timelineEvent } = event;
    grouped.set(on, [...(grouped.get(on) ?? []), timelineEvent]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([on, dayEvents]) => ({
      on,
      dateLabel: formatCaseDate(on),
      events: dayEvents,
    }));
}

function hasOccurred(on: string, now: number): boolean {
  return new Date(`${on}T00:00:00`).getTime() <= now;
}

function latestOccurredDate(
  days: Omit<CaseTimelineDay, "status">[],
  now: number
): string | null {
  return days.find((day) => hasOccurred(day.on, now))?.on ?? null;
}
