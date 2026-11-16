import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addDays,
  axisFor,
  columnFor,
  MON_TO_SAT,
  preparedAhead,
  todayCallout,
  verdictOf,
  weekScore,
  windowDays,
  type DayKey,
  type PrepTask,
} from "@/lib/advocate/prepared-ahead";

/*
 * The spec's test scenarios (§12), one test each, plus the edge rules they lean on.
 * Mon to Sat are working days. MON is Monday 2 November 2026; d(n) is n days after it.
 */
const cal = MON_TO_SAT;
const MON = "2026-11-02";
const d = (n: number): DayKey => addDays(MON, n);
const TUE = d(1);
const WED = d(2);
const THU = d(3);
const FRI = d(4);
const SAT_BEFORE = d(-2);
const SUN_BEFORE = d(-1);
const NEXT_MON = d(7);
/** An instant at 11 am court time on a day. */
const on = (day: DayKey, hour = 11) => `${day}T${String(hour).padStart(2, "0")}:00:00+05:30`;
const done = (day: DayKey) => [{ at: on(day), type: "completed" as const }];

function task(over: Partial<PrepTask> & { dueOn?: DayKey }): PrepTask {
  return {
    id: "t",
    title: "File the reply",
    caseTitle: "A v. B",
    createdAt: on(d(-10)),
    ...over,
  };
}

/** The column for a day, judged from a later "today" so the day is in the past. */
const col = (tasks: PrepTask[], day: DayKey, today: DayKey = d(14)) => columnFor(cal, tasks, day, today);

describe("prepared ahead · spec scenarios (§12)", () => {
  it("1 · due Mon, done Sat: done ahead on Sat, tick on Mon, verdict ahead", () => {
    const t = task({ dueOn: MON, completions: done(SAT_BEFORE) });
    assert.equal(col([t], SAT_BEFORE).counts.ahead, 1);
    assert.equal(col([t], MON).tick, true);
    assert.equal(col([t], MON).total, 0);
    assert.equal(verdictOf(cal, t, d(14)), "ahead");
  });

  it("2 · due Mon, done Mon: done on the day, no tick, not ahead", () => {
    const t = task({ dueOn: MON, completions: done(MON) });
    assert.equal(col([t], MON).counts.onDay, 1);
    assert.equal(col([t], MON).tick, false);
    assert.equal(verdictOf(cal, t, d(14)), "not-ahead");
  });

  it("3 · due Mon, done Wed: carried Mon and Tue, overdue cleared Wed", () => {
    const t = task({ dueOn: MON, completions: done(WED) });
    assert.equal(col([t], MON).counts.carried, 1);
    assert.equal(col([t], TUE).counts.carried, 1);
    assert.equal(col([t], WED).counts.carried, 0);
    assert.equal(col([t], WED).counts.cleared, 1);
    assert.equal(verdictOf(cal, t, d(14)), "not-ahead");
  });

  it("4 · due Mon, never done, expires Thu: carried Mon–Wed, expired Thu, nothing after", () => {
    const t = task({ dueOn: MON, expiresOn: THU });
    for (const day of [MON, TUE, WED]) assert.equal(col([t], day).counts.carried, 1, day);
    assert.equal(col([t], THU).counts.carried, 0);
    assert.equal(col([t], THU).counts.expired, 1);
    assert.equal(col([t], THU).tick, false);
    assert.equal(col([t], FRI).total, 0);
    assert.equal(verdictOf(cal, t, d(14)), "not-ahead");
  });

  it("5 · created Mon, due Mon, done Mon: done on the day, no verdict", () => {
    const t = task({ dueOn: MON, createdAt: on(MON, 9), completions: done(MON) });
    assert.equal(col([t], MON).counts.onDay, 1);
    assert.equal(verdictOf(cal, t, d(14)), null);
  });

  it("6 · adjourned the Thu before, new due date the following Mon: judged on the new Mon", () => {
    const t = task({ dueOn: NEXT_MON, dueChangedAt: on(d(-4)) });
    assert.equal(col([t], MON).total, 0);
    assert.equal(verdictOf(cal, t, d(6)), null, "no verdict before the new due date");
    assert.equal(verdictOf(cal, t, NEXT_MON), "not-ahead");
  });

  it("7 · due Mon not done, adjourned Wed to two weeks on, done Fri: marks removed, done ahead Fri", () => {
    const t = task({ dueOn: d(14), dueChangedAt: on(WED), completions: done(FRI) });
    assert.equal(col([t], MON, d(20)).counts.carried, 0);
    assert.equal(col([t], TUE, d(20)).counts.carried, 0);
    assert.equal(col([t], FRI, d(20)).counts.ahead, 1);
    assert.equal(verdictOf(cal, t, d(13)), null, "recorded on the new due date, not before");
    assert.equal(verdictOf(cal, t, d(20)), "ahead");
  });

  it("8 · tasks due Tue to Fri, all done Mon: tall done-ahead bar Mon, ticks Tue to Fri", () => {
    const tasks = [TUE, WED, THU, FRI].map((due, i) => task({ id: `t${i}`, dueOn: due, completions: done(MON) }));
    assert.equal(col(tasks, MON).counts.ahead, 4);
    for (const day of [TUE, WED, THU, FRI]) assert.equal(col(tasks, day).tick, true, day);
    for (const t of tasks) assert.equal(verdictOf(cal, t, d(14)), "ahead");
  });

  it("9 · due Mon, done the Sunday before: done ahead on Sat", () => {
    const t = task({ dueOn: MON, completions: done(SUN_BEFORE) });
    assert.equal(col([t], SAT_BEFORE).counts.ahead, 1);
    assert.equal(verdictOf(cal, t, d(14)), "ahead");
  });

  it("10 · last week 1 of 2 ahead, week before 3 of 4: 50%, down 25 points", () => {
    const today = d(14); // Monday two weeks on; last week = d(7)..d(13), week before = MON..d(6)
    const lastWeek = [
      task({ id: "a", dueOn: d(8), completions: done(d(7)) }),
      task({ id: "b", dueOn: d(9), completions: done(d(9)) }),
    ];
    const weekBefore = [
      task({ id: "c", dueOn: TUE, completions: done(MON) }),
      task({ id: "e", dueOn: WED, completions: done(MON) }),
      task({ id: "f", dueOn: THU, completions: done(WED) }),
      task({ id: "g", dueOn: FRI, completions: done(FRI) }),
    ];
    const result = preparedAhead(cal, [...lastWeek, ...weekBefore], today);
    assert.deepEqual([result.lastWeek.ahead, result.lastWeek.eligible, result.lastWeek.percent], [1, 2, 50]);
    assert.deepEqual([result.weekBefore.ahead, result.weekBefore.eligible, result.weekBefore.percent], [3, 4, 75]);
    assert.equal(result.change, -25);
  });

  it("11 · due Mon not done, case closed Wed: marks removed, nothing from Wed, no verdict", () => {
    const t = task({ dueOn: MON, caseClosedAt: on(WED) });
    for (const day of [MON, TUE, WED, THU]) assert.equal(col([t], day).total, 0, day);
    assert.equal(verdictOf(cal, t, d(14)), null);
  });

  it("12 · a day with only an expired task: expired segment, no tick", () => {
    const t = task({ dueOn: SAT_BEFORE, expiresOn: TUE });
    assert.equal(col([t], TUE).counts.expired, 1);
    assert.equal(col([t], TUE).total, 1);
    assert.equal(col([t], TUE).tick, false);
  });

  it("13 · expired task and a similar new one: two separate tasks", () => {
    const old = task({ id: "old", dueOn: MON, expiresOn: TUE });
    const fresh = task({ id: "new", dueOn: NEXT_MON, createdAt: on(WED), completions: done(THU) });
    assert.equal(col([old, fresh], MON).counts.carried, 1);
    assert.equal(col([old, fresh], TUE).counts.expired, 1);
    assert.equal(col([old, fresh], THU).counts.ahead, 1);
    assert.equal(verdictOf(cal, old, d(14)), "not-ahead");
    assert.equal(verdictOf(cal, fresh, d(14)), "ahead");
  });

  it("14 · due date edited Wed from Mon to next Mon, not done: Mon and Tue marks removed", () => {
    const t = task({ dueOn: NEXT_MON, dueChangedAt: on(WED) });
    assert.equal(col([t], MON).counts.carried, 0);
    assert.equal(col([t], TUE).counts.carried, 0);
    assert.equal(verdictOf(cal, t, NEXT_MON), "not-ahead");
  });

  it("15 · a task with no due date: off the chart, counted in the callout, no verdict", () => {
    const t = task({ dueOn: undefined });
    assert.equal(col([t], MON).total, 0);
    assert.equal(todayCallout(cal, [t], MON).noDueDate, 1);
    assert.equal(verdictOf(cal, t, d(14)), null);
  });
});

describe("prepared ahead · edge rules", () => {
  it("in-court tasks stay off the chart and out of the score (§3)", () => {
    const t = task({ dueOn: MON, inCourt: true, completions: done(MON) });
    assert.equal(col([t], MON).total, 0);
    assert.equal(verdictOf(cal, t, d(14)), null);
    assert.equal(preparedAhead(cal, [t], WED).notCounted.inCourt, 1);
  });

  it("a due date moved to a day already reached behaves as late-created (§7.3)", () => {
    const t = task({ dueOn: TUE, dueChangedAt: on(TUE), completions: done(TUE) });
    assert.equal(col([t], TUE).counts.onDay, 1);
    assert.equal(verdictOf(cal, t, d(14)), null);
  });

  it("a due date on Sunday counts as due Saturday (§4.3)", () => {
    const t = task({ dueOn: d(6) });
    assert.equal(col([t], d(5)).counts.carried, 1);
  });

  it("a reopened task is open again from the reopen; final completion drives segments (§9)", () => {
    const t = task({
      dueOn: TUE,
      completions: [
        { at: on(MON), type: "completed" },
        { at: on(WED), type: "reopened" },
        { at: on(THU), type: "completed" },
      ],
    });
    assert.equal(col([t], MON).counts.ahead, 0, "no segment for a completion that was undone");
    assert.equal(col([t], TUE).counts.carried, 0, "completed at the end of Tue");
    assert.equal(col([t], WED).counts.carried, 1, "open again at the end of Wed");
    assert.equal(col([t], THU).counts.cleared, 1);
    assert.equal(verdictOf(cal, t, d(14)), "ahead", "the verdict taken on Tue stands");
  });

  it("clearing everything in one sitting leaves the day clean (§4.1)", () => {
    const tasks = [MON, TUE].map((due, i) => task({ id: `t${i}`, dueOn: due, completions: done(WED) }));
    assert.equal(col(tasks, WED).counts.carried, 0);
    assert.equal(col(tasks, WED).counts.cleared, 2);
  });

  it("holidays get no column (§2)", () => {
    const withHoliday = { ...cal, holidays: [WED] };
    assert.equal(windowDays(withHoliday, FRI, 3).includes(WED), false);
    assert.deepEqual(windowDays(withHoliday, FRI, 3), [MON, TUE, THU, FRI]);
  });

  it("today: done today, overdue still to do and still to do (§4.2)", () => {
    const today = WED;
    const tasks = [
      task({ id: "a", dueOn: THU, completions: done(WED) }),
      task({ id: "b", dueOn: MON }),
      task({ id: "c", dueOn: WED }),
      task({ id: "e", dueOn: THU }),
      task({ id: "f", dueOn: FRI }),
    ];
    const c = columnFor(cal, tasks, today, today);
    assert.equal(c.counts.ahead, 1);
    assert.equal(c.counts.overdueTodo, 1);
    assert.equal(c.counts.todo, 2, "due today and due tomorrow");
    assert.equal(c.counts.carried, 0, "nothing is carried before midnight");
    const callout = todayCallout(cal, tasks, today);
    assert.deepEqual([callout.dueNext, callout.leftToday, callout.overdue], [1, 1, 1]);
  });

  it("ready through: everything owed up to a future date is done (§10.6)", () => {
    const tasks = [task({ id: "a", dueOn: THU, completions: done(MON) }), task({ id: "b", dueOn: d(5) })];
    assert.equal(todayCallout(cal, tasks, MON).readyThrough, FRI);
  });

  it("on Saturday the next working day is Monday, not tomorrow", () => {
    const c = todayCallout(cal, [task({ dueOn: NEXT_MON })], d(5));
    assert.equal(c.nextDay, NEXT_MON);
    assert.equal(c.nextIsTomorrow, false);
    assert.equal(c.dueNext, 1);
  });

  it("week score shows no change when a week had nothing due (§5.2)", () => {
    const result = preparedAhead(cal, [task({ dueOn: d(8), completions: done(d(7)) })], d(14));
    assert.equal(result.lastWeek.percent, 100);
    assert.equal(result.weekBefore.percent, null);
    assert.equal(result.change, null);
    assert.equal(weekScore(cal, [], MON, d(14)).percent, null);
  });

  it("carried task-days count each day a task stays open (§5.3)", () => {
    const result = preparedAhead(cal, [task({ dueOn: d(7), completions: done(d(10)) })], d(14));
    assert.equal(result.carriedTaskDays, 3);
  });

  it("the outlier rule caps the tallest bar at 3× the second (§10.3)", () => {
    assert.deepEqual(axisFor([2, 3, 20]), { max: 10, cap: 9 });
    assert.deepEqual(axisFor([2, 5]), { max: 6, cap: null }, "even steps keep the half line whole");
    assert.deepEqual(axisFor([4, 5, 7]), { max: 8, cap: null });
  });

  it("today on a Sunday gets no column; the window ends on Saturday (§2)", () => {
    const days = windowDays(cal, d(6), 3);
    assert.deepEqual(days, [d(3), d(4), d(5)]);
    const result = preparedAhead(cal, [task({ dueOn: d(5) })], d(6), 3);
    assert.equal(result.columns.some((c) => c.isToday), false);
    assert.equal(result.columns.at(-1)!.counts.carried, 1, "Saturday is over, so its open task is carried");
  });

  it("today can earn a tick when all of today's tasks were ready before it (§6)", () => {
    const t = task({ dueOn: WED, completions: done(TUE) });
    assert.equal(columnFor(cal, [t], WED, WED).tick, true);
    const overdue = task({ id: "o", dueOn: MON });
    assert.equal(columnFor(cal, [t, overdue], WED, WED).tick, false, "an overdue task still open blocks it");
  });

  it("ready through the last date done for, when nothing is open (§10.6)", () => {
    const tasks = [task({ dueOn: THU, completions: done(MON) })];
    const c = todayCallout(cal, tasks, TUE);
    assert.equal(c.allClear, true);
    assert.equal(c.readyThrough, THU);
  });

  it("a closed case keeps its completed tasks (§7.4)", () => {
    const t = task({ dueOn: TUE, completions: done(MON), caseClosedAt: on(WED) });
    assert.equal(col([t], MON).counts.ahead, 1);
    assert.equal(verdictOf(cal, t, d(14)), "ahead");
  });

  it("the footnote tells created-late from moved-late (§10.7)", () => {
    const created = task({ id: "c", dueOn: TUE, createdAt: on(TUE, 9), completions: done(TUE) });
    const moved = task({ id: "m", dueOn: TUE, dueChangedAt: on(TUE), completions: done(TUE) });
    assert.deepEqual(preparedAhead(cal, [created, moved], WED).notCounted, { inCourt: 0, lateCreated: 1, movedLate: 1 });
  });

  it("empty when nothing in the window (§10.7)", () => {
    assert.equal(preparedAhead(cal, [], WED).empty, true);
  });
});
