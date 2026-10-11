import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COURT_LIMITS,
  courtDocket,
  courtMeasures,
  courtStatements,
  daysInStage,
  gapHistogram,
  HEARING_STAGES,
  monthKey,
  STAGES,
  stageHearingHistogram,
  type HearingStageFilter,
} from "./court-docket";
import { registerCsv, registerIndexCount, registerView } from "./register-rows";
import { REGISTERS } from "./registers";

const DAY = "2026-10-11";

describe("the generated court", () => {
  it("is the same court for the same day", () => {
    const a = courtDocket(DAY);
    const b = courtDocket("2026-10-12");
    const again = courtDocket(DAY);
    assert.notEqual(a, again, "the cache holds one day at a time");
    assert.deepEqual(
      again.cases.map((c) => [c.filingNumber, c.caseNumber, c.stage, c.nextHearing]),
      a.cases.map((c) => [c.filingNumber, c.caseNumber, c.stage, c.nextHearing]),
    );
    assert.ok(b.cases.length > 0);
  });

  it("returns one object per day, so every screen reads the same cases", () => {
    assert.equal(courtDocket(DAY), courtDocket(DAY));
  });

  it("holds about 2,500 cases over the 24 months ending this month", () => {
    const docket = courtDocket(DAY);
    assert.ok(docket.cases.length > 2000 && docket.cases.length < 3200, `${docket.cases.length}`);
    assert.equal(monthKey(docket.today) - monthKey(docket.start), 23);
    assert.ok(docket.cases.every((c) => c.filed >= docket.start && c.filed <= docket.today));
  });

  it("numbers in Kerala's formats, without repeating a number", () => {
    const { cases, copies } = courtDocket(DAY);
    const seen = new Set<string>();
    for (const c of cases) {
      assert.match(c.filingNumber, /^KL-\d{6}-\d{4}$/);
      if (c.cmpNumber) assert.match(c.cmpNumber, /^CMP\/\d+\/\d{4}$/);
      if (c.stNumber) assert.match(c.stNumber, /^ST\/\d+\/\d{4}$/);
      if (c.lpNumber) assert.match(c.lpNumber, /^LP\/\d+\/\d{4}$/);
      for (const n of [c.filingNumber, c.cmpNumber, c.stNumber, c.lpNumber]) {
        if (!n) continue;
        assert.ok(!seen.has(n), `${n} allotted twice`);
        seen.add(n);
      }
    }
    for (const copy of copies) assert.match(copy.number, /^CA\/\d+\/\d{4}$/);
  });
});

describe("the statements", () => {
  const statements = courtStatements(courtDocket(DAY));

  it("reconcile: opening + filed − disposed and moved to LP = closing, every period", () => {
    for (const period of ["monthly", "quarterly", "annual"] as const) {
      for (const row of statements[period]) {
        assert.equal(
          row.opening + row.filed - row.totalDisposed,
          row.closing,
          `${period} ${row.label}`,
        );
        assert.equal(row.totalDisposed, row.uncontested + row.contested + row.longPending);
      }
    }
  });

  it("carry each period's closing into the next one's opening", () => {
    for (const period of ["monthly", "quarterly", "annual"] as const) {
      const rows = statements[period];
      for (let i = 1; i < rows.length; i++) {
        assert.equal(rows[i].opening, rows[i - 1].closing, `${period} ${rows[i].label}`);
      }
    }
  });

  it("covers 24 months, quarters from the first, and financial years", () => {
    assert.equal(statements.monthly.length, 24);
    assert.match(statements.monthly.at(-1)!.label, /\(to date\)$/);
    assert.equal(statements.quarterly[0].label, "Q4 2024");
    assert.deepEqual(
      statements.annual.map((row) => row.label),
      ["FY 2024–25", "FY 2025–26", "FY 2026–27 (to date)"],
    );
  });

  it("ends on today's pendency", () => {
    const docket = courtDocket(DAY);
    assert.equal(statements.monthly.at(-1)!.closing, courtMeasures(docket).pending.length);
  });
});

describe("every dashboard number is the length of what it opens", () => {
  const docket = courtDocket(DAY);
  const m = courtMeasures(docket);
  const total = (id: string, options = {}) => registerView(docket, id, options)!.total;

  it("status tiles equal their register views", () => {
    assert.equal(m.stPending.length, total("pending", { view: "st" }));
    assert.equal(m.cmpPending.length, total("pending", { view: "cmp" }));
    assert.equal(m.stDisposed.length, total("disposed", { view: "st" }));
    assert.equal(m.cmpDisposed.length, total("disposed", { view: "cmp" }));
    assert.equal(m.longPending.length, total("calendar", { longPendingOnly: true }));
    assert.equal(registerView(docket, "calendar", { longPendingOnly: true })!.rows.length, m.longPending.length);
  });

  it("pending by year sums to the pending total", () => {
    for (const view of ["st", "cmp"]) {
      const result = registerView(docket, "pending", { view })!;
      assert.equal(
        result.years!.reduce((sum, y) => sum + y.count, 0),
        result.total,
      );
      for (const y of result.years!) {
        assert.equal(registerView(docket, "pending", { view, year: y.year })!.rows.length, y.count);
      }
    }
  });

  it("overdue counts are past their limit, longest first", () => {
    for (const stage of STAGES) {
      const list = m.overdue[stage.key];
      for (const c of list) assert.ok(daysInStage(c, docket.today) > COURT_LIMITS.stages[stage.key]);
      for (let i = 1; i < list.length; i++) {
        assert.ok(daysInStage(list[i - 1], docket.today) >= daysInStage(list[i], docket.today));
      }
      assert.ok(list.length <= m.byStage[stage.key].length);
    }
    assert.ok(STAGES.some((stage) => m.overdue[stage.key].length > 0));
  });

  it("undated cases are pending, past registration, with no next date", () => {
    assert.ok(m.undated.length > 0);
    for (const c of m.undated) {
      assert.equal(c.nextHearing, null);
      assert.notEqual(c.stage, "registration");
      assert.equal(c.disposal, null);
    }
  });

  it("hearing histograms count every gap and every pending case", () => {
    for (const stage of ["all", ...HEARING_STAGES.map((s) => s.key)] as HearingStageFilter[]) {
      const cases = stageHearingHistogram(docket, stage).reduce((sum, b) => sum + b.value, 0);
      const pool =
        stage === "all"
          ? m.pending.filter((c) => c.stage !== "registration").length
          : m.byStage[stage].length;
      assert.equal(cases, pool, stage);
      const gaps = gapHistogram(docket, stage).reduce((sum, b) => sum + b.value, 0);
      const expected =
        stage === "all"
          ? HEARING_STAGES.reduce((sum, s) => sum + docket.gaps[s.key].length, 0)
          : docket.gaps[stage].length;
      assert.equal(gaps, expected, stage);
    }
  });

  it("judgements cover the last 12 complete months", () => {
    assert.equal(m.judgements.length, 12);
    assert.equal(m.judgements.at(-1)!.month, monthKey(docket.today) - 1);
  });
});

describe("the registers", () => {
  const docket = courtDocket(DAY);

  it("lists all 18, the last 8 with no rows and their source to confirm", () => {
    assert.equal(REGISTERS.length, 18);
    assert.deepEqual(REGISTERS.map((r) => r.no), Array.from({ length: 18 }, (_, i) => i + 1));
    for (const register of REGISTERS) {
      const result = registerView(docket, register.id)!;
      if (register.no > 10) {
        assert.ok(register.sourceToConfirm?.length, register.id);
        assert.equal(result.rows.length, 0, register.id);
        assert.equal(registerIndexCount(docket, register), null);
        assert.ok(result.columns.length > 0);
      } else {
        assert.equal(register.sourceToConfirm, undefined);
        assert.ok(result.rows.length > 0, register.id);
      }
    }
  });

  it("knows nothing about an id that is not a register", () => {
    assert.equal(registerView(docket, "nope"), undefined);
  });

  it("narrows by search and period, and can come up empty", () => {
    const all = registerView(docket, "calendar")!;
    const first = all.rows[0] as { filingNumber: string };
    const found = registerView(docket, "calendar", { query: first.filingNumber })!;
    assert.equal(found.rows.length, 1);
    assert.equal(found.total, all.total);
    assert.equal(registerView(docket, "calendar", { query: "zzzz no such case" })!.rows.length, 0);
    const month = registerView(docket, "calendar", { period: "month" })!;
    assert.ok(month.rows.length > 0 && month.rows.length < all.rows.length);
    const fy = registerView(docket, "calendar", { period: "fy" })!;
    assert.ok(fy.rows.length >= month.rows.length);
  });

  it("finds a Kerala number typed the way another state shows it", () => {
    const all = registerView(docket, "disposed", { view: "st" })!;
    const st = (all.rows[0] as { stNumber: string }).stNumber; // ST/12/2026
    const asGujarat = st.replace(/^ST/, "eCC");
    assert.ok(registerView(docket, "disposed", { view: "st", query: asGujarat })!.rows.length >= 1);
  });

  it("downloads the rows in view as CSV, header first", () => {
    const result = registerView(docket, "statements", { view: "annual" })!;
    const lines = registerCsv(result).trim().split("\r\n");
    assert.equal(lines.length, result.rows.length + 1);
    assert.match(lines[0], /^Sl\. no\.,Period,Opening pendency/);
  });
});
