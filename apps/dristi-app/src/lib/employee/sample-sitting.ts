/**
 * The progress today's sitting opens on — the one place each store below takes its
 * opening slice from, so the demo day can be filled or emptied in one edit.
 *
 Two seeds, chosen in Court settings → Demo data (`demo-seed.ts`; owner, 2026-10-15):
 *
 * - **Orders in every state** (the default) — twelve matters already heard, three orders
 *   in each of Pending orders' stages:
 *   - Drafting — items 8, 9 and 12: typed, not yet sent for signing.
 *   - Awaiting signature — items 1, 4 and 6: sent for signing, next hearing posted,
 *     attendance marked.
 *   - Order data to fill — items 5, 7 and 11: signed, the steno's order data
 *     (attendance, and for item 11 the next hearing) still to complete.
 *   - Triggered — items 2, 3 and 10: signed and order data complete.
 *   Everything else on the list opens scheduled.
 * - **Empty day** — no hearing started and no order drafted (the untouched day of
 *   2026-10-13).
 *
 * Opening values only: a browser that has saved its own sitting keeps it until the seed
 * is switched or the sandbox reset. Nothing here is a court record — it is the same demo
 * bargain as the stores it seeds.
 */

import type { HearingSession } from "./hearing-session";
import type { OrderDraft } from "./order-draft";
import type { OrderSigningStatus } from "./order-signing";
import type { PendingOrder, PendingOrderStage } from "./pending-orders";

type SampleOrder = {
  id: string;
  heading: string;
  caseNumber: string;
  origin: string;
  stage: PendingOrderStage;
  /** The order's words, one paragraph per entry. */
  text: string[];
  marks: OrderDraft["marks"];
  posting?: { nextDate: string; nextPurpose: OrderDraft["nextPurpose"] };
  /**
   * Typed as a regular order where the state offers another type (`order-type.ts`), so a
   * Gujarat demo has a regular order's Roznama to sign. Kerala ignores it.
   */
  regular?: {
    companion?: string;
    /** Order data marked complete while the order still awaits its signature. */
    dataComplete?: boolean;
  };
};

const ORDERS: SampleOrder[] = [
  {
    id: "h-249",
    heading: "Shubhreet Singh v. Gill Steel Fabricators",
    caseNumber: "ST/249/2026",
    origin: "Hearing · Appearance",
    stage: "drafting",
    text: [
      "Complainant present. Accused present with counsel.",
      "Accused appeared on summons. Counsel for the accused filed vakalat. Accused to execute bond.",
    ],
    marks: {
      complainant: "present",
      accused: "present",
      "accused-counsel": "present",
    },
    posting: { nextDate: "2026-10-28", nextPurpose: "plea" },
  },
  {
    id: "h-250",
    regular: {},
    heading: "Fathima Beevi v. Nithin Jose",
    caseNumber: "ST/250/2026",
    origin: "Hearing · Evidence of complainant",
    stage: "drafting",
    text: [
      "Complainant present with counsel. Accused present.",
      "PW1 examined in chief. Exhibits P1 to P4 marked.",
    ],
    marks: {},
  },
  {
    id: "h-253",
    heading: "Abdul Salam v. Riverside Constructions",
    caseNumber: "ST/253/2026",
    origin: "Hearing · Examination of accused under S. 351 BNSS",
    stage: "drafting",
    text: ["Accused examined under Section 351 BNSS. Accused denies the incriminating circumstances."],
    marks: {},
  },
  {
    id: "h-243",
    heading: "Meenakshi Nair v. Coastal Agro Exports Pvt Ltd",
    caseNumber: "ST/243/2026",
    origin: "Hearing · Admission",
    stage: "triggered",
    text: [
      "Complainant present with counsel.",
      "Complaint admitted. Issue summons to the accused.",
    ],
    marks: { complainant: "present", "complainant-counsel": "present" },
    posting: { nextDate: "2026-11-04", nextPurpose: "appearance" },
  },
  {
    id: "h-244",
    regular: {
      companion:
        "Heard the complainant. Accused absent. Bailable warrant issued; next on 3 November 2026.",
    },
    heading: "Kiran Mathew v. Harbour Line Shipping",
    caseNumber: "ST/244/2026",
    origin: "Hearing · Appearance",
    stage: "triggered",
    text: [
      "Complainant present. Accused absent despite service of summons.",
      "Issue bailable warrant against the accused.",
    ],
    marks: {
      complainant: "present",
      "complainant-counsel": "present",
      accused: "absent",
    },
    posting: { nextDate: "2026-11-06", nextPurpose: "appearance" },
  },
  {
    id: "h-251",
    regular: {},
    heading: "Ganesh Iyer v. Backwater Marine Logistics and Warehousing Company Pvt Ltd",
    caseNumber: "ST/251/2026",
    origin: "Hearing · For reports (to be received from forensics, ADR, etc)",
    stage: "triggered",
    text: [
      "Both sides present.",
      "Report from the mediation centre awaited. Call for the report.",
    ],
    marks: {
      complainant: "present",
      "complainant-counsel": "present",
      accused: "present",
      "accused-counsel": "present",
    },
    posting: { nextDate: "2026-11-10", nextPurpose: "for-reports" },
  },
  {
    id: "h-241",
    heading: "Sunil Varghese v. Anand Traders",
    caseNumber: "ST/241/2026",
    origin: "Hearing · Evidence of complainant",
    stage: "awaiting-signature",
    text: [
      "Complainant present. Counsel for the complainant present. Accused present with counsel.",
      "Chief examination of PW1 completed. Exhibits P1 to P6 marked. Cross-examination deferred at the request of the counsel for the accused.",
      "Call on the next date for cross-examination of PW1.",
    ],
    marks: {
      complainant: "present",
      "complainant-counsel": "present",
      accused: "present",
      "accused-counsel": "present",
    },
    posting: { nextDate: "2026-10-29", nextPurpose: "evidence-of-complainant" },
  },
  {
    id: "h-245",
    regular: { dataComplete: true },
    heading: "Rajeev Menon v. Ferns Interiors",
    caseNumber: "ST/245/2026",
    origin: "Hearing · Delay condonation",
    stage: "awaiting-signature",
    text: [
      "Complainant present with counsel. Accused absent; counsel for the accused present.",
      "Heard on the petition to condone delay. Objection filed by the accused. For orders on the petition.",
    ],
    marks: {
      complainant: "present",
      "complainant-counsel": "present",
      accused: "absent",
      "accused-counsel": "present",
    },
    posting: { nextDate: "2026-10-22", nextPurpose: "delay-condonation" },
  },
  {
    id: "h-247",
    heading: "Thomas Kurian v. Highland Rubber Works",
    caseNumber: "ST/247/2026",
    origin: "Hearing · Cognizance",
    stage: "awaiting-signature",
    text: [
      "Complainant present with counsel.",
      "Sworn statement of the complainant recorded. Cognizance taken. Issue summons to the accused.",
    ],
    marks: { complainant: "present", "complainant-counsel": "present" },
    posting: { nextDate: "2026-11-05", nextPurpose: "appearance" },
  },
  {
    id: "h-246",
    heading: "Ayesha Rahman v. Sreekumar P",
    caseNumber: "ST/246/2026",
    origin: "Hearing · Admission",
    stage: "workflow-to-fill",
    text: [
      "Complainant present. Accused present.",
      "Accused admits the issuance of the cheque. Particulars of the offence read over and explained. Accused pleads not guilty.",
    ],
    marks: {},
    posting: { nextDate: "2026-10-30", nextPurpose: "evidence-of-complainant" },
  },
  {
    id: "h-248",
    heading: "Deepa Suresh v. Vasanth Kumar S",
    caseNumber: "ST/248/2026",
    origin: "Hearing · Plea",
    stage: "workflow-to-fill",
    text: [
      "Complainant present. Accused absent. Counsel for the accused filed a petition to excuse the absence of the accused.",
      "Petition allowed. Plea of the accused to be recorded on the next date.",
    ],
    marks: {},
    posting: { nextDate: "2026-11-03", nextPurpose: "plea" },
  },
  {
    id: "h-252",
    heading: "Lakshmi Prasad v. Zenith Auto Spares",
    caseNumber: "ST/252/2026",
    origin: "Hearing · Admission",
    stage: "workflow-to-fill",
    text: [
      "Complainant present with counsel. Accused not appeared despite service of summons.",
      "Issue bailable warrant against the accused.",
    ],
    marks: {},
  },
];

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type SittingSeed = {
  session: HearingSession;
  signing: Readonly<Record<string, OrderSigningStatus>>;
  drafts: Readonly<Record<string, OrderDraft>>;
  pending: Readonly<Record<string, PendingOrder>>;
};

function seedFrom(orders: readonly SampleOrder[]): SittingSeed {
  return {
    session: {
      day: null,
      previous: null,
      ongoingIds: new Set(),
      endedIds: new Set(orders.map((order) => order.id)),
      passedOverIds: new Set(),
      postings: Object.fromEntries(
        orders.flatMap((order) =>
          order.posting
            ? [[order.id, { next: "list" as const, ...order.posting }]]
            : [],
        ),
      ),
    },
    /* Sent for signing marks the order ready; the magistrate's signature marks it
       signed. A draft has no entry. */
    signing: Object.fromEntries(
      orders.flatMap((order): [string, OrderSigningStatus][] =>
        order.stage === "drafting"
          ? []
          : [[order.id, order.stage === "awaiting-signature" ? "ready" : "signed"]],
      ),
    ),
    /* Each order's draft on screen E, under E's own key (`editorDraftKey`). */
    drafts: Object.fromEntries(
      orders.map((order) => [
        `editor:${order.id}`,
        {
          marks: order.marks,
          applications: {},
          next: "list",
          nextPurpose: order.posting?.nextPurpose ?? "",
          nextDate: order.posting?.nextDate ?? null,
          blocks: [],
          links: [],
          body: {
            html: order.text.map((line) => `<p>${escapeHtml(line)}</p>`).join(""),
            text: order.text.join("\n"),
          },
          ...(order.regular
            ? {
                orderType: "regular" as const,
                ...(order.regular.companion
                  ? { aDiarySame: false, aDiaryText: order.regular.companion }
                  : {}),
              }
            : {}),
        } satisfies OrderDraft,
      ]),
    ),
    /* What Pending orders lists for them. */
    pending: Object.fromEntries(
      orders.map((order) => [
        order.id,
        {
          key: order.id,
          heading: order.heading,
          caseNumber: order.caseNumber,
          origin: order.origin,
          orderHref: `/employee/hearings/${order.id}/order`,
          sent: order.stage !== "drafting",
          workflowComplete:
            order.stage === "triggered" || Boolean(order.regular?.dataComplete),
        },
      ]),
    ),
  };
}

export type DemoSeed = "orders" | "empty";

export const SITTING_SEEDS: Record<DemoSeed, SittingSeed> = {
  orders: seedFrom(ORDERS),
  empty: seedFrom([]),
};

/** What a fresh browser opens on. */
export const SAMPLE_SESSION = SITTING_SEEDS.orders.session;
export const SAMPLE_SIGNING = SITTING_SEEDS.orders.signing;
export const SAMPLE_DRAFTS = SITTING_SEEDS.orders.drafts;
export const SAMPLE_PENDING_ORDERS = SITTING_SEEDS.orders.pending;
