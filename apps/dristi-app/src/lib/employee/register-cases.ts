/**
 * Complaints waiting to be registered — the court's intake queue, as data.
 *
 * The sibling of `schedule.ts` and `hearings.ts`: those modules are cases already on
 * file (waiting for a date, or listed today). This one is the queue *before* that —
 * complaints that have been submitted and have not yet been taken on the register.
 * They share the court-side vocabulary rather than restating it — counsel, sides, the
 * cause title, the page sizes all come from `hearings.ts`. Only the citizen side is
 * off limits (see `content.ts`).
 *
 * **There is no backend.** `REGISTER_QUEUE` is demo data shaped to exercise what the
 * screen has to survive: a wait long enough to dominate the column, a corporate accused
 * long enough to wrap the cause title, a side with several counsel, a complaint with
 * no vakalat on record at all, and enough rows to page at 10, 20 and 30. No row is
 * read from a case, a court or a queue.
 *
 * **Nothing here registers anything.** Taking a complaint on file is a real judicial
 * act and this build performs none, so the table carries no row actions at all (see
 * `RegisterCasesTable`) — not even disabled ones. The list is honest about what is
 * waiting; the act is simply not offered yet.
 *
 * Numbers are the filing number (`KL-NNNNNN-YYYY`), not a case number — a complaint
 * carries its filing number until the magistrate takes it on file, at which point it
 * is numbered as a summary trial (`ST/…`). These rows are all still waiting for that,
 * so there is no case number to show yet. They do not overlap the scheduling queue: a
 * complaint waiting to be registered is not also waiting for a hearing date.
 */

import { type CourtCounsel } from "./hearings";
import { caseSearchKey } from "@/lib/court/localize";

export type RegisterCase = {
  id: string;
  filingNumber: string;
  parties: { complainant: string; accused: string };
  /**
   * Counsel on record. A complaint may have none — it has been submitted, not yet
   * numbered, and a vakalat is not a given. The cell then shows nothing rather than a
   * dash: an empty advocates column on the reference was an absence, not a missing
   * value.
   */
  counsel: CourtCounsel[];
  /**
   * How long this complaint has been waiting, in whole days.
   *
   * Stored as a count rather than a submitted-on date so the demo does not drift as
   * the fixture sits. The screen renders the number; it does not compute it.
   */
  daysSinceSubmitted: number;
};

/**
 * The complaints this court has not yet registered.
 *
 * Ordered longest wait first — that is the scan the days column exists for, and the
 * order the reference showed. Names follow the fixtures the rest of the repo uses:
 * local parties and the same bar as the day's cause list — one court, one set of
 * advocates practising in it — but not the same matters as `SCHEDULING_QUEUE`.
 */
export const REGISTER_QUEUE: RegisterCase[] = [
  {
    id: "r-1840",
    filingNumber: "KL-001840-2025",
    parties: { complainant: "Rajan Krishnan", accused: "Quilon Cashew Exports" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    daysSinceSubmitted: 281,
  },
  {
    id: "r-1722",
    filingNumber: "KL-001722-2025",
    parties: { complainant: "Shiny Varghese", accused: "Thevally Boat Yard" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    daysSinceSubmitted: 240,
  },
  {
    id: "r-1654",
    filingNumber: "KL-001654-2025",
    parties: { complainant: "Ajith Kumar", accused: "Punalur Paper Depot" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    daysSinceSubmitted: 198,
  },
  {
    id: "r-1588",
    filingNumber: "KL-001588-2025",
    parties: { complainant: "Leela Kumari", accused: "Asramam Dairy Products" },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "complainant" },
    ],
    daysSinceSubmitted: 167,
  },
  {
    id: "r-1490",
    filingNumber: "KL-001490-2025",
    parties: { complainant: "Shihabudeen", accused: "Kottiyam Steel House" },
    counsel: [],
    daysSinceSubmitted: 142,
  },
  {
    id: "r-1402",
    filingNumber: "KL-001402-2025",
    parties: { complainant: "Geetha Nair", accused: "Chavara Minerals" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    daysSinceSubmitted: 118,
  },
  {
    id: "r-1333",
    filingNumber: "KL-001333-2025",
    parties: { complainant: "Mathew Philip", accused: "Ochira Furniture Mart" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    daysSinceSubmitted: 97,
  },
  {
    id: "r-1288",
    filingNumber: "KL-001288-2025",
    parties: { complainant: "Ramla Beevi", accused: "Mayyanad Fisheries" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    daysSinceSubmitted: 81,
  },
  {
    id: "r-1199",
    filingNumber: "KL-001199-2025",
    parties: { complainant: "Vijayakumar", accused: "Kundara Clay Works" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    daysSinceSubmitted: 73,
  },
  {
    id: "r-1104",
    filingNumber: "KL-001104-2025",
    parties: {
      complainant: "Soumya Rajan",
      accused: "Thangasseri Marine Stores and Ship Chandling",
    },
    counsel: [
      { name: "Adv. Suresh Menon", side: "complainant" },
      { name: "Adv. Latha Krishnan", side: "complainant" },
    ],
    daysSinceSubmitted: 64,
  },
  {
    id: "r-210",
    filingNumber: "KL-000210-2026",
    parties: { complainant: "Meenakshi S", accused: "Harbour Line Logistics" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Rekha Pillai", side: "complainant" },
    ],
    daysSinceSubmitted: 56,
  },
  {
    id: "r-188",
    filingNumber: "KL-000188-2026",
    parties: { complainant: "Haridasan", accused: "Lakeside Coir Exports" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    daysSinceSubmitted: 51,
  },
  {
    id: "r-176",
    filingNumber: "KL-000176-2026",
    parties: { complainant: "Jameela", accused: "Oachira Handlooms" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    daysSinceSubmitted: 48,
  },
  {
    id: "r-165",
    filingNumber: "KL-000165-2026",
    parties: { complainant: "Sreejith", accused: "Sasthamkotta Rice Traders" },
    counsel: [],
    daysSinceSubmitted: 44,
  },
  {
    id: "r-154",
    filingNumber: "KL-000154-2026",
    parties: { complainant: "Amina", accused: "Anchal Timber Depot" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    daysSinceSubmitted: 41,
  },
  {
    id: "r-148",
    filingNumber: "KL-000148-2026",
    parties: { complainant: "Gopalakrishnan", accused: "Kilikolloor Hardware" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    daysSinceSubmitted: 38,
  },
  {
    id: "r-441",
    filingNumber: "KL-000441-2026",
    parties: { complainant: "Fathima Beevi", accused: "Kadappakada Motors" },
    counsel: [],
    daysSinceSubmitted: 34,
  },
  {
    id: "r-428",
    filingNumber: "KL-000428-2026",
    parties: { complainant: "Bindhu", accused: "Pallimukku Electricals" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    daysSinceSubmitted: 31,
  },
  {
    id: "r-401",
    filingNumber: "KL-000401-2026",
    parties: { complainant: "Yousaf", accused: "Eravipuram Cement Store" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    daysSinceSubmitted: 28,
  },
  {
    id: "r-388",
    filingNumber: "KL-000388-2026",
    parties: { complainant: "Kavitha", accused: "Kottarakkara Spices" },
    counsel: [
      { name: "Adv. Anitha George", side: "complainant" },
      { name: "Adv. Feroz Hameed", side: "complainant" },
    ],
    daysSinceSubmitted: 26,
  },
  {
    id: "r-372",
    filingNumber: "KL-000372-2026",
    parties: { complainant: "Shaji", accused: "Mundakkal Auto Parts" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    daysSinceSubmitted: 23,
  },
  {
    id: "r-359",
    filingNumber: "KL-000359-2026",
    parties: { complainant: "Rosamma", accused: "Thekkumbhagam Printers" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    daysSinceSubmitted: 21,
  },
  {
    id: "r-341",
    filingNumber: "KL-000341-2026",
    parties: { complainant: "Anwar", accused: "Parippally Feeds" },
    counsel: [],
    daysSinceSubmitted: 19,
  },
  {
    id: "r-330",
    filingNumber: "KL-000330-2026",
    parties: { complainant: "Usha", accused: "Chathannoor Tiles" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    daysSinceSubmitted: 17,
  },
  {
    id: "r-318",
    filingNumber: "KL-000318-2026",
    parties: { complainant: "Dileep", accused: "Kottiyam Medical Agencies" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    daysSinceSubmitted: 15,
  },
  {
    id: "r-301",
    filingNumber: "KL-000301-2026",
    parties: { complainant: "Haseena", accused: "Adichanalloor Traders" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    daysSinceSubmitted: 13,
  },
  {
    id: "r-612",
    filingNumber: "KL-000612-2026",
    /* The queue's one complaint filed by an entity (`case-review.ts` marks it
       `complainantType: "institution"`), so the complainant is a firm and not a person:
       the *Company* tag beside the name has to sit on something that is one, and a
       registered office and an authorised signatory are what the file then prints
       instead of an age and two addresses. It read "Thomas Kurien" until 2026-09-11 —
       a person wearing a company's tag, which is the same defect as a constant fact
       wearing a fact's clothes. */
    parties: {
      complainant: "Kurien Agencies",
      accused: "Paravur Rice Mills and General Trading Pvt Ltd",
    },
    counsel: [
      { name: "Adv. Nisha Thomas", side: "complainant" },
      { name: "Adv. Saurabh Verma", side: "complainant" },
    ],
    daysSinceSubmitted: 12,
  },
  {
    id: "r-620",
    filingNumber: "KL-000620-2026",
    parties: { complainant: "Ravi", accused: "Kureepuzha Builders" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    daysSinceSubmitted: 11,
  },
  {
    id: "r-633",
    filingNumber: "KL-000633-2026",
    parties: { complainant: "Mini", accused: "Perinad Agro Mills" },
    counsel: [{ name: "Adv. Rekha Pillai", side: "complainant" }],
    daysSinceSubmitted: 9,
  },
  {
    id: "r-648",
    filingNumber: "KL-000648-2026",
    parties: { complainant: "Shameer", accused: "Sakthikulangara Harbour Stores" },
    counsel: [],
    daysSinceSubmitted: 8,
  },
  {
    id: "r-661",
    filingNumber: "KL-000661-2026",
    parties: { complainant: "Lissy", accused: "Kavanad Super Bazaar" },
    counsel: [{ name: "Adv. Latha Krishnan", side: "complainant" }],
    daysSinceSubmitted: 7,
  },
  {
    id: "r-674",
    filingNumber: "KL-000674-2026",
    parties: { complainant: "Unnikrishnan", accused: "Mulamkadakam Motors" },
    counsel: [{ name: "Adv. Saurabh Verma", side: "complainant" }],
    daysSinceSubmitted: 5,
  },
  {
    id: "r-688",
    filingNumber: "KL-000688-2026",
    parties: { complainant: "Beegum", accused: "Polayathode Cold Storage" },
    counsel: [{ name: "Adv. Feroz Hameed", side: "complainant" }],
    daysSinceSubmitted: 4,
  },
  {
    id: "r-701",
    filingNumber: "KL-000701-2026",
    parties: { complainant: "Arun", accused: "Mevaram Furniture" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    daysSinceSubmitted: 3,
  },
  {
    id: "r-714",
    filingNumber: "KL-000714-2026",
    parties: { complainant: "Saji", accused: "Vadakkevila Provisions" },
    counsel: [{ name: "Adv. Anitha George", side: "complainant" }],
    daysSinceSubmitted: 1,
  },
];

/**
 * How many complaints are waiting to be registered — the number the rail carries
 * beside "Register cases".
 *
 * Derived from the list rather than typed in beside the label, the way
 * `TODAYS_HEARING_COUNT` is, so the rail and the screen cannot disagree about the
 * size of the queue.
 */
export const REGISTER_QUEUE_COUNT = REGISTER_QUEUE.length;

/**
 * One waiting complaint, or nothing — the review screen looks a row up by id, and so
 * does the trail, which has to know whether a nested segment is a complaint before it
 * can say the page sits under Register cases.
 *
 * The sibling of `hearingById`, and asked the same way for the same reason: a route
 * that resolves against the queue cannot be fooled by a sibling path that merely looks
 * like an id.
 */
export function registerCaseById(id: string): RegisterCase | undefined {
  return REGISTER_QUEUE.find((entry) => entry.id === id);
}

export type RegisterFilters = {
  /**
   * Free text over the cause title, the case number and counsel — the same reach the
   * scheduling queue uses. The reference labelled the box "Case Name or No, Advocate".
   */
  query: string;
};

export const EMPTY_REGISTER_FILTERS: RegisterFilters = { query: "" };

export function filterRegisterCases(
  rows: RegisterCase[],
  filters: RegisterFilters,
): RegisterCase[] {
  const query = caseSearchKey(filters.query);
  if (!query) return rows;
  return rows.filter((entry) => {
    const haystack = [
      entry.parties.complainant,
      entry.parties.accused,
      entry.filingNumber,
      ...entry.counsel.map((counsel) => counsel.name),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

/** The number the table shows; the column header names the unit. */
export function formatDaysWaiting(days: number): string {
  return String(days);
}

/** The same fact, spoken — used on the stacked phone rows, where there is no header. */
export function formatDaysSinceSubmitted(days: number): string {
  return days === 1 ? "1 day since submitted" : `${days} days since submitted`;
}
