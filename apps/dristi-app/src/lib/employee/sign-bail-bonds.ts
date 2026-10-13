/**
 * Bail bonds waiting on this bench's signature — the signing queue for bonds, as data.
 *
 * The third sibling of `sign-forms.ts` and `sign-orders.ts`, one row below them in the
 * same rail group. A form is a court paper drawn up for a party to swear; an order is
 * the court's own decision; a bail bond is the undertaking an accused executes, with a
 * surety, to appear on every date this case is adjourned to. It is not a bond until the
 * magistrate signs it. So this queue is shaped like the other two — the same court-side
 * vocabulary, the same page sizes, the same demo-data honesty — and differs in the two
 * facts the reference screens add.
 *
 * **The litigant is the row.** Every other court-side queue is one row per case. This one
 * is not: a case with two accused carries two bonds, one per accused, and the only thing
 * telling those rows apart is who executed each one. That is why the reference gives this
 * queue a Litigant column and no status column, and why `ST/822/2026` appears twice
 * below.
 *
 * **The bench's only filter is the case.** The reference puts one control on this screen
 * — "Case Name or Number" — and no status, date or type filter. So `SignBailBondFilters`
 * holds one field, and a bond leaves the queue when it is signed or rejected rather than
 * staying behind a status the screen has no control to reach.
 *
 * **There is no backend and nothing here is signed, published or filed.** Neither the
 * bulk path nor the single-bond path applies a signature, publishes anything, calls an
 * e-sign provider, writes a document or notifies anyone. `signSelectedBailBonds` and
 * `rejectBailBond` do exactly one thing each: move a row's status in this demo queue, the
 * way Approve and Reject already do on the rescheduling queue. The confirmation copy
 * describes what signing *means* so the control is not misread; the build performs none
 * of it.
 *
 * **The bond wording is demo text, not a court-approved bail bond form.** `docs/product/`
 * defines no §138 bond template, and this module invents no statutory citation, no form
 * number and no rule. What it does carry, unlike `sign-orders.ts`, is a **sum**: a bail
 * bond whose whole substance is the amount bound cannot recite "the sum this court has
 * fixed" and still read as a bond, so each row carries a demo figure as data and the
 * facsimile prints the row's own. Those figures are invented for this screen and mean
 * nothing. Same for the sureties and the dates of appearance.
 *
 * `SIGN_BAIL_BOND_QUEUE` is demo data shaped to exercise what the screen has to survive:
 * one case carrying two bonds under different accused (the reference's own case, and the
 * reason Litigant is a column), corporate complainants long enough to wrap a cell, both
 * `ST/…` and `CMP/…` numbers, and enough rows to page at 10, 20 and 30. These rows do not
 * overlap today's cause list, the scheduling queue, the register queue, the rescheduling
 * queue, the other-applications queue or the signing queues for forms and orders.
 */

import { CURRENT_STAFF } from "./content";
import { causeTitle, formatListingDate, isoDay, parseIsoDay } from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";
import { localizeForDownload, voicedForDownload } from "@/lib/court/browser";

/**
 * Whether the signature is on it yet.
 *
 * Three states rather than the two `sign-orders.ts` names, because this queue has two
 * ways out. The reference's preview offers Reject beside Proceed to sign, so a bond can
 * leave the bench without a signature — and a row that left needs to say which way it
 * went, or `signSelectedBailBonds` cannot tell a rejected bond from one it has already
 * signed.
 *
 * None of the three is a column. The screen lists what is pending; signing or rejecting
 * drops the row. See the module header.
 */
export type SignBailBondStatus = "pending-signature" | "signed" | "rejected";

/**
 * Who stands surety, and how they know the accused.
 *
 * A bond needs a surety to be a bond, and the facsimile has to name one — so the row
 * carries them rather than the template inventing one per render. Demo people; see the
 * module header.
 */
export type SignBailBondSurety = { name: string; relationship: string };

export type SignBailBond = {
  id: string;
  caseNumber: string;
  parties: { complainant: string; accused: string };
  /**
   * The party bound by this bond — the reference's "Litigant" column.
   *
   * Always one of the accused: in a §138 case it is the accused who is admitted to bail
   * and executes the bond. Where a case has more than one accused, `parties.accused`
   * reads "… and 1 other" and each accused has their own row and their own bond.
   */
  litigant: string;
  surety: SignBailBondSurety;
  /** The sum bound, in rupees. A demo figure — see the module header. */
  bondAmount: number;
  status: SignBailBondStatus;
  /** ISO day the bond was drawn up and added to this queue. */
  addedOn: string;
  /** ISO day of the hearing the bond binds the litigant to attend. */
  appearsOn: string;
  /** ISO day the signature went on. Present only on a signed row. */
  signedOn?: string;
};

/** The court whose bonds these are. One bench, one signing queue. */
const COURT = CURRENT_STAFF.court;

/**
 * The bonds in front of this bench, newest first.
 *
 * Newest first because a signing queue is worked from what was just drawn up — the same
 * order the two sibling queues use.
 */
export const SIGN_BAIL_BOND_QUEUE: SignBailBond[] = [
  {
    id: "bb-804",
    caseNumber: "ST/804/2026",
    parties: {
      complainant: "Punalur Rubber and Latex Traders",
      accused: "Salim Muhammed Kunju",
    },
    litigant: "Salim Muhammed Kunju",
    surety: { name: "Nazeer Muhammed Kunju", relationship: "elder brother" },
    bondAmount: 50000,
    status: "pending-signature",
    addedOn: "2026-09-02",
    appearsOn: "2026-09-24",
  },
  {
    id: "bb-809",
    caseNumber: "ST/809/2026",
    parties: {
      complainant: "Karunagappally Cashew Exporters Private Limited",
      accused: "Ajitha Chandrasekharan",
    },
    litigant: "Ajitha Chandrasekharan",
    surety: { name: "Chandrasekharan Nair", relationship: "father" },
    bondAmount: 75000,
    status: "pending-signature",
    addedOn: "2026-09-01",
    appearsOn: "2026-09-29",
  },
  {
    id: "bb-2204",
    caseNumber: "CMP/2204/2026",
    parties: {
      complainant: "Kundara Ceramics Agency",
      accused: "Bindu Vijayakumar",
    },
    litigant: "Bindu Vijayakumar",
    surety: { name: "Vijayakumar Pillai", relationship: "spouse" },
    bondAmount: 25000,
    status: "pending-signature",
    addedOn: "2026-08-28",
    appearsOn: "2026-09-17",
  },
  /* The reference's own case, and the reason Litigant is a column: one case, two accused,
     two bonds. Both rows carry the same cause title and the same number, and only the
     litigant tells them apart. */
  {
    id: "bb-822-a",
    caseNumber: "ST/822/2026",
    parties: {
      complainant: "Chavara Beach Hotels and Catering Services",
      accused: "Anil Kumar Pillai and 1 other",
    },
    litigant: "Anil Kumar Pillai",
    surety: { name: "Sreekumar Pillai", relationship: "uncle" },
    bondAmount: 100000,
    status: "pending-signature",
    addedOn: "2026-08-26",
    appearsOn: "2026-10-06",
  },
  {
    id: "bb-822-b",
    caseNumber: "ST/822/2026",
    parties: {
      complainant: "Chavara Beach Hotels and Catering Services",
      accused: "Anil Kumar Pillai and 1 other",
    },
    litigant: "Jayasree Gopalakrishnan",
    surety: { name: "Gopalakrishnan Achari", relationship: "father" },
    bondAmount: 100000,
    status: "pending-signature",
    addedOn: "2026-08-26",
    appearsOn: "2026-10-06",
  },
  {
    id: "bb-815",
    caseNumber: "ST/815/2026",
    parties: {
      complainant: "Anchalummoodu Hardware and Sanitary Mart",
      accused: "Noushad Pareed",
    },
    litigant: "Noushad Pareed",
    surety: { name: "Shajahan Pareed", relationship: "brother" },
    bondAmount: 40000,
    status: "pending-signature",
    addedOn: "2026-08-24",
    appearsOn: "2026-09-22",
  },
  {
    id: "bb-818",
    caseNumber: "ST/818/2026",
    parties: { complainant: "Perinad Rice Mill", accused: "Remya Prakash" },
    litigant: "Remya Prakash",
    surety: { name: "Prakash Kumar", relationship: "spouse" },
    bondAmount: 30000,
    status: "pending-signature",
    addedOn: "2026-08-21",
    appearsOn: "2026-09-15",
  },
  {
    id: "bb-827",
    caseNumber: "ST/827/2026",
    parties: {
      complainant: "Sasthamcotta Lake Fisheries Co-operative Society",
      accused: "Thomas Chacko",
    },
    litigant: "Thomas Chacko",
    surety: { name: "Mariamma Chacko", relationship: "mother" },
    bondAmount: 60000,
    status: "pending-signature",
    addedOn: "2026-08-19",
    appearsOn: "2026-10-13",
  },
  {
    id: "bb-2211",
    caseNumber: "CMP/2211/2026",
    parties: {
      complainant: "Mayyanad Poultry Farm",
      accused: "Sabitha Raveendran",
    },
    litigant: "Sabitha Raveendran",
    surety: { name: "Raveendran Pillai", relationship: "father-in-law" },
    bondAmount: 25000,
    status: "pending-signature",
    addedOn: "2026-08-17",
    appearsOn: "2026-09-19",
  },
  {
    id: "bb-831",
    caseNumber: "ST/831/2026",
    parties: {
      complainant: "Kadappakkada Auto Spares",
      accused: "Firoz Khan Aliyar",
    },
    litigant: "Firoz Khan Aliyar",
    surety: { name: "Aliyar Kunju", relationship: "father" },
    bondAmount: 50000,
    status: "pending-signature",
    addedOn: "2026-08-14",
    appearsOn: "2026-09-26",
  },
  {
    id: "bb-836",
    caseNumber: "ST/836/2026",
    parties: {
      complainant: "Ezhukone Fertilisers and Seeds",
      accused: "Deepthi Mohanan",
    },
    litigant: "Deepthi Mohanan",
    surety: { name: "Mohanan Kesavan", relationship: "father" },
    bondAmount: 35000,
    status: "pending-signature",
    addedOn: "2026-08-12",
    appearsOn: "2026-10-01",
  },
  {
    id: "bb-2218",
    caseNumber: "CMP/2218/2026",
    parties: {
      complainant: "Oachira Handloom Weavers",
      accused: "Vargheese Kuriakose",
    },
    litigant: "Vargheese Kuriakose",
    surety: { name: "Kuriakose Vargheese", relationship: "brother" },
    bondAmount: 45000,
    status: "pending-signature",
    addedOn: "2026-08-10",
    appearsOn: "2026-09-30",
  },
  {
    id: "bb-840",
    caseNumber: "ST/840/2026",
    parties: {
      complainant: "Kilikollur Steel Fabricators",
      accused: "Nisha Balachandran",
    },
    litigant: "Nisha Balachandran",
    surety: { name: "Balachandran Nair", relationship: "father" },
    bondAmount: 150000,
    status: "pending-signature",
    addedOn: "2026-08-07",
    appearsOn: "2026-10-20",
  },
  {
    id: "bb-845",
    caseNumber: "ST/845/2026",
    parties: {
      complainant: "Thevally Marine Exports and Cold Storage",
      accused: "Prasanth Kumar Nadar",
    },
    litigant: "Prasanth Kumar Nadar",
    surety: { name: "Selvaraj Nadar", relationship: "uncle" },
    bondAmount: 80000,
    status: "pending-signature",
    addedOn: "2026-08-05",
    appearsOn: "2026-10-08",
  },
  {
    id: "bb-2225",
    caseNumber: "CMP/2225/2026",
    parties: {
      complainant: "Kottiyam Medical Distributors",
      accused: "Suhara Beevi Ismail",
    },
    litigant: "Suhara Beevi Ismail",
    surety: { name: "Ismail Rawther", relationship: "spouse" },
    bondAmount: 30000,
    status: "pending-signature",
    addedOn: "2026-08-03",
    appearsOn: "2026-09-18",
  },
  {
    id: "bb-849",
    caseNumber: "ST/849/2026",
    parties: {
      complainant: "Kilikollur Steel Fabricators",
      accused: "Rafeeq Muhammed Rawther",
    },
    litigant: "Rafeeq Muhammed Rawther",
    surety: { name: "Hamsa Rawther", relationship: "brother" },
    bondAmount: 55000,
    status: "pending-signature",
    addedOn: "2026-07-31",
    appearsOn: "2026-10-15",
  },
  {
    id: "bb-854",
    caseNumber: "ST/854/2026",
    parties: {
      complainant: "Neendakara Boat Builders",
      accused: "Lekha Sudhakaran",
    },
    litigant: "Lekha Sudhakaran",
    surety: { name: "Sudhakaran Pillai", relationship: "father" },
    bondAmount: 40000,
    status: "pending-signature",
    addedOn: "2026-07-29",
    appearsOn: "2026-10-22",
  },
  {
    id: "bb-2232",
    caseNumber: "CMP/2232/2026",
    parties: {
      complainant: "Chinnakada Gold and Diamonds",
      accused: "Biju Chellappan",
    },
    litigant: "Biju Chellappan",
    surety: { name: "Chellappan Pillai", relationship: "father" },
    bondAmount: 65000,
    status: "pending-signature",
    addedOn: "2026-07-27",
    appearsOn: "2026-09-23",
  },
  {
    id: "bb-858",
    caseNumber: "ST/858/2026",
    parties: {
      complainant: "Pallithottam Fish Meal and Oil Company",
      accused: "Shameem Abdul Latheef",
    },
    litigant: "Shameem Abdul Latheef",
    surety: { name: "Abdul Latheef Kunju", relationship: "father" },
    bondAmount: 70000,
    status: "pending-signature",
    addedOn: "2026-07-24",
    appearsOn: "2026-10-27",
  },
  {
    id: "bb-862",
    caseNumber: "ST/862/2026",
    parties: {
      complainant: "Ashramam Convention Centre",
      accused: "Geetha Kumari Amma",
    },
    litigant: "Geetha Kumari Amma",
    surety: { name: "Sasidharan Pillai", relationship: "brother" },
    bondAmount: 25000,
    status: "pending-signature",
    addedOn: "2026-07-22",
    appearsOn: "2026-10-29",
  },
  {
    id: "bb-2239",
    caseNumber: "CMP/2239/2026",
    parties: {
      complainant: "Kilikollur Steel Fabricators",
      accused: "Mahesh Radhakrishnan",
    },
    litigant: "Mahesh Radhakrishnan",
    surety: { name: "Radhakrishnan Achari", relationship: "father" },
    bondAmount: 45000,
    status: "pending-signature",
    addedOn: "2026-07-20",
    appearsOn: "2026-09-21",
  },
  {
    id: "bb-867",
    caseNumber: "ST/867/2026",
    parties: {
      complainant: "Kureepuzha Poultry and Feeds",
      accused: "Zainaba Muhammed Haneefa",
    },
    litigant: "Zainaba Muhammed Haneefa",
    surety: { name: "Muhammed Haneefa", relationship: "spouse" },
    bondAmount: 35000,
    status: "pending-signature",
    addedOn: "2026-07-15",
    appearsOn: "2026-11-03",
  },
];

/**
 * How many bonds are waiting for signature — the number the rail carries beside "Sign
 * bail bonds".
 *
 * The *pending* rows, not the length of the list, so the rail cannot send the bench to a
 * screen with less work on it than the badge promised. Derived rather than typed in
 * beside the label, the way `SIGN_FORM_QUEUE_COUNT` and `REGISTER_QUEUE_COUNT` are.
 */
export const SIGN_BAIL_BOND_QUEUE_COUNT = SIGN_BAIL_BOND_QUEUE.filter(
  (bond) => bond.status === "pending-signature",
).length;

/**
 * What the bench can narrow this queue by: the case, and nothing else.
 *
 * One field, because the reference puts one control on this screen. The reach is the
 * cause title, the case number and the litigant — the three things the table shows, so
 * a bench that can see a row can find it again by typing any part of it. The litigant is
 * in the reach even though the reference's label names only the case: with two bonds to
 * a case, a search that could not reach the litigant could not find one of them.
 */
export type SignBailBondFilters = { query: string };

export const EMPTY_SIGN_BAIL_BOND_FILTERS: SignBailBondFilters = { query: "" };

/**
 * The bonds this screen lists: pending signature, matching the search.
 *
 * Pending is not a filter the bench sets — it is what the queue *is*. A signed or
 * rejected bond has left the bench, and this screen has no control that could bring it
 * back into view, so it is dropped here rather than hidden behind a status the reference
 * does not draw.
 */
export function filterSignBailBonds(
  rows: SignBailBond[],
  filters: SignBailBondFilters,
): SignBailBond[] {
  const query = caseSearchKey(filters.query);
  return rows.filter((bond) => {
    if (bond.status !== "pending-signature") return false;
    if (!query) return true;
    const haystack = [
      bond.parties.complainant,
      bond.parties.accused,
      bond.caseNumber,
      bond.litigant,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

/**
 * Sign the chosen bonds — the demo act behind both the sticky bar and the preview's
 * Proceed to sign.
 *
 * A pure function over the queue so the screen holds one list and no second copy of the
 * truth. It signs only what is still pending: an id naming a bond that has since been
 * signed or rejected, or no bond at all, is ignored rather than throwing — a queue that
 * moved under a stale selection is a real case, not an error.
 *
 * **It signs nothing.** See the module header: this moves a status and stamps a date in
 * memory. Nothing is written, published, sent or filed.
 */
export function signSelectedBailBonds(
  rows: SignBailBond[],
  ids: ReadonlySet<string>,
  on: string,
): SignBailBond[] {
  return rows.map((bond) =>
    ids.has(bond.id) && bond.status === "pending-signature"
      ? { ...bond, status: "signed", signedOn: on }
      : bond,
  );
}

/**
 * Decline to sign one bond — the preview's Reject.
 *
 * The bond leaves the queue without a signature. No reason is recorded, because the
 * reference asks for none and inventing a reasons taxonomy for a demo would be inventing
 * product. Like signing, it writes nothing anywhere.
 */
export function rejectBailBond(
  rows: SignBailBond[],
  id: string,
): SignBailBond[] {
  return rows.map((bond) =>
    bond.id === id && bond.status === "pending-signature"
      ? { ...bond, status: "rejected" }
      : bond,
  );
}

/** "31 Aug 2026" — the same column register every other court-side list uses. */
export function formatSignBailBondDate(day: string): string {
  return formatListingDate(day);
}

const LONG_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "15 September 2026" — a date named inside the bond's prose, not in a column. */
export function formatSignBailBondLongDate(day: string): string {
  return LONG_DAY.format(parseIsoDay(day));
}

const RUPEES = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** "₹50,000" — the sum bound, as the bond recites it. A demo figure; see the header. */
export function formatBondAmount(rupees: number): string {
  return RUPEES.format(rupees);
}

/** Today, as an ISO day — what a signature is stamped with. */
export function todayIsoDay(): string {
  return isoDay(new Date());
}

/**
 * The bond as a document: what the preview renders and what Download writes.
 *
 * Shaped like `SignOrderDocument` and `SignFormDocument`, so the court-side facsimiles
 * read as one product — but laid out as the reference lays this one out: the case number
 * on its own line above the court, the court as the document's heading, then the register
 * line, then the bond itself.
 */
export type SignBailBondDocument = {
  /** The reference's first line, above the court heading. */
  caseNumber: string;
  /** The court, as a bond heads itself — upper case, on its own. */
  court: string;
  /** The register line under the heading: the case number and its year of institution. */
  register: string;
  matter: string;
  title: string;
  /** What brought the bond about, in prose. */
  recital: string[];
  /** The undertakings themselves, numbered on the page. */
  undertakings: string[];
  dated: string;
  /** Who puts their hand to it. */
  signatories: { role: string; name: string }[];
  /** Whether the bench has signed, said plainly rather than shown as an empty rule. */
  signature: string;
};

/**
 * The bond's own words.
 *
 * Demo text — see the module header. It recites the row's own sum, surety and date of
 * appearance, because a bond that recited none of them would not read as a bond; it
 * cites no section, form number or rule, because `docs/product/` defines none for §138
 * and an invented citation in a facsimile is the kind of detail that gets screenshot and
 * quoted back.
 */
function bondClauses(bond: SignBailBond): {
  recital: string[];
  undertakings: string[];
} {
  const sum = formatBondAmount(bond.bondAmount);
  const appears = formatSignBailBondLongDate(bond.appearsOn);
  const { litigant, surety } = bond;

  return {
    recital: [
      `${bond.parties.complainant} has complained to this court of the dishonour of a cheque drawn in their favour, and ${litigant}, the accused in this case, has appeared before this court on summons.`,
      `This court has by its order of even date admitted ${litigant} to bail on their executing a bond for their attendance, with one surety to the satisfaction of this court. This bond is executed in pursuance of that order.`,
    ],
    undertakings: [
      `I, ${litigant}, bind myself to attend before this court on ${appears}, and on every date to which the hearing of this case is thereafter adjourned, until this case is disposed of or until otherwise ordered by this court.`,
      `I bind myself in the sum of ${sum} to be forfeited to the State Government should I make default in that attendance.`,
      `I, ${surety.name}, ${surety.relationship} of ${litigant}, declare myself surety for the attendance of ${litigant} as undertaken above, and bind myself in the sum of ${sum} to be forfeited to the State Government should ${litigant} make default in that attendance.`,
      `I, ${litigant}, further undertake not to leave the local limits of the jurisdiction of this court without the leave of this court, and not to tamper with the evidence in this case or to influence any witness in it.`,
      `Should default be made in the attendance undertaken above, this court may forfeit the sums bound above, may issue a warrant for the arrest of ${litigant}, and may cancel the bail granted.`,
    ],
  };
}

export function buildSignBailBondDocument(
  bond: SignBailBond,
): SignBailBondDocument {
  const { recital, undertakings } = bondClauses(bond);
  const year = bond.caseNumber.split("/").at(-1) ?? "";

  return {
    caseNumber: bond.caseNumber,
    court: `In the ${COURT}`.toUpperCase(),
    register: `Case no. ${bond.caseNumber} of ${year}`,
    matter: causeTitle(bond),
    title: "Bail bond",
    recital,
    undertakings,
    dated: formatSignBailBondLongDate(bond.addedOn),
    signatories: [
      { role: "Accused", name: bond.litigant },
      {
        role: "Surety",
        name: `${bond.surety.name} (${bond.surety.relationship} of ${bond.litigant})`,
      },
    ],
    /* The one part of the facsimile that is not the same on every row: an unsigned bond
       says so plainly rather than showing an empty rule that could be mistaken for a
       signature that failed to render. */
    signature:
      bond.status === "signed" && bond.signedOn
        ? `Attested by the magistrate, ${COURT}, on ${formatSignBailBondLongDate(bond.signedOn)}.`
        : "Pending the signature of the magistrate.",
  };
}

export function signBailBondDocumentText(
  document: SignBailBondDocument,
): string {
  return [
    `Case Number: ${document.caseNumber}`,
    "",
    document.court,
    "",
    document.register,
    document.matter,
    "",
    document.title,
    "",
    ...document.recital,
    "",
    ...document.undertakings.map(
      (clause, index) => `${index + 1}. ${clause}`,
    ),
    "",
    `Dated this the ${document.dated}.`,
    "",
    ...document.signatories.map((entry) => `${entry.role}: ${entry.name}`),
    "",
    document.signature,
  ].join("\n");
}

export function signBailBondDocumentFilename(bond: SignBailBond): string {
  return `${bond.caseNumber.replace(/\//g, "-")}-bail-bond-${bond.id}.txt`;
}

export function downloadSignBailBondDocument(bond: SignBailBond): void {
  const document = buildSignBailBondDocument(bond);
  const url = URL.createObjectURL(
    new Blob([localizeForDownload(signBailBondDocumentText(document))], { type: "text/plain" }),
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = signBailBondDocumentFilename(voicedForDownload(bond));
  anchor.click();
  URL.revokeObjectURL(url);
}
