/**
 * The summons an accused person receives: v15 of the one-sheet, two-sided design
 * (v14 was the PDF the onboarding modal linked to).
 *
 * **Written in Kerala's terms, voiced per court.** Like every fixture in the app, the
 * facts below are Kollam's; the page passes each string through `localizeCourtText`, so
 * the court name, places, PINs, names and case number follow the court picked in Settings
 * (`lib/court/profiles.ts`). What the court profile does not carry yet (the portal's
 * address, phone numbers, the Bar Council's site, the line in the state's language) is in
 * `SUMMONS_COURT` below. Kerala's values are v14's; the other states' are placeholders,
 * written so they read as placeholders, until each state supplies its own.
 *
 * Changes from v14 (owner's review notes):
 * - The "Kollam District · Kerala Subordinate Judiciary" line is gone: the court is the
 *   24×7 ON Court, not a district subordinate court.
 * - One case number. The CNR is dropped from the front.
 * - No court seal. The summons is signed digitally.
 * - Every link is printed as its address. Link text ("what these are") is lost on paper.
 * - Joining by video names where the link is (sign in, open the case), since the paper
 *   carries no video link.
 * - Not appearing does not cost the accused the right to question the complainant.
 *
 * Demo text, not court-approved process.
 */

import type { CourtId } from "@/lib/court/profiles";

/** The demo case, in Kerala's terms. `localizeCourtText` voices it for the other states. */
export const SUMMONS_FACTS = {
  court: "24×7 ON Court, Kollam",
  bench: "JMFC Court 1",
  courtAddress: "Civil Station, Vidya Nagar, Kollam 691013, Kerala",
  caseNumber: "ST/847/2026",
  complainant: "South Indian Bank Ltd.",
  accused: "Rajan Krishnan Nair",
  accusedAddress: ["TC 14/2201, Manakkal House, Vadakkevila", "Kollam 691010, Kerala"],
  complainantAdvocate: "Adv. Anitha Menon",
  chequeNumber: "004512",
  amount: "INR 1,85,000",
  hearingDate: "18 September 2026",
  hearingDay: "Friday, 10:30 AM",
  dated: "4 August 2026",
  accessCode: "472905",
  /** Bail on contesting: two sureties, for an amount the court has not yet supplied. */
  suretyAmount: "[surety amount]",
  legalAid: "District Legal Services Authority, Kollam",
  barCouncil: "Bar Council of Kerala",
  helpInPerson: "e-Sewa Kendra, District Court Complex, Kollam",
} as const;

type Phone = { display: string; tel: string | null };

export type SummonsCourt = {
  /** The portal's address, printed without a scheme so it reads as typed. */
  portal: string;
  /** Whether `portal` is a real address that can also be a link on screen. */
  portalIsReal: boolean;
  helpline: Phone;
  legalAid: Phone;
  complainantAdvocate: Phone;
  barCouncilSite: string;
  /** The one line in the court's language, above the join QR. */
  language: { lang: string; line: string; font: string };
};

/** A number the state has not supplied: same shape as the onboarding copy's. */
const NO_PHONE: Phone = { display: "0000 000000", tel: null };

const PLACEHOLDER = {
  portalIsReal: false,
  helpline: NO_PHONE,
  legalAid: NO_PHONE,
  complainantAdvocate: NO_PHONE,
  barCouncilSite: "[Bar Council website]",
} as const;

/*
 * The language line, translated from the Malayalam one v14 carried. The Gujarati and
 * Hindi lines need a native speaker's check before they are printed.
 */
export const SUMMONS_COURT: Record<CourtId, SummonsCourt> = {
  kerala: {
    portal: "oncourts.kerala.gov.in",
    portalIsReal: true,
    helpline: { display: "0474 2919099", tel: "+914742919099" },
    legalAid: { display: "0474 2794 536", tel: "+914742794536" },
    complainantAdvocate: { display: "0474 2761 480", tel: "+914742761480" },
    barCouncilSite: "barcouncilkerala.org",
    language: {
      lang: "ml",
      line: "നിങ്ങളുടെ കേസിൽ ചേരാൻ ഈ കോഡ് സ്കാൻ ചെയ്യുക. നിങ്ങളുടെ ഭാഷയിൽ സഹായം ലഭ്യമാണ്.",
      font: '"Noto Sans Malayalam", "Malayalam Sangam MN", sans-serif',
    },
  },
  gujarat: {
    ...PLACEHOLDER,
    portal: "[SARAS portal address]",
    language: {
      lang: "gu",
      line: "તમારા કેસમાં જોડાવા માટે આ કોડ સ્કેન કરો. તમારી ભાષામાં મદદ ઉપલબ્ધ છે.",
      font: '"Noto Sans Gujarati", "Gujarati Sangam MN", sans-serif',
    },
  },
  "punjab-haryana": {
    ...PLACEHOLDER,
    portal: "[ON Courts Punjab & Haryana portal address]",
    language: {
      lang: "hi",
      line: "अपने केस से जुड़ने के लिए यह कोड स्कैन करें। आपकी भाषा में सहायता उपलब्ध है।",
      font: '"Noto Sans Devanagari", "Kohinoor Devanagari", "Devanagari Sangam MN", sans-serif',
    },
  },
};
