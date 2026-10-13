/**
 * Advancement/reschedule applications waiting on the bench — the review
 * queue, as data.
 *
 * The sibling of `register-cases.ts` and `schedule.ts`: those modules are
 * complaints not yet on the register, and matters not yet given a date. This
 * one is cases already listed, where a party has asked to move the date. They
 * share the court-side vocabulary — counsel, sides, the cause title, the page
 * sizes, the listing-date format — rather than restating it. Only the citizen
 * side is off limits (see `content.ts`).
 *
 * **There is no backend.** `RESCHEDULING_QUEUE` is demo data shaped to
 * exercise what the screen has to survive: a corporate accused long enough to
 * wrap the cause title, a side with no vakalat, a request the other parties
 * have not agreed to, and a request that proposes two dates. No row is read
 * from a case, a court or a queue.
 *
 * **Approve and Reject do not write an order.** They only drop the row from
 * this demo queue. Moving the listed date is Bulk reschedule / Schedule; the
 * order composer is the place an order is drafted. This module names the
 * application and claims nothing more about what the bench's answer files.
 *
 * Numbers are `ST/…`. A listed hearing to reschedule is already on file; CMP
 * is the number *before* cognizance, and those complaints live on Register
 * cases. These rows do not overlap today's cause list, the scheduling queue,
 * or the register queue.
 */

import { CURRENT_STAFF } from "./content";
import {
  causeTitle,
  courtHearingPurposeLabel,
  formatListingDate,
  parseIsoDay,
  type CounselSide,
  type CourtCounsel,
  type CourtHearingPurposeId,
} from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

export type ReschedulingRequest = {
  id: string;
  caseNumber: string;
  parties: { complainant: string; accused: string };
  counsel: CourtCounsel[];
  /** ISO day the application reached the court. */
  appliedOn: string;
  /** ISO day the matter is currently listed. */
  listedOn: string;
  purpose: CourtHearingPurposeId;
  /** ISO days the party asked to be heard on. At least one. */
  proposedOn: string[];
  partiesAgreed: boolean;
  /** The advocate who filed, as written on the application. */
  sender: string;
  /** The party the application is filed for. */
  filedFor: CounselSide;
  /**
   * Who prepared the filing — the advocate's clerk on the reference. A role
   * attached to the sender, not a persona.
   */
  createdBy: string;
  /** The reason on the application, in the filer's words. */
  reason: string;
};

/**
 * Applications waiting for the bench to approve or reject a date change.
 *
 * Ordered newest application first — that is the scan the application-date
 * column exists for, and the order a review queue is read. Names follow the
 * fixtures the rest of the court side uses: local parties and the same bar,
 * but not the same matters as `CAUSE_LIST`, `SCHEDULING_QUEUE` or
 * `REGISTER_QUEUE`.
 */
export const RESCHEDULING_QUEUE: ReschedulingRequest[] = [
  {
    id: "rr-312",
    caseNumber: "ST/312/2026",
    parties: {
      complainant: "George Mathew",
      accused: "Kundara Metal Works Pvt Ltd",
    },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Saurabh Verma", side: "accused" },
    ],
    appliedOn: "2026-08-28",
    listedOn: "2026-09-18",
    purpose: "arguments",
    proposedOn: ["2026-10-06", "2026-10-13"],
    partiesAgreed: true,
    sender: "Adv. Nisha Thomas",
    filedFor: "complainant",
    createdBy: "Clerk to Adv. Nisha Thomas",
    reason:
      "Counsel for the complainant is already committed before another bench on the listed date.",
  },
  {
    id: "rr-311",
    caseNumber: "ST/311/2026",
    parties: { complainant: "Lathika Nair", accused: "Asramam Printers" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    appliedOn: "2026-08-26",
    listedOn: "2026-09-15",
    purpose: "evidence-of-complainant",
    proposedOn: ["2026-09-29"],
    partiesAgreed: true,
    sender: "Adv. Anitha George",
    filedFor: "complainant",
    createdBy: "Clerk to Adv. Anitha George",
    reason:
      "The complainant's witness is undergoing treatment and cannot attend on the listed date.",
  },
  {
    id: "rr-310",
    caseNumber: "ST/310/2026",
    parties: { complainant: "Abdul Kareem", accused: "Thevally Workshop" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    appliedOn: "2026-08-22",
    listedOn: "2026-09-12",
    purpose: "admission",
    proposedOn: ["2026-09-26"],
    partiesAgreed: false,
    sender: "Adv. Suresh Menon",
    filedFor: "complainant",
    createdBy: "Clerk to Adv. Suresh Menon",
    reason:
      "The complainant is out of station on the listed date and seeks a later posting.",
  },
  {
    id: "rr-309",
    caseNumber: "ST/309/2026",
    parties: {
      complainant: "Indira Devi",
      accused: "Sakthikulangara Nets",
    },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    appliedOn: "2026-08-20",
    listedOn: "2026-09-11",
    purpose: "plea",
    proposedOn: ["2026-09-25"],
    partiesAgreed: true,
    sender: "Adv. Vinod Chandran",
    filedFor: "accused",
    createdBy: "Clerk to Adv. Vinod Chandran",
    reason:
      "The accused has a medical appointment on the listed date and asks that the plea be taken a fortnight later.",
  },
  {
    id: "rr-308",
    caseNumber: "ST/308/2026",
    parties: { complainant: "Ramesh Babu", accused: "Mayyanad Tile Works" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    appliedOn: "2026-08-18",
    listedOn: "2026-09-10",
    purpose: "appearance",
    proposedOn: ["2026-09-24"],
    partiesAgreed: true,
    sender: "Adv. Anitha George",
    filedFor: "complainant",
    createdBy: "Clerk to Adv. Anitha George",
    reason:
      "Counsel is appearing in a part-heard matter in the same establishment on the listed date.",
  },
  {
    id: "rr-307",
    caseNumber: "ST/307/2026",
    parties: {
      complainant: "Sheeja",
      accused: "Kureepuzha Marine Stores",
    },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Saurabh Verma", side: "accused" },
    ],
    appliedOn: "2026-08-16",
    listedOn: "2026-09-09",
    purpose: "evidence-of-complainant",
    proposedOn: ["2026-09-23"],
    partiesAgreed: true,
    sender: "Adv. Suresh Menon",
    filedFor: "complainant",
    createdBy: "Clerk to Adv. Suresh Menon",
    reason:
      "The bank witness summoned for the listed date is not available until the week after.",
  },
  {
    id: "rr-306",
    caseNumber: "ST/306/2026",
    parties: { complainant: "Fazil Rahman", accused: "Pallimukku Cold Store" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    appliedOn: "2026-08-14",
    listedOn: "2026-09-08",
    purpose: "arguments",
    proposedOn: ["2026-09-22"],
    partiesAgreed: true,
    sender: "Adv. Nisha Thomas",
    filedFor: "complainant",
    createdBy: "Clerk to Adv. Nisha Thomas",
    reason:
      "Written arguments will not be ready by the listed date; a short posting is sought.",
  },
  {
    id: "rr-305",
    caseNumber: "ST/305/2026",
    parties: { complainant: "Omana Joseph", accused: "Eravipuram Saw Mills" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    appliedOn: "2026-08-12",
    listedOn: "2026-09-07",
    purpose: "admission",
    proposedOn: ["2026-09-21"],
    partiesAgreed: true,
    sender: "Adv. Anitha George",
    filedFor: "complainant",
    createdBy: "Clerk to Adv. Anitha George",
    reason:
      "The complainant cannot travel to the court on the listed date and proposes the following week.",
  },
  {
    id: "rr-304",
    caseNumber: "ST/304/2026",
    parties: {
      complainant: "Krishnakumar Pillai",
      accused: "Kadavoor Rubber Depot",
    },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Saurabh Verma", side: "accused" },
    ],
    appliedOn: "2026-08-10",
    listedOn: "2026-09-04",
    purpose: "plea",
    proposedOn: ["2026-09-18"],
    partiesAgreed: true,
    sender: "Adv. Saurabh Verma",
    filedFor: "accused",
    createdBy: "Clerk to Adv. Saurabh Verma",
    reason:
      "The accused is appearing in another §138 matter on the listed date and seeks that both not be called together.",
  },
  {
    id: "rr-303",
    caseNumber: "ST/303/2026",
    parties: { complainant: "Saleena Beevi", accused: "Chinnakada Textiles" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    appliedOn: "2026-08-08",
    listedOn: "2026-09-03",
    purpose: "appearance",
    proposedOn: ["2026-09-17"],
    partiesAgreed: true,
    sender: "Adv. Nisha Thomas",
    filedFor: "complainant",
    createdBy: "Clerk to Adv. Nisha Thomas",
    reason:
      "Summons on the accused was served only this week; a later appearance is sought so vakalat can be filed.",
  },
  {
    id: "rr-302",
    caseNumber: "ST/302/2026",
    parties: {
      complainant: "Biju Varghese",
      accused: "Paravur Boat Builders",
    },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    appliedOn: "2026-08-06",
    listedOn: "2026-09-02",
    purpose: "evidence-of-complainant",
    proposedOn: ["2026-09-16"],
    partiesAgreed: true,
    sender: "Adv. Anitha George",
    filedFor: "complainant",
    createdBy: "Clerk to Adv. Anitha George",
    reason:
      "The cheque and dishonour memo are with the bank for certification and will not be back in time for the listed date.",
  },
  {
    id: "rr-301",
    caseNumber: "ST/301/2026",
    parties: {
      complainant: "Remya Krishnan",
      accused: "Thankassery Ice Plant",
    },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    appliedOn: "2026-08-04",
    listedOn: "2026-09-01",
    purpose: "admission",
    proposedOn: ["2026-09-15"],
    partiesAgreed: true,
    sender: "Adv. Suresh Menon",
    filedFor: "complainant",
    createdBy: "Clerk to Adv. Suresh Menon",
    reason:
      "The complainant seeks that the matter be taken a fortnight later so both counsel can attend.",
  },
];

/**
 * How many requests are waiting — the number the rail carries beside
 * "Rescheduling request".
 *
 * Derived from the list rather than typed in beside the label, the way
 * `REGISTER_QUEUE_COUNT` is, so the rail and the screen cannot disagree
 * about the size of the queue.
 */
export const RESCHEDULING_QUEUE_COUNT = RESCHEDULING_QUEUE.length;

export const APPLICATION_TYPE_LABEL = "Advancement/reschedule";

export type ReschedulingFilters = {
  /**
   * Free text over the cause title, the case number and counsel — the same
   * reach the scheduling queue uses. The reference labelled the box "Case
   * Name or No, Advocate".
   */
  query: string;
};

export const EMPTY_RESCHEDULING_FILTERS: ReschedulingFilters = { query: "" };

export function filterReschedulingRequests(
  rows: ReschedulingRequest[],
  filters: ReschedulingFilters,
): ReschedulingRequest[] {
  const query = caseSearchKey(filters.query);
  if (!query) return rows;
  return rows.filter((entry) => {
    const haystack = [
      entry.parties.complainant,
      entry.parties.accused,
      entry.caseNumber,
      ...entry.counsel.map((counsel) => counsel.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

/** Compact column date — the same register the cause list already uses. */
export function formatRequestDate(day: string): string {
  return formatListingDate(day);
}

const LONG_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "5 March 2026" — a date named in the review facts, not in a column. */
export function formatRequestLongDate(day: string): string {
  return LONG_DAY.format(parseIsoDay(day));
}

export function formatProposedDates(days: string[]): string {
  return days.map(formatRequestLongDate).join(", ");
}

export function consentLabel(agreed: boolean): string {
  return agreed ? "Yes" : "No";
}

export function filedForName(request: ReschedulingRequest): string {
  return request.filedFor === "complainant"
    ? request.parties.complainant
    : request.parties.accused;
}

/** "Adv. X on behalf of Y" — the sender line the reference showed. */
export function senderLine(request: ReschedulingRequest): string {
  return `${request.sender} on behalf of ${filedForName(request)}`;
}

export type ReschedulingDocument = {
  court: string;
  caseNumber: string;
  matter: string;
  title: string;
  filedFor: string;
  facts: { term: string; value: string }[];
  paragraphs: string[];
  prayer: string;
  dated: string;
};

/**
 * The application as a court-form document, composed from this request.
 *
 * Structure mirrors the advocate-side generated application: court heading,
 * case number, cause title, a facts table, numbered operative paragraphs and
 * a prayer. Restated here so the employee area does not read `lib/cases`.
 */
export function buildReschedulingDocument(
  request: ReschedulingRequest,
): ReschedulingDocument {
  const filedFor = filedForName(request);
  const facts: { term: string; value: string }[] = [
    { term: "Complainant", value: request.parties.complainant },
    { term: "Accused", value: request.parties.accused },
  ];
  const complainantCounsel = request.counsel
    .filter((counsel) => counsel.side === "complainant")
    .map((counsel) => counsel.name);
  if (complainantCounsel.length) {
    facts.push({
      term: "Complainant counsel",
      value: complainantCounsel.join(", "),
    });
  }
  const accusedCounsel = request.counsel
    .filter((counsel) => counsel.side === "accused")
    .map((counsel) => counsel.name);
  if (accusedCounsel.length) {
    facts.push({
      term: "Accused counsel",
      value: accusedCounsel.join(", "),
    });
  }
  facts.push({
    term: "Offence",
    value: "S. 138 of the Negotiable Instruments Act, 1881",
  });

  const paragraphs = [
    `This case is listed before this court on ${formatRequestLongDate(
      request.listedOn,
    )} for ${courtHearingPurposeLabel(request.purpose).toLowerCase()}.`,
    `The applicant seeks a change of the hearing date for the following reason: ${request.reason}`,
    `The party is available to attend on ${formatProposedDates(
      request.proposedOn,
    )}.`,
    request.partiesAgreed
      ? "The other parties in the case have agreed to the proposed dates."
      : "The other parties in the case have not yet agreed to the proposed dates.",
  ];

  return {
    court: `Before the ${CURRENT_STAFF.court}`,
    caseNumber: request.caseNumber,
    matter: causeTitle(request),
    title: "Application for advancement or rescheduling of hearing",
    filedFor,
    facts,
    paragraphs,
    prayer:
      "It is therefore prayed that this court may advance or reschedule the hearing of this case to one of the dates proposed above.",
    dated: formatRequestLongDate(request.appliedOn),
  };
}

export function reschedulingDocumentText(
  document: ReschedulingDocument,
): string {
  return [
    document.court,
    `Case no. ${document.caseNumber}`,
    document.matter,
    "",
    document.title,
    "",
    ...document.facts.map((fact) => `${fact.term}: ${fact.value}`),
    "",
    ...document.paragraphs.map(
      (paragraph, index) => `${index + 1}. ${paragraph}`,
    ),
    "",
    `Prayer: ${document.prayer}`,
    "",
    `Filed for ${document.filedFor}`,
    `Dated ${document.dated}`,
  ].join("\n");
}

export function reschedulingDocumentFilename(
  request: ReschedulingRequest,
): string {
  return `${request.caseNumber.replace(/\//g, "-")}-advancement-reschedule.txt`;
}

export function downloadReschedulingDocument(
  request: ReschedulingRequest,
): void {
  const document = buildReschedulingDocument(request);
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(reschedulingDocumentText(document))], { type: "text/plain" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = reschedulingDocumentFilename(voicedForDownload(request));
  anchor.click();
  URL.revokeObjectURL(url);
}
