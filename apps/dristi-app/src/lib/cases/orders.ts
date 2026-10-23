/**
 * Orders and notifications — the case register of records formally issued
 * or communicated by the court or system. Types are the live catalogue,
 * class groups them for browsing, and kind is the order/notification split
 * the register is filtered by. This is not a hearing, application, or the
 * compiled Case file.
 *
 * Featured dummy content comes from `orders-dummy.json`. Labels follow
 * Laws sentence case; statutory short forms (BNSS, ADR) stay as written.
 * Labels name the act, not the code section behind it — which code applies
 * turns on the cause-of-action date (product-foundation.md §3, point-in-time
 * law), so a section number in a label is wrong for half the caseload.
 */
import pack from "./orders-dummy.json";
import { counselFor, type CaseRecord } from "./types";

export type OrderClassId =
  | "judicial"
  | "process"
  | "scheduling"
  | "workflow"
  | "other";

/**
 * The broad split the register is read by: orders are passed by the court,
 * notifications are court communications about listings. Today the only
 * notification is the bulk reschedule. This is not a claim about who pressed
 * the button — summons and other process issue over court staff signatures
 * "by order of the Court" and are still orders.
 */
export type OrderKind = "order" | "notification";

export type OrderStatus =
  | "draft-in-progress"
  | "pending-signature"
  | "published";

export type OrderTypeId =
  | "abate-case"
  | "case-transfer-accept"
  | "case-transfer-reject"
  | "judgement"
  | "execution-of-sentence-and-compensation"
  | "moving-case-out-of-long-pending-register"
  | "moving-case-to-long-pending-register"
  | "order-for-acceptance-rejection-of-delay-condonation"
  | "order-for-taking-cognizance"
  | "order-to-dismiss-case"
  | "refer-case-to-adr"
  | "settlement-accept"
  | "settlement-reject"
  | "withdrawal-accept"
  | "withdrawal-reject"
  | "bail"
  | "condition-of-bail"
  | "cost"
  | "interim-compensation"
  | "rejection-of-bail"
  | "accept-rescheduling-request"
  | "extension-of-document-submission-date"
  | "notification-for-bulk-reschedule"
  | "rejection-reschedule-request"
  | "reschedule-of-hearing-date"
  | "schedule-of-hearing-date"
  | "acceptance-of-checkout-request"
  | "rejection-of-checkout-request"
  | "approve-voluntary-submissions"
  | "reject-voluntary-submissions"
  | "mandatory-submissions-responses"
  | "order-for-advocate-replacement-approval-rejection"
  | "order-for-approval-rejection-of-litigant-details-change"
  | "attachment"
  | "miscellaneous-process"
  | "notice"
  | "postponement-of-issue-of-process"
  | "proclamation"
  | "production-of-documents"
  | "summons"
  | "warrant"
  | "witness-batta"
  | "others";

/**
 * Browsing groups, in reading order. `other` is last on purpose: it is the
 * bucket for a record the catalogue has no name for yet, so it must not sit
 * inside a group that claims to describe its contents.
 */
export const ORDER_CLASSES: { id: OrderClassId; label: string }[] = [
  { id: "judicial", label: "Judicial order or judgment" },
  { id: "process", label: "Court process" },
  { id: "scheduling", label: "Scheduling record" },
  { id: "workflow", label: "Workflow decision" },
  { id: "other", label: "Other" },
];

/**
 * The catalogue owns `classId` and `kind` — records derive both rather than
 * carrying their own copy, so reclassifying a type moves every record with it.
 */
export const ORDER_TYPES: {
  id: OrderTypeId;
  label: string;
  classId: OrderClassId;
  kind: OrderKind;
}[] = [
  { id: "abate-case", label: "Abate case", classId: "judicial", kind: "order" },
  {
    id: "case-transfer-accept",
    label: "Case transfer accept",
    classId: "judicial",
    kind: "order",
  },
  {
    id: "case-transfer-reject",
    label: "Case transfer reject",
    classId: "judicial",
    kind: "order",
  },
  { id: "judgement", label: "Judgement", classId: "judicial", kind: "order" },
  {
    /**
     * What the execution stage produces once a conviction is recorded — the
     * sentence, the fine and the compensation the court awards the payee are
     * recovered on this side of the case (journey.md §9 · NI Act §138,
     * BNSS §395; product-foundation.md §3 Kerala step 7). Hearings already
     * has an `execution` sitting; this is the order it passes.
     */
    id: "execution-of-sentence-and-compensation",
    label: "Execution of sentence and compensation",
    classId: "judicial",
    kind: "order",
  },
  {
    id: "moving-case-out-of-long-pending-register",
    label: "Moving case out of long pending register",
    classId: "judicial",
    kind: "order",
  },
  {
    id: "moving-case-to-long-pending-register",
    label: "Moving case to long pending register",
    classId: "judicial",
    kind: "order",
  },
  {
    /**
     * Whether a complaint filed beyond the one-month limitation is heard at
     * all — the maintainability question, not a workflow step (journey.md §3
     * · NI Act §142, BNSS §514). Hearings and Applications already treat it
     * as substantive.
     */
    id: "order-for-acceptance-rejection-of-delay-condonation",
    label: "Order for acceptance/rejection of delay condonation",
    classId: "judicial",
    kind: "order",
  },
  {
    /** Taking the complaint on file is the admission (journey.md §4). */
    id: "order-for-taking-cognizance",
    label: "Order for taking cognizance",
    classId: "judicial",
    kind: "order",
  },
  {
    id: "order-to-dismiss-case",
    label: "Order to dismiss case",
    classId: "judicial",
    kind: "order",
  },
  {
    id: "refer-case-to-adr",
    label: "Refer case to ADR",
    classId: "judicial",
    kind: "order",
  },
  {
    id: "settlement-accept",
    label: "Settlement accept",
    classId: "judicial",
    kind: "order",
  },
  {
    id: "settlement-reject",
    label: "Settlement reject",
    classId: "judicial",
    kind: "order",
  },
  {
    id: "withdrawal-accept",
    label: "Withdrawal accept",
    classId: "judicial",
    kind: "order",
  },
  {
    id: "withdrawal-reject",
    label: "Withdrawal reject",
    classId: "judicial",
    kind: "order",
  },
  { id: "bail", label: "Bail", classId: "judicial", kind: "order" },
  {
    id: "condition-of-bail",
    label: "Condition of bail",
    classId: "judicial",
    kind: "order",
  },
  { id: "cost", label: "Cost", classId: "judicial", kind: "order" },
  {
    /**
     * The direction to the drawer to pay up to 20% of the cheque amount
     * before the trial concludes (journey.md §6 · NI Act §143A).
     */
    id: "interim-compensation",
    label: "Interim compensation",
    classId: "judicial",
    kind: "order",
  },
  {
    id: "rejection-of-bail",
    label: "Rejection of bail",
    classId: "judicial",
    kind: "order",
  },
  /**
   * Scheduling is one act with two directions — fixing a date and moving
   * one — plus the court's answer to a party who asked for the move. The
   * catalogue used to split "assigning", "initiating" and "next hearing"
   * out of those, which named steps of one workflow rather than records a
   * reader could tell apart.
   */
  {
    id: "accept-rescheduling-request",
    label: "Accept rescheduling request",
    classId: "scheduling",
    kind: "order",
  },
  {
    id: "extension-of-document-submission-date",
    label: "Extension of document submission date",
    classId: "scheduling",
    kind: "order",
  },
  {
    /** A reschedule communicated across a day's list — still scheduling. */
    id: "notification-for-bulk-reschedule",
    label: "Notification for bulk reschedule",
    classId: "scheduling",
    kind: "notification",
  },
  {
    id: "rejection-reschedule-request",
    label: "Rejection reschedule request",
    classId: "scheduling",
    kind: "order",
  },
  {
    id: "reschedule-of-hearing-date",
    label: "Reschedule of hearing date",
    classId: "scheduling",
    kind: "order",
  },
  {
    /** Fixing or posting a date — the first one and every one after it. */
    id: "schedule-of-hearing-date",
    label: "Schedule of hearing date",
    classId: "scheduling",
    kind: "order",
  },
  {
    id: "acceptance-of-checkout-request",
    label: "Acceptance of checkout request",
    classId: "workflow",
    kind: "order",
  },
  {
    id: "rejection-of-checkout-request",
    label: "Rejection of checkout request",
    classId: "workflow",
    kind: "order",
  },
  {
    id: "approve-voluntary-submissions",
    label: "Approve voluntary submissions",
    classId: "workflow",
    kind: "order",
  },
  {
    id: "reject-voluntary-submissions",
    label: "Reject voluntary submissions",
    classId: "workflow",
    kind: "order",
  },
  {
    id: "mandatory-submissions-responses",
    label: "Mandatory submissions responses",
    classId: "workflow",
    kind: "order",
  },
  {
    id: "order-for-advocate-replacement-approval-rejection",
    label: "Order for advocate replacement approval/rejection",
    classId: "workflow",
    kind: "order",
  },
  {
    id: "order-for-approval-rejection-of-litigant-details-change",
    label: "Order for approval/rejection of litigant details change",
    classId: "workflow",
    kind: "order",
  },
  {
    id: "attachment",
    label: "Attachment",
    classId: "process",
    kind: "order",
  },
  {
    id: "miscellaneous-process",
    label: "Miscellaneous process",
    classId: "process",
    kind: "order",
  },
  { id: "notice", label: "Notice", classId: "process", kind: "order" },
  {
    /**
     * Holding back the summons while the court inquires further before it
     * issues process (journey.md §5, "issue of process"). Named for the act,
     * not the section: the old label said CRPC, which is wrong for every
     * cause of action after 1 July 2024 (product-foundation.md §3).
     */
    id: "postponement-of-issue-of-process",
    label: "Postponement of issue of process",
    classId: "process",
    kind: "order",
  },
  {
    id: "proclamation",
    label: "Proclamation",
    classId: "process",
    kind: "order",
  },
  {
    /**
     * Compels a record out of whoever holds it — the drawee bank's return
     * record is the usual one (journey.md §7 · NI Act §146). Process rather
     * than judicial: like summons, notice and witness batta, it is an
     * instrument the court issues to a person to make them act.
     */
    id: "production-of-documents",
    label: "Production of documents",
    classId: "process",
    kind: "order",
  },
  { id: "summons", label: "Summons", classId: "process", kind: "order" },
  { id: "warrant", label: "Warrant", classId: "process", kind: "order" },
  {
    id: "witness-batta",
    label: "Witness batta",
    classId: "process",
    kind: "order",
  },
  { id: "others", label: "Others", classId: "other", kind: "order" },
];

export const ORDER_STATUSES: { id: OrderStatus; label: string }[] = [
  { id: "draft-in-progress", label: "Draft in progress" },
  { id: "pending-signature", label: "Pending signature" },
  { id: "published", label: "Published" },
];

/**
 * Kind filter values, in toggle order. There is no combined view — the
 * register is always read as one kind or the other, and orders are the
 * resting one because they are what a case is mostly made of.
 */
export type OrderKindFilter = OrderKind;

export const ORDER_KIND_FILTERS: { id: OrderKindFilter; label: string }[] = [
  { id: "order", label: "Orders" },
  { id: "notification", label: "Notifications" },
];

/** The kind the register opens on, and what "Clear filters" returns to. */
export const ORDER_KIND_DEFAULT: OrderKindFilter = "order";

export function isOrderKindFilter(value: string): value is OrderKindFilter {
  return ORDER_KIND_FILTERS.some((item) => item.id === value);
}

export function orderTypeLabel(id: OrderTypeId): string {
  return ORDER_TYPES.find((item) => item.id === id)?.label ?? id;
}

export function orderTypeClass(id: OrderTypeId): OrderClassId {
  return ORDER_TYPES.find((item) => item.id === id)?.classId ?? "judicial";
}

export function orderTypeKind(id: OrderTypeId): OrderKind {
  return ORDER_TYPES.find((item) => item.id === id)?.kind ?? "order";
}

export function orderClassLabel(id: OrderClassId): string {
  return ORDER_CLASSES.find((item) => item.id === id)?.label ?? id;
}

export function isOrderTypeId(value: string): value is OrderTypeId {
  return ORDER_TYPES.some((item) => item.id === value);
}

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUSES.find((item) => item.id === status)?.label ?? status;
}

/** Publication workflow — not case status. Pair with the words (Laws). */
export function orderStatusVariant(
  status: OrderStatus
): "success" | "info" | "warning" {
  if (status === "published") return "success";
  if (status === "pending-signature") return "info";
  return "warning";
}

export type OrderPerson = {
  id: string;
  name: string;
  role: string;
  /** Filter option copy — includes the role. */
  filterLabel: string;
};

export type OrderDocument = {
  label: string;
  href?: string;
  /** 1-based page in `href`. */
  page?: number;
};

export type OrderRecord = {
  id: string;
  type: OrderTypeId;
  /** Court-facing title when it differs from the type. */
  title: string;
  /** Both derived from the type catalogue — never authored per record. */
  classId: OrderClassId;
  kind: OrderKind;
  status: OrderStatus;
  issuedOn: string;
  /**
   * Business of the day — the one or two line summary of what was passed.
   * Authored per record; absent until the order is actually passed.
   */
  botd?: string;
  participantIds: string[];
  partiesDisplay: string;
  issuedDocument?: OrderDocument;
};

export type OrdersFile = {
  court: string;
  people: OrderPerson[];
  orders: OrderRecord[];
};

export function orderPartiesDisplay(
  order: OrderRecord,
  peopleById: Map<string, OrderPerson>
): string {
  if (order.partiesDisplay) return order.partiesDisplay;
  return order.participantIds
    .map((id) => {
      const person = peopleById.get(id);
      if (!person) return null;
      return person.role ? `${person.name} (${person.role})` : person.name;
    })
    .filter((label): label is string => Boolean(label))
    .join(", ");
}

export function orderDocumentSrc(doc: OrderDocument): string | undefined {
  if (!doc.href) return undefined;
  return doc.page ? `${doc.href}#page=${doc.page}` : doc.href;
}

export function hasIssuedDocument(order: OrderRecord): boolean {
  return Boolean(order.issuedDocument?.href);
}

function typeIdFromPack(label: string): OrderTypeId {
  const normalized = label.trim().toLowerCase();
  const match = ORDER_TYPES.find(
    (item) => item.label.toLowerCase() === normalized
  );
  if (!match) {
    throw new Error(`Unknown order type in dummy pack: ${label}`);
  }
  return match.id;
}

function statusFromPack(value: string): OrderStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === "draft in progress") return "draft-in-progress";
  if (normalized === "pending signature") return "pending-signature";
  if (normalized === "published") return "published";
  throw new Error(`Unknown order status in dummy pack: ${value}`);
}

function documentFromPack(
  value: { label: string; href?: string; page?: number } | null | undefined
): OrderDocument | undefined {
  if (!value) return undefined;
  return {
    label: value.label,
    href: value.href,
    page: value.page,
  };
}

function featuredPeople(): OrderPerson[] {
  return pack.filters.parties.map((item) => {
    const [left, role] = item.label.split(" — ");
    const name = left.split(",")[0]?.trim() ?? left;
    return {
      id: item.id,
      name,
      role: role ?? "",
      filterLabel: item.label,
    };
  });
}

type DummyOrderRow = (typeof pack.orders)[number] & {
  title?: string;
  botd?: string;
};

function featuredFile(): OrdersFile {
  return {
    court: pack.case.court,
    people: featuredPeople(),
    orders: pack.orders.map((item) => {
      const row = item as DummyOrderRow;
      const type = typeIdFromPack(row.type);
      return {
        id: row.orderId,
        type,
        title: row.title?.trim() || orderTypeLabel(type),
        classId: orderTypeClass(type),
        kind: orderTypeKind(type),
        status: statusFromPack(row.status),
        issuedOn: row.issuedOn,
        botd: row.botd?.trim() || undefined,
        participantIds: row.participantIds,
        partiesDisplay: row.partiesDisplay,
        issuedDocument: documentFromPack(row.issuedDocument),
      };
    }),
  };
}

function peopleFrom(record: CaseRecord): OrderPerson[] {
  const people: OrderPerson[] = [
    {
      id: `${record.id}-complainant`,
      name: record.parties.complainant,
      role: "Complainant",
      filterLabel: `${record.parties.complainant} — Complainant`,
    },
    {
      id: `${record.id}-accused`,
      name: record.parties.accused,
      role: "Accused",
      filterLabel: `${record.parties.accused} — Accused`,
    },
  ];

  counselFor(record, "complainant").forEach((name, index) => {
    people.push({
      id: `${record.id}-counsel-c-${index}`,
      name,
      role: "Complainant counsel",
      filterLabel: `${name} — Complainant counsel`,
    });
  });
  counselFor(record, "accused").forEach((name, index) => {
    people.push({
      id: `${record.id}-counsel-a-${index}`,
      name,
      role: "Accused counsel",
      filterLabel: `${name} — Accused counsel`,
    });
  });

  return people;
}

function filingKey(record: CaseRecord): string {
  return record.caseNumber.replaceAll("/", "-");
}

/**
 * Kerala's operational spine puts scrutiny and the defect check between
 * filing and cognizance (product-foundation.md §3), so a complaint is never
 * taken on file the day it is filed. Three weeks is the stand-in gap until
 * registry dates are real.
 */
const SCRUTINY_DAYS = 21;

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * When the complaint was taken on file. Derived from `filedOn` so a record
 * always renders the same register, and pulled back when the record already
 * claims a court date inside the scrutiny gap. A court date at or before the
 * filing day means the record disagrees with itself — the filing day is the
 * floor either way, because no order predates the complaint.
 */
function cognizanceOn(record: CaseRecord): string {
  const afterScrutiny = addDays(record.filedOn, SCRUTINY_DAYS);
  const firstCourtDay =
    record.previousHearingOn ?? record.nextHearing?.on ?? record.disposal?.on;
  if (!firstCourtDay || afterScrutiny <= firstCourtDay) return afterScrutiny;
  return firstCourtDay > record.filedOn ? firstCourtDay : record.filedOn;
}

/**
 * Shape of a register for a case with no curated pack. No `botd` — the
 * business of the day is authored text, not something to synthesise.
 * Class and kind both come off the catalogue, so reclassifying a type
 * cannot leave a synthesised record filed under the old group.
 */
function defaultOrders(
  record: CaseRecord,
  people: OrderPerson[]
): OrderRecord[] {
  const partyIds = people
    .filter((person) => person.role === "Complainant" || person.role === "Accused")
    .map((person) => person.id);
  const accusedId = people.find((person) => person.role === "Accused")?.id;
  const orders: OrderRecord[] = [];
  const key = filingKey(record);

  if (record.stage !== "scrutiny") {
    // Cognizance and the process that follows it both wait on scrutiny.
    const takenOnFile = cognizanceOn(record);
    orders.push({
      id: `${key}-OR1`,
      type: "order-for-taking-cognizance",
      title: orderTypeLabel("order-for-taking-cognizance"),
      classId: orderTypeClass("order-for-taking-cognizance"),
      kind: orderTypeKind("order-for-taking-cognizance"),
      status: "published",
      issuedOn: takenOnFile,
      participantIds: partyIds,
      partiesDisplay: "",
    });
    orders.push({
      id: `${key}-OR2`,
      type: "summons",
      title: orderTypeLabel("summons"),
      classId: orderTypeClass("summons"),
      kind: orderTypeKind("summons"),
      status: "published",
      issuedOn: takenOnFile,
      participantIds: accusedId ? [accusedId] : partyIds,
      partiesDisplay: "",
    });
  }

  if (record.nextHearing && !record.disposal) {
    orders.push({
      id: `${key}-OR3`,
      type: "schedule-of-hearing-date",
      title: orderTypeLabel("schedule-of-hearing-date"),
      classId: orderTypeClass("schedule-of-hearing-date"),
      kind: orderTypeKind("schedule-of-hearing-date"),
      status: "published",
      issuedOn: record.nextHearing.on,
      participantIds: partyIds,
      partiesDisplay: "",
    });
  }

  if (record.disposal) {
    orders.push({
      id: `${key}-OR4`,
      type: "judgement",
      title: orderTypeLabel("judgement"),
      classId: orderTypeClass("judgement"),
      kind: orderTypeKind("judgement"),
      status: "published",
      issuedOn: record.disposal.on,
      participantIds: partyIds,
      partiesDisplay: "",
    });
  }

  return orders;
}

const FEATURED_CASE_ID = "c-1001";

export function ordersFile(record: CaseRecord): OrdersFile {
  const file =
    record.id === FEATURED_CASE_ID
      ? featuredFile()
      : (() => {
          const people = peopleFrom(record);
          return {
            court: record.court,
            people,
            orders: defaultOrders(record, people),
          };
        })();
  return { ...file, orders: file.orders.map(withIssuedDocument) };
}

/**
 * Every published order has its signed copy: there is no gap between the court passing
 * an order and the order being there to read (owner, 2026-10-23). The demo packs author
 * a few; the rest open on the page of the case file's compiled orders that is the same
 * kind of order — a stand-in, not that order's own text.
 */
const ORDERS_PDF = "/case-file/09-orders.pdf";
const ORDER_PAGE_BY_TYPE: Partial<Record<OrderTypeId, number>> = {
  "order-for-taking-cognizance": 2,
  bail: 4,
  "condition-of-bail": 4,
  "rejection-of-bail": 4,
  judgement: 10,
  "execution-of-sentence-and-compensation": 10,
};
/** Order of the day — any order with no page of its own kind. */
const ORDER_OF_THE_DAY_PAGE = 5;
/** Order issuing summons — for every process order. */
const PROCESS_ORDER_PAGE = 3;

function withIssuedDocument(order: OrderRecord): OrderRecord {
  if (order.issuedDocument?.href) return order;
  return {
    ...order,
    issuedDocument: {
      label: "Issued order",
      href: ORDERS_PDF,
      page:
        ORDER_PAGE_BY_TYPE[order.type] ??
        (order.classId === "process"
          ? PROCESS_ORDER_PAGE
          : ORDER_OF_THE_DAY_PAGE),
    },
  };
}

export const ORDERS_PAGE_SIZES = [10, 20, 30, 40, 50] as const;
export type OrdersPageSize = (typeof ORDERS_PAGE_SIZES)[number];
export const ORDERS_PAGE_SIZE: OrdersPageSize = 10;

export function isOrdersPageSize(value: number): value is OrdersPageSize {
  return (ORDERS_PAGE_SIZES as readonly number[]).includes(value);
}

export type OrdersSelection = {
  /** One page of the filtered set, newest first. */
  rows: OrderRecord[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
};

export function selectOrders(options: {
  orders: OrderRecord[];
  kind: OrderKindFilter;
  pageSize: OrdersPageSize;
  page: number;
}): OrdersSelection {
  const matched = options.orders.filter(
    (order) => order.kind === options.kind
  );

  const sorted = [...matched].sort((a, b) => {
    const byDate = b.issuedOn.localeCompare(a.issuedOn);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });

  const pageSize = options.pageSize;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(options.page, pageCount);
  const start = (page - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  return {
    rows,
    total: sorted.length,
    page,
    pageCount,
    from: sorted.length === 0 ? 0 : start + 1,
    to: start + rows.length,
  };
}

export function orderPageWindow(
  page: number,
  pageCount: number
): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = new Set([1, pageCount, page, page - 1, page + 1]);
  const visible = [...pages]
    .filter((entry) => entry >= 1 && entry <= pageCount)
    .sort((a, b) => a - b);

  return visible.flatMap((entry, index) =>
    index > 0 && entry - visible[index - 1] > 1
      ? ["gap" as const, entry]
      : [entry]
  );
}
