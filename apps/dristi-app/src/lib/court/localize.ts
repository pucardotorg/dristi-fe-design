/**
 * Kerala's words and numbers, re-voiced for another state's court.
 *
 * Every fixture, document and seed in this app is written in Kerala's terms — that is
 * the state it was designed against, and the owner keeps it as the baseline. Rather than
 * fork a thousand-odd fixtures per state, the screens show them through this function:
 * the same case, numbered and headed the way the selected state's court would.
 *
 * It is a display transform, never a data one. Lookups, filters and the sandbox store
 * keep the Kerala value; only what a reader sees passes through here. For Kerala it is
 * the identity, so the designed screens are exactly as they were.
 *
 * What changes, and from which source (owner's documents, 2026-10-08):
 *
 * - **Court and product names.** In Gujarat "24×7 ON Courts" becomes SARAS 2.0 and
 *   "24×7 ON Court" the SARAS Court, and DRISTI is never named (owner, 2026-10-09); a bench gains its state
 *   ("JMFC Court 1, Gujarat") where Kerala's demo left the district out.
 * - **Filing number.** Kerala's `KL-000049-2025` — Gujarat's e-filing number keeps the
 *   platform's shape with its own tenant; Punjab & Haryana's is `NACT/49/2025`.
 * - **Registration (CMP).** Gujarat allots `eCC`, `eCR EN` or `eCR MA` by the case's
 *   classification at scrutiny; Punjab & Haryana allot the `NACT` case number.
 * - **Cognizance (ST).** Gujarat's case number is always `eCC`; Punjab & Haryana's case
 *   number was allotted at registration and carries on.
 * - **CNR.** The state, district and establishment prefix changes; the sequence and
 *   year do not.
 * - **Signing.** Punjab's filing step is "Sign", where the others' is "Sign and oath".
 */

import {
  BAR_PREFIX,
  COURT_LANGUAGE,
  districtCode,
  STATE_CODE,
  KERALA_PLACE_PATTERN,
  PIN_PREFIX,
  PLACES,
  HOUSE_NAMES,
  SCRIPT_NAMES,
} from "./places";
import { MALAYALI_NAME_PATTERN, voiceName } from "./names";
import { courtProfile, type CourtId, type CourtProfile } from "./profiles";

/** Words that stand before a name without being one. */
const TITLES = new Set(["Adv", "Advocate", "Mr", "Mrs", "Ms", "Dr", "Sri", "Smt", "Shri", "Before", "In", "Item"]);

/**
 * Malayali names, for the selected state (`names.ts`). A name part after another name
 * stands where a surname goes; the name before it is re-voiced too, since the pattern
 * takes it along to tell the two apart.
 */
function voiceNames(text: string, court: CourtId): string {
  return text.replace(MALAYALI_NAME_PATTERN, (_match, before: string | undefined, name: string) => {
    if (!before) return voiceName(court, name, false);
    const word = before.trim().replace(/\.$/, "");
    const lead = TITLES.has(word) ? before : before.replace(word, voiceName(court, word, false));
    return lead + voiceName(court, name, !TITLES.has(word));
  });
}

/**
 * Gujarat classifies a case at scrutiny into one of three types. The fixtures carry no
 * such field, so the type is read off the registration sequence — stable for a given
 * case, and mostly eCC, as a cheque-dishonour docket would be.
 */
function gujaratRegistrationType(sequence: number): string {
  const slot = sequence % 5;
  if (slot === 3) return "eCR EN";
  if (slot === 4) return "eCR MA";
  return "eCC";
}

type Rule = [RegExp, (profile: CourtProfile, ...groups: string[]) => string];

/**
 * The product, "24×7 ON Courts", and the court it runs, "24×7 ON Court". Punjab and
 * Haryana run as ON Courts, so both stay as they are. Gujarat's product is SARAS 2.0; its
 * court is the SARAS Court (owner, 2026-10-09).
 */
function productName(p: CourtProfile, short = false): string {
  return p.brandName ?? (short ? "ON Courts" : "24×7 ON Courts");
}

function courtName(p: CourtProfile, short = false): string {
  return p.courtName ?? (short ? "ON Court" : "24×7 ON Court");
}

const NAME_RULES: Rule[] = [
  // The scrutiny packet's heading and its prose twin name the seat as well; another
  // state's court is not in Ahmedabad by default.
  [/24[×x]7 ON COURT AT AHMEDABAD/g, (p) => courtName(p).toUpperCase()],
  [/24[×x]7 ON Court, Ahmedabad/g, (p) => courtName(p)],
  [/24[×x]7 ON Courts/g, (p) => productName(p)],
  [/24[×x]7 ON Court/g, (p) => courtName(p)],
  [/24[×x]7 ON COURTS/g, (p) => productName(p).toUpperCase()],
  [/24[×x]7 ON COURT/g, (p) => courtName(p).toUpperCase()],
  [/\bON Courts\b/g, (p) => productName(p, true)],
  // The platform's own name, where a state ships it as its own product: Gujarat's
  // screens never say DRISTI (owner, 2026-10-09). Elsewhere it stays as it is.
  [/\bDRISTI\b/g, (p) => p.brandName ?? "DRISTI"],
  [/\bDristi\b/g, (p) => p.brandName ?? "Dristi"],
  [/\bON Court\b/g, (p) => courtName(p, true)],
  // Punjab's filing is signed, not sworn: its step is "Sign" (owner, 2026-10-08).
  [/\bSign and oath\b/g, (p) => (p.signWithOath ? "Sign and oath" : "Sign")],
  // A bench names its state; one that already names a place is left alone.
  [/\bJMFC Court (\d+)\b(?!,)/g, (p, n) => `JMFC Court ${n}, ${p.state}`],
  [/\bJMFC COURT (\d+)\b(?!,)/g, (p, n) => `JMFC COURT ${n}, ${p.state.toUpperCase()}`],
];

/**
 * Kerala's sample geography and the state's other marks — places, the state's own
 * name, its court language, PIN codes and Bar Council numbers (`places.ts`). Run after
 * the court names, so "24×7 ON Court" is never read as containing a place.
 */
const PLACE_RULES: Rule[] = [
  [KERALA_PLACE_PATTERN, (p, place) => PLACES[p.id]?.[place] ?? place],
  // The Bar Council is a body, not a place: Punjab and Haryana share one.
  [
    /\bBar Council of Kerala\b/g,
    (p) => `Bar Council of ${p.id === "gujarat" ? "Gujarat" : "Punjab and Haryana"}`,
  ],
  [/\bKerala\b/g, (p) => p.state],
  // The scrutiny queue's sample filings are Ahmedabad's: right for Gujarat as they stand,
  // and moved to the state's demo district everywhere else.
  [/\bAhmedabad\b/g, (p) => (p.id === "gujarat" ? "Ahmedabad" : (PLACES[p.id]?.Kollam ?? "Ahmedabad"))],
  [/\bGujarat\b/g, (p) => (p.id === "gujarat" ? "Gujarat" : p.state)],
  // A few disposed cases are Panchkula's already: right for Haryana, moved elsewhere.
  [/\bPanchkula\b/g, (p) => (p.id === "haryana" ? "Panchkula" : (PLACES[p.id]?.Kollam ?? "Panchkula"))],
  [/\bKERALA\b/g, (p) => p.state.toUpperCase()],
  [/\bMalayalam\b/g, (p) => COURT_LANGUAGE[p.id] ?? "Malayalam"],
  [
    new RegExp(`(${Object.keys(SCRIPT_NAMES).join("|")})`, "g"),
    (p, name) => SCRIPT_NAMES[name]?.[p.id] ?? name,
  ],
  // Kerala's PIN codes (67xxxx–69xxxx) move to the state's postal circle — only where an
  // address puts them (after a place, a dash or "PIN"), so a cheque number is left alone.
  [
    /(?<=(?:PIN(?: code)?\s*:?\s*|[—–-]\s*|[A-Z][a-z]+,?\s))(6[7-9]|3[6-9])(\d{4})\b/g,
    // Gujarat's own (36–39) are the scrutiny queue's: kept in Gujarat, moved elsewhere.
    (p, circle, rest) =>
      circle.startsWith("3") && p.id === "gujarat"
        ? `${circle}${rest}`
        : `${PIN_PREFIX[p.id] ?? circle}${rest}`,
  ],
  // Kerala Bar Council enrolments: "KL/1109/2009" and the short "K/1234/2020".
  [/\bKL\/(\d+\/\d{4})\b/g, (p, rest) => `${BAR_PREFIX[p.id]?.long ?? "KL"}/${rest}`],
  [/\bK\/(\d+\/\d{4})\b/g, (p, rest) => `${BAR_PREFIX[p.id]?.short ?? "K"}/${rest}`],
  // The scrutiny queue's advocates are Gujarat's (G/…, GJ/…): kept there, moved elsewhere.
  [/\bGJ\/(\d+\/\d{4})\b/g, (p, rest) => `${p.id === "gujarat" ? "GJ" : (BAR_PREFIX[p.id]?.long ?? "GJ")}/${rest}`],
  [/\bG\/(\d+\/\d{4})\b/g, (p, rest) => `${p.id === "gujarat" ? "G" : (BAR_PREFIX[p.id]?.short ?? "G")}/${rest}`],
  [
    new RegExp(`\\b(${Object.keys(HOUSE_NAMES).join("|")})\\b`, "g"),
    (p, house) => HOUSE_NAMES[house]?.[p.id] ?? house,
  ],

];

const NUMBER_RULES: Rule[] = [
  [
    /\bKL-(\d{6})-(\d{4})\b/g,
    (p, seq, year) =>
      p.numbering.kind === "nact"
        ? `NACT/${Number(seq)}/${year}`
        : `${p.cnrPrefix.slice(0, 2)}-${seq}-${year}`,
  ],
  [
    /\bCMP[ /](\d+)\/(\d{4})\b/g,
    (p, seq, year) =>
      p.numbering.kind === "nact"
        ? `NACT/${seq}/${year}`
        : `${gujaratRegistrationType(Number(seq))}/${seq}/${year}`,
  ],
  [
    /\bST[ /](\d+)\/(\d{4})\b/g,
    (p, seq, year) =>
      p.numbering.kind === "nact" ? `NACT/${seq}/${year}` : `eCC/${seq}/${year}`,
  ],
  // KLKM + the two-digit establishment code — 52 for the 24×7 court, others for the
  // district's benches — then the sequence and year.
  [/\bKLKM\d{2}(\d{10})\b/g, (p, rest) => `${p.cnrPrefix}${rest}`],
  // Other platform numbers carry the tenant too: an advocate's registration application.
  [/\bKL-([A-Z]+-\d+-\d{4})\b/g, (p, rest) => `${p.cnrPrefix.slice(0, 2)}-${rest}`],
  // Every other identifier that opens with Kerala's code — application, order and
  // notary numbers, district-coded case numbers (KLKL01-…, KL-KLEK-…), the Gramin
  // Bank's IFSC (KLGB…). First the district code, then the state code before it.
  [/\bKL([A-Z]{2})(?=[0-9-])/g, (p, district) => `${STATE_CODE[p.id] ?? "KL"}${districtCode(p.id, district)}`],
  [/\bKL(?=[-/][A-Z0-9])/g, (p) => STATE_CODE[p.id] ?? "KL"],
  // A few long-pending numbers in the data are Panchkula's already (HR-PKL-…): right
  // for Haryana, the state's demo district everywhere else.
  [
    /\bHR-PKL(?=-\d)/g,
    (p) => (p.id === "haryana" ? "HR-PKL" : `${STATE_CODE[p.id] ?? "HR"}-${p.id === "gujarat" ? "AHM" : "LDH"}`),
  ],
  // The scrutiny queue's filing numbers are Ahmedabad's (`F/AHM/2026/00319`) — right for
  // Gujarat as they stand, and the platform's NACT filing number for Punjab and Haryana.
  [
    /\bF\/AHM\/(\d{4})\/(\d+)\b/g,
    (p, year, seq) =>
      p.numbering.kind === "nact" ? `NACT/${Number(seq)}/${year}` : `F/AHM/${year}/${seq}`,
  ],
];

const ROMAN: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
};

/**
 * A numbered bench, for a state that does not call it a JMFC court — Gujarat's are
 * "SARAS Court 1, 2, 3…" (owner, 2026-10-09). Applied before the name rules, so the
 * bench is renamed before any of them would add the state to it. The fixtures' district
 * suffix goes with it: the state's bench is named by its number alone.
 */
const BENCH_RULES: Rule[] = [
  [/\bJMFC Court (\d+)(?:, (?:Gujarat|Sample District))?/g, (p, n) => `${p.benchName} ${n}`],
  [/\bJMFC COURT (\d+)(?:, (?:GUJARAT|SAMPLE DISTRICT))?/g, (p, n) => `${p.benchName?.toUpperCase()} ${n}`],
  [/\bJMFC-(X|IX|VIII|VII|VI|V|IV|III|II|I)\b/g, (p, r) => `${p.benchName} ${ROMAN[r] ?? r}`],
  [/\bJMFC Court\b/g, (p) => p.benchName ?? "JMFC Court"],
];

function apply(text: string, rules: Rule[], profile: CourtProfile): string {
  let out = text;
  for (const [pattern, to] of rules) {
    out = out.replace(pattern, (_match, ...groups: unknown[]) =>
      to(profile, ...(groups.filter((g) => typeof g === "string") as string[]))
    );
  }
  return out;
}

/** A case number, CNR or filing number, as the selected state allots it. */
export function localizeCaseNumber(value: string, court: CourtId): string {
  const profile = courtProfile(court);
  if (profile.numbering.kind === "kerala") return value;
  return apply(value, NUMBER_RULES, profile);
}

/**
 * Any text a reader sees — a heading, a table cell, a document's HTML. Names first,
 * then numbers, so a court name never contains a number rule's match.
 */
export function localizeCourtText(text: string, court: CourtId): string {
  const profile = courtProfile(court);
  if (profile.numbering.kind === "kerala") return text;
  const benched = profile.benchName ? apply(text, BENCH_RULES, profile) : text;
  return apply(
    voiceNames(apply(apply(benched, NAME_RULES, profile), PLACE_RULES, profile), court),
    NUMBER_RULES,
    profile,
  );
}

const PIN_FIELD = /^(?:pin|pinCode|pincode|postalCode)$/;

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * A whole record re-voiced: every string in it, through plain objects and arrays. Built
 * for court documents, whose heading, numbers and body all have to agree — re-voicing
 * the heading and missing the body would put two states on one page.
 *
 * Anything that is not a plain object or array — a `Date`, a `File`, a React element —
 * passes through as it is. For Kerala the value comes back untouched, identity and all.
 */
export function localizeDeep<T>(value: T, court: CourtId): T {
  if (courtProfile(court).numbering.kind === "kerala") return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return localizeCourtText(v, court);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object" && isPlainObject(v) && !("$$typeof" in v)) {
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [
          k,
          // A PIN on its own has no address around it to be recognised by, so the field
          // name says what it is.
          PIN_FIELD.test(k) && typeof x === "string"
            ? localizeCourtText(`PIN ${x}`, court).slice(4)
            : walk(x),
        ]),
      );
    }
    return v;
  };
  return walk(value) as T;
}

/**
 * A search query, ready to match the stored Kerala records — lower-cased and trimmed,
 * with any state's number spelled back into something the record contains.
 *
 * Screens show `NACT/241/2026` or `eCR EN/58/2025` while the row underneath still says
 * `ST 241/2026`, so a clerk typing what they read would find nothing. Every table's
 * search reads its query through here instead: the state's prefix is dropped, leaving
 * the `241/2026` that every stage's number shares, and another state's CNR or filing
 * prefix goes back to Kerala's. It needs no court — no Kerala query is touched, so it
 * is safe whichever state is selected.
 */
export function caseSearchKey(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/\b(?:e\s*cr\s*(?:en|ma)|e\s*cc|nact)\s*\//g, "")
    // A state code, with or without its district (GJ-…, GJAH01…, HRPK03…, PB/…), is
    // dropped: what follows it is what the stored Kerala number contains too.
    // A whole CNR keeps only its sequence and year: the court code differs too.
    .replace(/\b(?:gj|pb|hr)[a-z]{2}\d{2}(?=\d{10}\b)/g, "")
    .replace(/\b(?:gj|pb|hr)(?:[a-z]{2})?(?=[-/]?\d)/g, "");
}
