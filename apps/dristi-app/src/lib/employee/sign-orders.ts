/**
 * Orders waiting on this bench's signature — the signing queue for orders, as data.
 *
 * The sibling of `sign-forms.ts`, one row below it in the same rail group. A form is a
 * court paper drawn up for a party to swear; an order is the court's own decision, and
 * it is not an order until the magistrate signs it. So this queue is shaped like that
 * one — the same court-side vocabulary (the cause title, the page sizes, the listing
 * date format), the same demo-data honesty — and differs in the two facts the reference
 * screens add: an order carries a **title** (which decision it is) and a **status**
 * (whether the signature is already on it).
 *
 * **There is no backend and nothing here is signed or published.** `SIGN_ORDER_QUEUE`
 * is demo data shaped to exercise what the screen has to survive: all six order titles,
 * one case carrying four separate orders (the reference's own case, and the reason the
 * title is the row's emphasised cell rather than the cause), corporate parties long
 * enough to wrap, dates spread across months so the date filter has something to cut
 * on, both statuses so the status filter has something to cut on, and enough pending
 * rows to page at 10, 20 and 30.
 *
 * **Signing is a screen action, not a court record.** Neither the bulk path nor the
 * single-order path applies a signature, publishes anything, calls an e-sign provider,
 * writes a document or notifies anyone. `signSelectedOrders` does exactly one thing:
 * moves rows from `pending-signature` to `signed` in this demo queue, the way Approve
 * and Reject already do on the rescheduling queue. The confirmation copy describes what
 * signing *means* so the control is not misread; the build performs none of it.
 *
 * **The order wording is demo text, not a court-approved order.** Each title has a
 * template filled from the row's own particulars, so the preview has something
 * real-shaped to render. No §138 order template is defined in `docs/product/`, and the
 * rows carry no sums, sureties or dates of payment — the templates therefore recite
 * none, and say "the sum this court has fixed" where a real order would name a figure.
 * They claim nothing more than that.
 *
 * The titles are the case register's own words (`lib/cases/orders.ts`), restated here
 * rather than imported for the reason `order-draft.ts` restates the direction labels:
 * the employee area stays self-contained (`content.ts`), and the *words* are the
 * register's so the two halves of the app cannot disagree about what "Approve voluntary
 * submissions" is called. This is the signing subset — six of the register's titles,
 * the ones the reference's queue actually holds.
 *
 * Numbers are `ST/…` and `CMP/…` both: an order can be passed before cognizance (a
 * reference to mediation on a complaint still numbered CMP) or after it. These rows do
 * not overlap today's cause list, the scheduling queue, the register queue, the
 * rescheduling queue or the signing queue for forms.
 */

import { CURRENT_STAFF } from "./content";
import { causeTitle, formatListingDate, parseIsoDay } from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

/**
 * Which decision the order carries — the reference's "Title" column.
 *
 * Six, and only these: a queue row must have a title the templates below can actually
 * write, and a title with no template is a preview that renders nothing. The register
 * has forty-odd; the rest arrive with the screens that draw them up.
 */
export type SignOrderTypeId =
  | "approve-voluntary-submissions"
  | "reject-voluntary-submissions"
  | "bail"
  | "interim-compensation"
  | "refer-case-to-adr"
  | "others";

export const SIGN_ORDER_TYPES: { id: SignOrderTypeId; label: string }[] = [
  /* Sentence case, per the DS Laws — the reference's Title Case does not survive them.
     ADR keeps its capitals: a statutory short form, like CNR and BNSS. */
  { id: "approve-voluntary-submissions", label: "Approve voluntary submissions" },
  { id: "reject-voluntary-submissions", label: "Reject voluntary submissions" },
  { id: "bail", label: "Bail" },
  { id: "interim-compensation", label: "Interim compensation" },
  { id: "refer-case-to-adr", label: "Refer case to ADR" },
  // "Others" is the register's own bucket for a decision the catalogue has no name for.
  { id: "others", label: "Others" },
];

export function signOrderTypeLabel(id: SignOrderTypeId): string {
  return SIGN_ORDER_TYPES.find((entry) => entry.id === id)?.label ?? id;
}

/**
 * Whether the signature is on it yet.
 *
 * Two states, because the reference's Status filter opens *pre-set* to "Pending
 * signature" — a filter with one possible answer is a control that can only ever return
 * the whole list, so the queue it filters must hold more than one state. The register
 * (`lib/cases/orders.ts`) names a third, `draft-in-progress`: a draft is not in this
 * queue at all, because nothing has been sent for signature yet.
 */
export type SignOrderStatusId = "pending-signature" | "signed";

export const SIGN_ORDER_STATUSES: { id: SignOrderStatusId; label: string }[] = [
  { id: "pending-signature", label: "Pending signature" },
  { id: "signed", label: "Signed" },
];

export function signOrderStatusLabel(id: SignOrderStatusId): string {
  return SIGN_ORDER_STATUSES.find((entry) => entry.id === id)?.label ?? id;
}

/** Who moved the court to pass it. `court` is an order passed on its own motion. */
export type SignOrderMovedBy = "complainant" | "accused" | "court";

export type SignOrder = {
  id: string;
  caseNumber: string;
  parties: { complainant: string; accused: string };
  type: SignOrderTypeId;
  status: SignOrderStatusId;
  /** ISO day the order was drawn up and added to this queue. */
  addedOn: string;
  /** ISO day the signature went on. Present only on a signed row. */
  signedOn?: string;
  movedBy: SignOrderMovedBy;
};

/** The court whose orders these are. One bench, one signing queue. */
const COURT = CURRENT_STAFF.court;

/**
 * The orders in front of this bench, newest first.
 *
 * Newest first because a signing queue is worked from what was just drawn up. The signed
 * rows are the older ones, so they sit at the foot of the list rather than being sorted
 * into a second block — one list, one order, and the status column says which is which.
 */
export const SIGN_ORDER_QUEUE: SignOrder[] = [
  {
    id: "so-606-a",
    caseNumber: "ST/606/2026",
    parties: {
      complainant: "Thangasseri Marine Stores and Ship Chandling",
      accused: "Rajesh Varma",
    },
    type: "reject-voluntary-submissions",
    status: "pending-signature",
    addedOn: "2026-08-24",
    movedBy: "accused",
  },
  {
    id: "so-606-b",
    caseNumber: "ST/606/2026",
    parties: {
      complainant: "Thangasseri Marine Stores and Ship Chandling",
      accused: "Rajesh Varma",
    },
    type: "approve-voluntary-submissions",
    status: "pending-signature",
    addedOn: "2026-08-24",
    movedBy: "complainant",
  },
  {
    id: "so-606-c",
    caseNumber: "ST/606/2026",
    parties: {
      complainant: "Thangasseri Marine Stores and Ship Chandling",
      accused: "Rajesh Varma",
    },
    type: "interim-compensation",
    status: "pending-signature",
    addedOn: "2026-08-24",
    movedBy: "complainant",
  },
  {
    id: "so-606-d",
    caseNumber: "ST/606/2026",
    parties: {
      complainant: "Thangasseri Marine Stores and Ship Chandling",
      accused: "Rajesh Varma",
    },
    type: "others",
    status: "pending-signature",
    addedOn: "2026-08-21",
    movedBy: "court",
  },
  {
    id: "so-611",
    caseNumber: "ST/611/2026",
    parties: { complainant: "Beena Sasidharan", accused: "Anwar Rasheed" },
    type: "bail",
    status: "pending-signature",
    addedOn: "2026-08-18",
    movedBy: "accused",
  },
  {
    id: "so-1014",
    caseNumber: "CMP/1014/2026",
    parties: {
      complainant: "Kannanalloor Coir Works",
      accused: "Devika Ramachandran",
    },
    type: "refer-case-to-adr",
    status: "pending-signature",
    addedOn: "2026-08-14",
    movedBy: "court",
  },
  {
    id: "so-613",
    caseNumber: "ST/613/2026",
    parties: { complainant: "Harshad Kunju", accused: "Eravipuram Cement Store" },
    type: "interim-compensation",
    status: "pending-signature",
    addedOn: "2026-08-11",
    movedBy: "complainant",
  },
  {
    id: "so-615",
    caseNumber: "ST/615/2026",
    parties: { complainant: "Latheef Muhammed", accused: "Sujatha Pillai" },
    type: "approve-voluntary-submissions",
    status: "pending-signature",
    addedOn: "2026-08-07",
    movedBy: "accused",
  },
  {
    id: "so-1019",
    caseNumber: "CMP/1019/2026",
    parties: { complainant: "Vinod Chandran", accused: "Chinnakada Traders" },
    type: "refer-case-to-adr",
    status: "pending-signature",
    addedOn: "2026-08-03",
    movedBy: "court",
  },
  {
    id: "so-618",
    caseNumber: "ST/618/2026",
    parties: { complainant: "Sreelatha Nair", accused: "Joseph Mathew" },
    type: "reject-voluntary-submissions",
    status: "pending-signature",
    addedOn: "2026-07-30",
    movedBy: "complainant",
  },
  {
    id: "so-621",
    caseNumber: "ST/621/2026",
    parties: {
      complainant: "Kottarakkara Spices and Provisions",
      accused: "Ameena Bhaskar",
    },
    type: "bail",
    status: "pending-signature",
    addedOn: "2026-07-24",
    movedBy: "accused",
  },
  {
    id: "so-624",
    caseNumber: "ST/624/2026",
    parties: { complainant: "Praveen Kuttan", accused: "Reshma Anil" },
    type: "others",
    status: "pending-signature",
    addedOn: "2026-07-20",
    movedBy: "court",
  },
  {
    id: "so-1023",
    caseNumber: "CMP/1023/2026",
    parties: { complainant: "Fathima Beevi", accused: "Sanoop Krishnan" },
    type: "refer-case-to-adr",
    status: "pending-signature",
    addedOn: "2026-07-14",
    movedBy: "court",
  },
  {
    id: "so-627",
    caseNumber: "ST/627/2026",
    parties: {
      complainant: "Ashtamudi Backwater Resorts",
      accused: "Girish Panicker",
    },
    type: "interim-compensation",
    status: "pending-signature",
    addedOn: "2026-07-08",
    movedBy: "complainant",
  },
  {
    id: "so-630",
    caseNumber: "ST/630/2026",
    parties: { complainant: "Manju Sekhar", accused: "Basheer Kunnathu" },
    type: "approve-voluntary-submissions",
    status: "pending-signature",
    addedOn: "2026-06-29",
    movedBy: "complainant",
  },
  {
    id: "so-633",
    caseNumber: "ST/633/2026",
    parties: { complainant: "Ravindran Achari", accused: "Neethu Sasi" },
    type: "bail",
    status: "pending-signature",
    addedOn: "2026-06-19",
    movedBy: "accused",
  },
  {
    id: "so-1028",
    caseNumber: "CMP/1028/2026",
    parties: {
      complainant: "Paravur Timber and Plywood",
      accused: "Shyam Gopinath",
    },
    type: "others",
    status: "pending-signature",
    addedOn: "2026-06-11",
    movedBy: "court",
  },
  {
    id: "so-636",
    caseNumber: "ST/636/2026",
    parties: { complainant: "Zainab Rahim", accused: "Prakash Unnithan" },
    type: "reject-voluntary-submissions",
    status: "pending-signature",
    addedOn: "2026-05-28",
    movedBy: "accused",
  },
  /* Already signed. They stay in the list so the status filter and the status column
     both carry information, and so the bench can find an order it signed last month
     without leaving the screen. */
  {
    id: "so-639",
    caseNumber: "ST/639/2026",
    parties: { complainant: "Suresh Balan", accused: "Anitha Vasudevan" },
    type: "approve-voluntary-submissions",
    status: "signed",
    addedOn: "2026-05-14",
    signedOn: "2026-05-18",
    movedBy: "complainant",
  },
  {
    id: "so-1031",
    caseNumber: "CMP/1031/2026",
    parties: { complainant: "Nazeer Kutty", accused: "Punalur Paper Traders" },
    type: "refer-case-to-adr",
    status: "signed",
    addedOn: "2026-05-06",
    signedOn: "2026-05-11",
    movedBy: "court",
  },
  {
    id: "so-642",
    caseNumber: "ST/642/2026",
    parties: { complainant: "Deepa Chandrasekhar", accused: "Ibrahim Sait" },
    type: "bail",
    status: "signed",
    addedOn: "2026-04-27",
    signedOn: "2026-04-29",
    movedBy: "accused",
  },
  {
    id: "so-645",
    caseNumber: "ST/645/2026",
    parties: {
      complainant: "Karunagappally Cashew Exports",
      accused: "Meenakshi Warrier",
    },
    type: "interim-compensation",
    status: "signed",
    addedOn: "2026-04-16",
    signedOn: "2026-04-21",
    movedBy: "complainant",
  },
  {
    id: "so-648",
    caseNumber: "ST/648/2026",
    parties: { complainant: "Thomas Kurien", accused: "Salma Nasar" },
    type: "reject-voluntary-submissions",
    status: "signed",
    addedOn: "2026-04-02",
    signedOn: "2026-04-06",
    movedBy: "complainant",
  },
  {
    id: "so-1035",
    caseNumber: "CMP/1035/2026",
    parties: { complainant: "Ajay Menon", accused: "Lakeside Steel and Hardware" },
    type: "others",
    status: "signed",
    addedOn: "2026-03-23",
    signedOn: "2026-03-27",
    movedBy: "court",
  },
];

/**
 * How many orders are waiting for signature — the number the rail carries beside "Sign
 * orders".
 *
 * The *pending* rows, not the length of the list: the queue holds signed orders too, and
 * a rail badge that counted them would send the bench to a screen with less work on it
 * than the number promised. Derived rather than typed in beside the label, the way
 * `SIGN_FORM_QUEUE_COUNT` and `REGISTER_QUEUE_COUNT` are.
 */
export const SIGN_ORDER_PENDING_COUNT = SIGN_ORDER_QUEUE.filter(
  (order) => order.status === "pending-signature",
).length;

export type SignOrderFilters = {
  status: SignOrderStatusId | "all";
  /** ISO day the order was added, or `""` for any day. */
  addedOn: string;
  /**
   * Free text over the cause title and the case number — the reach the reference's
   * "Case Name or Number" box names. Narrower than the sibling queues on purpose: an
   * order has no counsel of its own to search, and this queue carries no advocate column.
   */
  query: string;
};

/**
 * What the screen opens on — pending signature, any day, no search.
 *
 * Not `EMPTY_…` like the sibling queues, because it is not empty: the reference opens
 * with the status filter already set, and it is right. The bench comes to this screen to
 * clear work, not to browse orders it has already signed. Clear returns here rather than
 * to "all statuses" for the same reason.
 */
export const DEFAULT_SIGN_ORDER_FILTERS: SignOrderFilters = {
  status: "pending-signature",
  addedOn: "",
  query: "",
};

export function filterSignOrders(
  rows: SignOrder[],
  filters: SignOrderFilters,
): SignOrder[] {
  const query = caseSearchKey(filters.query);
  return rows.filter((order) => {
    if (filters.status !== "all" && order.status !== filters.status) {
      return false;
    }
    if (filters.addedOn && order.addedOn !== filters.addedOn) return false;
    if (!query) return true;
    const haystack = [
      order.parties.complainant,
      order.parties.accused,
      order.caseNumber,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

/**
 * Sign the chosen orders — the demo act behind both the bulk bar and the single-order
 * dialog.
 *
 * A pure function over the queue so the screen holds one list and no second copy of the
 * truth. It signs only what is still pending: an id that names an already-signed order,
 * or no order at all, is ignored rather than throwing — a queue that has moved on under
 * a stale selection is a real case, not an error.
 *
 * **It signs nothing.** See the module header: this moves a status and stamps a date in
 * memory. Nothing is written, published, sent or filed.
 */
export function signSelectedOrders(
  rows: SignOrder[],
  ids: ReadonlySet<string>,
  on: string,
): SignOrder[] {
  return rows.map((order) =>
    ids.has(order.id) && order.status === "pending-signature"
      ? { ...order, status: "signed", signedOn: on }
      : order,
  );
}

/** "31 Aug 2026" — the same column register every other court-side list uses. */
export function formatSignOrderDate(day: string): string {
  return formatListingDate(day);
}

const LONG_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "15 September 2026" — a date named inside the order's prose, not in a column. */
export function formatSignOrderLongDate(day: string): string {
  return LONG_DAY.format(parseIsoDay(day));
}

/** Today, as an ISO day — what a signature is stamped with. */
export function todayIsoDay(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * The order as a document: what the preview renders and what Download writes.
 *
 * Shaped like `ReschedulingDocument` and `SignFormDocument` — a court heading, the
 * cause, a title, numbered operative paragraphs and the block that signs it — so the
 * court-side facsimiles read as one product rather than three.
 */
export type SignOrderDocument = {
  court: string;
  caseNumber: string;
  matter: string;
  /** The order's own title, e.g. "Approve voluntary submissions". */
  title: string;
  paragraphs: string[];
  dated: string;
  /** The signature block: who signs, and whether they have. */
  signature: string;
};

/** How the order's opening sentence names the party who moved the court. */
function movedByPhrase(order: SignOrder): string {
  switch (order.movedBy) {
    case "complainant":
      return `the complainant, ${order.parties.complainant},`;
    case "accused":
      return `the accused, ${order.parties.accused},`;
    case "court":
      return "this court, on its own motion,";
  }
}

/**
 * What each title's order says.
 *
 * Six templates, filled from the row's own particulars. All six are demo text — see the
 * module header. They recite no sum, surety or date of payment, because the rows carry
 * none and an invented figure in a facsimile is the kind of detail that gets screenshot
 * and quoted back.
 */
function paragraphsFor(order: SignOrder): string[] {
  const moved = movedByPhrase(order);
  const { complainant, accused } = order.parties;

  switch (order.type) {
    case "approve-voluntary-submissions":
      return [
        `Documents have been produced before this court in this case as voluntary submissions by ${moved} with an application that they be received on record. The submissions have been perused and both sides have been heard on the application.`,
        "The documents bear on the matter in issue. The voluntary submissions are allowed and taken on file, copies are made available to the other side, and the case stands for hearing on the date already fixed.",
      ];
    case "reject-voluntary-submissions":
      return [
        `Documents have been produced before this court in this case as voluntary submissions by ${moved} with an application that they be received on record. The submissions have been perused and both sides have been heard on the application.`,
        "The documents do not bear on the matter in issue and no ground is made out for receiving them at this stage. The application is rejected, the papers are returned to the party that produced them, and the case stands for hearing on the date already fixed.",
      ];
    case "bail":
      return [
        `The accused, ${accused}, has appeared before this court and applied to be released on bail in this case. The complainant has been heard on the application.`,
        "The accused is released on bail on executing a bond in the sum this court has fixed, with one surety to its satisfaction, and on the condition that the accused appears on every date to which this case is adjourned and does not tamper with the evidence in it.",
      ];
    case "interim-compensation":
      return [
        `${moved.charAt(0).toUpperCase()}${moved.slice(1)} has applied for interim compensation in this case, and the other side has been heard on the application.`,
        `The accused, ${accused}, is directed to pay interim compensation to the complainant, ${complainant}, in the sum this court has fixed, within sixty days of this order, and to report the payment to this court on the next date of hearing.`,
      ];
    case "refer-case-to-adr":
      return [
        `On a reading of the papers in this case it appears to this court that there exist elements of a settlement between ${complainant} and ${accused} which the parties may find acceptable.`,
        "The case is referred to the mediation centre attached to this court. Both parties are directed to appear before the mediator on the date the centre appoints, and the centre is directed to report the result of the reference to this court.",
      ];
    case "others":
      return [
        `${moved.charAt(0).toUpperCase()}${moved.slice(1)} has moved this court in this case, and both sides have been heard.`,
        "The order recorded on the file is passed for the reasons stated in it, and the case stands for hearing on the date already fixed.",
      ];
  }
}

export function buildSignOrderDocument(order: SignOrder): SignOrderDocument {
  return {
    court: `Before the ${COURT}`,
    caseNumber: order.caseNumber,
    matter: causeTitle(order),
    title: signOrderTypeLabel(order.type),
    paragraphs: paragraphsFor(order),
    dated: formatSignOrderLongDate(order.addedOn),
    /* The signature block is the one part of the facsimile that is not the same on every
       row: an unsigned order says so plainly rather than showing an empty rule that
       could be mistaken for a signature that failed to render. */
    signature:
      order.status === "signed" && order.signedOn
        ? `Signed by the magistrate, ${COURT}, on ${formatSignOrderLongDate(order.signedOn)}.`
        : "Pending the signature of the magistrate.",
  };
}

export function signOrderDocumentText(document: SignOrderDocument): string {
  return [
    document.court,
    `Case no. ${document.caseNumber}`,
    document.matter,
    "",
    document.title,
    "",
    ...document.paragraphs.map(
      (paragraph, index) => `${index + 1}. ${paragraph}`,
    ),
    "",
    `Dated this the ${document.dated}.`,
    "",
    document.signature,
  ].join("\n");
}

export function signOrderDocumentFilename(order: SignOrder): string {
  return `${order.caseNumber.replace(/\//g, "-")}-${order.type}.txt`;
}

export function downloadSignOrderDocument(order: SignOrder): void {
  const document = buildSignOrderDocument(order);
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(signOrderDocumentText(document))], { type: "text/plain" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = signOrderDocumentFilename(voicedForDownload(order));
  anchor.click();
  URL.revokeObjectURL(url);
}
