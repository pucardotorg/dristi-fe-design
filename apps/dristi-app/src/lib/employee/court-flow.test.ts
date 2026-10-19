import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COURT_LIMITS,
  courtDocket,
  courtMeasures,
  courtStatements,
  dayToMs,
  monthKey,
  STAGES,
} from "./court-docket";
import {
  clampPeriod,
  formatPeriod,
  formatSpan,
  formatSpanFull,
  gapsIn,
  movementIn,
  nextDates,
  pickerPresets,
  positionOn,
  presetPeriod,
  previousPeriod,
  readingFor,
  todoLists,
} from "./court-flow";
import {
  attentionFor,
  averageOver,
  closureBaseline,
  closureSummary,
  closureTimeline,
  outcomeDetail,
  stagePathFor,
  trendBreakdown,
  compareShort,
  defaultSelection,
  filedAndClosed,
  monthlyTrends,
  outcomesIn,
  pendingAges,
  periodReading,
  previousName,
  trendMonths,
  trendOpening,
  trendPresets,
} from "./court-flow";
import {
  baselineWindows,
  closedCases,
  filedCases,
  pendingSets,
  trendDetail,
} from "./court-flow";

const DAY = "2026-10-19";
const docket = courtDocket(DAY);
const d = dayToMs;

describe("periods", () => {
  it("names the presets and compares each with the same stretch one step back", () => {
    const thisMonth = presetPeriod("this-month", docket);
    assert.equal(formatPeriod(thisMonth), "1–19 Oct 2026");
    assert.deepEqual(previousPeriod(thisMonth, docket), { from: d("2026-09-01"), to: d("2026-09-30") });

    const lastMonth = presetPeriod("last-month", docket);
    assert.equal(formatPeriod(lastMonth), "Sep 2026");
    assert.deepEqual(previousPeriod(lastMonth, docket), { from: d("2026-08-01"), to: d("2026-08-31") });

    const quarter = presetPeriod("last-3-months", docket);
    assert.equal(formatPeriod(quarter), "Jul–Sep 2026");
    assert.deepEqual(previousPeriod(quarter, docket), { from: d("2026-04-01"), to: d("2026-06-30") });
  });

  it("compares a whole month with the whole month before, whatever their lengths", () => {
    const september = { from: d("2026-09-01"), to: d("2026-09-30") };
    assert.deepEqual(previousPeriod(september, docket), { from: d("2026-08-01"), to: d("2026-08-31") });
    const march = { from: d("2026-03-01"), to: d("2026-03-31") };
    assert.deepEqual(previousPeriod(march, docket), { from: d("2026-02-01"), to: d("2026-02-28") });
  });

  it("compares any other range with the same number of days just before it", () => {
    const range = { from: d("2026-09-10"), to: d("2026-09-19") };
    assert.deepEqual(previousPeriod(range, docket), { from: d("2026-08-31"), to: d("2026-09-09") });
    assert.equal(formatPeriod(range), "10–19 Sep 2026");
    assert.equal(formatPeriod({ from: d("2026-08-12"), to: d("2026-09-03") }), "12 Aug – 3 Sep 2026");
  });

  it("offers no comparison that would begin before the records do", () => {
    assert.equal(previousPeriod({ from: docket.start, to: docket.today }, docket), null);
  });

  it("keeps a chosen range in order and inside the records", () => {
    const clamped = clampPeriod({ from: d("2027-01-01"), to: d("2020-01-01") }, docket);
    assert.deepEqual(clamped, { from: docket.start, to: docket.today });
  });
});

describe("the court on a past day", () => {
  it("agrees with today's measures when read for today", () => {
    const m = courtMeasures(docket);
    const today = positionOn(docket, docket.today);
    assert.equal(today.pending, m.pending.length);
    assert.equal(today.st, m.stPending.length);
    assert.equal(today.cmp, m.cmpPending.length);
    assert.equal(today.awaitingRegistration, m.awaitingRegistration.length);
    assert.equal(today.longPending, m.longPending.length);
    for (const stage of STAGES) {
      assert.equal(today.byStage[stage.key].length, m.byStage[stage.key].length, stage.key);
      assert.deepEqual(
        today.overdue[stage.key].map((x) => x.case.id).sort(),
        m.overdue[stage.key].map((c) => c.id).sort(),
        stage.key,
      );
    }
    const ids = (list: { case: { id: number } }[]) => [...new Set(list.map((x) => x.case.id))].sort();
    assert.deepEqual(
      ids(STAGES.flatMap((s) => today.paymentPending[s.key])),
      ids(m.paymentPending),
    );
    assert.deepEqual(
      ids(STAGES.flatMap((s) => today.deliveryPending[s.key])),
      ids(m.deliveryPending),
    );
  });

  it("reconciles: pending at the start, plus what came in, less what went out, is pending at the end", () => {
    const period = presetPeriod("last-month", docket);
    const opening = positionOn(docket, period.from - 86_400_000).pending;
    const moved = movementIn(docket, period);
    const closing = positionOn(docket, period.to).pending;
    assert.equal(opening + moved.cameIn.length - moved.disposed.length - moved.toLongPending.length, closing);
    const september = courtStatements(docket).monthly.find((row) => row.label === "Sep 2026");
    assert.equal(september?.closing, closing, "the statement of pendency says the same");
  });

  it("puts a case past its review point only when it has stayed longer than the limit", () => {
    const at = d("2026-09-30");
    const position = positionOn(docket, at);
    for (const stage of STAGES) {
      for (const row of position.overdue[stage.key]) {
        assert.ok(row.days > COURT_LIMITS.stages[stage.key]);
      }
    }
  });
});

describe("hearing gaps in a period", () => {
  it("counts only hearings held in it, and none in registration", () => {
    const gaps = gapsIn(docket, presetPeriod("last-month", docket));
    assert.equal(gaps.registration.hearings, 0);
    assert.equal(gaps.registration.median, null);
    assert.ok(gaps.trial.hearings > 0);
    assert.ok(gaps.trial.long <= gaps.trial.hearings);
  });
});

describe("what to do first", () => {
  it("lists today's cases once each, longest waiting first, hearings soonest first", () => {
    for (const list of todoLists(docket)) {
      const ids = list.rows.map((row) => row.case.id);
      assert.equal(new Set(ids).size, ids.length, `${list.id} has no repeats`);
      const days = list.rows.map((row) => row.days);
      const ordered = days.slice().sort((a, b) => (list.soonestFirst ? a - b : b - a));
      assert.deepEqual(days, ordered, `${list.id} order`);
    }
  });

  it("gives the magistrate's own work to the magistrate and process to the office", () => {
    const who = Object.fromEntries(todoLists(docket).map((list) => [list.id, list.who]));
    assert.deepEqual(who, { process: "Office", undated: "You", applications: "You", judgement: "You" });
  });
});

describe("reading a chosen date", () => {
  it("reads one day as the month so far, compared with the whole of last month and 30 days earlier", () => {
    const r = readingFor({ from: d("2026-10-15"), to: d("2026-10-15") }, docket);
    assert.equal(r.single, true);
    assert.equal(r.live, false);
    assert.deepEqual(r.movement, { from: d("2026-10-01"), to: d("2026-10-15") });
    assert.deepEqual(r.prior, { from: d("2026-09-01"), to: d("2026-09-30") });
    assert.equal(r.compareAt, d("2026-09-15"));
    assert.equal(formatSpan(r.movement.from, r.movement.to, docket.today), "1–15 Oct");
  });

  it("reads a range across itself, counts on its last day compared with its first", () => {
    const r = readingFor({ from: d("2026-09-01"), to: d("2026-10-19") }, docket);
    assert.equal(r.live, true);
    assert.deepEqual(r.movement, { from: d("2026-09-01"), to: d("2026-10-19") });
    assert.equal(r.compareAt, d("2026-09-01"));
    assert.equal(formatSpanFull(r.movement.from, r.movement.to), "1 Sep – 19 Oct 2026");
  });

  it("keeps every quick pick inside the records, and All records has nothing before it", () => {
    for (const preset of pickerPresets(docket)) {
      assert.ok(preset.period.from >= docket.start && preset.period.to <= docket.today, preset.label);
    }
    const all = pickerPresets(docket).find((p) => p.label === "All records")!;
    assert.equal(readingFor(all.period, docket).prior, null);
  });
});

describe("next dates, latest day", () => {
  it("splits today's lists by stage without losing or repeating a case", () => {
    const m = courtMeasures(docket);
    const next = nextDates(docket);
    const all = (lists: Record<string, { case: { id: number } }[]>) =>
      Object.values(lists).flatMap((list) => list.map((row) => row.case.id));
    assert.equal(all(next.undated).length, m.undated.length);
    const soon = all(next.hearingSoon);
    assert.equal(soon.length, new Set(m.hearingSoon.map((x) => x.case.id)).size);
    assert.equal(new Set(soon).size, soon.length);
    assert.equal(next.usual.registration, null);
    assert.equal(next.farBeyond.registration.length, 0);
  });
});

describe("the period under review", () => {
  it("opens on this month so far, compared with the whole of last month", () => {
    const r = periodReading(defaultSelection(docket), docket);
    assert.deepEqual(r.selection, { from: d("2026-10-01"), to: d("2026-10-19") });
    assert.equal(r.kind, "month");
    assert.equal(r.isDefault, true);
    assert.deepEqual(r.baseline, [{ from: d("2026-09-01"), to: d("2026-09-30") }]);
    assert.equal(r.overdueSince, d("2026-10-01"));
    assert.equal(previousName(r.selection), "Previous month");
    assert.equal(compareShort("prev", r.selection), "vs last month");
  });

  it("reads one day alone, against the same weekday a week earlier", () => {
    const day = { from: d("2026-10-15"), to: d("2026-10-15") };
    const r = periodReading(day, docket);
    assert.equal(r.kind, "day");
    assert.deepEqual(r.baseline, [{ from: d("2026-10-08"), to: d("2026-10-08") }]);
    assert.equal(r.overdueSince, d("2026-09-15"));
    assert.equal(previousName(day), "Same day last week");
    assert.equal(compareShort("prev", day), "vs last week");
    assert.deepEqual(periodReading(day, docket, "year").baseline, [
      { from: d("2026-10-15") - 52 * 7 * 86_400_000, to: d("2026-10-15") - 52 * 7 * 86_400_000 },
    ]);
  });

  it("compares a whole month with whole months, and any range with the same length before it", () => {
    const sep = { from: d("2026-09-01"), to: d("2026-09-30") };
    assert.deepEqual(periodReading(sep, docket).baseline, [{ from: d("2026-08-01"), to: d("2026-08-31") }]);
    assert.deepEqual(periodReading(sep, docket, "year").baseline, [{ from: d("2025-09-01"), to: d("2025-09-30") }]);
    assert.equal(previousName(sep), "Previous month");
    const span = { from: d("2026-09-10"), to: d("2026-09-19") };
    assert.deepEqual(periodReading(span, docket).baseline, [{ from: d("2026-08-31"), to: d("2026-09-09") }]);
    assert.equal(previousName(span), "Previous 10 days");
    assert.equal(compareShort("prev", span), "vs previous period");
  });

  it("averages up to six periods, and drops any that begin before the records", () => {
    const r = periodReading(defaultSelection(docket), docket, "avg");
    assert.equal(r.baseline.length, 6);
    assert.equal(r.baseline[5].from, d("2026-04-01"));
    const early = periodReading({ from: d("2024-12-01"), to: d("2024-12-31") }, docket, "avg");
    assert.equal(early.baseline.length, 1);
    assert.equal(periodReading(defaultSelection(docket), docket, "none").baseline.length, 0);
    assert.equal(compareShort("none", defaultSelection(docket)), "");
    const avg = averageOver(r.baseline, (p) => filedAndClosed(docket, p))!;
    const each = r.baseline.map((p) => filedAndClosed(docket, p).filed);
    assert.equal(avg.filed, each.reduce((a, b) => a + b, 0) / each.length);
  });

  it("counts closures once each, and ages every pending case", () => {
    const period = presetPeriod("last-month", docket);
    const out = outcomesIn(docket, period);
    const moved = movementIn(docket, period);
    assert.equal(out.Convicted + out.Acquitted + out.Settled + out.early + out.toLongPending, filedAndClosed(docket, period).closed);
    assert.equal(out.early, out.Withdrawn + out.Dismissed + out.Returned);
    assert.equal(filedAndClosed(docket, period).filed, moved.cameIn.length);
    const ages = pendingAges(docket, period);
    assert.equal(ages[0] + ages[1] + ages[2], positionOn(docket, period.to).pending);
  });
});

describe("trends", () => {
  it("reads five measures over the chosen months, the last to the day", () => {
    const trends = monthlyTrends(docket, docket.today);
    assert.deepEqual(trends.map((t) => t.id), ["pending", "clearance", "overdue", "disposal", "serve"]);
    for (const trend of trends) {
      assert.equal(trend.points.length, 12, trend.id);
      assert.equal(trend.points.at(-1)!.partial, true);
      if (trend.last && trend.base) {
        const change = (trend.last.value! - trend.base) / Math.abs(trend.base);
        const expected =
          Math.abs(change) < 0.05 ? "steady" : change > 0 === (trend.better === "up") ? "better" : "worse";
        assert.equal(trend.verdict, expected, trend.id);
      }
    }
    assert.equal(trends[0].last!.value, positionOn(docket, docket.today).pending);
  });

  it("gives no verdict with fewer than four months", () => {
    const now = 2026 * 12 + 9;
    const short = monthlyTrends(docket, docket.today, { from: now - 2, to: now });
    assert.equal(short[0].points.length, 3);
    assert.ok(short.every((t) => t.verdict === null));
    const all = monthlyTrends(docket, docket.today, { from: 0, to: now });
    assert.equal(all[0].points.length, 24);
  });
});

describe("the trends date picker", () => {
  it("offers whole-month quick picks inside the records, opening on the last 12 months", () => {
    const docket = courtDocket("2026-10-19");
    const picks = trendPresets(docket);
    assert.deepEqual(
      picks.map((p) => p.label),
      ["Last 6 months", "Last 12 months", "This year", "Last year", "All records"],
    );
    for (const { period } of picks) {
      assert.ok(period.from >= docket.start && period.to <= docket.today);
    }
    const opening = trendOpening(docket);
    assert.deepEqual(trendMonths(opening), { from: monthKey(dayToMs("2025-11-01")), to: monthKey(dayToMs("2026-10-19")) });
    assert.deepEqual(trendMonths({ from: dayToMs("2026-08-12"), to: dayToMs("2026-09-03") }), {
      from: monthKey(dayToMs("2026-08-01")),
      to: monthKey(dayToMs("2026-09-01")),
    });
  });
});

describe("the cases behind each figure", () => {
  const reading = periodReading(defaultSelection(docket), docket, "avg");
  const period = reading.selection;

  it("lists exactly the cases filed and closed in the period", () => {
    const counts = filedAndClosed(docket, period);
    assert.equal(filedCases(docket, period).length, counts.filed);
    const closed = closedCases(docket, period);
    assert.equal(closed.length, counts.closed);
    const out = outcomesIn(docket, period);
    for (const key of ["Convicted", "Acquitted", "Settled", "early", "toLongPending"] as const) {
      assert.equal(closed.filter((r) => r.outcome === key).length, out[key], key);
    }
  });

  it("splits the pending cases by register and by age without losing one", () => {
    const sets = pendingSets(docket, period);
    const position = positionOn(docket, period.to);
    assert.equal(sets.all.length, position.pending);
    assert.equal(sets.cmp.length, position.cmp);
    assert.equal(sets.st.length, position.st);
    assert.equal(sets.awaitingRegistration.length, position.awaitingRegistration);
    assert.deepEqual(sets.ages.map((a) => a.length), pendingAges(docket, period));
  });

  it("spells out the baseline windows the average is taken over", () => {
    const windows = baselineWindows(docket, reading);
    assert.equal(windows.length, 6);
    const avg = averageOver(reading.baseline, (p) => filedAndClosed(docket, p))!;
    assert.equal(windows.reduce((sum, w) => sum + w.filed, 0) / 6, avg.filed);
  });

  it("reads a trend's months, its extremes and the months its verdict averages", () => {
    const trend = monthlyTrends(docket, docket.today)[0];
    const detail = trendDetail(trend);
    assert.equal(detail.rows.length, trend.points.length);
    assert.equal(detail.rows[0].change, null);
    assert.equal(detail.rows[1].change, trend.points[1].value! - trend.points[0].value!);
    assert.equal(detail.baseMonths.length, 3);
    const mean = detail.baseMonths.reduce((sum, p) => sum + p.value!, 0) / 3;
    assert.equal(mean, trend.base);
    const values = trend.points.map((p) => p.value!);
    assert.equal(detail.highest!.value, Math.max(...values));
    assert.equal(detail.lowest!.value, Math.min(...values));
  });
});

describe("the v4 dashboard", () => {
  const month = defaultSelection(docket);

  it("bins each stage's days around its review point, and counts moves in the period", () => {
    const path = stagePathFor(docket, month);
    const position = positionOn(docket, month.to);
    for (const stage of STAGES) {
      const p = path[stage.key];
      assert.equal(p.rows.length, position.byStage[stage.key].length, stage.key);
      assert.equal(p.bins.length, p.reviewAfter * 2 + 1, stage.key);
      assert.equal(p.bins.reduce((sum, b) => sum + b.rows.length, 0), p.rows.length, stage.key);
      const late = p.bins.filter((b) => b.late).reduce((sum, b) => sum + b.rows.length, 0);
      assert.equal(late, position.overdue[stage.key].length, `${stage.key} past its review point`);
      assert.equal(p.bins[p.reviewAfter - 1].to, COURT_LIMITS.stages[stage.key], `${stage.key} review point`);
    }
    const filed = filedAndClosed(docket, month).filed;
    assert.equal(path.registration.cameIn, filed, "every filing enters registration");
    for (let i = 1; i < STAGES.length; i++) {
      assert.ok(path[STAGES[i - 1].key].movedOn <= path[STAGES[i].key].cameIn, STAGES[i].key);
    }
    const opening = positionOn(docket, month.from - 86_400_000).pending;
    const cameIn = STAGES.reduce((s, x) => s + path[x.key].cameIn, 0);
    const left = STAGES.reduce((s, x) => s + path[x.key].left, 0);
    assert.equal(opening + cameIn - left, positionOn(docket, month.to).pending, "stage moves reconcile");
  });

  it("counts attention on the day, bins every case once, and compares a range with its first day", () => {
    const today = attentionFor(docket, { from: docket.today, to: docket.today });
    const checks = today.groups.flatMap((g) => g.checks);
    for (const ch of checks) {
      assert.ok(ch.available, ch.id);
      assert.equal(ch.bins.reduce((sum, b) => sum + b.rows.length, 0), ch.rows.length, ch.id);
    }
    const ids = new Set(checks.flatMap((c) => c.rows.map((r) => r.case.id)));
    assert.equal(today.distinct, ids.size);
    const pay = checks.find((c) => c.id === "pay")!;
    assert.equal(pay.rows.length, STAGES.reduce((s, x) => s + positionOn(docket, docket.today).paymentPending[x.key].length, 0));

    const range = attentionFor(docket, { from: d("2026-10-01"), to: d("2026-10-15") });
    const rc = range.groups.flatMap((g) => g.checks);
    assert.equal(range.start, d("2026-10-01"));
    for (const ch of rc) {
      if (ch.latestOnly) {
        assert.equal(ch.available, false, ch.id);
        assert.equal(ch.rows.length, 0);
      } else {
        assert.equal(typeof ch.atStart, "number", ch.id);
      }
    }
  });

  it("summarises closures against a baseline and spreads them over a timeline", () => {
    const summary = closureSummary(docket, month);
    const rows = closedCases(docket, month);
    assert.equal(summary.total, rows.length);
    assert.equal(summary.judgements, rows.filter((r) => r.outcome === "Convicted" || r.outcome === "Acquitted").length);
    const reading = periodReading(month, docket, "avg");
    const base = closureBaseline(docket, reading.baseline)!;
    const each = reading.baseline.map((p) => closureSummary(docket, p).total);
    assert.equal(base.total, each.reduce((a, b) => a + b, 0) / each.length);
    const detail = outcomeDetail(rows.filter((r) => r.outcome === "Convicted"));
    assert.equal(detail.ages.reduce((s, a) => s + a.rows.length, 0), rows.filter((r) => r.outcome === "Convicted").length);
    assert.equal(detail.beforeCognizance, 0, "a conviction follows cognizance");
    const timeline = closureTimeline(docket, month)!;
    assert.equal(timeline.unit, "day");
    assert.equal(timeline.columns.length, 19);
    assert.equal(timeline.columns.reduce((s, c) => s + c.total, 0), rows.length);
    assert.equal(closureTimeline(docket, presetPeriod("last-3-months", docket))!.unit, "week");
    assert.equal(closureTimeline(docket, { from: docket.today, to: docket.today }), null);
  });

  it("breaks a trend's month down into what went into it", () => {
    const [pending, clearance] = monthlyTrends(docket, docket.today);
    const point = pending.points[0];
    const rows = trendBreakdown(docket, "pending", point);
    assert.deepEqual(rows.map((r) => r.label), ["Filed in the month", "Disposed in the month", "Moved to long pending"]);
    const c = trendBreakdown(docket, "clearance", clearance.points[0]);
    const disposed = Number(c[0].value.replace(/,/g, ""));
    const filed = Number(c[1].value.replace(/,/g, ""));
    assert.equal(Math.round((disposed / filed) * 100), Math.round(clearance.points[0].value!));
    const detail = trendDetail(pending);
    assert.equal(detail.best, detail.lowest, "fewer pending is better");
  });
});
