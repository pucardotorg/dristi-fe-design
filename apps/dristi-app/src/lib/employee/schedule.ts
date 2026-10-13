/**
 * Matters waiting for a hearing date — the scheduling worklist, as data.
 *
 * The sibling of `hearings.ts`: that module is the day the court is *sitting*, this one is
 * the queue of cases the court has not listed yet. They share the court-side vocabulary
 * rather than restating it — counsel, sides, the cause title, the page sizes all come from
 * `hearings.ts`, which the employee area already treats as the owner of those words. Only
 * the citizen side is off limits (see `content.ts`); inside `/employee` the two lists must
 * agree about what an advocate on record is.
 *
 * **There is no backend.** `SCHEDULING_QUEUE` is demo data shaped to exercise what the
 * screen has to survive: every stage, a corporate accused long enough to wrap the cause
 * title, sides with several counsel, and — the case that matters most here — matters at
 * cognizance where the accused has no counsel on record at all, because the accused has
 * not been called yet. No row is read from a case, a court or a queue.
 *
 * **Nothing here schedules anything.** Giving a matter a date is a real listing act and
 * this build performs none, so the table carries no row actions at all (see
 * `ScheduleTable`) — not even disabled ones. The list is honest about what the court is
 * owed; the act is simply not offered yet.
 */

import { type CourtCounsel } from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";

/**
 * Where a case has reached in the §138 process — a different axis from a hearing's
 * *purpose*, which is what one sitting is for. A case sits at a stage for as long as that
 * part of the trial takes; it is listed for a purpose on one day.
 *
 * The six the court lists from, drawn from the national journey
 * (`docs/product/domain/journey.md` §4–§8). Stages before cognizance — scrutiny, the
 * defect check — are the registry's queue and not a hearing to be given a date, so they
 * are not offered: a filter that can never match a row is a control that only ever
 * returns nothing.
 */
export type CaseStage =
  | "cognizance"
  | "appearance"
  | "plea"
  | "evidence"
  | "arguments"
  | "judgement";

export const CASE_STAGES: { id: CaseStage; label: string }[] = [
  { id: "cognizance", label: "Cognizance" },
  { id: "appearance", label: "Appearance" },
  { id: "plea", label: "Plea" },
  { id: "evidence", label: "Evidence" },
  { id: "arguments", label: "Arguments" },
  { id: "judgement", label: "Judgement" },
];

export function caseStageLabel(stage: CaseStage): string {
  return CASE_STAGES.find((entry) => entry.id === stage)?.label ?? stage;
}

export type SchedulingCase = {
  id: string;
  /**
   * `CMP/…` before cognizance is taken, `ST/…` after.
   *
   * Not decoration: a complaint carries its filing number until the magistrate takes it on
   * file, at which point it is numbered as a summary trial. The two prefixes in this list
   * therefore track the `stage` column beside them, and a row that disagreed with itself
   * would be the first thing a bench clerk noticed.
   */
  caseNumber: string;
  parties: { complainant: string; accused: string };
  /**
   * Counsel on record. A side may have none — at cognizance the accused has not been
   * called, so there is no vakalat for that side yet and the cell shows only the
   * complainant's line.
   */
  counsel: CourtCounsel[];
  stage: CaseStage;
};

/**
 * The matters this court owes a date.
 *
 * Names follow the fixtures the rest of the repo uses: local parties and the same bar as
 * the day's cause list — one court, one set of advocates practising in it.
 */
export const SCHEDULING_QUEUE: SchedulingCase[] = [
  {
    id: "s-1211",
    caseNumber: "CMP/1211/2026",
    parties: { complainant: "Jayaprakash Nair", accused: "Vithura Timbers" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    stage: "cognizance",
  },
  {
    id: "s-1350",
    caseNumber: "CMP/1350/2026",
    parties: { complainant: "Salma Beevi", accused: "Reshmi Ravindran" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    stage: "cognizance",
  },
  {
    id: "s-1441",
    caseNumber: "CMP/1441/2026",
    parties: {
      complainant: "Devika Menon",
      accused: "Ashtamudi Marine Foods and Cold Storage Pvt Ltd",
    },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Saurabh Verma", side: "complainant" },
    ],
    stage: "cognizance",
  },
  {
    id: "s-1522",
    caseNumber: "CMP/1522/2026",
    parties: { complainant: "Benny Mathew", accused: "Kanjirappally Motors" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    stage: "cognizance",
  },
  {
    id: "s-1785",
    caseNumber: "CMP/1785/2025",
    parties: { complainant: "Rehana Sherif", accused: "Neelakanta Jewellers" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    stage: "cognizance",
  },
  {
    id: "s-020",
    caseNumber: "ST/20/2026",
    parties: { complainant: "Girish Kumar", accused: "Paravur Poly Packs" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    stage: "appearance",
  },
  {
    id: "s-079",
    caseNumber: "ST/79/2026",
    parties: { complainant: "Latha Ammal", accused: "Sajeev Chandran" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    stage: "appearance",
  },
  {
    id: "s-094",
    caseNumber: "ST/94/2026",
    parties: { complainant: "Noushad Ali", accused: "Lakeside Tile Works" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    stage: "appearance",
  },
  {
    id: "s-112",
    caseNumber: "ST/112/2026",
    parties: { complainant: "Vidya Balachandran", accused: "Sreedhar Pillai" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    stage: "plea",
  },
  {
    id: "s-128",
    caseNumber: "ST/128/2026",
    parties: { complainant: "Ibrahim Kunju", accused: "Western Ghats Spices" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    stage: "plea",
  },
  {
    id: "s-143",
    caseNumber: "ST/143/2026",
    parties: { complainant: "Susan Jacob", accused: "Anugraha Builders" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "accused" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    stage: "evidence",
  },
  {
    id: "s-157",
    caseNumber: "ST/157/2026",
    parties: { complainant: "Prakash Pillai", accused: "Meridian Aqua Farms" },
    counsel: [
      { name: "Adv. Saurabh Verma", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    stage: "evidence",
  },
  {
    id: "s-166",
    caseNumber: "ST/166/2026",
    parties: { complainant: "Nazeema Rasheed", accused: "Karunagappally Agro" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    stage: "evidence",
  },
  {
    id: "s-178",
    caseNumber: "ST/178/2026",
    parties: { complainant: "Sudheer Nambiar", accused: "Quilon Steel Traders" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "accused" },
    ],
    stage: "arguments",
  },
  {
    id: "s-184",
    caseNumber: "ST/184/2026",
    parties: { complainant: "Elizabeth Thomas", accused: "Vinayak Enterprises" },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "accused" },
    ],
    stage: "arguments",
  },
  {
    id: "s-191",
    caseNumber: "ST/191/2026",
    parties: { complainant: "Manoj Sasidharan", accused: "Aster Print House" },
    counsel: [
      { name: "Adv. Saurabh Verma", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "accused" },
    ],
    stage: "judgement",
  },
  {
    id: "s-198",
    caseNumber: "ST/198/2026",
    parties: { complainant: "Bhavani Amma", accused: "Chinnakada Hardware" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Vinod Chandran", side: "accused" },
    ],
    stage: "judgement",
  },
];

/**
 * How many matters are waiting for a date — the number the rail carries beside "Schedule
 * hearing".
 *
 * Derived from the list rather than typed in beside the label, the way
 * `TODAYS_HEARING_COUNT` is, so the rail and the screen cannot disagree about the size of
 * the queue.
 */
export const SCHEDULING_QUEUE_COUNT = SCHEDULING_QUEUE.length;

export type ScheduleFilters = {
  stage: CaseStage | "all";
  /**
   * Free text over the cause title, the case number **and** counsel — wider than the day's
   * list, which does not search advocates. A clerk working this queue is as likely to be
   * asked "what is pending for Adv. Menon" as for a case number.
   */
  query: string;
};

export const EMPTY_SCHEDULE_FILTERS: ScheduleFilters = {
  stage: "all",
  query: "",
};

export function filterSchedulingCases(
  rows: SchedulingCase[],
  filters: ScheduleFilters,
): SchedulingCase[] {
  const query = caseSearchKey(filters.query);
  return rows.filter((entry) => {
    if (filters.stage !== "all" && entry.stage !== filters.stage) return false;
    if (!query) return true;
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
