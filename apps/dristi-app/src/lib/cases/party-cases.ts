/**
 * The litigant profile's own cases — demo fixtures, no backend.
 *
 * The litigant profile used to show an empty Cases page: the advocate's
 * fixtures are not a litigant's to see, and nothing else existed. The
 * Application Lifecycle PRD gives a litigant (and a PoA holder, and a party
 * in person) their own rights on applications, so the profile needs cases
 * it is actually on. One per seat the PRD names:
 *
 * - `lt-2201`: the account holder files her own complaint with no advocate,
 *   a party in person. She drafts, signs, pays and objects herself.
 * - `lt-2202`: she is the accused, with an advocate. She pays for what is
 *   filed on her behalf and sees what is submitted.
 * - `lt-2203`: she holds her mother's power of attorney in her mother's
 *   complaint. She pays for what is filed on her mother's behalf.
 *
 * Kept out of `CASES` so the advocate's Cases list, counts and tests do not
 * change. `findCaseRecord` resolves an id against both.
 */

import { CASES } from "./fixtures";
import type { CaseRecord } from "./types";

/**
 * The join-a-case demo case (`DEMO_JOIN_CASE`, CC 847/2026), as a record so View case
 * at the end of joining opens its case page (owner, 2026-10-12). Resolvable by id
 * only, not listed in Your Cases: the demo joins it fresh every time.
 */
export const JOIN_DEMO_CASE_ID = "c-847";

const JOIN_DEMO_CASE: CaseRecord = {
  id: JOIN_DEMO_CASE_ID,
  caseNumber: "CC 847/2026",
  parties: { complainant: "South Indian Bank Ltd.", accused: "Rajan Krishnan Nair and 1 other" },
  // Seen only after joining, so the viewer is on record for the accused.
  counsel: { complainant: ["Adv. Meera Pillai"], accused: ["Adv. Anjali Nair"] },
  court: "JMFC-I",
  filedOn: "2026-07-31",
  updatedOn: "2026-08-28",
  latestUpdate: "Summons issued to the accused",
  nextHearing: { on: "2026-09-18", purpose: "Appearance of the accused" },
  stage: "appearance",
  longPending: false,
  bookmarked: false,
};

export const PARTY_CASES: CaseRecord[] = [
  {
    id: "lt-2201",
    caseNumber: "CMP/2201/2026",
    parties: { complainant: "Anjali Nair", accused: "Kiran Motors" },
    counsel: { accused: ["Adv. George Kurian"] },
    court: "JMFC-II",
    filedOn: "2026-05-14",
    updatedOn: "2026-08-10",
    latestUpdate: "Accused entered appearance through counsel",
    nextHearing: { on: "2026-08-20", purpose: "Framing of charge" },
    previousHearingOn: "2026-07-23",
    stage: "appearance",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "lt-2202",
    caseNumber: "ST/2202/2026",
    parties: { complainant: "Harbour Fisheries", accused: "Anjali Nair" },
    counsel: {
      complainant: ["Adv. Meera Krishnan"],
      accused: ["Adv. Joseph Mathew"],
    },
    court: "JMFC-I",
    filedOn: "2026-03-02",
    updatedOn: "2026-08-09",
    latestUpdate: "Plea recorded; posted for complainant's evidence",
    nextHearing: { on: "2026-08-24", purpose: "Evidence of the complainant" },
    previousHearingOn: "2026-07-27",
    stage: "evidence",
    substage: "Evidence of the complainant",
    longPending: false,
    bookmarked: false,
  },
  {
    id: "lt-2203",
    caseNumber: "CMP/2203/2026",
    parties: { complainant: "Leela Nair", accused: "Sree Durga Traders" },
    counsel: {
      complainant: ["Adv. Ramesh Menon"],
      accused: ["Adv. Latha Nambiar"],
    },
    court: "JMFC-III",
    filedOn: "2026-06-01",
    updatedOn: "2026-08-08",
    latestUpdate: "Summons served on the accused",
    nextHearing: { on: "2026-08-27", purpose: "Appearance of the accused" },
    previousHearingOn: "2026-07-30",
    stage: "summons",
    longPending: false,
    bookmarked: false,
  },
];

/** A case by id, from the advocate's fixtures or the litigant's. */
export function findCaseRecord(caseId: string): CaseRecord | undefined {
  return (
    CASES.find((record) => record.id === caseId) ??
    PARTY_CASES.find((record) => record.id === caseId) ??
    (caseId === JOIN_DEMO_CASE_ID ? JOIN_DEMO_CASE : undefined)
  );
}
