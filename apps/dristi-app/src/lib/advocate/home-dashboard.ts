/**
 * The advocate Home dashboard: one demo day, and the rules that read it.
 *
 * Home answers five questions in a fixed order (owner, 2026-11-13 to 11-16):
 *   ① Where you need to be    one bar per court sitting today
 *   ② Must do today           overdue · due today · due tomorrow; List | Insights
 *   ③ Waiting on you          someone prepared it or asked; bookmarked first, then longest wait
 *   ④ Updates on your cases   newest first; bookmarked first
 *   ⑤ Coming up               hearings and tasks due, per working day
 *
 * Every task lives once, in `TASKS`. ②'s list, ②'s insights (`prepared-ahead.ts`) and ⑤'s
 * task bars all read that one set, so their numbers cannot disagree. A task dated by
 * tomorrow belongs to ②; otherwise, if someone is waiting on it, to ③ (an item shows once).
 *
 * Demo data, shaped on fields main's advocate screens already show: `Task.dueAt`,
 * `isBlocking` + `hearingAt`, `prepared.by/at`, `review`, `completion.at`, `createdAt`;
 * `CaseRecord.bookmarked`, `latestUpdate`, `updatedOn`; the cause list's item numbers.
 * Three fields the insights need are not on main yet and are open with the backend:
 * a task's expiry date, its completion history (reopen) and the court holiday calendar.
 * Everything is dated relative to today, in working days, so the demo reads the same on
 * any day it is opened.
 */

import {
  addDays,
  dayOf,
  isWorkingDay,
  mondayOf,
  MON_TO_SAT,
  nextWorkingDay,
  toWorkingDay,
  type CourtCalendar,
  type DayKey,
  type PrepTask,
} from "@/lib/advocate/prepared-ahead";

export const HOME_CALENDAR: CourtCalendar = MON_TO_SAT;

export type TaskKind = "pay" | "sign" | "file" | "review" | "hearing";

export type HomeTask = PrepTask & {
  kind: TaskKind;
  /** The task's own verb, as Take action words it. */
  verb: string;
  bookmarked?: boolean;
  /** The hearing it holds up today (`isBlocking` + `hearingAt`). */
  blocks?: { item: number; court: string };
  /** Someone prepared it for you, or asked you (`prepared.by/at`, `review`). */
  waiting?: { by: string; how: "prepared" | "raised"; since: string };
};

export type CourtToday = {
  court: string;
  /** The item being heard now; 0 when the court has not sat yet. */
  now: number;
  last: number;
  mine: { item: number; bookmarked?: boolean; /** Why it may not go ahead. */ issue?: string }[];
};

export type CaseUpdate = {
  id: string;
  what: string;
  caseTitle: string;
  at: string;
  bookmarked?: boolean;
};

export type HomeDay = {
  today: DayKey;
  now: number;
  courts: CourtToday[];
  moreCourts: number;
  tasks: HomeTask[];
  updates: CaseUpdate[];
  moreUpdates: number;
  /** Hearings listed per day, today first, with how many of them are on bookmarked cases. */
  hearings: Record<DayKey, { count: number; bookmarked: number }>;
};

/* ── Time ─────────────────────────────────────────────────────────────── */

/** n working days from `day` (negative: before). */
export function workingDaysFrom(cal: CourtCalendar, day: DayKey, n: number): DayKey {
  let d = day;
  for (let i = 0; i < Math.abs(n); i++) {
    d = addDays(d, n > 0 ? 1 : -1);
    while (!isWorkingDay(cal, d)) d = addDays(d, n > 0 ? 1 : -1);
  }
  return d;
}

/** An instant at a court-time hour on a day. */
export const at = (day: DayKey, hour = 11, minute = 0) =>
  `${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`;

/**
 * The demo clock: 11:20 am court time, so courts are sitting and the morning's work is open.
 * On a Sunday or holiday the demo opens on the next court day, so it always shows a sitting day.
 */
export function demoNow(): number {
  let today = dayOf(new Date().toISOString());
  if (!isWorkingDay(HOME_CALENDAR, today)) today = nextWorkingDay(HOME_CALENDAR, today);
  return new Date(at(today, 11, 20)).getTime();
}

/* ── The demo day ─────────────────────────────────────────────────────── */

export function homeDay(now: number = demoNow()): HomeDay {
  const cal = HOME_CALENDAR;
  const today = dayOf(new Date(now).toISOString());
  const w = (n: number) => workingDaysFrom(cal, today, n);
  const done = (day: DayKey, hour = 16) => [{ at: at(day, hour), type: "completed" as const }];
  /** Days of last week from its Monday (k = 0), and of the week before (negative k). */
  const lastMonday = addDays(mondayOf(today), -7);
  const L = (k: number) => addDays(lastMonday, k);

  const C = {
    fathima: "Fathima Beevi v. Anil Kumar K.",
    anitha: "Anitha Joseph v. Latheef M.",
    murali: "Muralidharan P. v. Sherin Thomas",
    kerala: "Kerala Agro Mart v. Biju Varghese",
    lakshmi: "Lakshmi Menon v. P. J. Thomas",
    jaya: "Jaya Textiles v. Noufal A.",
    nimmy: "Nimmy George v. Saji Kurian",
    durga: "Sree Durga Traders v. Ajmal K.",
    aiswarya: "Aiswarya Agencies v. Deepa Mohan",
    malabar: "Malabar Spices v. Rasheed P.",
    thomas: "Thomas Kurian v. Bindu Mathew",
  };

  const t = (id: string, kind: TaskKind, verb: string, title: string, caseTitle: string, over: Partial<HomeTask>): HomeTask => ({
    id,
    kind,
    verb,
    title,
    caseTitle,
    createdAt: at(w(-16), 10),
    ...over,
  });

  const tasks: HomeTask[] = [
    /* ② Overdue: due two working days ago, still open, so it has been carried since. */
    t("copy-fee", "pay", "Pay", "Pay the copying fee", C.kerala, { dueOn: w(-2) }),

    /* ② Due today. Two of them hold up a matter listed today. */
    t("process-fee", "pay", "Pay", "Pay the process fee", C.fathima, {
      dueOn: today,
      bookmarked: true,
      blocks: { item: 14, court: "24×7 ON Court" },
    }),
    t("bail-sign", "sign", "Sign", "Sign the bail application", C.anitha, {
      dueOn: today,
      blocks: { item: 3, court: "CJM Court" },
    }),
    t("reply", "file", "File", "File the reply to the objection", C.murali, { dueOn: today }),

    /* ② Due tomorrow (the next working day). */
    t("affidavit", "file", "File", "File the proof affidavit", C.lakshmi, { dueOn: w(1) }),
    t("court-fee", "pay", "Pay", "Pay the court fee", C.jaya, { dueOn: w(1) }),
    t("witness-list", "file", "File", "File the witness list", C.malabar, { dueOn: w(1), createdAt: at(w(-3), 12) }),

    /* Done today, a day ahead: today's column shows it as done ahead. */
    t("summons-fee", "pay", "Pay", "Pay the summons fee", C.thomas, { dueOn: w(1), completions: done(today, 10) }),

    /* ③ Waiting on you: someone prepared it or asked. Not due by tomorrow. */
    t("removal", "review", "Respond", "Request to remove you from the case", C.nimmy, {
      bookmarked: true,
      createdAt: at(w(-5), 15),
      waiting: { by: "Deepa Varghese", how: "raised", since: at(addDays(today, -5), 15) },
    }),
    t("vakalat", "sign", "Sign", "Vakalatnama", C.durga, {
      bookmarked: true,
      dueOn: w(4),
      createdAt: at(addDays(today, -1), 17),
      waiting: { by: "S. Prakash", how: "prepared", since: at(addDays(today, -1), 17) },
    }),
    t("affidavit-sign", "sign", "Sign", "Proof affidavit", C.aiswarya, {
      dueOn: w(5),
      createdAt: at(addDays(today, -3), 12),
      waiting: { by: "Rahul Iyer", how: "prepared", since: at(addDays(today, -3), 12) },
    }),
    t("copy-app", "sign", "Sign", "Application for certified copy", C.kerala, {
      createdAt: at(today, 9, 40),
      waiting: { by: "Rahul Iyer", how: "prepared", since: at(today, 9, 40) },
    }),
    t("memo-sign", "sign", "Sign", "Memo of appearance", C.jaya, {
      dueOn: w(6),
      createdAt: at(addDays(today, -2), 11),
      waiting: { by: "S. Prakash", how: "prepared", since: at(addDays(today, -2), 11) },
    }),
    t("adj-review", "review", "Respond", "Request to share the case file", C.malabar, {
      dueOn: w(7),
      createdAt: at(addDays(today, -4), 10),
      waiting: { by: "Arun Thomas", how: "raised", since: at(addDays(today, -4), 10) },
    }),

    /* Coming up, nobody waiting: counted in ⑤ only. */
    t("cert-fee", "pay", "Pay", "Pay the certified copy fee", C.durga, { dueOn: w(2) }),
    t("written-args", "file", "File", "File written arguments", C.anitha, { dueOn: w(2) }),
    t("vak-fee", "pay", "Pay", "Pay the vakalatnama fee", C.aiswarya, { dueOn: w(3) }),
    t("doc-list", "file", "File", "File the list of documents", C.thomas, { dueOn: w(5) }),

    /* History, dated from last week's Monday so both scored weeks are full on any weekday.
       The week before last was rough; last week, steadier. */
    t("h1", "pay", "Pay", "Pay the process fee", C.durga, { dueOn: L(-5), completions: done(L(-6)) }),
    t("h2", "file", "File", "File the vakalatnama", C.nimmy, { dueOn: L(-5), completions: done(L(-5)) }),
    t("h3", "pay", "Pay", "Pay the court fee", C.malabar, { dueOn: L(-4), completions: done(L(-2)) }),
    t("h4", "sign", "Sign", "Sign the complaint", C.thomas, { dueOn: L(-4), completions: done(L(-4)) }),
    t("h5", "file", "File", "File the reply", C.jaya, { dueOn: L(-3), expiresOn: L(0) }),
    t("h6", "pay", "Pay", "Pay the summons fee", C.anitha, { dueOn: L(-2), completions: done(L(-3)) }),
    t("h7", "file", "File", "File the memo", C.murali, { dueOn: L(-2), completions: done(L(-2)) }),
    t("h8", "hearing", "Mark done", "Be present for the plea", C.lakshmi, { dueOn: L(0), inCourt: true, completions: done(L(0), 12) }),
    t("h9", "pay", "Pay", "Pay the process fee", C.aiswarya, { dueOn: L(0), completions: done(L(-2)) }),
    t("h10", "sign", "Sign", "Sign the bail bond", C.fathima, { dueOn: L(1), completions: done(L(0)) }),
    t("h11", "file", "File", "File the witness list", C.durga, { dueOn: L(1), completions: done(L(0)) }),
    t("h12", "pay", "Pay", "Pay the copying fee", C.nimmy, { dueOn: L(2), completions: done(L(1)) }),
    t("h13", "file", "File", "File the proof affidavit", C.thomas, { dueOn: L(2), completions: done(L(0)) }),
    t("h14", "file", "File", "File the counter statement", C.malabar, { dueOn: L(3), createdAt: at(L(3), 9), completions: done(L(3)) }),
    t("h15", "sign", "Sign", "Sign the vakalatnama", C.jaya, { dueOn: L(3), completions: done(L(2)) }),
    t("h16", "pay", "Pay", "Pay the court fee", C.anitha, { dueOn: L(4), completions: done(L(3)) }),
    t("h17", "file", "File", "File the reply", C.lakshmi, { dueOn: L(5), completions: done(L(4)) }),
    t("h18", "pay", "Pay", "Pay the process fee", C.murali, { dueOn: L(5), completions: done(L(5)) }),
  ];

  const courts: CourtToday[] = [
    { court: "24×7 ON Court", now: 9, last: 40, mine: [{ item: 14, bookmarked: true, issue: "Process fee unpaid" }, { item: 22 }] },
    { court: "CJM Court", now: 1, last: 18, mine: [{ item: 3, issue: "Bail application unsigned" }, { item: 11 }] },
    { court: "ACJM Court", now: 20, last: 32, mine: [{ item: 26, issue: `Passed over ${shortDay(w(-1))}` }] },
    { court: "NI Act Court", now: 0, last: 25, mine: [{ item: 7, bookmarked: true }] },
  ];

  const updates: CaseUpdate[] = [
    { id: "u1", what: `Objection invited on the discharge application, due ${shortDay(w(3))}`, caseTitle: C.fathima, at: at(today, 9, 20), bookmarked: true },
    { id: "u2", what: "Summons served on the accused", caseTitle: C.durga, at: at(w(-1), 13, 30), bookmarked: true },
    { id: "u3", what: "Adjournment application rejected", caseTitle: C.nimmy, at: at(w(-1), 12, 10), bookmarked: true },
    { id: "u4", what: `Next hearing set for ${shortDay(w(12))}`, caseTitle: C.aiswarya, at: at(w(-1), 16, 5) },
    { id: "u5", what: "Bail bond accepted", caseTitle: C.anitha, at: at(w(-2), 15, 40) },
  ];

  const hearings: HomeDay["hearings"] = {};
  const listed = [8, 6, 4, 7, 3, 5, 2];
  const marked = [2, 0, 1, 0, 0, 1, 0];
  for (let i = 0; i < listed.length; i++) hearings[w(i)] = { count: listed[i], bookmarked: marked[i] };

  return { today, now, courts, moreCourts: 2, tasks, updates, moreUpdates: 5, hearings };
}

/* ── Rules the cards read ─────────────────────────────────────────────── */

const isOpen = (t: HomeTask) => !t.completions?.length || t.completions.at(-1)!.type !== "completed";

/** Open and still owed on `today`: an expired task has closed for good (§8 of the insights spec). */
const isOwed = (cal: CourtCalendar, t: HomeTask, today: DayKey) =>
  isOpen(t) && !(t.expiresOn && toWorkingDay(cal, t.expiresOn) <= today);

export type MustDoGroup = { key: "overdue" | "today" | "tomorrow"; label: string; tasks: HomeTask[] };

/** ② Must do today: overdue, due today, due the next working day. Blockers first, then by due date. */
export function mustDo(cal: CourtCalendar, tasks: HomeTask[], today: DayKey): MustDoGroup[] {
  const next = nextWorkingDay(cal, today);
  const open = tasks.filter((t) => isOwed(cal, t, today) && t.dueOn);
  const due = (t: HomeTask) => toWorkingDay(cal, t.dueOn!);
  const order = (a: HomeTask, b: HomeTask) =>
    Number(Boolean(b.blocks)) - Number(Boolean(a.blocks)) || due(a).localeCompare(due(b)) || a.id.localeCompare(b.id);
  return [
    { key: "overdue" as const, label: "Overdue", tasks: open.filter((t) => due(t) < today).sort(order) },
    { key: "today" as const, label: "Due today", tasks: open.filter((t) => due(t) === today).sort(order) },
    {
      key: "tomorrow" as const,
      label: next === addDays(today, 1) ? "Due tomorrow" : `Due ${shortDay(next)}`,
      tasks: open.filter((t) => due(t) === next).sort(order),
    },
  ];
}

/** ③ Waiting on you: someone waits, and it is not already in ②. Bookmarked first, then longest wait. */
export function waitingOnYou(cal: CourtCalendar, tasks: HomeTask[], today: DayKey): HomeTask[] {
  const next = nextWorkingDay(cal, today);
  return tasks
    .filter((t) => isOwed(cal, t, today) && t.waiting && !(t.dueOn && toWorkingDay(cal, t.dueOn) <= next))
    .sort(
      (a, b) =>
        Number(Boolean(b.bookmarked)) - Number(Boolean(a.bookmarked)) ||
        a.waiting!.since.localeCompare(b.waiting!.since) ||
        a.id.localeCompare(b.id),
    );
}

/** ④ Updates: bookmarked first, then newest. */
export function updatesFirst(updates: CaseUpdate[]): CaseUpdate[] {
  return [...updates].sort(
    (a, b) => Number(Boolean(b.bookmarked)) - Number(Boolean(a.bookmarked)) || b.at.localeCompare(a.at) || a.id.localeCompare(b.id),
  );
}

export type WeekDay = { day: DayKey; hearings: number; bookmarked: number; tasks: number };

/** ⑤ Coming up: today and the next six working days. Tasks due counts open tasks due that day. */
export function comingUp(cal: CourtCalendar, day: HomeDay, count = 7): WeekDay[] {
  const out: WeekDay[] = [];
  let d = day.today;
  for (let i = 0; i < count; i++) {
    const h = day.hearings[d] ?? { count: 0, bookmarked: 0 };
    const tasks = day.tasks.filter((t) => isOwed(cal, t, day.today) && t.dueOn && toWorkingDay(cal, t.dueOn) === d).length;
    out.push({ day: d, hearings: h.count, bookmarked: h.bookmarked, tasks });
    d = nextWorkingDay(cal, d);
  }
  return out;
}

/* ── Words ────────────────────────────────────────────────────────────── */

const short = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" });
const long = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

/** "Mon 16". */
export function shortDay(day: DayKey): string {
  return short.format(new Date(`${day}T00:00:00Z`)).replace(",", "");
}

/** "Monday, 16 November". */
export function longDay(day: DayKey): string {
  const parts = long.formatToParts(new Date(`${day}T00:00:00Z`));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")}`;
}

/** "9:20 am". */
export function clock(iso: string): string {
  return time.format(new Date(iso)).replace(/\s?([ap])\.?m\.?/i, (_, x: string) => ` ${x.toLowerCase()}m`);
}

/** "Today, 9:20 am" · "Yesterday, 4:05 pm" · "Sat 14, 1:30 pm". */
export function whenOf(iso: string, today: DayKey): string {
  const day = dayOf(iso);
  const lead = day === today ? "Today" : day === addDays(today, -1) ? "Yesterday" : shortDay(day);
  return `${lead}, ${clock(iso)}`;
}

/** Whole calendar days between two days. */
export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
