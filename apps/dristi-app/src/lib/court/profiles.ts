/**
 * Which state's court the app runs as — the deployment switch in the rail (`CourtSwitch`).
 *
 * DRISTI is one shared core deployed per state (`docs/product/national-vs-state.md`).
 * Kerala is what every screen was designed against, so its profile changes nothing: the
 * fixtures, documents and fees already speak Kerala. The other three re-voice the same
 * screens with what the stakeholders' documents say differs (owner, 2026-10-08): the
 * product's name and logo, the case numbers, the fees, and — for Punjab & Haryana — that
 * the filing step is signing alone, with no oath, and that scrutiny runs without AI.
 *
 * The interface does not change between them. Nothing here adds a step, a field or a
 * queue; a Gujarat case already carries its eCC / eCR type rather than asking the clerk
 * to pick one.
 *
 * Sources: "Case Numbering System" sheets for Kerala, Gujarat and Punjab & Haryana, and
 * "Payment Logic" (schedule 1 Kerala, 2 Gujarat, 3 Punjab and Haryana), shared in the
 * owner's chat on 2026-10-08. Punjab & Haryana runs as one 24×7 ON Court, like Kerala —
 * one deployment under the shared High Court (owner, 2026-10-12, which merged the two);
 * Gujarat's product is SARAS 2.0, with a placeholder logo until it sends its own (owner,
 * 2026-10-08, renamed 2026-10-09).
 */

import type { SigningRules } from "@/lib/filing/config";
import type { FeeSchedule } from "./fees";
import { GUJARAT_FEES, KERALA_FEES, PUNJAB_HARYANA_FEES } from "./fees";

export type CourtId = "kerala" | "gujarat" | "punjab-haryana";

/** How a state numbers a case, in terms of the Kerala numbers the fixtures carry. */
export type NumberingScheme =
  /** Kerala's own: filing number, CMP at registration, ST at cognizance. */
  | { kind: "kerala" }
  /**
   * Gujarat (CIS): a registration number in one of three case types, then an eCC case
   * number once cognizance is taken. Each stage runs its own sequence.
   */
  | { kind: "gujarat" }
  /** Punjab & Haryana: NACT filing and case numbers; the case number holds after cognizance. */
  | { kind: "nact" };

/**
 * Whether AI assistance is part of a court's scrutiny workbench, and whether it worked.
 * `unavailable` — the court uses AI, but it could not read this file, so the officer is
 * told the readings are missing. `off` — the court never enabled it, so there is nothing
 * missing to announce. Both hide every machine reading; only `unavailable` says so.
 */
export type AiMode = "on" | "unavailable" | "off";

export type CourtProfile = {
  id: CourtId;
  /** What the court switch calls this deployment. */
  name: string;
  /**
   * The state, as the placeholder name and in document headings and addresses. Punjab &
   * Haryana's sample places are Panchkula's, so its addresses say Haryana.
   */
  state: string;
  numbering: NumberingScheme;
  /**
   * The six characters a CNR opens with: state, district, establishment. The sixteen
   * characters after them are the sequence and year, carried over unchanged.
   */
  cnrPrefix: string;
  /**
   * The product's name where it is not 24×7 ON Courts. `null` keeps the ON Courts marks
   * and name; a name is shown beside a placeholder logo, and replaces "ON Courts" in text.
   */
  brandName: string | null;
  /**
   * The court's own name where it is not "24×7 ON Court" — what "In the …" heads a
   * complaint with. `null` keeps ON Court; Kerala and Punjab & Haryana run as ON Courts.
   */
  courtName: string | null;
  /**
   * What the state calls a numbered bench, where it is not a JMFC court: Gujarat's are
   * "SARAS Court 1, 2, 3…" (owner, 2026-10-09). `null` keeps "JMFC Court N".
   */
  benchName: string | null;
  /** Whether the filing's signing step carries an oath — Punjab & Haryana's does not. */
  signWithOath: boolean;
  /** Who signs and who swears (`lib/filing/config.ts`). Gujarat only, for now. */
  signing: SigningRules;
  fees: FeeSchedule;
  /** Whether scrutiny opens with AI assistance — never `unavailable`, which is per file. */
  aiMode: Exclude<AiMode, "unavailable">;
};

export const COURT_PROFILES: Record<CourtId, CourtProfile> = {
  kerala: {
    id: "kerala",
    name: "Kerala",
    state: "Kerala",
    numbering: { kind: "kerala" },
    cnrPrefix: "KLKM52",
    brandName: null,
    courtName: null,
    benchName: null,
    signWithOath: true,
    signing: { oath: false, everyAdvocate: false },
    fees: KERALA_FEES,
    aiMode: "on",
  },
  gujarat: {
    id: "gujarat",
    name: "Gujarat",
    state: "Gujarat",
    numbering: { kind: "gujarat" },
    // GJAH + 2-digit court ID, per the Gujarat sheet's example (GJAH010001252026).
    cnrPrefix: "GJAH01",
    // Gujarat's product is SARAS 2.0 and its court is the SARAS Court (owner,
    // 2026-10-09). The exact court wording is still to be confirmed with Gujarat.
    brandName: "SARAS 2.0",
    courtName: "SARAS Court",
    benchName: "SARAS Court",
    signWithOath: true,
    signing: { oath: true, everyAdvocate: true },
    fees: GUJARAT_FEES,
    aiMode: "on",
  },
  /*
   * One deployment under the Punjab and Haryana High Court (owner, 2026-10-12). It took
   * Punjab's filing — signing with no oath — and scrutiny without AI, and Haryana's CNR
   * and court language; the sample places, names and numbers are Panchkula's.
   */
  "punjab-haryana": {
    id: "punjab-haryana",
    name: "Punjab & Haryana",
    state: "Haryana",
    numbering: { kind: "nact" },
    // Panchkula Special NI Act Court, per the Punjab & Haryana sheet.
    cnrPrefix: "HRPK03",
    brandName: null,
    courtName: null,
    benchName: null,
    signWithOath: false,
    signing: { oath: false, everyAdvocate: false },
    fees: PUNJAB_HARYANA_FEES,
    aiMode: "off",
  },
};

/** In the order the court switch offers them: the designed baseline first. */
export const COURT_IDS: CourtId[] = ["kerala", "gujarat", "punjab-haryana"];

export const DEFAULT_COURT: CourtId = "kerala";

/** The cookie the choice lives in, so the server renders the right court first time. */
export const COURT_COOKIE = "dristi-court";

export function isCourtId(value: unknown): value is CourtId {
  return typeof value === "string" && Object.hasOwn(COURT_PROFILES, value);
}

/** Courts that were once separate, so a browser still holding one lands on its successor. */
const RENAMED: Record<string, CourtId> = {
  punjab: "punjab-haryana",
  haryana: "punjab-haryana",
};

/** A stored or linked court id, read forgivingly: a retired id maps to the court it became. */
export function toCourtId(value: unknown): CourtId | null {
  if (isCourtId(value)) return value;
  return typeof value === "string" ? (RENAMED[value] ?? null) : null;
}

export function courtProfile(id: CourtId): CourtProfile {
  return COURT_PROFILES[id];
}
