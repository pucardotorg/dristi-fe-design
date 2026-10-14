/**
 * SANDBOX DATA — the seed the front end runs on until a tasks service exists.
 *
 * Five advocates and their cases, and ~40 tasks that between them touch every kind,
 * every status, every view and every permission edge the screens must handle. Dates are
 * relative to *today*, so the seed never goes stale. Windows and closure rules follow
 * DRISTI 1.0's pending-task inventory: scrutiny returns cure in 5 days (owner, O7 —
 * 1.0 practice is nearer 3, and 5 stands until the rule is confirmed), payment tasks
 * auto-close when the hearing they serve passes, response tasks close when the court
 * decides the application. Nothing here has been sent to a real court.
 */

import {
  SCRUTINY_DEFECTS,
  SCRUTINY_DEFECTS_LAKSHMI,
  SCRUTINY_DEFECTS_RAFI,
  SCRUTINY_DRAFT_ID,
  SCRUTINY_DRAFT_ID_LAKSHMI,
  SCRUTINY_DRAFT_ID_RAFI,
  DEFECTS_BY_BASE,
  EXTRA_RETURNS,
} from "./scrutiny-return";
import type { Case, Defect, Person, Task } from "./types";

/** Bump when the seed's shape changes; a browser holding an older seed is re-seeded.
 *  (The seed stamp also folds in the people/case counts, so adding or removing
 *  fixture matters reseeds on its own even without a bump — see store.tsx.) */
export const SEED_VERSION = 28;

/**
 * A defect on a filing that was made outside this app, so there is no draft to open and
 * no field to point at: the remark stands against the filed bundle. Only the demonstrated
 * return (`t-retsainaba`) has a draft behind it — see `scrutiny-return.ts`.
 */
function bundleDefect(n: number, note: string): Defect {
  return {
    n,
    note,
    target: {
      kind: "doc",
      step: "documents",
      slotKey: `filed-bundle-${n}`,
      label: "The filed bundle",
      sectionLabel: "Documents",
    },
  };
}

/* ───────────────────────────── people ───────────────────────────── */

export const PEOPLE: Person[] = [
  { id: "p-an", name: "Anjali Nair", initials: "AN", role: "senior" },
  { id: "p-sp", name: "S. Prakash", initials: "SP", role: "junior" },
  { id: "p-dv", name: "Deepa Varghese", initials: "DV", role: "senior" },
  { id: "p-rm", name: "R. Manoj", initials: "RM", role: "senior" },
  { id: "p-ri", name: "Rahul Iyer", initials: "RI", role: "junior" },
  // Other advocates on the court docket — they carry the matters that are not the
  // viewer's, so the cause list reads as the court's full published list, not only
  // hers. The viewer is on none of these, so they never reach her board.
  { id: "p-o1", name: "Meera Pillai", initials: "MP", role: "senior" },
  { id: "p-o2", name: "Anil George", initials: "AG", role: "senior" },
  { id: "p-o3", name: "Joseph Mathew", initials: "JM", role: "senior" },
  { id: "p-o4", name: "Reena Thomas", initials: "RT", role: "junior" },
  { id: "p-o5", name: "Sunil Kumar", initials: "SK", role: "senior" },
  { id: "p-o6", name: "Fathima Latheef", initials: "FL", role: "junior" },
  { id: "p-o7", name: "Rajesh Menon", initials: "RM", role: "senior" },
  { id: "p-o8", name: "Divya Nair", initials: "DN", role: "junior" },
  { id: "p-o9", name: "Salim Ahmed", initials: "SA", role: "senior" },
  { id: "p-o10", name: "Latha Krishnan", initials: "LK", role: "senior" },
  { id: "p-o11", name: "George Kurian", initials: "GK", role: "junior" },
  { id: "p-o12", name: "Nisha Rawther", initials: "NR", role: "senior" },
];

/** Who the sandbox signs in as until the account menu says otherwise. */
export const DEFAULT_USER_ID = "p-an";

/* ───────────────────────────── dates ───────────────────────────── */

const DAY = 24 * 60 * 60 * 1000;

/** `days` from today at a given hour (local). Negative days are in the past. */
function at(days: number, hour = 17, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return new Date(d.getTime() + days * DAY).toISOString();
}

/** A hearing: 10:30 on that day. */
function hearing(days: number): string {
  return at(days, 10, 30);
}

/* ─────────────────────────── scale fixture ───────────────────────────
 * The bench, and the fill that stands in for the court complex's docket.
 * Anjali's own scale matters (SCALE_CASES) sit in the first few of these courts and
 * reach HER board; the far larger OTHER_CASES set below (other advocates, across
 * every court) is what makes the cause list read like the court's published list —
 * a long docket across the whole complex, only a fraction of it hers. Her board
 * still shows only the courts she is listed in, so widening this pool does not grow
 * the board. Demo scaffolding: remove the OTHER_CASES/SCALE blocks to return to the
 * small hand-authored day. */
const SCALE_COURTS = [
  // Only the 24×7 ON courts — the SARAS courts in Gujarat (owner, 2026-10-14): one
  // cause list per court, three courts.
  "24×7 ON Court",
  "24×7 ON Court 2",
  "24×7 ON Court 3",
];

const SCALE_NAMES = [
  "Rajesh Kumar", "Sunitha Rani", "Mohanan Nair", "Beena Thomas", "Latheef M.",
  "Girija Kumari", "Suresh Babu", "Ambika Devi", "Noushad Ali", "Remya S.",
  "Pradeep Kumar", "Sheela George", "Vijayan Pillai", "Anita Joseph", "Basheer K.",
  "Deepa Menon", "Sudheer Raj", "Maya Krishnan", "Firoz Khan", "Leela Bai",
  "Aravind Menon", "Shyamala Devi", "Thomas Varghese", "Nabeela P.", "Ravi Shankar",
  "Jaya Prakash", "Meenakshi S.", "Abdul Rahiman", "Prasad Kumar", "Sarita Nair",
  "Vinod Chandran", "Kavitha Mohan", "Shabana Iqbal", "Rekha Pillai", "Gopakumar V.",
  "Fathima Beevi", "Sanjay Menon", "Usha Rani", "Dinesh Kartha", "Priya Lakshmi",
];
const SCALE_ORGS = [
  "Coastal Traders", "Malabar Agencies", "Sea Queen Exports", "Highland Finance",
  "Kerala Motors", "Sunrise Textiles", "Green Valley Estates", "Anand Enterprises",
  "Royal Cashews", "Metro Hardwares", "Backwater Foods", "Pearl Marine",
  "Western Ghats Timber", "Shoreline Fisheries", "Cardamom County Estates",
  "Vembanad Traders", "Southern Spices", "Ashirvad Chits", "Meridian Motors",
  "Palm Grove Resorts", "Lakeside Cashew Co.", "Neptune Marine", "Orient Rubbers",
  "Silverline Finance",
];
const SCALE_STAGES = [
  "Appearance", "Plea", "Evidence of the complainant", "Cross-examination",
  "Arguments", "Cognizance", "Judgment",
];
const SCALE_EXTRAS = ["p-sp", "p-rm", "p-dv", "p-ri"] as const;

/** How many extra matters to list today, filling courts the hand-authored set
 *  (mostly the ON court) does not reach. Six, so the day is 17 hand-authored + 6
 *  = 23 matters — the launch-day size the board states (12 concluded, 3 now, 8
 *  upcoming). Their placement into those zones is authored in `todaySchedule`. */
const SCALE_COUNT = 6;

type CaseSeed = Omit<Case, "nextHearingAt">;

const SCALE_SEEDS: CaseSeed[] = Array.from({ length: SCALE_COUNT }, (_, i) => {
  const year = 2025 + (i % 2);
  const code = String((i % 6) + 1).padStart(2, "0");
  const seq = String(1000 + i * 17).padStart(6, "0");
  return {
    id: `c-sd${i}`,
    stNumber: `ST ${210 + i}/${year}`,
    cnr: `KLKL${code}-${seq}-${year}`,
    parties: `${SCALE_NAMES[i % SCALE_NAMES.length]} v. ${SCALE_ORGS[(i * 5) % SCALE_ORGS.length]}`,
    court: SCALE_COURTS[i % SCALE_COURTS.length],
    stage: SCALE_STAGES[i % SCALE_STAGES.length],
    signatories: ["p-an"],
    advocates: ["p-an", SCALE_EXTRAS[i % SCALE_EXTRAS.length]],
  };
});

/**
 * Today's board, authored to a launch-day size: 12 concluded, 3 being called now,
 * 8 upcoming — 23 matters in all, the counts the screen states. The three matters
 * carrying blocking tasks are split so the flag lands where work is still worth
 * doing: one (c-hd3) among the three ongoing, two (c-hd5, c-hd8) in the upcoming
 * band. The scale set (c-sd0–5) fills courts the hand-authored matters, clustered
 * in the ON court, do not reach.
 */
/* One matter is called at a time in a court, so "now" is one per court: c-hd3 (court
   1), c-hd6 (court 2), c-hd9 (court 3). c-hd3 is the one blocking matter here. */
const NOW_IDS = ["c-hd3", "c-hd6", "c-hd9"];
const CONCLUDED_IDS = [
  "c-sd0", "c-sd1", "c-sd2",
  "c-hd2", "c-hd4", "c-hd7", "c-hd10", "c-hd11", "c-hd12", "c-hd13", "c-hd14", "c-hd15",
]; // 12
const UPCOMING_IDS = [
  "c-hd5", "c-hd8", // the two blocking matters, still worth preparing for
  "c-hd1",
  "c-sd3", "c-sd4", "c-sd5", "c-hd16", "c-hd17",
]; // 7

/**
 * Today's cause list, built when the sandbox is seeded.
 *
 * Roles are assigned by list, not left to emerge from a grid: the zone counts are
 * exact (the board states them), so each group is placed deliberately around the
 * home's 14:10 demo clock — the morning concluded, ~2 pm being called now, the
 * afternoon upcoming. The backend keeps these times; the launch view hides them
 * (config `lib/advocate/config`) and only their zone shows, but a fuller config
 * surfaces and groups by them. Which matters read as "now" is still decided at
 * read time against the clock, so the day always reads as one in progress.
 */
function todaySchedule(): Record<string, string> {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const slotAt = (minutes: number) =>
    new Date(base.getTime() + minutes * 60 * 1000).toISOString();

  const schedule: Record<string, string> = {};
  // Concluded: the morning in pairs on a 30-minute grid from 09:00 — a shared
  // time is invisible in the flat launch view and gives a fuller config a
  // conflict to show. All fall before the ~12:40 edge of the live window.
  CONCLUDED_IDS.forEach((id, i) => {
    schedule[id] = slotAt(9 * 60 + Math.floor(i / 2) * 30);
  });
  // Now: inside the 90-minute live window that ends at the 14:10 demo clock.
  NOW_IDS.forEach((id, i) => {
    schedule[id] = slotAt(13 * 60 + i * 20);
  });
  // Upcoming: the afternoon, after the live window through the sitting's end.
  UPCOMING_IDS.forEach((id, i) => {
    schedule[id] = slotAt(14 * 60 + 30 + i * 20);
  });
  return schedule;
}

const TODAY = todaySchedule();

/** The listed time of a matter on today's board. */
/** The ISO date `n` days before the seed day: when a carried-over matter was passed over. */
function daysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function listedToday(id: string): string {
  return TODAY[id];
}

/** The scale matters, each bound to the block time the schedule gave it. */
const SCALE_CASES: Case[] = SCALE_SEEDS.map((seed) => ({
  ...seed,
  nextHearingAt: listedToday(seed.id),
}));

/* ─────────── recent past days (concluded boards) ───────────
 * The home reads `Case.nextHearingAt` as a matter's listed time, so to give the
 * days behind today a real concluded cause list (rather than an empty board) a
 * modest set of matters is seeded on each of the last few days. They surface only
 * when that past day is selected — the timeline is per-day — so today's counts and
 * the scale set are untouched. Being cases, they also add to Your Cases: demo
 * scaffolding, like the scale block; remove it to return to a today-only fixture. */
const PAST_DAY_COUNT = 6;
const PER_PAST_DAY = 10;

function pastCases(): Case[] {
  // 10:00–16:00 on a 30-minute grid; the ten matters wrap over the first seven
  // blocks so a few share a slot and a past day shows the same conflict clusters
  // as today rather than a flat single-file list.
  const blocks: number[] = [];
  for (let m = 10 * 60; m <= 16 * 60; m += 30) blocks.push(m);
  const out: Case[] = [];
  for (let d = 1; d <= PAST_DAY_COUNT; d += 1) {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    midnight.setDate(midnight.getDate() - d);
    for (let i = 0; i < PER_PAST_DAY; i += 1) {
      const n = d * 100 + i;
      const year = 2025 + (n % 2);
      const code = String((n % 6) + 1).padStart(2, "0");
      const seq = String(3000 + n * 13).padStart(6, "0");
      const block = blocks[i % 7];
      out.push({
        id: `c-pd${d}-${i}`,
        stNumber: `ST ${500 + n}/${year}`,
        cnr: `KLKL${code}-${seq}-${year}`,
        parties: `${SCALE_NAMES[n % SCALE_NAMES.length]} v. ${SCALE_ORGS[(n * 3) % SCALE_ORGS.length]}`,
        court: SCALE_COURTS[i % SCALE_COURTS.length],
        stage: SCALE_STAGES[n % SCALE_STAGES.length],
        signatories: ["p-an"],
        advocates: ["p-an", SCALE_EXTRAS[n % SCALE_EXTRAS.length]],
        nextHearingAt: new Date(midnight.getTime() + block * 60 * 1000).toISOString(),
      });
    }
  }
  return out;
}

/** Concluded matters on the recent past days, so those days are not empty. */
const PAST_CASES: Case[] = pastCases();

/* ─────────── other advocates' matters (the rest of today's docket) ───────────
 * Matters listed today that the viewer (Anjali) is NOT on. They never reach her
 * board — the board is her own cases — but they fill the court's published cause
 * list, so it reads like a real published list: a long docket across every court,
 * advocate, stage and status, of which her ~two dozen matters are only a small
 * slice. Sized so the list feels the scale of a district complex's day. Being
 * outside her cases, they add nothing to Your Cases, the calendar, or the board's
 * counts; they surface in the cause list alone. */
const OTHER_ADVOCATES = [
  "p-o1", "p-o2", "p-o3", "p-o4", "p-o5", "p-o6",
  "p-o7", "p-o8", "p-o9", "p-o10", "p-o11", "p-o12",
] as const;
const OTHER_COUNT = 120;

function otherCases(): Case[] {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  // Spread across 09:00–17:00 so the docket carries other advocates' matters in
  // every status — concluded through the morning, one being called around the
  // demo clock, the rest upcoming.
  /* Kept clear of the 12:30–14:20 band where her three matters are being called, so
     in each court the matter being heard now is hers — one matter at a time. */
  const morning = 12 * 60 + 30 - 9 * 60;
  const span = morning + (17 * 60 - (14 * 60 + 20));
  return Array.from({ length: OTHER_COUNT }, (_, i) => {
    const year = 2025 + (i % 2);
    const code = String((i % 6) + 1).padStart(2, "0");
    const seq = String(2000 + i * 19).padStart(6, "0");
    const offset = Math.round((i / (OTHER_COUNT - 1)) * span);
    const minutes =
      offset < morning ? 9 * 60 + offset : 14 * 60 + 20 + (offset - morning);
    const lead = OTHER_ADVOCATES[i % OTHER_ADVOCATES.length];
    const second = OTHER_ADVOCATES[(i + 2) % OTHER_ADVOCATES.length];
    return {
      id: `c-ot${i}`,
      stNumber: `ST ${300 + i}/${year}`,
      cnr: `KLKL${code}-${seq}-${year}`,
      parties: `${SCALE_NAMES[(i * 3) % SCALE_NAMES.length]} v. ${SCALE_ORGS[(i * 7) % SCALE_ORGS.length]}`,
      court: SCALE_COURTS[i % SCALE_COURTS.length],
      stage: SCALE_STAGES[i % SCALE_STAGES.length],
      // Every third matter reads as passed over; it only shows once concluded.
      passedOver: i % 3 === 0,
      signatories: [lead],
      advocates: [lead, second],
      nextHearingAt: new Date(base.getTime() + minutes * 60 * 1000).toISOString(),
    };
  });
}

/** The rest of the day's docket — other advocates' matters, cause list only. */
const OTHER_CASES: Case[] = otherCases();

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ───────────────────────────── cases ───────────────────────────── */

/**
 * How long a scrutiny return leaves to fix the defects.
 *
 * Open question O7: the real window is not confirmed — practice is believed to be around
 * three days, and the brief's instruction is to assume five until the rule is known. So
 * the fixture assumes five *and says that it is assuming*. Stating it as the Registry's
 * rule would put an invented deadline in front of someone who has a statutory clock
 * running (`docs/product/product-foundation.md` §3).
 */
const RETURN_WINDOW_NOTE =
  "Assumed 5 days from the return to fix the defects — the Registry's window is not yet confirmed";

const ON = "24×7 ON Court";
/* Every court in the demo is a 24×7 ON court — the SARAS courts (owner, 2026-10-14). */
const JMFC1 = "24×7 ON Court 2";
const JMFC2 = "24×7 ON Court 3";
const CJM = "24×7 ON Court 3";

// Vakalatnamas: the first signatory is the main advocate. Anjali (the default identity)
// is a signatory on some cases, only on the case on others, and absent from a few.
export const CASES: Case[] = [
  { id: "c-412", stNumber: "ST 412/2025", cnr: "KLKL01-000412-2025", parties: "Sreekumar N. v. Vismaya Traders", court: ON, stage: "Evidence of the complainant", nextHearingAt: hearing(2), signatories: ["p-an", "p-rm"], advocates: ["p-an", "p-rm", "p-sp"] },
  { id: "c-88", stNumber: "ST 88/2026", cnr: "KLKL01-000088-2026", parties: "Fathima Beevi v. Anil Kumar K.", court: ON, stage: "Plea", nextHearingAt: hearing(1), signatories: ["p-an"], advocates: ["p-an", "p-ri"] },
  { id: "c-941", stNumber: "ST 941/2025", cnr: "KLKL01-000941-2025", parties: "Anitha Joseph v. Latheef M.", court: ON, stage: "Evidence of the complainant", nextHearingAt: hearing(9), signatories: ["p-dv"], advocates: ["p-dv", "p-an", "p-sp"] },
  { id: "c-1102", stNumber: "ST 1102/2026", cnr: "KLKL01-001102-2026", parties: "Nirmala T. v. Ashique P.", court: ON, stage: "Appearance", nextHearingAt: hearing(16), signatories: ["p-rm"], advocates: ["p-rm", "p-an"] },
  { id: "c-217", stNumber: "ST 217/2025", cnr: "KLKL02-000217-2025", parties: "Suresh Babu v. Kairali Motors", court: JMFC1, stage: "Plea", nextHearingAt: hearing(5), signatories: ["p-rm", "p-dv"], advocates: ["p-rm", "p-dv"] },
  { id: "c-509", stNumber: "ST 509/2025", cnr: "KLKL02-000509-2025", parties: "Lakshmi Menon v. P. J. Thomas", court: JMFC1, stage: "Evidence of the complainant", nextHearingAt: hearing(12), signatories: ["p-an"], advocates: ["p-an", "p-sp"] },
  { id: "c-144", stNumber: "ST 144/2025", cnr: "KLKL02-000144-2025", parties: "K. Radhakrishnan v. Chandy & Sons", court: JMFC1, stage: "Arguments", nextHearingAt: hearing(20), signatories: ["p-an", "p-dv"], advocates: ["p-an", "p-dv", "p-sp"] },
  { id: "c-71", stNumber: "ST 71/2025", cnr: "KLKL03-000071-2025", parties: "Joseph Mathew v. Star Traders", court: JMFC2, stage: "Evidence of the complainant", nextHearingAt: hearing(7), signatories: ["p-dv"], advocates: ["p-dv", "p-ri"] },
  { id: "c-381", stNumber: "ST 381/2025", cnr: "KLKL03-000381-2025", parties: "Rukhiya Beevi v. N. Pillai", court: JMFC2, stage: "Cognizance", nextHearingAt: hearing(30), signatories: ["p-an"], advocates: ["p-an"] },
  { id: "c-52", stNumber: "ST 52/2025", cnr: "KLKL04-000052-2025", parties: "Shaji P. v. Lakeside Cashew Co.", court: CJM, stage: "Evidence of the complainant", nextHearingAt: hearing(3), signatories: ["p-dv", "p-an"], advocates: ["p-dv", "p-an", "p-sp"] },
  { id: "c-221", stNumber: "ST 221/2025", cnr: "KLKL01-000221-2025", parties: "Ramesh P. v. Coastal Traders", court: ON, stage: "Evidence of the complainant", nextHearingAt: hearing(18), signatories: ["p-rm"], advocates: ["p-rm", "p-an", "p-sp"] },
  { id: "c-377", stNumber: "ST 377/2025", cnr: "KLKL01-000377-2025", parties: "Sujatha R. v. M. Haneefa", court: ON, stage: "Evidence of the complainant", nextHearingAt: hearing(25), signatories: ["p-rm"], advocates: ["p-rm", "p-ri"] },
  { id: "c-633", stNumber: "ST 633/2025", cnr: "KLKL01-000633-2025", parties: "Sheeba Rasheed v. Muhammed Ashraf", court: ON, stage: "Evidence of the complainant", nextHearingAt: hearing(4), signatories: ["p-rm"], advocates: ["p-rm", "p-an", "p-sp"] },
  { id: "c-702", stNumber: "ST 702/2025", cnr: "KLKL02-000702-2025", parties: "Manoj Kurian v. Highrange Estates", court: JMFC1, stage: "Evidence of the complainant", nextHearingAt: hearing(3), signatories: ["p-an"], advocates: ["p-an", "p-ri"] },
  { id: "c-815", stNumber: "ST 815/2025", cnr: "KLKL04-000815-2025", parties: "Vinod Chandran v. Sabari Traders", court: CJM, stage: "Arguments", nextHearingAt: hearing(10), signatories: ["p-an", "p-dv"], advocates: ["p-an", "p-dv"] },
  { id: "c-1044", stNumber: "ST 1044/2026", cnr: "KLKL03-001044-2026", parties: "Beena Thomas v. A. Salim", court: JMFC2, stage: "Appearance", nextHearingAt: hearing(22), signatories: ["p-dv"], advocates: ["p-dv", "p-an"] },
  // ── Today's cause list ───────────────────────────────────────────
  // Seventeen matters listed today across three courts (ON 12 · JMFC 1 3 · CJM 2),
  // timed by `TODAY_OFFSET` so the day always reads as a day in progress. Anjali
  // is a signatory on most; four (c-hd4, c-hd7, c-hd12, c-hd15) she can see but
  // not act on — the vakalatnama split the home screen marks on the card itself.
  { id: "c-hd1", stNumber: "ST 268/2025", cnr: "KLKL01-000268-2025", parties: "Prakash Kumar v. Malabar Traders", court: ON, stage: "Evidence of the complainant", nextHearingAt: listedToday("c-hd1"), signatories: ["p-an"], advocates: ["p-an", "p-sp"] },
  { id: "c-hd2", stNumber: "ST 743/2025", cnr: "KLKL01-000743-2025", parties: "Divya Suresh v. K. Salim", court: ON, stage: "Plea", nextHearingAt: listedToday("c-hd2"), passedOver: true, signatories: ["p-an", "p-rm"], advocates: ["p-an", "p-rm"] },
  { id: "c-hd3", stNumber: "ST 512/2025", cnr: "KLKL01-000512-2025", parties: "Gopinathan Nair v. Chaithanya Agencies", court: ON, stage: "Evidence of the complainant", nextHearingAt: listedToday("c-hd3"), signatories: ["p-an"], advocates: ["p-an", "p-sp"] },
  { id: "c-hd4", stNumber: "ST 391/2026", cnr: "KLKL01-000391-2026", parties: "Mariyam Bee v. Anwar Sadath", court: ON, stage: "Appearance", nextHearingAt: listedToday("c-hd4"), signatories: ["p-dv"], advocates: ["p-dv", "p-an"] },
  { id: "c-hd5", stNumber: "ST 129/2026", cnr: "KLKL01-000129-2026", parties: "Ravi Chandran v. Sea Pearl Exports", court: ON, stage: "Evidence of the complainant", nextHearingAt: listedToday("c-hd5"), signatories: ["p-an", "p-dv"], advocates: ["p-an", "p-dv", "p-sp"] },
  { id: "c-hd6", stNumber: "ST 84/2026", cnr: "KLKL02-000084-2026", parties: "Salini Mohan v. Grand Textiles", court: JMFC1, stage: "Plea", nextHearingAt: listedToday("c-hd6"), signatories: ["p-an"], advocates: ["p-an", "p-ri"] },
  { id: "c-hd7", stNumber: "ST 610/2025", cnr: "KLKL02-000610-2025", parties: "Peter Varghese v. Nila Finance", court: JMFC1, stage: "Arguments", nextHearingAt: listedToday("c-hd7"), signatories: ["p-rm"], advocates: ["p-rm", "p-an"] },
  { id: "c-hd8", stNumber: "ST 233/2025", cnr: "KLKL02-000233-2025", parties: "Asha Kumari v. Vel Murugan Stores", court: JMFC1, stage: "Evidence of the complainant", nextHearingAt: listedToday("c-hd8"), signatories: ["p-an"], advocates: ["p-an", "p-sp"] },
  { id: "c-hd9", stNumber: "ST 47/2025", cnr: "KLKL04-000047-2025", parties: "Krishnan Kutty v. Sree Devi Traders", court: CJM, stage: "Arguments", nextHearingAt: listedToday("c-hd9"), signatories: ["p-an"], advocates: ["p-an"] },
  { id: "c-hd10", stNumber: "ST 902/2025", cnr: "KLKL04-000902-2025", parties: "Noor Jahan v. Kadavil Motors", court: CJM, stage: "Appearance", nextHearingAt: listedToday("c-hd10"), signatories: ["p-dv", "p-an"], advocates: ["p-dv", "p-an"] },
  // Seven more in the ON court, so the flagship board runs twelve deep — enough
  // to see how the day scales, and how a matter reads when three or four
  // advocates share it: some sign together, some only have case access.
  { id: "c-hd11", stNumber: "ST 318/2025", cnr: "KLKL01-000318-2025", parties: "Vasanthi Amma v. Deepak Nambiar", court: ON, stage: "Evidence of the complainant", nextHearingAt: listedToday("c-hd11"), signatories: ["p-an", "p-dv"], advocates: ["p-an", "p-dv", "p-sp", "p-ri"] },
  { id: "c-hd12", stNumber: "ST 655/2026", cnr: "KLKL01-000655-2026", parties: "Faisal Rahman v. Ponnamma K.", court: ON, stage: "Appearance", nextHearingAt: listedToday("c-hd12"), signatories: ["p-rm"], advocates: ["p-rm", "p-an", "p-sp"] },
  { id: "c-hd13", stNumber: "ST 205/2026", cnr: "KLKL01-000205-2026", parties: "Leelamma Joy v. Sunrise Plywoods", court: ON, stage: "Cross-examination", nextHearingAt: listedToday("c-hd13"), timeFixed: true, signatories: ["p-an"], advocates: ["p-an", "p-sp"] },
  { id: "c-hd14", stNumber: "ST 471/2025", cnr: "KLKL01-000471-2025", parties: "Abdul Latheef v. Thejas Marine", court: ON, stage: "Plea", nextHearingAt: listedToday("c-hd14"), signatories: ["p-an", "p-rm", "p-dv"], advocates: ["p-an", "p-rm", "p-dv", "p-sp"] },
  { id: "c-hd15", stNumber: "ST 830/2025", cnr: "KLKL01-000830-2025", parties: "Sarala Devi v. Kochu Varkey", court: ON, stage: "Arguments", nextHearingAt: listedToday("c-hd15"), signatories: ["p-dv"], advocates: ["p-dv", "p-an", "p-ri"] },
  { id: "c-hd16", stNumber: "ST 96/2026", cnr: "KLKL01-000096-2026", parties: "Jaseela Beegum v. Anand Motors", court: ON, stage: "Evidence of the complainant", nextHearingAt: listedToday("c-hd16"), passedOverOn: daysAgoKey(1), signatories: ["p-an"], advocates: ["p-an", "p-ri", "p-sp"] },
  { id: "c-hd17", stNumber: "ST 1190/2026", cnr: "KLKL01-001190-2026", parties: "Rajeev Menon v. Padmini Traders", court: ON, stage: "Appearance", nextHearingAt: listedToday("c-hd17"), passedOverOn: daysAgoKey(3), signatories: ["p-an", "p-sp"], advocates: ["p-an", "p-sp"] },
  // Substantial postings in the fortnight ahead — evidence, cross and arguments
  // an advocate has to be ready for well before the day arrives.
  { id: "c-pa1", stNumber: "ST 559/2025", cnr: "KLKL01-000559-2025", parties: "Girija Kumari v. Elite Hardwares", court: ON, stage: "Cross-examination", nextHearingAt: hearing(3), signatories: ["p-an", "p-dv"], advocates: ["p-an", "p-dv", "p-sp"] },
  { id: "c-pa2", stNumber: "ST 1073/2026", cnr: "KLKL01-001073-2026", parties: "Hariharan P. v. Blue Wave Foods", court: ON, stage: "Arguments", nextHearingAt: hearing(11), signatories: ["p-an"], advocates: ["p-an", "p-ri"] },
  { id: "c-pa3", stNumber: "ST 284/2026", cnr: "KLKL02-000284-2026", parties: "Zainaba M. v. Crescent Steels", court: JMFC1, stage: "Evidence of the accused", nextHearingAt: hearing(14), signatories: ["p-dv", "p-an"], advocates: ["p-dv", "p-an", "p-sp"] },
  // ── The weeks ahead ──────────────────────────────────────────────
  // The diary an advocate actually carries: most days after today hold something,
  // at varied hours, substantial and procedural mixed, so the week strip, the
  // "next hearing day" jump and the prep queue all have real ground under them.
  { id: "c-up1", stNumber: "ST 447/2025", cnr: "KLKL01-000447-2025", parties: "Thankamani P. v. Vayalar Traders", court: ON, stage: "Cross-examination", nextHearingAt: at(1, 11, 0), signatories: ["p-an"], advocates: ["p-an", "p-sp"] },
  { id: "c-up2", stNumber: "ST 918/2026", cnr: "KLKL02-000918-2026", parties: "Basheer K. v. Malabar Gold Mart", court: JMFC1, stage: "Appearance", nextHearingAt: at(1, 14, 30), timeFixed: true, signatories: ["p-rm", "p-an"], advocates: ["p-rm", "p-an"] },
  { id: "c-up3", stNumber: "ST 122/2026", cnr: "KLKL01-000122-2026", parties: "Susheela Devi v. Anand Cements", court: ON, stage: "Evidence of the complainant", nextHearingAt: at(2, 10, 0), signatories: ["p-an", "p-dv"], advocates: ["p-an", "p-dv", "p-ri"] },
  { id: "c-up4", stNumber: "ST 736/2025", cnr: "KLKL04-000736-2025", parties: "Ibrahim Kutty v. Sagara Fisheries", court: CJM, stage: "Arguments", nextHearingAt: at(2, 15, 0), signatories: ["p-dv"], advocates: ["p-dv", "p-an"] },
  { id: "c-up5", stNumber: "ST 65/2026", cnr: "KLKL01-000065-2026", parties: "Remani Amma v. Kuttan Pillai", court: ON, stage: "Plea", nextHearingAt: at(4, 11, 30), signatories: ["p-an"], advocates: ["p-an", "p-sp", "p-ri"] },
  { id: "c-up6", stNumber: "ST 1281/2026", cnr: "KLKL02-001281-2026", parties: "Nazeer M. v. Kerala Spice Board", court: JMFC1, stage: "Cross-examination", nextHearingAt: at(5, 10, 30), signatories: ["p-an", "p-rm"], advocates: ["p-an", "p-rm", "p-sp"] },
  { id: "c-up7", stNumber: "ST 503/2025", cnr: "KLKL03-000503-2025", parties: "Ammini George v. Padma Textiles", court: JMFC2, stage: "Evidence of the complainant", nextHearingAt: at(4, 14, 0), signatories: ["p-an"], advocates: ["p-an", "p-dv"] },
  { id: "c-up8", stNumber: "ST 194/2026", cnr: "KLKL01-000194-2026", parties: "Devassy Joseph v. Anchor Marine", court: ON, stage: "Appearance", nextHearingAt: at(8, 10, 30), signatories: ["p-rm"], advocates: ["p-rm", "p-an"] },
  { id: "c-up9", stNumber: "ST 872/2025", cnr: "KLKL01-000872-2025", parties: "Radhamani T. v. Sunlight Agro", court: ON, stage: "Evidence of the accused", nextHearingAt: at(13, 11, 0), signatories: ["p-an", "p-dv"], advocates: ["p-an", "p-dv", "p-sp"] },
  { id: "c-up10", stNumber: "ST 331/2026", cnr: "KLKL04-000331-2026", parties: "Ouseph Varkey v. Nilgiri Rubbers", court: CJM, stage: "Arguments", nextHearingAt: at(17, 10, 30), signatories: ["p-an"], advocates: ["p-an", "p-ri"] },
  // ── Scale test: ~20 courts, ~48 more matters listed today (demo scaffolding) ──
  ...SCALE_CASES,
  // ── Concluded boards on the recent past days, so a past day is not empty ──
  ...PAST_CASES,
  // ── Other advocates' matters today — the rest of the court docket (cause list only) ──
  ...OTHER_CASES,
  // Matters before filing — no ST number, no CNR yet; the statutory clocks live here.
  { id: "c-sainaba", stNumber: "", cnr: "", parties: "Sainaba K. v. Riyas M.", court: ON, stage: "Pre-filing", signatories: ["p-an"], advocates: ["p-an", "p-sp"] },
  { id: "c-lakshmi", stNumber: "", cnr: "", parties: "Lakshmi Devi v. Thomas Kurian", court: ON, stage: "Pre-filing", signatories: ["p-an"], advocates: ["p-an", "p-sp"] },
  { id: "c-rafi", stNumber: "", cnr: "", parties: "Mohammed Rafi v. Suresh Babu", court: ON, stage: "Pre-filing", signatories: ["p-an"], advocates: ["p-an", "p-sp"] },
  { id: "c-arun", stNumber: "", cnr: "", parties: "Arun K. v. Meera Enterprises", court: ON, stage: "Pre-filing", signatories: ["p-rm"], advocates: ["p-rm", "p-sp"] },
  { id: "c-bindu", stNumber: "", cnr: "", parties: "Bindu S. v. Kerala Agro Traders", court: ON, stage: "Pre-filing", signatories: ["p-an"], advocates: ["p-an", "p-sp"] },
  // More returned filings for the demo (`EXTRA_RETURNS`).
  ...EXTRA_RETURNS.map((extra): Case => ({
    id: extra.caseId,
    stNumber: "",
    cnr: "",
    parties: `${extra.complainant} v. ${extra.accused}`,
    court: ON,
    stage: "Pre-filing",
    signatories: ["p-an"],
    advocates: ["p-an", "p-sp"],
  })),
];

/* ───────────────────────────── tasks ───────────────────────────── */

type Seed = Omit<Task, "history" | "createdAt" | "isBlocking" | "systemObservable"> & {
  createdAt?: string;
  history?: Task["history"];
  isBlocking?: boolean;
  systemObservable?: boolean;
};

/** Fill the defaults the kind implies, and open every task with a "created" line. */
function task(seed: Seed): Task {
  const createdAt = seed.createdAt ?? seed.why.at;
  // Hearing tasks happen in court — the system cannot see them; everything else closes
  // on its event (signature, payment, acceptance).
  const systemObservable = seed.systemObservable ?? seed.kind !== "hearing";
  return {
    ...seed,
    isBlocking: seed.isBlocking ?? !!seed.hearingAt,
    createdAt,
    systemObservable,
    history: seed.history ?? [{ at: createdAt, text: `Created — ${seed.why.event}` }],
  };
}

const RUPEE = 100;

export function buildTasks(): Task[] {
  const created = (days: number, event: string) => ({ event, at: at(days, 11) });
  const order = (days: number) => `Order dated ${shortDate(at(days))}`;

  return [
    /* ── To sign ─────────────────────────────────────────────────── */
    task({
      id: "t-vak633",
      caseId: "c-633",
      kind: "sign",
      title: "Sign the vakalatnama for the additional complainant",
      why: created(-9, `The additional complainant was impleaded by ${order(-9).toLowerCase()}`),
      whatToDo: "The vakalatnama for the additional complainant needs the advocate's signature before the next posting.",
      documentsNeeded: ["Vakalatnama (additional complainant)"],
      dueAt: at(-7),
      dueKind: "court-set",
      deadlineNote: "To be filed within 2 days of the impleading order",
      status: "open",
    }),
    task({
      id: "t-sign88",
      caseId: "c-88",
      kind: "sign",
      title: "Sign the proof affidavit of the complainant",
      why: created(-5, `Affidavit prepared for the plea posting on ${shortDate(hearing(1))}`),
      whatToDo: "Read the affidavit and e-sign it. The signed copy attaches to the task and the case file.",
      documentsNeeded: ["Proof affidavit of the complainant"],
      dueAt: at(1, 9),
      dueKind: "before-hearing",
      deadlineNote: `Before the posting on ${shortDate(hearing(1))}`,
      hearingAt: hearing(1),
      status: "open",
    }),
    task({
      id: "t-ready412",
      caseId: "c-412",
      kind: "sign",
      title: "Sign the application to condone the delay",
      why: created(-4, "The complaint was presented after the limitation period; an application under the proviso to section 142 is needed"),
      whatToDo: "Read the application and the affidavit in support, then e-sign. S. Prakash drafted both from the notice dates.",
      documentsNeeded: ["Application to condone the delay", "Affidavit in support"],
      dueAt: at(2),
      dueKind: "court-set",
      deadlineNote: "Registry: to be filed before the next posting",
      status: "ready",
      statusNote: "Prepared by S. Prakash",
      prepared: {
        by: "p-sp",
        at: at(-1, 16, 40),
        note: "Drafted from the notice dates on the file. The postal receipts are annexed as A3 and A4.",
        files: [{ id: "seed-f-cond", name: "condonation-application.pdf", size: 96_512, type: "application/pdf", ext: "PDF", slot: "Application to condone the delay" }],
      },
      files: [{ id: "seed-f-cond", name: "condonation-application.pdf", size: 96_512, type: "application/pdf", ext: "PDF", slot: "Application to condone the delay" }],
      history: [
        { at: at(-4, 11), text: "Created — application under the proviso to section 142 needed" },
        { at: at(-2, 15), by: "p-sp", text: "S. Prakash saved a draft" },
        { at: at(-1, 16, 40), by: "p-sp", text: "S. Prakash marked this ready — “Drafted from the notice dates on the file. The postal receipts are annexed as A3 and A4.”" },
      ],
    }),
    task({
      id: "t-sign221",
      caseId: "c-221",
      kind: "sign",
      title: "Sign the affidavit of service of the summons",
      why: created(-3, "The summons was served by hand on the accused; an affidavit of service is to be filed"),
      whatToDo: "Confirm the date and manner of service in the affidavit, then e-sign it.",
      documentsNeeded: ["Affidavit of service"],
      dueAt: at(5),
      dueKind: "court-set",
      deadlineNote: "Before the next posting",
      status: "open",
    }),
    task({
      id: "t-signdone144",
      caseId: "c-144",
      kind: "sign",
      title: "Sign the vakalatnama for the complainant",
      why: created(-20, "Vakalatnama executed by the complainant on engagement"),
      whatToDo: "Accept the vakalatnama by e-signing it.",
      documentsNeeded: ["Vakalatnama"],
      dueAt: at(-18),
      dueKind: "court-set",
      status: "done",
      completion: { by: "p-an", at: at(-18, 12, 5), how: "event", receipt: "ESIGN-7KQ2M9PXV4" },
      history: [
        { at: at(-20, 11), text: "Created — vakalatnama executed on engagement" },
        { at: at(-18, 12, 5), by: "p-an", text: "Anjali Nair signed with Aadhaar e-Sign — ESIGN-7KQ2M9PXV4" },
      ],
    }),

    /* ── To pay ──────────────────────────────────────────────────── */
    task({
      id: "t-fee412",
      caseId: "c-412",
      kind: "pay",
      title: "Pay the process fee for the summons",
      why: created(-43, "Summons issued to the accused — process fee payable for service by post"),
      whatToDo: "Pay the process fee so the registry can dispatch the summons. The receipt attaches to the case file.",
      amountPaise: 40 * RUPEE,
      feeHead: "Process fee",
      dueAt: at(-41),
      dueKind: "court-set",
      deadlineNote: `${order(-43)}: process fee to be paid within 2 days`,
      hearingAt: hearing(2),
      closesWhen: "Closes on payment, or when the hearing passes",
      status: "open",
    }),
    task({
      id: "t-payfailed702",
      caseId: "c-702",
      kind: "pay",
      title: "Pay the process fee for the witness summons",
      why: created(-3, `Summons ordered to PW-3 by ${order(-3).toLowerCase()}`),
      whatToDo: "Pay the process fee so the summons can go out before the evidence posting.",
      amountPaise: 200 * RUPEE,
      feeHead: "Process fee",
      dueAt: at(1),
      dueKind: "court-set",
      deadlineNote: "Registry: pay within 3 days of the order",
      hearingAt: hearing(3),
      closesWhen: "Closes on payment, or when the hearing passes",
      status: "open",
      statusNote: "Payment failed — try again",
      lastPayment: { result: "failed", ref: "TXN-9F2KQ7HM3X", at: at(-1, 15) },
      history: [
        { at: at(-3, 11), text: "Created — summons ordered to PW-3" },
        { at: at(-1, 15), by: "p-an", text: "Payment failed (ref TXN-9F2KQ7HM3X) — nothing was paid" },
      ],
    }),
    task({
      id: "t-courtfee941",
      caseId: "c-941",
      kind: "pay",
      title: "Pay the court fee on the application to condone the delay",
      why: created(-2, "The condonation application was numbered; the court fee is payable before it is listed"),
      whatToDo: "Pay the court fee on the application. The registry lists it once the fee is on record.",
      amountPaise: 100 * RUPEE,
      feeHead: "Court fee",
      dueAt: at(3),
      dueKind: "court-set",
      deadlineNote: "Registry: before the application is listed",
      closesWhen: "Closes when the fee is paid",
      status: "open",
    }),
    task({
      id: "t-certcopy1102",
      caseId: "c-1102",
      kind: "pay",
      title: "Pay the certified-copy fee for the order on appearance",
      why: created(-1, `Copy application filed for ${order(-1).toLowerCase()}`),
      whatToDo: "Pay the copying fee so the certified copy is issued.",
      amountPaise: 30 * RUPEE,
      feeHead: "Copying fee",
      dueAt: at(6),
      dueKind: "court-set",
      deadlineNote: "Copy section: within 7 days of the copy application",
      closesWhen: "Closes when the fee is paid",
      status: "open",
    }),
    task({
      id: "t-pay71",
      caseId: "c-71",
      kind: "pay",
      title: "Pay the process fee for the summons to PW-2",
      why: created(-2, `Summons ordered to PW-2 by ${order(-2).toLowerCase()}`),
      whatToDo: "Pay the process fee so the summons can go out before the evidence posting.",
      amountPaise: 200 * RUPEE,
      feeHead: "Process fee",
      dueAt: at(2),
      dueKind: "court-set",
      hearingAt: hearing(7),
      closesWhen: "Closes on payment, or when the hearing passes",
      status: "open",
    }),
    task({
      id: "t-payconf52",
      caseId: "c-52",
      kind: "pay",
      title: "Pay the process fee for the summons to PW-3",
      why: created(-6, `Summons ordered to PW-3 by ${order(-6).toLowerCase()}`),
      whatToDo: "Pay the process fee so the summons can go out before the evidence posting.",
      amountPaise: 200 * RUPEE,
      feeHead: "Process fee",
      dueAt: at(1),
      dueKind: "court-set",
      hearingAt: hearing(3),
      closesWhen: "Closes on payment, or when the hearing passes",
      status: "payment-confirming",
      statusNote: "Gateway ref TXN-4HW8NQ2TZC",
      lastPayment: { result: "pending", ref: "TXN-4HW8NQ2TZC", at: at(0, 9, 40) },
      history: [
        { at: at(-6, 11), text: "Created — summons ordered to PW-3" },
        { at: at(0, 9, 40), by: "p-dv", text: "Deepa Varghese paid — gateway is confirming (ref TXN-4HW8NQ2TZC)" },
      ],
    }),
    task({
      id: "t-vakfee509",
      caseId: "c-509",
      kind: "pay",
      title: "Pay the vakalatnama fee",
      why: created(-1, "S. Prakash joined the case; the vakalatnama fee was not paid at joining"),
      whatToDo: "Pay the vakalatnama fee so the joining is complete on the record.",
      amountPaise: 25 * RUPEE,
      feeHead: "Vakalatnama fee",
      dueAt: at(0),
      dueKind: "court-set",
      deadlineNote: "Payable at joining — due immediately",
      closesWhen: "Closes when this or any other vakalatnama fee on the case is paid",
      status: "open",
    }),
    task({
      id: "t-paydone509",
      caseId: "c-509",
      kind: "pay",
      title: "Pay the process fee for the summons",
      why: created(-15, "Summons issued to the accused — process fee payable for service by post"),
      whatToDo: "Pay the process fee so the registry can dispatch the summons.",
      amountPaise: 40 * RUPEE,
      feeHead: "Process fee",
      dueAt: at(-13),
      dueKind: "court-set",
      status: "done",
      lastPayment: { result: "success", ref: "TXN-2BD7PX5KLM", at: at(-14, 10, 12) },
      completion: { by: "p-an", at: at(-14, 10, 12), how: "event", receipt: "TXN-2BD7PX5KLM" },
      history: [
        { at: at(-15, 11), text: "Created — summons issued to the accused" },
        { at: at(-14, 10, 12), by: "p-an", text: "Anjali Nair paid — receipt TXN-2BD7PX5KLM" },
      ],
    }),
    task({
      id: "t-payexpired1044",
      caseId: "c-1044",
      kind: "pay",
      title: "Pay the process fee for the summons",
      why: created(-16, "Summons issued to the accused — process fee payable for service by post"),
      whatToDo: "Pay the process fee so the registry can dispatch the summons.",
      amountPaise: 40 * RUPEE,
      feeHead: "Process fee",
      dueAt: at(-14),
      dueKind: "court-set",
      status: "expired",
      statusNote: "summons re-issued by a fresh order",
      history: [
        { at: at(-16, 11), text: "Created — summons issued to the accused" },
        { at: at(-6, 11), text: "Expired — summons re-issued by a fresh order" },
      ],
    }),

    /* ── To file ─────────────────────────────────────────────────── */
    task({
      id: "t-affidavit509",
      caseId: "c-509",
      kind: "file",
      title: "File the proof affidavit of the complainant",
      why: created(-34, `${order(-34)} — complainant to file proof affidavit in lieu of chief examination`),
      whatToDo: "Prepare the affidavit from the complaint, have it sworn before a notary, and file it with the annexures.",
      documentsNeeded: ["Proof affidavit (sworn)", "Annexure list"],
      dueAt: at(-20),
      dueKind: "court-set",
      deadlineNote: `${order(-34)}: file within two weeks`,
      status: "open",
    }),
    task({
      id: "t-memo1102",
      caseId: "c-1102",
      kind: "file",
      title: "File the memo of addresses for the summons",
      why: created(-2, "Process ordered — addresses of the accused to be furnished for the summons"),
      whatToDo: "File the memo listing the accused's address for service, with the postal covers.",
      documentsNeeded: ["Memo of addresses", "Postal covers"],
      dueAt: at(4),
      dueKind: "court-set",
      deadlineNote: "Registry: within 7 days of the order issuing process",
      status: "open",
    }),
    task({
      id: "t-pw2-412",
      caseId: "c-412",
      kind: "file",
      title: "File the chief affidavit of PW-2 before the evidence posting",
      why: created(-12, `${order(-12)} — complainant directed to keep PW-2 present on the next posting`),
      whatToDo: "File the sworn chief affidavit of PW-2 so it is on record before the witness is examined.",
      documentsNeeded: ["Chief affidavit of PW-2"],
      dueAt: at(0),
      dueKind: "before-hearing",
      deadlineNote: `${order(-12)}: file before the next posting`,
      hearingAt: hearing(2),
      status: "open",
    }),
    task({
      id: "t-reply88",
      caseId: "c-88",
      kind: "file",
      title: "File the reply to the accused's application for adjournment",
      why: created(-2, `The accused filed an application for adjournment on ${shortDate(at(-2))}`),
      whatToDo: "File a reply, or record no objection, before the posting.",
      documentsNeeded: ["Reply"],
      dueAt: at(1, 9),
      dueKind: "court-set",
      deadlineNote: `Reply before the posting on ${shortDate(hearing(1))}`,
      hearingAt: hearing(1),
      closesWhen: "Closes when the court decides the application",
      status: "open",
    }),
    task({
      id: "t-redated633",
      caseId: "c-633",
      kind: "file",
      title: "File the scanned original cheque and return memo",
      why: created(-14, `${order(-14)} — originals to be produced at the evidence posting`),
      whatToDo: "File the scans now; the originals are marked at the hearing.",
      documentsNeeded: ["Original cheque (scan)", "Return memo (scan)"],
      dueAt: at(3),
      dueKind: "before-hearing",
      deadlineNote: "Before the evidence posting",
      hearingAt: hearing(4),
      status: "open",
      statusNote: `Moved from ${shortDate(at(-3))} — hearing adjourned`,
      redate: { from: at(-3), to: at(3), reason: "hearing adjourned", at: at(-3, 13) },
      history: [
        { at: at(-14, 11), text: "Created — order to produce the originals" },
        { at: at(-3, 13), text: `Due date moved from ${shortDate(at(-3))} to ${shortDate(at(3))} — hearing adjourned to ${shortDate(hearing(4))}` },
      ],
    }),
    task({
      id: "t-stmt52",
      caseId: "c-52",
      kind: "file",
      title: "File the bank's statement of account for the cheque period",
      why: created(-8, `${order(-8)} — complainant to produce the account statement`),
      whatToDo: "File the statement covering the cheque date and the return, certified by the bank.",
      documentsNeeded: ["Statement of account (certified)", "Bank certificate under the Bankers' Books Evidence Act"],
      dueAt: at(2),
      dueKind: "before-hearing",
      deadlineNote: `Before the evidence posting on ${shortDate(hearing(3))}`,
      hearingAt: hearing(3),
      status: "draft",
      draft: { by: "p-an", savedAt: at(-1, 16, 20) },
      files: [{ id: "seed-f-stmt", name: "statement-jan-mar.pdf", size: 184_204, type: "application/pdf", ext: "PDF", slot: "Statement of account (certified)" }],
      history: [
        { at: at(-8, 11), text: "Created — order to produce the account statement" },
        { at: at(-1, 16, 20), by: "p-an", text: "Anjali Nair saved a draft" },
      ],
    }),
    task({
      id: "t-draftfile941",
      caseId: "c-941",
      kind: "file",
      title: "File the affidavit of the complainant in lieu of chief examination",
      why: created(-10, `${order(-10)} — complainant to file the chief affidavit before the evidence posting`),
      whatToDo: "Prepare the affidavit from the complaint, have it sworn, and file it with the annexures.",
      documentsNeeded: ["Chief affidavit (sworn)", "Annexure list"],
      dueAt: at(8),
      dueKind: "before-hearing",
      deadlineNote: "Before the evidence posting",
      hearingAt: hearing(9),
      status: "draft",
      draft: { by: "p-sp", savedAt: at(-2, 18, 5), note: "Paras 1–9 done; waiting on the bank certificate." },
      history: [
        { at: at(-10, 11), text: "Created — order to file the chief affidavit" },
        { at: at(-2, 18, 5), by: "p-sp", text: "S. Prakash saved a draft" },
      ],
    }),
    task({
      id: "t-withcourt144",
      caseId: "c-144",
      kind: "file",
      title: "File the application to recall PW-1",
      why: created(-7, "The accused's counsel pointed to an omission in the chief examination; PW-1 is to be recalled"),
      whatToDo: "File the application with the affidavit in support.",
      documentsNeeded: ["Application to recall PW-1", "Affidavit in support"],
      dueAt: at(-1),
      dueKind: "court-set",
      deadlineNote: "Before the arguments posting",
      status: "awaiting-court",
      files: [{ id: "seed-f-recall", name: "recall-application.pdf", size: 142_880, type: "application/pdf", ext: "PDF", slot: "Application to recall PW-1" }],
      history: [
        { at: at(-7, 11), text: "Created — PW-1 to be recalled" },
        { at: at(-3, 14, 30), by: "p-sp", text: "S. Prakash marked this ready — “Affidavit sworn this morning.”" },
        { at: at(-2, 10, 15), by: "p-an", text: "Completed by Anjali Nair — prepared by S. Prakash · filed with the court — awaiting scrutiny" },
      ],
    }),
    task({
      id: "t-filedone221",
      caseId: "c-221",
      kind: "file",
      title: "File the memo of addresses for the summons",
      why: created(-12, "Process ordered — addresses of the accused to be furnished for the summons"),
      whatToDo: "File the memo listing the accused's address for service.",
      documentsNeeded: ["Memo of addresses"],
      dueAt: at(-9),
      dueKind: "court-set",
      status: "done",
      completion: { by: "p-rm", at: at(-9, 12), how: "event", receipt: "ACK-5TV3WQ8RNX" },
      history: [
        { at: at(-12, 11), text: "Created — process ordered" },
        { at: at(-10, 17), by: "p-rm", text: "R. Manoj filed with the court — awaiting scrutiny" },
        { at: at(-9, 12), text: "Accepted by the registry — acknowledgement ACK-5TV3WQ8RNX" },
      ],
    }),
    task({
      id: "t-obsolete1044",
      caseId: "c-1044",
      kind: "file",
      title: "File the reply to the accused's application for adjournment",
      why: created(-9, `The accused filed an application for adjournment on ${shortDate(at(-9))}`),
      whatToDo: "File a reply, or record no objection, before the posting.",
      documentsNeeded: ["Reply"],
      dueAt: at(-5),
      dueKind: "court-set",
      status: "obsolete",
      statusNote: "application withdrawn",
      history: [
        { at: at(-9, 11), text: "Created — application for adjournment filed" },
        { at: at(-6, 15), text: "No longer needed — application withdrawn" },
      ],
    }),

    /* ── Returned by scrutiny ────────────────────────────────────── */
    /*
     * The demonstrated return: eight defects pointing at real fields and one real
     * document in the seeded filing draft, so `Fix` opens the filing in a correction
     * posture rather than a checklist. O7 (owner, 2026-08-21): a return carries a
     * deadline — assume five days from the return date until the rule is confirmed.
     */
    task({
      id: "t-retsainaba",
      caseId: "c-sainaba",
      kind: "returned",
      title: "Fix 8 defects and re-file the complaint",
      why: created(-2, "Scrutiny returned the complaint for compliance with 8 defects"),
      whatToDo:
        "Correct each flagged field in the filing, replace the flagged document, and submit the corrections to scrutiny.",
      documentsNeeded: ["Proof of delivery of demand notice (AD card)"],
      dueAt: at(3),
      dueKind: "court-set",
      deadlineNote: RETURN_WINDOW_NOTE,
      draftId: SCRUTINY_DRAFT_ID,
      status: "open",
      returned: { by: "scrutiny", at: at(-2, 11), defects: SCRUTINY_DEFECTS },
    }),
    task({
      id: "t-retlakshmi",
      caseId: "c-lakshmi",
      kind: "returned",
      title: "Fix 3 defects and re-file the complaint",
      why: created(-1, "Scrutiny returned the complaint for compliance with 3 defects"),
      whatToDo:
        "Correct each flagged field in the filing and submit the corrections to scrutiny.",
      dueAt: at(4),
      dueKind: "court-set",
      deadlineNote: RETURN_WINDOW_NOTE,
      draftId: SCRUTINY_DRAFT_ID_LAKSHMI,
      status: "open",
      returned: { by: "scrutiny", at: at(-1, 11), defects: SCRUTINY_DEFECTS_LAKSHMI },
    }),
    task({
      id: "t-retrafi",
      caseId: "c-rafi",
      kind: "returned",
      title: "Fix 2 defects and re-file the complaint",
      why: created(-3, "Scrutiny returned the complaint for compliance with 2 defects"),
      whatToDo:
        "Correct the flagged field, replace the flagged document, and submit the corrections to scrutiny.",
      documentsNeeded: ["Proof of delivery of demand notice (AD card)"],
      dueAt: at(2),
      dueKind: "court-set",
      deadlineNote: RETURN_WINDOW_NOTE,
      draftId: SCRUTINY_DRAFT_ID_RAFI,
      status: "open",
      returned: { by: "scrutiny", at: at(-3, 11), defects: SCRUTINY_DEFECTS_RAFI },
    }),
    ...EXTRA_RETURNS.map((extra) => {
      const defects = DEFECTS_BY_BASE[extra.base];
      const n = defects.length;
      return task({
        id: extra.id,
        caseId: extra.caseId,
        kind: "returned",
        title: `Fix ${n} defect${n === 1 ? "" : "s"} and re-file the complaint`,
        why: created(-extra.returnedAgo, `Scrutiny returned the complaint for compliance with ${n} defect${n === 1 ? "" : "s"}`),
        whatToDo: "Correct each flagged item in the filing and submit the corrections to scrutiny.",
        dueAt: at(5 - extra.returnedAgo),
        dueKind: "court-set",
        deadlineNote: RETURN_WINDOW_NOTE,
        draftId: extra.draftId,
        status: "open",
        returned: { by: "scrutiny", at: at(-extra.returnedAgo, 11), defects },
      });
    }),
    task({
      id: "t-ret941",
      caseId: "c-941",
      kind: "returned",
      title: "Fix 2 defects and re-file the application to condone the delay",
      why: created(-3, "Scrutiny returned the application to condone the delay with 2 defects"),
      whatToDo: "Fix each defect, attach the corrected document where one is needed, and re-file.",
      documentsNeeded: ["Affidavit in support (attested)", "Postal acknowledgement"],
      dueAt: at(2),
      dueKind: "court-set",
      deadlineNote: RETURN_WINDOW_NOTE,
      hearingAt: hearing(9),
      status: "open",
      returned: {
        by: "scrutiny",
        at: at(-3, 11),
        defects: [
          bundleDefect(1, "Affidavit in support is not attested by a notary."),
          bundleDefect(2, "Copy of the postal acknowledgement referred to in para 4 is not produced."),
        ],
      },
    }),
    task({
      id: "t-retready221",
      caseId: "c-221",
      kind: "returned",
      title: "Fix 1 defect and re-file the affidavit of the complainant",
      why: created(-4, "Scrutiny returned the chief affidavit with 1 defect"),
      whatToDo: "Fix the defect, attach the corrected affidavit, and re-file.",
      documentsNeeded: ["Chief affidavit (sworn)"],
      dueAt: at(1),
      dueKind: "court-set",
      deadlineNote: RETURN_WINDOW_NOTE,
      status: "ready",
      statusNote: "Prepared by S. Prakash",
      returned: {
        by: "scrutiny",
        at: at(-4, 11),
        defects: [
          {
            ...bundleDefect(1, "Page 3 of the affidavit is not signed by the deponent."),
            resolution: {
              how: "replaced",
              at: at(-1, 12, 10),
              replacement: { id: "seed-f-aff221", name: "chief-affidavit-signed.pdf", size: 210_440, type: "application/pdf", ext: "PDF", slot: "Replacement for defect 1" },
            },
          },
        ],
      },
      prepared: { by: "p-sp", at: at(-1, 12, 30), note: "Deponent signed page 3 in office yesterday; scan attached." },
      history: [
        { at: at(-4, 11), text: "Created — scrutiny returned the affidavit with 1 defect" },
        { at: at(-1, 12, 10), by: "p-sp", text: "S. Prakash replaced the document for defect 1" },
        { at: at(-1, 12, 30), by: "p-sp", text: "S. Prakash marked this ready — “Deponent signed page 3 in office yesterday; scan attached.”" },
      ],
    }),
    task({
      id: "t-retexpired377",
      caseId: "c-377",
      kind: "returned",
      title: "Fix 2 defects and re-file the application to condone the delay",
      why: created(-20, "Scrutiny returned the application with 2 defects"),
      whatToDo: "Fix each defect, attach the corrected document where one is needed, and re-file.",
      dueAt: at(-15),
      dueKind: "court-set",
      deadlineNote: RETURN_WINDOW_NOTE,
      status: "expired",
      statusNote: "fix window lapsed",
      returned: {
        by: "scrutiny",
        at: at(-20, 11),
        defects: [
          bundleDefect(1, "Affidavit in support is not attested by a notary."),
          bundleDefect(2, "Court fee on the application is short by ₹50."),
        ],
      },
      history: [
        { at: at(-20, 11), text: "Created — scrutiny returned the application with 2 defects" },
        { at: at(-12, 11), text: "Expired — fix window lapsed" },
      ],
    }),

    /* ── To review ───────────────────────────────────────────────── */
    task({
      id: "t-remove144",
      caseId: "c-144",
      kind: "review",
      title: "Respond to the request for your removal from the case",
      why: created(-1, "Deepa Varghese asked for your consent to your removal from the case"),
      whatToDo:
        "The client wants to consolidate representation with Deepa Varghese. Accepting records your consent and the removal goes ahead; declining sends the request to the magistrate to decide.",
      dueKind: "none",
      status: "open",
      closesWhen: "Closes when you respond, or when the magistrate decides the removal instead.",
      review: { requestedBy: "p-dv", of: "p-an" },
    }),

    /* ── To submit (at a posting) ────────────────────────────────── */
    task({
      id: "t-plea88",
      caseId: "c-88",
      kind: "hearing",
      title: "Be present for the plea",
      why: created(-10, `Case posted for recording the plea of the accused on ${shortDate(hearing(1))}`),
      whatToDo: "Be present with the complainant when the plea is recorded; mark done afterwards.",
      dueAt: hearing(1),
      dueKind: "before-hearing",
      deadlineNote: `The posting on ${shortDate(hearing(1))}`,
      hearingAt: hearing(1),
      status: "open",
    }),
    task({
      id: "t-pw1-52",
      caseId: "c-52",
      kind: "hearing",
      title: "Produce PW-1 for cross-examination",
      why: created(-15, `${order(-15)} — complainant to keep PW-1 present on the next posting`),
      whatToDo: "Confirm PW-1 attends the posting; mark done once they have been produced.",
      dueAt: hearing(3),
      dueKind: "before-hearing",
      deadlineNote: `The posting on ${shortDate(hearing(3))}`,
      hearingAt: hearing(3),
      status: "open",
    }),
    task({
      id: "t-cross633",
      caseId: "c-633",
      kind: "hearing",
      title: "Produce the complainant for cross-examination",
      why: created(-14, `${order(-14)} — complainant to be present for cross-examination on the next posting`),
      whatToDo: "Confirm the complainant attends the posting; mark done once examined.",
      dueAt: hearing(4),
      dueKind: "before-hearing",
      hearingAt: hearing(4),
      status: "open",
    }),
    task({
      id: "t-sworn381",
      caseId: "c-381",
      kind: "hearing",
      title: "Be present with the complainant for the sworn statement",
      why: created(-1, `Complaint taken on file; posted for the sworn statement of the complainant on ${shortDate(hearing(30))}`),
      whatToDo: "The complainant makes the sworn statement under section 200 CrPC; mark done afterwards.",
      dueAt: hearing(30),
      dueKind: "before-hearing",
      hearingAt: hearing(30),
      status: "open",
    }),
    task({
      id: "t-args144",
      caseId: "c-144",
      kind: "hearing",
      title: "Address arguments for the complainant",
      why: created(-6, `Evidence closed; case posted for arguments on ${shortDate(hearing(20))}`),
      whatToDo: "Argue the complainant's case; file written arguments at the posting if the court permits.",
      dueAt: hearing(20),
      dueKind: "before-hearing",
      hearingAt: hearing(20),
      status: "open",
    }),
    task({
      id: "t-plea217",
      caseId: "c-217",
      kind: "hearing",
      title: "Be present for the plea",
      why: created(-8, `Case posted for recording the plea of the accused on ${shortDate(hearing(5))}`),
      whatToDo: "Be present with the complainant when the plea is recorded; mark done afterwards.",
      dueAt: hearing(5),
      dueKind: "before-hearing",
      hearingAt: hearing(5),
      status: "open",
    }),
    task({
      id: "t-pw2-509",
      caseId: "c-509",
      kind: "hearing",
      title: "Produce PW-2 for cross-examination",
      why: created(-19, `${order(-19)} — complainant to keep PW-2 present on the posting of ${shortDate(hearing(-6))}`),
      whatToDo: "Confirm PW-2 attends the posting; mark done once they have been produced.",
      dueAt: hearing(-6),
      dueKind: "before-hearing",
      hearingAt: hearing(-6),
      status: "open",
    }),
    task({
      id: "t-dates941",
      caseId: "c-941",
      kind: "hearing",
      title: "Choose your dates for the rescheduled hearing",
      why: created(0, `The accused asked to reschedule the evidence posting of ${shortDate(hearing(9))}`),
      whatToDo: "Give the dates your side can attend; the court fixes the new posting from the preferences.",
      dueAt: at(2),
      dueKind: "court-set",
      deadlineNote: "Registry allows 2 days to give date preferences",
      closesWhen: "Closes when you choose dates, or when the court decides the rescheduling request",
      status: "open",
    }),
    task({
      id: "t-appeardone1102",
      caseId: "c-1102",
      kind: "hearing",
      title: "Be present with the complainant at appearance",
      why: created(-18, `Case posted for appearance of the accused on ${shortDate(hearing(-10))}`),
      whatToDo: "Be present at the appearance posting; mark done afterwards.",
      dueAt: hearing(-10),
      dueKind: "before-hearing",
      hearingAt: hearing(-10),
      status: "done",
      completion: { by: "p-rm", at: at(-10, 12, 45), how: "manual" },
      history: [
        { at: at(-18, 11), text: "Created — posted for appearance" },
        { at: at(-10, 12, 45), by: "p-rm", text: "R. Manoj marked this done" },
      ],
    }),

    /* ── Drafts ──────────────────────────────────────────────────── */
    task({
      id: "t-draftarun",
      caseId: "c-arun",
      kind: "draft",
      title: "Continue the draft complaint",
      why: created(-5, "Statutory notice unanswered for 15 days — the cause of action arose"),
      whatToDo: "Finish the complaint, attach the cheque, return memo, notice and postal receipts, and file it.",
      documentsNeeded: ["Complaint", "Affidavit in support", "Cheque and return memo", "Statutory notice and postal receipts"],
      dueAt: at(18),
      dueKind: "statutory",
      deadlineNote: "Limitation: within one month of the cause of action (section 142)",
      status: "draft",
      draft: { by: "p-sp", savedAt: at(-1, 19, 10), note: "Parties and cheque particulars done; cause-of-action paras pending." },
      history: [
        { at: at(-5, 11), text: "Created — cause of action arose" },
        { at: at(-1, 19, 10), by: "p-sp", text: "S. Prakash saved a draft" },
      ],
    }),
    task({
      id: "t-draftbindu",
      caseId: "c-bindu",
      kind: "draft",
      title: "Continue the draft complaint",
      why: created(-3, "Statutory notice unanswered for 15 days — the cause of action arose"),
      whatToDo: "Finish the complaint, attach the cheque, return memo, notice and postal receipts, and file it.",
      documentsNeeded: ["Complaint", "Affidavit in support", "Cheque and return memo", "Statutory notice and postal receipts"],
      dueAt: at(12),
      dueKind: "statutory",
      deadlineNote: "Limitation: within one month of the cause of action (section 142)",
      status: "draft",
      draft: { by: "p-an", savedAt: at(0, 8, 50) },
      history: [
        { at: at(-3, 11), text: "Created — cause of action arose" },
        { at: at(0, 8, 50), by: "p-an", text: "Anjali Nair saved a draft" },
      ],
    }),
    task({
      id: "t-draftapp815",
      caseId: "c-815",
      kind: "draft",
      title: "Continue the draft application to recall PW-1",
      why: created(-2, "An omission in PW-1's chief examination needs to be cured before arguments"),
      whatToDo: "Finish the application and the affidavit in support, then file it before the arguments posting.",
      documentsNeeded: ["Application to recall PW-1", "Affidavit in support"],
      dueKind: "none",
      status: "draft",
      draft: { by: "p-dv", savedAt: at(-2, 17, 30), note: "Grounds drafted; needs the date of the omission from the deposition." },
      history: [
        { at: at(-2, 11), text: "Created — application to recall PW-1 started" },
        { at: at(-2, 17, 30), by: "p-dv", text: "Deepa Varghese saved a draft" },
      ],
    }),

    /* ── Today's cause list — blockers and the week's dues ───────── */
    task({
      id: "t-fee-hd3",
      caseId: "c-hd3",
      kind: "pay",
      title: "Pay the process fee for the summons to the accused",
      why: created(-6, order(-6)),
      whatToDo: "Pay the process fee so the summons can issue before today's posting.",
      amountPaise: 8 * RUPEE,
      feeHead: "Process fee",
      closesWhen: "Closes on payment, or when the hearing passes",
      dueAt: at(0, 12, 0),
      dueKind: "court-set",
      deadlineNote: "Registry: before today's posting",
      hearingAt: listedToday("c-hd3"),
      status: "open",
    }),
    // The one passed-over matter also owes work before it is called again, so
    // the board shows a row carrying both flags.
    task({
      id: "t-memo-hd2",
      caseId: "c-hd2",
      kind: "file",
      title: "File the plea memo before the matter is called again",
      why: created(-2, order(-2)),
      whatToDo: "Upload the signed plea memo; the matter was passed over and will be called again today.",
      documentsNeeded: ["Plea memo"],
      dueAt: at(0, 15, 0),
      dueKind: "before-hearing",
      deadlineNote: "Before the matter is called again",
      hearingAt: listedToday("c-hd2"),
      status: "open",
    }),
    task({
      id: "t-aff-hd5",
      caseId: "c-hd5",
      kind: "file",
      title: "File the chief affidavit of PW-1 before today's evidence posting",
      why: created(-4, order(-4)),
      whatToDo: "Upload the sworn chief affidavit of PW-1; the evidence posting is this afternoon.",
      documentsNeeded: ["Chief affidavit of PW-1"],
      dueAt: at(0, 14, 0),
      dueKind: "before-hearing",
      deadlineNote: "Before today's evidence posting",
      hearingAt: listedToday("c-hd5"),
      status: "open",
    }),
    task({
      id: "t-post-hd8",
      caseId: "c-hd8",
      kind: "file",
      title: "Produce the postal acknowledgement of the demand notice",
      why: created(-3, order(-3)),
      whatToDo: "Upload the postal acknowledgement the court called for; the posting is today.",
      documentsNeeded: ["Postal acknowledgement (demand notice)"],
      dueAt: at(0, 15, 0),
      dueKind: "court-set",
      deadlineNote: "Order: to be produced at today's posting",
      hearingAt: listedToday("c-hd8"),
      status: "open",
    }),
    task({
      id: "t-sign-hd2",
      caseId: "c-hd2",
      kind: "sign",
      title: "Sign the memo of appearance for the second accused",
      why: created(-2, "The second accused entered appearance through counsel"),
      whatToDo: "Read the memo of appearance and e-sign it for filing.",
      documentsNeeded: ["Memo of appearance"],
      dueAt: at(1, 17),
      dueKind: "court-set",
      deadlineNote: "To be filed before tomorrow's board closes",
      status: "open",
    }),
    task({
      id: "t-pay-hd6",
      caseId: "c-hd6",
      kind: "pay",
      title: "Pay the copying charges for the certified order copy",
      why: created(-1, "Certified copy application allowed"),
      whatToDo: "Pay the copying charges so the certified copy can be prepared.",
      amountPaise: 46 * RUPEE,
      feeHead: "Copying charges",
      closesWhen: "Closes on payment",
      dueAt: at(2, 17),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-file-hd10",
      caseId: "c-hd10",
      kind: "file",
      title: "File the affidavit of assets of the complainant",
      why: created(-2, order(-2)),
      whatToDo: "Upload the affidavit of assets the court directed at the last posting.",
      documentsNeeded: ["Affidavit of assets"],
      dueAt: at(3, 17),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-sign-hd9",
      caseId: "c-hd9",
      kind: "sign",
      title: "Sign the written arguments for filing",
      why: created(-1, "Written arguments drafted after the last posting"),
      whatToDo: "Read the written arguments and e-sign them for filing before the next posting.",
      documentsNeeded: ["Written arguments"],
      dueAt: at(5, 17),
      dueKind: "court-set",
      status: "open",
    }),

    /* ── More of every kind, in every tab (owner, 2026-10-14) ──────────── */

    /* Needs action: Pay, Sign, File/Submit, Others. */
    task({
      id: "t-copy509",
      caseId: "c-509",
      kind: "pay",
      title: "Pay the copying fee for the certified copy of the order",
      why: created(-2, "Certified copy of the order dated 10 Sept applied for"),
      whatToDo: "Pay the copying fee so the registry can issue the certified copy.",
      amountPaise: 30 * RUPEE,
      feeHead: "Copying fee",
      closesWhen: "Closes when the fee is paid",
      dueAt: at(4),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-warrant-pa1",
      caseId: "c-pa1",
      kind: "pay",
      title: "Pay the process fee for the bailable warrant",
      why: created(-3, `${order(-3)}: bailable warrant to the accused`),
      whatToDo: "Pay the process fee so the warrant can be sent for execution.",
      amountPaise: 100 * RUPEE,
      feeHead: "Process fee",
      closesWhen: "Closes when the fee is paid",
      dueAt: at(2),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-sign381",
      caseId: "c-381",
      kind: "sign",
      title: "Sign the sworn statement of the complainant",
      why: created(-2, "Sworn statement recorded for taking cognizance"),
      whatToDo: "Read the sworn statement and e-sign it before the cognizance posting.",
      documentsNeeded: ["Sworn statement of the complainant"],
      dueAt: at(3),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-sign-pa2",
      caseId: "c-pa2",
      kind: "sign",
      title: "Sign the reply to the application for adjournment",
      why: created(-1, "The accused applied to adjourn the arguments posting"),
      whatToDo: "Read the reply drafted by Rahul Iyer and e-sign it.",
      documentsNeeded: ["Reply to the application for adjournment"],
      dueAt: at(1),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-witness144",
      caseId: "c-144",
      kind: "file",
      title: "File the list of witnesses for the complainant",
      why: created(-4, `${order(-4)}: list of witnesses to be filed`),
      whatToDo: "File the list of witnesses the complainant proposes to examine.",
      documentsNeeded: ["List of witnesses"],
      dueAt: at(3),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-advance702",
      caseId: "c-702",
      kind: "file",
      title: "File the application to advance the hearing date",
      why: created(-1, "The complainant has to travel abroad before the posting"),
      whatToDo: "File an application to advance the hearing, with the travel dates.",
      documentsNeeded: ["Application to advance the hearing", "Travel itinerary"],
      dueAt: at(2),
      dueKind: "none",
      status: "open",
    }),
    task({
      id: "t-args144",
      caseId: "c-144",
      kind: "hearing",
      title: "Be present for the arguments",
      why: created(-6, `Case posted for arguments on ${shortDate(hearing(20))}`),
      whatToDo: "Be present for the arguments; mark done afterwards.",
      dueAt: hearing(20),
      dueKind: "before-hearing",
      deadlineNote: `The posting on ${shortDate(hearing(20))}`,
      hearingAt: hearing(20),
      status: "open",
    }),

    /* Due today on the home rail — signing and paying beside the filings, so the day's
       list reads as the mix an advocate's day is (owner, 2026-10-14). */
    task({
      id: "t-today-sign-hd5",
      caseId: "c-hd5",
      kind: "sign",
      title: "Sign the affidavit of the complainant in lieu of chief examination",
      why: created(-2, "Affidavit prepared for today's evidence posting"),
      whatToDo: "Read the affidavit and e-sign it before the matter is called.",
      documentsNeeded: ["Affidavit in lieu of chief examination"],
      dueAt: at(0, 13),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-today-sign-hd6",
      caseId: "c-hd6",
      kind: "sign",
      title: "Sign the memo of appearance for the complainant",
      why: created(-1, "The complainant engaged you for today's posting"),
      whatToDo: "E-sign the memo so your appearance is recorded today.",
      documentsNeeded: ["Memo of appearance"],
      dueAt: at(0, 11),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-today-fee-hd1",
      caseId: "c-hd1",
      kind: "pay",
      title: "Pay the court fee on the application for certified copies",
      why: created(-1, "Application for certified copies of the depositions filed"),
      whatToDo: "Pay the court fee so the application goes to the registry.",
      amountPaise: 20 * RUPEE,
      feeHead: "Court fee",
      closesWhen: "Closes when the fee is paid",
      dueAt: at(0, 12),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-today-copy-hd8",
      caseId: "c-hd8",
      kind: "pay",
      title: "Pay the copying charges for the deposition of PW-1",
      why: created(-2, "Certified copy of PW-1's deposition applied for"),
      whatToDo: "Pay the copying charges so the registry can issue the copy.",
      amountPaise: 40 * RUPEE,
      feeHead: "Copying fee",
      closesWhen: "Closes when the fee is paid",
      dueAt: at(0, 14),
      dueKind: "court-set",
      status: "open",
    }),

    /* More for the demo (owner, 2026-10-14): enough of each kind to show every flow —
       paying, signing, filing a document, filing an application, the courtroom — more
       than once, across the week. */
    task({
      id: "t-demo-vakfee-pa2",
      caseId: "c-pa2",
      kind: "pay",
      title: "Pay the vakalatnama fee",
      why: created(-1, "Vakalatnama filed for the accused's second counsel"),
      whatToDo: "Pay the vakalatnama fee so the appearance is recorded.",
      amountPaise: 25 * RUPEE,
      feeHead: "Vakalatnama fee",
      closesWhen: "Closes when the fee is paid",
      dueAt: at(1, 12),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-demo-courtfee-815",
      caseId: "c-815",
      kind: "pay",
      title: "Pay the court fee on the application to reopen evidence",
      why: created(-2, "Application to reopen evidence drafted"),
      whatToDo: "Pay the court fee so the application can be filed.",
      amountPaise: 20 * RUPEE,
      feeHead: "Court fee",
      closesWhen: "Closes when the fee is paid",
      dueAt: at(2, 12),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-demo-copy-412",
      caseId: "c-412",
      kind: "pay",
      title: "Pay the copying charges for the order sheet",
      why: created(-1, "Certified copy of the order sheet applied for"),
      whatToDo: "Pay the copying charges so the registry can issue the copy.",
      amountPaise: 15 * RUPEE,
      feeHead: "Copying fee",
      closesWhen: "Closes when the fee is paid",
      dueAt: at(5),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-demo-sign-hd8",
      caseId: "c-hd8",
      kind: "sign",
      title: "Sign the list of documents for the evidence posting",
      why: created(-1, "List of documents prepared for today's evidence posting"),
      whatToDo: "Read the list and e-sign it before the matter is called.",
      documentsNeeded: ["List of documents"],
      dueAt: at(0, 15),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-demo-sign-702",
      caseId: "c-702",
      kind: "sign",
      title: "Sign the application to advance the hearing date",
      why: created(-1, "Application drafted by Rahul Iyer"),
      whatToDo: "Read the application and e-sign it.",
      documentsNeeded: ["Application to advance the hearing"],
      dueAt: at(1, 16),
      dueKind: "court-set",
      status: "ready",
      statusNote: "Prepared by Rahul Iyer",
    }),
    task({
      id: "t-demo-sign-pa1",
      caseId: "c-pa1",
      kind: "sign",
      title: "Sign the reply to the accused's objection",
      why: created(-2, "The accused objected to the marking of Exhibit P5"),
      whatToDo: "Read the reply and e-sign it.",
      documentsNeeded: ["Reply to the objection"],
      dueAt: at(3, 12),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-demo-file-hd1",
      caseId: "c-hd1",
      kind: "file",
      title: "File the memo of addresses of the witnesses",
      why: created(-2, `${order(-2)}: addresses of the witnesses to be furnished`),
      whatToDo: "File the memo with the witnesses' current addresses.",
      documentsNeeded: ["Memo of addresses"],
      dueAt: at(0, 13),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-demo-file-88",
      caseId: "c-88",
      kind: "file",
      title: "File the affidavit of service of the summons",
      why: created(-3, "Summons served on the accused by hand"),
      whatToDo: "File the affidavit of service, with the acknowledgement.",
      documentsNeeded: ["Affidavit of service", "Acknowledgement"],
      dueAt: at(2),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-demo-app-delay-381",
      caseId: "c-381",
      kind: "file",
      title: "File the application to condone the delay in filing the complaint",
      why: created(-2, "The complaint was presented a week after the limitation period"),
      whatToDo: "File the application to condone the delay, with the affidavit in support.",
      documentsNeeded: ["Application to condone the delay", "Affidavit in support"],
      dueAt: at(4),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-demo-app-witness-509",
      caseId: "c-509",
      kind: "file",
      title: "File the application to add a witness",
      why: created(-1, "The bank manager is needed to prove the return memo"),
      whatToDo: "File the application to examine the bank manager as an additional witness.",
      documentsNeeded: ["Application to add a witness"],
      dueAt: at(3),
      dueKind: "none",
      status: "open",
    }),
    task({
      id: "t-demo-produce-hd5",
      caseId: "c-hd5",
      kind: "hearing",
      title: "Produce the original cheque before the court",
      why: created(-3, "The court asked for the original cheque at the evidence posting"),
      whatToDo: "Bring the original cheque to court; mark done afterwards.",
      dueAt: at(0, 14),
      dueKind: "before-hearing",
      status: "open",
    }),
    task({
      id: "t-demo-present-815",
      caseId: "c-815",
      kind: "hearing",
      title: "Be present for the arguments on the delay application",
      why: created(-4, "Delay application posted for arguments"),
      whatToDo: "Be present for the arguments; mark done afterwards.",
      dueAt: at(6, 11),
      dueKind: "before-hearing",
      status: "open",
    }),
    task({
      id: "t-demo-sign-221",
      caseId: "c-221",
      kind: "sign",
      title: "Sign the chief affidavit of PW-1",
      why: created(-2, "Chief affidavit prepared for the evidence posting"),
      whatToDo: "R. Manoj reads the affidavit and e-signs it.",
      documentsNeeded: ["Chief affidavit of PW-1"],
      dueAt: at(2),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-demo-pay-377",
      caseId: "c-377",
      kind: "pay",
      title: "Pay the court fee on the application for adjournment",
      why: created(-1, "Application for adjournment drafted"),
      whatToDo: "R. Manoj pays the court fee so the application can be filed.",
      amountPaise: 20 * RUPEE,
      feeHead: "Court fee",
      closesWhen: "Closes when the fee is paid",
      dueAt: at(1),
      dueKind: "court-set",
      status: "open",
    }),

    /* Waiting on others: another advocate's move, the court's, or the gateway's. */
    task({
      id: "t-warrant217",
      caseId: "c-217",
      kind: "pay",
      title: "Pay the process fee for the non-bailable warrant",
      why: created(-2, `${order(-2)}: non-bailable warrant to the accused`),
      whatToDo: "Pay the process fee so the warrant can issue.",
      amountPaise: 150 * RUPEE,
      feeHead: "Process fee",
      closesWhen: "Closes when the fee is paid",
      dueAt: at(3),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-memo941",
      caseId: "c-941",
      kind: "sign",
      title: "Sign the memo of appearance for the complainant",
      why: created(-1, "The complainant changed counsel"),
      whatToDo: "The memo of appearance needs the signature of the advocate on record.",
      documentsNeeded: ["Memo of appearance"],
      dueAt: at(2),
      dueKind: "court-set",
      status: "open",
    }),
    task({
      id: "t-docs509",
      caseId: "c-509",
      kind: "file",
      title: "File the list of documents relied on",
      why: created(-6, `${order(-6)}: list of documents to be filed`),
      whatToDo: "File the list of documents the complainant relies on.",
      documentsNeeded: ["List of documents"],
      dueAt: at(-1),
      dueKind: "court-set",
      status: "awaiting-court",
      files: [{ id: "seed-f-docs509", name: "list-of-documents.pdf", size: 98_304, type: "application/pdf", ext: "PDF", slot: "List of documents" }],
      completion: { by: "p-an", at: at(-2, 15, 20), how: "event", receipt: "FIL-6TQ3W8ZK2D" },
      history: [
        { at: at(-6, 11), text: "Created — list of documents to be filed" },
        { at: at(-2, 15, 20), by: "p-an", text: "Anjali Nair filed with the court — awaiting scrutiny" },
      ],
    }),
    task({
      id: "t-remove1102",
      caseId: "c-1102",
      kind: "review",
      title: "Respond to the request for R. Manoj's removal from the case",
      why: created(-1, "Deepa Varghese asked for R. Manoj's consent to his removal from the case"),
      whatToDo: "R. Manoj accepts or declines; declining sends it to the magistrate.",
      dueKind: "none",
      status: "open",
      closesWhen: "Closes when R. Manoj responds, or when the magistrate decides the removal.",
      review: { requestedBy: "p-dv", of: "p-rm" },
    }),

    /* Completed. */
    task({
      id: "t-done-copy88",
      caseId: "c-88",
      kind: "pay",
      title: "Pay the copying fee for the deposition of PW-1",
      why: created(-9, "Certified copy of PW-1's deposition applied for"),
      whatToDo: "Pay the copying fee.",
      amountPaise: 20 * RUPEE,
      feeHead: "Copying fee",
      dueAt: at(-7),
      dueKind: "court-set",
      status: "done",
      lastPayment: { result: "success", ref: "TXN-8MRW2K4QZC", at: at(-8, 12, 30) },
      completion: { by: "p-an", at: at(-8, 12, 30), how: "event", receipt: "TXN-8MRW2K4QZC" },
      history: [
        { at: at(-9, 11), text: "Created — certified copy applied for" },
        { at: at(-8, 12, 30), by: "p-an", text: "Anjali Nair paid — receipt TXN-8MRW2K4QZC" },
      ],
    }),
    task({
      id: "t-done-sign815",
      caseId: "c-815",
      kind: "sign",
      title: "Sign the written notes of arguments",
      why: created(-6, "Written notes prepared for the arguments posting"),
      whatToDo: "Read the notes and e-sign them.",
      documentsNeeded: ["Written notes of arguments"],
      dueAt: at(-4),
      dueKind: "court-set",
      status: "done",
      completion: { by: "p-an", at: at(-5, 10, 5), how: "event", receipt: "ESIGN-3PLX9Q7VDN" },
      history: [
        { at: at(-6, 11), text: "Created — written notes prepared" },
        { at: at(-5, 10, 5), by: "p-an", text: "Anjali Nair signed with Aadhaar e-Sign — ESIGN-3PLX9Q7VDN" },
      ],
    }),
    task({
      id: "t-done-file702",
      caseId: "c-702",
      kind: "file",
      title: "File the memo of appearance",
      why: created(-12, "Vakalatnama accepted; appearance to be entered"),
      whatToDo: "File the memo of appearance.",
      documentsNeeded: ["Memo of appearance"],
      dueAt: at(-10),
      dueKind: "court-set",
      status: "done",
      files: [{ id: "seed-f-memo702", name: "memo-of-appearance.pdf", size: 64_512, type: "application/pdf", ext: "PDF", slot: "Memo of appearance" }],
      completion: { by: "p-an", at: at(-9, 16), how: "event", receipt: "FIL-2HV8C5NR7J" },
      history: [
        { at: at(-12, 11), text: "Created — appearance to be entered" },
        { at: at(-11, 14), by: "p-an", text: "Anjali Nair filed with the court — awaiting scrutiny" },
        { at: at(-9, 16), text: "Accepted by the registry — FIL-2HV8C5NR7J" },
      ],
    }),
    task({
      id: "t-done-ev52",
      caseId: "c-52",
      kind: "hearing",
      title: "Be present for the evidence of the complainant",
      why: created(-10, "Case posted for the evidence of the complainant"),
      whatToDo: "Be present with PW-1 for the evidence; mark done afterwards.",
      dueAt: at(-3, 10, 30),
      dueKind: "before-hearing",
      status: "done",
      completion: { by: "p-an", at: at(-3, 13), how: "manual" },
      history: [
        { at: at(-10, 11), text: "Created — posted for evidence" },
        { at: at(-3, 13), by: "p-an", text: "Anjali Nair marked this done" },
      ],
    }),

    /* Archived — put away, each from the status it held. */
    task({
      id: "t-arch-fee412",
      caseId: "c-412",
      kind: "pay",
      title: "Pay the process fee for the re-issued summons",
      why: created(-30, "Summons returned unserved and re-issued"),
      whatToDo: "Pay the process fee for the re-issued summons.",
      amountPaise: 40 * RUPEE,
      feeHead: "Process fee",
      dueAt: at(-25),
      dueKind: "court-set",
      status: "archived",
      archived: { by: "p-an", at: at(-20, 10), from: "expired" },
      history: [
        { at: at(-30, 11), text: "Created — summons re-issued" },
        { at: at(-24, 0), text: "Expired — the posting it served has passed" },
        { at: at(-20, 10), by: "p-an", text: "Anjali Nair archived this" },
      ],
    }),
    task({
      id: "t-arch-sign381",
      caseId: "c-381",
      kind: "sign",
      title: "Sign the draft complaint",
      why: created(-40, "Complaint drafted from the notice and the bank memo"),
      whatToDo: "Read the draft complaint and e-sign it.",
      documentsNeeded: ["Complaint"],
      dueKind: "none",
      status: "archived",
      archived: { by: "p-an", at: at(-30, 9, 30), from: "done" },
      completion: { by: "p-an", at: at(-38, 16), how: "event", receipt: "ESIGN-5ZK8W2QMTR" },
      history: [
        { at: at(-40, 11), text: "Created — complaint drafted" },
        { at: at(-38, 16), by: "p-an", text: "Anjali Nair signed with Aadhaar e-Sign — ESIGN-5ZK8W2QMTR" },
        { at: at(-30, 9, 30), by: "p-an", text: "Anjali Nair archived this" },
      ],
    }),
    task({
      id: "t-arch-file144",
      caseId: "c-144",
      kind: "file",
      title: "File the postal acknowledgement of the summons",
      why: created(-28, "Summons served by registered post"),
      whatToDo: "File the postal acknowledgement.",
      documentsNeeded: ["Postal acknowledgement"],
      dueKind: "none",
      status: "archived",
      archived: { by: "p-sp", at: at(-21, 15), from: "obsolete" },
      statusNote: "No longer needed — the accused appeared",
      history: [
        { at: at(-28, 11), text: "Created — summons served by post" },
        { at: at(-22, 12), text: "No longer needed — the accused appeared" },
        { at: at(-21, 15), by: "p-sp", text: "S. Prakash archived this" },
      ],
    }),
    task({
      id: "t-arch-plea88",
      caseId: "c-88",
      kind: "hearing",
      title: "Be present for the appearance of the accused",
      why: created(-35, "Case posted for the appearance of the accused"),
      whatToDo: "Be present for the appearance; mark done afterwards.",
      dueAt: at(-30, 10, 30),
      dueKind: "before-hearing",
      status: "archived",
      archived: { by: "p-an", at: at(-25, 11), from: "done" },
      completion: { by: "p-an", at: at(-30, 13), how: "manual" },
      history: [
        { at: at(-35, 11), text: "Created — posted for appearance" },
        { at: at(-30, 13), by: "p-an", text: "Anjali Nair marked this done" },
        { at: at(-25, 11), by: "p-an", text: "Anjali Nair archived this" },
      ],
    }),
  ];
}
