import { CHECKS } from "@/lib/employee/scrutiny/sections";
import type {
  BundleDoc,
  Field,
  Filing,
  HistoryEvent,
  SectionDef,
} from "@/lib/employee/scrutiny/types";

/**
 * The officer's checklist for a non-cheque matter. The authored `CHECKS` are §138-shaped
 * ("Cheque details match the instrument", "Notice within 30 days of return memo"); on a
 * money suit or a rent matter those name documents that are not in the bundle, so a civil
 * filing gets the checks that actually apply to it.
 */
const CIVIL_CHECKS = [
  "Names match across the agreement, ID and pleadings",
  "Claim amount matches the agreement",
  "Filing within limitation (or condonation prayed)",
  "Jurisdiction consistent with addresses",
  "Signatures on complaint & affidavit",
  "All documents legible and the right ones",
];

/**
 * A scrutiny, derived from one queue row.
 *
 * The workbench was built around a single hand-authored case: its fields, its bundle and
 * its history all lived in module constants, so only that one filing could be opened and
 * every other row in the queue was a dead link. This derives the same shapes for any
 * filing from what the queue already knows about it — the parties, the advocate, the
 * instrument type, the reason it is in scrutiny and how long it has waited — so the whole
 * queue opens a real, working review rather than a 404.
 *
 * **Two rules hold this honest.** The documents are illegible facsimiles
 * (`kind: "facsimile"`, drawn by `page-facsimile.tsx`), never legible pages, because a
 * readable court record we are only standing in for would be a fabrication. And the
 * seeded values are plainly synthetic filler in an already-fictional fixture — the same
 * category as the queue rows themselves — not a claim about a real case. What is *real*
 * on every derived case is what the queue row actually carries: the parties, the
 * advocate, the instrument, and the reason and age that put it here.
 *
 * The field and document ids match the authored case exactly, so the workbench's lookups,
 * the evidence-row links and the pure state transitions behave identically whichever case
 * they were handed.
 */
export interface DerivedCase {
  party: {
    complainant: string;
    accused: string;
    submitted: string;
    advocate: string;
  };
  sections: SectionDef[];
  bundle: BundleDoc[];
  docRow: Record<string, string>;
  checks: string[];
  history: HistoryEvent[];
  historySummary: string;
  historyRound: number;
}

/* ── a small deterministic PRNG ──────────────────────────────────────────── */

/**
 * Seeded from the filing number so a case looks the same on every render and reload —
 * the officer must not watch the cheque amount change under them when the list
 * re-sorts. A tiny xmur3 + mulberry32; nothing here needs cryptographic anything.
 */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h ^= h >>> 16) >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePicker(rng: () => number) {
  return <T>(pool: readonly T[]): T => pool[Math.floor(rng() * pool.length)];
}

/* ── synthetic pools ─────────────────────────────────────────────────────── */

const BANKS = [
  { name: "State Bank of India", ifsc: "SBIN0007558" },
  { name: "HDFC Bank", ifsc: "HDFC0001204" },
  { name: "Bank of Baroda", ifsc: "BARB0AHMEDA" },
  { name: "ICICI Bank", ifsc: "ICIC0000221" },
  { name: "Axis Bank", ifsc: "UTIB0000418" },
  { name: "Punjab National Bank", ifsc: "PUNB0142200" },
] as const;

const LOCALITIES = [
  "Naroda",
  "Maninagar",
  "Bopal",
  "Vastrapur",
  "Satellite",
  "Chandkheda",
  "Ghatlodia",
  "Nikol",
] as const;

const SOCIETIES = [
  "Shyam Avirah",
  "Shanti Kunj Society",
  "Ambika Nagar",
  "Sardar Complex",
  "Swagat Residency",
  "Krishna Bungalows",
] as const;

const WITNESSES = [
  "Rakesh Patel",
  "Suresh Mehta",
  "Anita Desai",
  "Jignesh Shah",
  "Pooja Nair",
  "Harish Vyas",
] as const;

const PINS = ["382345", "380008", "380015", "382330", "380052", "382481"] as const;

/* ── dates ───────────────────────────────────────────────────────────────── */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** DD/MM/YYYY — the format the filing form uses. */
function slash(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "4 Jul 2026" — the format the case bar and history use. */
function longDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/* ── phone / bar / cheque numbers ────────────────────────────────────────── */

function mobile(rng: () => number): string {
  const start = 90 + Math.floor(rng() * 10);
  const mid = Math.floor(rng() * 90000) + 10000;
  const end = Math.floor(rng() * 9000) + 1000;
  return `+91 ${start}${String(mid).slice(0, 3)} ${String(mid).slice(3)}${String(end).slice(0, 2)}`;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

/** "Prateek Agrawal v. Deepak Choudhary" → the two names. */
export function splitParties(parties: string): {
  complainant: string;
  accused: string;
} {
  const [complainant, accused] = parties.split(/\s+v\.?\s+/i);
  return {
    complainant: (complainant ?? parties).trim(),
    accused: (accused ?? "The accused").trim(),
  };
}

/* ── the derivation ──────────────────────────────────────────────────────── */

/** Whether this filing is a cheque-dishonour matter, which shapes its whole bundle. */
function isCheque(filing: Filing): boolean {
  return /138|NI Act/i.test(filing.type);
}

export function deriveScrutinyCase(filing: Filing): DerivedCase {
  const rng = seededRandom(filing.no);
  const pick = makePicker(rng);
  const { complainant, accused } = splitParties(filing.parties);

  const bank = pick(BANKS);
  const locality = pick(LOCALITIES);
  const society = pick(SOCIETIES);
  const pin = pick(PINS);
  const accusedLocality = pick(LOCALITIES);
  const accusedSociety = pick(SOCIETIES);
  const accusedPin = pick(PINS);

  const complainantAddr = `${Math.floor(rng() * 400) + 1}, ${society}, ${locality}, Ahmedabad, Gujarat — ${pin}`;
  const accusedAddr = `${Math.floor(rng() * 90) + 1}, ${accusedSociety}, ${accusedLocality}, Ahmedabad, Gujarat — ${accusedPin}`;

  // A back-dated, internally consistent chain: the instrument, its dishonour, the notice
  // within limitation, the cause of action, then the filing — the very sequence scrutiny
  // checks. Anchored so the filing lands a plausible while before it reached this desk.
  const filed = addDays(new Date(2026, 6, 4), -Math.floor(rng() * 40));
  const chequeDate = addDays(filed, -(120 + Math.floor(rng() * 240)));
  const presented = addDays(chequeDate, 20 + Math.floor(rng() * 40));
  const returned = addDays(presented, Math.floor(rng() * 2));
  const noticeDate = addDays(returned, 5 + Math.floor(rng() * 20));
  const causeDate = addDays(noticeDate, 16 + Math.floor(rng() * 12));

  const amountLakh = 2 + Math.floor(rng() * 60);
  const amountThousand = pick([0, 25, 50, 75] as const);
  const amount = `₹ ${amountLakh},${pad(amountThousand)},000`;
  const chequeNo = String(200000 + Math.floor(rng() * 800000));
  const barYear = 1988 + Math.floor(rng() * 30);
  const barNo = `G/${Math.floor(rng() * 900) + 60}/${barYear}`;
  const witness = pick(WITNESSES);

  const cheque = isCheque(filing);

  const party: DerivedCase["party"] = {
    complainant,
    accused,
    submitted: `Submitted ${longDate(filed)}`,
    advocate: filing.advocate,
  };

  /* Which single value the AI flags — matched to the reason the queue already gives, so
     the officer opens the case and finds exactly the thing that put it here. */
  const reason = filing.reason.toLowerCase();
  const skipsAmount = cheque && /skipped|warning/.test(reason);
  const lowConfidence = /low ai|not ai|contested|open/.test(reason);

  const complainantGroup = {
    id: "compl",
    icon: "user" as const,
    title: "Complainant Details",
    fields: [
      {
        id: "c-name",
        label: "Full name",
        value: complainant,
        doc: "aadhaar",
        ...(lowConfidence && !skipsAmount
          ? {
              ocrfail: true,
              failnote:
                "Not on the uploaded ID — only the address side was uploaded",
            }
          : {}),
      },
      { id: "c-mob", label: "Mobile number", value: mobile(rng) },
      {
        id: "c-mail",
        label: "Email address",
        value: `${firstName(complainant).toLowerCase()}.${Math.floor(rng() * 900) + 100}@gmail.com`,
      },
      /* Unlike the authored case — whose ID thumbnail is a real scan — a derived case's
         ID is an illegible facsimile with no bitmap to crop, so the row states it in
         words rather than showing a blank value beside an empty thumbnail. */
      {
        id: "c-id",
        label: "ID proof",
        value: "Uploaded at filing",
        thumb: "aadhaar",
      },
      {
        id: "c-perm",
        label: "Permanent address",
        value: complainantAddr,
        doc: "aadhaar",
        region: [12, 40, 60, 24] as const,
      },
      { id: "c-pip", label: "Party in person", value: "No" },
    ] as Field[],
  };

  const advocateGroup = {
    id: "advo",
    icon: "scale" as const,
    title: "Advocate Details",
    fields: [
      { id: "adv-name", label: "Advocate name", value: filing.advocate },
      { id: "adv-for", label: "Advocate for", value: "Complainant" },
      { id: "adv-bar", label: "BAR registration", value: barNo, ident: true },
    ] as Field[],
  };

  const accusedGroup = {
    id: "accu",
    icon: "userSearch" as const,
    title: "Accused Details",
    fields: [
      {
        id: "a-name",
        label: "Full name",
        value: accused,
        ...(cheque
          ? { doc: "cheque", srcnote: "Signatory on the cheque" }
          : { nodoc: "Named in the agreement only" }),
      },
      { id: "a-age", label: "Age", value: String(28 + Math.floor(rng() * 35)) },
      { id: "a-mob", label: "Mobile number", value: mobile(rng) },
      {
        id: "a-addr",
        label: "Permanent address",
        value: accusedAddr,
        nodoc: "Not in any document",
      },
    ] as Field[],
  };

  const partySection: SectionDef = {
    id: "party",
    num: "1",
    title: "Party Details",
    groups: [complainantGroup, advocateGroup, accusedGroup],
  };

  const chequeGroups = [
    {
      id: "chq",
      icon: "cheque" as const,
      title: "Cheque Details",
      fields: [
        {
          id: "q-no",
          label: "Cheque number",
          value: chequeNo,
          ident: true,
          doc: "cheque",
          srcnote: "MICR band",
        },
        {
          id: "q-date",
          label: "Date on cheque",
          value: slash(chequeDate),
          doc: "cheque",
        },
        {
          id: "q-amt",
          label: "Amount",
          value: amount,
          doc: "cheque",
          region: [67, 44, 24, 14] as const,
          ...(skipsAmount
            ? {
                docread: `₹ ${amountLakh},${pad(Math.max(0, amountThousand - 25) || 75)},000/-`,
                skipped: true,
              }
            : {}),
        },
        {
          id: "q-ifsc",
          label: "IFSC code",
          value: bank.ifsc,
          ident: true,
          doc: "cheque",
        },
        {
          id: "q-bank",
          label: "Bank name",
          value: bank.name,
          doc: "cheque",
        },
      ] as Field[],
    },
    {
      id: "memo",
      icon: "memo" as const,
      title: "Cheque Return Memo",
      fields: [
        {
          id: "m-pres",
          label: "Date of presentation",
          value: slash(presented),
          doc: "memo",
        },
        {
          id: "m-ret",
          label: "Date of return",
          value: slash(returned),
          doc: "memo",
          ...(lowConfidence && skipsAmount
            ? { ocrfail: true, failnote: "Not legible in the memo scan" }
            : {}),
        },
        {
          id: "m-why",
          label: "Return reason",
          value: pick([
            "Funds insufficient",
            "Payment stopped by drawer",
            "Exceeds arrangement",
          ] as const),
          doc: "memo",
        },
      ] as Field[],
    },
    {
      id: "notice",
      icon: "mail" as const,
      title: "Legal Demand Notice",
      fields: [
        {
          id: "n-date",
          label: "Date of demand notice",
          value: slash(noticeDate),
          doc: "notice",
        },
        {
          id: "n-mode",
          label: "Mode of dispatch",
          value: "Registered post (RPAD)",
          nodoc: "No postal receipt uploaded",
        },
        {
          id: "n-del",
          label: "Whether delivered",
          value: "Yes",
          nodoc: "No delivery proof (A.D.) uploaded",
        },
        { id: "n-reply", label: "Reply received from accused", value: "No" },
        { id: "n-pay", label: "Payment received after notice", value: "No" },
      ] as Field[],
    },
  ];

  const claimGroup = {
    id: "chq",
    icon: "memo" as const,
    title: "Claim Details",
    fields: [
      {
        id: "q-amt",
        label: "Amount claimed",
        value: amount,
        doc: "cheque",
        ...(lowConfidence
          ? { ocrfail: true, failnote: "Figure unclear on the agreement scan" }
          : {}),
      },
      {
        id: "q-date",
        label: "Date of agreement",
        value: slash(chequeDate),
        doc: "cheque",
      },
      {
        id: "q-no",
        label: "Nature of claim",
        value: filing.type,
      },
    ] as Field[],
  };

  const jurisdictionGroup = {
    id: "jur",
    icon: "pin" as const,
    title: "Jurisdiction & Limitation",
    fields: [
      {
        id: "j-court",
        label: "Court",
        value: "24×7 ON Court, Ahmedabad",
      },
      {
        id: "j-cause",
        label: "Date of cause of action",
        value: slash(causeDate),
      },
      { id: "j-file", label: "Date of complaint filing", value: slash(filed) },
      {
        id: "j-delay",
        label: "Reason for praying condonation of delay",
        value:
          "Settlement discussions were ongoing between the parties; the accused repeatedly sought time and assured payment.",
        long: true,
      },
    ] as Field[],
  };

  const prayerGroup = {
    id: "adr",
    icon: "doc" as const,
    title: "ADR, Other Details & Prayer",
    fields: [
      { id: "p-adr", label: "Willing to settle outside court", value: "No" },
      {
        id: "p-final",
        label: "Final relief",
        value: `It is most respectfully prayed that this Hon'ble Court may be pleased to grant the relief sought against the accused, direct payment of ${amount} with interest, and pass such further orders as the Court deems fit.`,
        long: true,
        doc: "complaint",
      },
      {
        id: "p-aff",
        label: "Affidavit",
        value: "Signed & uploaded (scanned copy)",
        doc: "affidavit",
        scannote: "Scanned upload — check for blur or missing pages",
      },
    ] as Field[],
  };

  const caseSection: SectionDef = {
    id: "case",
    num: "2",
    title: "Case Details",
    groups: cheque
      ? [...chequeGroups, jurisdictionGroup, prayerGroup]
      : [claimGroup, jurisdictionGroup, prayerGroup],
  };

  const documentsFields: Field[] = [
    {
      id: "d-affidavit",
      label: "Affidavit",
      value: "Scanned & signed",
      docrow: "affidavit",
      scannote: "Scanned upload — check for blur or missing pages",
    },
    ...(cheque
      ? [
          {
            id: "d-cheque",
            label: "Cheque (front)",
            value: "Uploaded at filing",
            docrow: "cheque",
          },
          {
            id: "d-memo",
            label: "Cheque return memo",
            value: "Uploaded at filing",
            docrow: "memo",
          },
          {
            id: "d-notice",
            label: "Legal demand notice",
            value: "Uploaded at filing",
            docrow: "notice",
          },
        ]
      : [
          {
            id: "d-cheque",
            label: "Agreement",
            value: "Uploaded at filing",
            docrow: "cheque",
          },
        ]),
    {
      id: "d-aadhaar",
      label: `ID proof — ${firstName(complainant)}`,
      value: "Uploaded at filing",
      docrow: "aadhaar",
    },
  ];

  const evidenceSection: SectionDef = {
    id: "evid",
    num: "3",
    title: "Evidence",
    groups: [
      {
        id: "wit",
        icon: "user",
        title: "Witness Details",
        fields: [
          { id: "w-name", label: "Witness name", value: witness },
          { id: "w-age", label: "Age", value: String(30 + Math.floor(rng() * 30)) },
          {
            id: "w-addr",
            label: "Address",
            value: `${Math.floor(rng() * 90) + 1}, ${pick(SOCIETIES)}, ${pick(LOCALITIES)}, Ahmedabad — ${pick(PINS)}`,
          },
        ],
      },
      {
        id: "docs",
        icon: "doc",
        title: "Documents",
        fields: documentsFields,
      },
    ],
  };

  const sections = [partySection, caseSection, evidenceSection];

  /* The bundle, in the complaint-PDF reading order the officer scrolls. Illegible
     facsimiles throughout — each doc names the page *shape* it is drawn as. */
  const bundle: BundleDoc[] = [
    { id: "synopsis", name: "Synopsis", kind: "facsimile", sheet: "letter", no: 1 },
    {
      id: "complaint",
      name: "Complaint — filed details",
      kind: "facsimile",
      sheet: "letter",
      no: 2,
    },
    {
      id: "affidavit",
      name: "Affidavit (scanned & signed)",
      kind: "facsimile",
      sheet: "letter",
      no: 3,
      poorScan: true,
    },
    cheque
      ? { id: "cheque", name: "Cheque (front)", kind: "facsimile", sheet: "cheque", no: 4 }
      : { id: "cheque", name: "Agreement", kind: "facsimile", sheet: "form", no: 4 },
    ...(cheque
      ? ([
          {
            id: "memo",
            name: "Cheque return memo",
            kind: "facsimile",
            sheet: "memo",
            no: 5,
          },
          {
            id: "notice",
            name: "Legal demand notice",
            kind: "facsimile",
            sheet: "letter",
            no: 6,
          },
        ] as BundleDoc[])
      : []),
    {
      id: "aadhaar",
      name: `ID proof — ${firstName(complainant)}`,
      kind: "facsimile",
      sheet: "id",
      no: cheque ? 7 : 5,
    },
  ];

  const docRow: Record<string, string> = {
    affidavit: "d-affidavit",
    cheque: "d-cheque",
    aadhaar: "d-aadhaar",
    ...(cheque ? { memo: "d-memo", notice: "d-notice" } : {}),
  };

  const { history, historySummary, historyRound } = deriveHistory(filing, party);

  return {
    party,
    sections,
    bundle,
    docRow,
    checks: cheque ? CHECKS : CIVIL_CHECKS,
    history,
    historySummary,
    historyRound,
  };
}

/* ── history ─────────────────────────────────────────────────────────────── */

/**
 * The travel of the filing, derived from where it now sits.
 *
 * A fresh filing has one line; a resubmission has a round-trip behind it; a closed one
 * ends where it ended. The round number is what the case bar prints, so it has to agree
 * with the events listed.
 */
function deriveHistory(
  filing: Filing,
  party: DerivedCase["party"],
): { history: HistoryEvent[]; historySummary: string; historyRound: number } {
  const filedShort = party.submitted.replace(/^Submitted /, "");
  /* An unclaimed filing has "—" for its officer; in a history line that reads as a hole,
     so it is named for the desk that holds it, the way the send-back branch already does. */
  const who = filing.who === "—" ? "Registry" : filing.who;
  const filed: HistoryEvent = {
    status: "past",
    title: "Filed",
    meta: `${filedShort} · ${filing.advocate}`,
  };
  /* "Filer skipped an AI warning", "Low AI confidence", "Not AI-reviewed": a routing
     reason that names AI is only said where the court runs it (`aiNote`). */
  const routed: HistoryEvent = /\bAI\b/.test(filing.reason)
    ? {
        status: "past",
        title: "Routed to scrutiny",
        meta: filedShort,
        aiNote: filing.reason,
      }
    : {
        status: "past",
        title: "Routed to scrutiny",
        meta: `${filedShort} · ${filing.reason}`,
      };

  const stage = filing.stage.toLowerCase();

  // Out with the advocate, or fresh in the queue: at most one round has happened.
  if (filing.ball === "registry" && /awaiting scrutiny/.test(stage)) {
    return {
      history: [filed, routed],
      historySummary: "In queue · not yet started",
      historyRound: 1,
    };
  }

  if (filing.ball === "registry" && /under scrutiny/.test(stage)) {
    return {
      history: [
        filed,
        routed,
        { status: "current", title: "Scrutiny started", meta: `${filedShort} · ${who}` },
      ],
      historySummary: "Round 1 · in progress",
      historyRound: 1,
    };
  }

  if (filing.ball === "advocate") {
    const items = Number((filing.reason.match(/(\d+)/) ?? [])[1] ?? 1);
    return {
      history: [
        filed,
        { status: "past", title: "Scrutiny started", meta: `${filedShort} · ${filing.who === "—" ? "Registry" : filing.who}` },
        {
          status: "current",
          title: `Sent back with ${items} item${items > 1 ? "s" : ""}`,
          meta: `Awaiting the advocate · ${filing.reason}`,
        },
      ],
      historySummary: `1 round · ${filing.reason.toLowerCase()}`,
      historyRound: 1,
    };
  }

  if (filing.ball === "registry" && /re-scrutiny/.test(stage)) {
    return {
      history: [
        filed,
        { status: "past", title: "Sent back with 2 items", meta: `${filedShort} · registry` },
        { status: "past", title: "Resubmitted", meta: `${filing.advocate} · all items answered` },
        { status: "current", title: "Returned to scrutiny", meta: "Awaiting re-check" },
      ],
      historySummary: "2 rounds · all items answered",
      historyRound: 2,
    };
  }

  // Closed — registered or withdrawn.
  const closed = /withdraw/.test(stage)
    ? { status: "current" as const, title: "Withdrawn", meta: `${filing.advocate}` }
    : { status: "current" as const, title: "Registered", meta: filing.reason };
  return {
    history: [
      filed,
      { status: "past", title: "Scrutiny started", meta: `${filedShort} · ${who}` },
      closed,
    ],
    historySummary: /withdraw/.test(stage) ? "Closed · withdrawn" : "Closed · registered",
    historyRound: 1,
  };
}
