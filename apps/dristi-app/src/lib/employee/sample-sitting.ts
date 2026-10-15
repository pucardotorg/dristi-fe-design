/**
 * The progress today's sitting opens on — the one place each store below takes its
 * opening slice from, so the demo day can be filled or emptied in one edit.
 *
 * **Six matters already heard, with their orders under way** (owner, 2026-10-15: three
 * awaiting signature and three with order data to fill, so Pending orders opens with
 * something in both). Everything else on the list opens scheduled. This replaces the
 * untouched day of 2026-10-13.
 *
 * - Awaiting signature — items 1, 4 and 6: typed by the steno, sent for signing, next
 *   hearing posted, attendance marked.
 * - Order data to fill — items 5, 7 and 11: signed by the magistrate, with the steno's
 *   order data (attendance, and for item 11 the next hearing) still to complete.
 *
 * Opening values only: a browser that has saved its own sitting keeps it until Reset
 * sandbox data. Nothing here is a court record — it is the same demo bargain as the
 * stores it seeds.
 */

import type { HearingSession } from "./hearing-session";
import type { OrderDraft } from "./order-draft";
import type { OrderSigningStatus } from "./order-signing";
import type { PendingOrder } from "./pending-orders";

type SampleOrder = {
  id: string;
  heading: string;
  caseNumber: string;
  origin: string;
  stage: "awaiting-signature" | "workflow-to-fill";
  /** The order's words, one paragraph per entry. */
  text: string[];
  marks: OrderDraft["marks"];
  posting?: { nextDate: string; nextPurpose: OrderDraft["nextPurpose"] };
};

const ORDERS: SampleOrder[] = [
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

export const SAMPLE_SESSION: HearingSession = {
  ongoingId: null,
  endedIds: new Set(ORDERS.map((order) => order.id)),
  passedOverIds: new Set(),
  postings: Object.fromEntries(
    ORDERS.flatMap((order) =>
      order.posting ? [[order.id, { next: "list" as const, ...order.posting }]] : [],
    ),
  ),
};

/** Sent for signing marks the order ready; the magistrate's signature marks it signed. */
export const SAMPLE_SIGNING: Readonly<Record<string, OrderSigningStatus>> =
  Object.fromEntries(
    ORDERS.map((order) => [
      order.id,
      order.stage === "awaiting-signature" ? "ready" : "signed",
    ]),
  );

/** Each order's draft on screen E, under E's own key (`editorDraftKey`). */
export const SAMPLE_DRAFTS: Readonly<Record<string, OrderDraft>> = Object.fromEntries(
  ORDERS.map((order) => [
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
    } satisfies OrderDraft,
  ]),
);

/** What Pending orders lists for them. */
export const SAMPLE_PENDING_ORDERS: Readonly<Record<string, PendingOrder>> =
  Object.fromEntries(
    ORDERS.map((order) => [
      order.id,
      {
        key: order.id,
        heading: order.heading,
        caseNumber: order.caseNumber,
        origin: order.origin,
        orderHref: `/employee/hearings/${order.id}/order`,
        sent: true,
        workflowComplete: false,
      },
    ]),
  );
