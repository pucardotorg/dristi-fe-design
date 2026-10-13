import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { at, junior, kase, makeTask, NOW, otherCase, outsider, PEOPLE, senior } from "./fixtures";
import {
  applyFilters,
  bandByDue,
  BANDED_VIEWS,
  courtsOf,
  DEFAULT_FILTERS,
  dueBucketOf,
  isNarrowed,
  categoryCounts,
  summaryOf,
  viewCounts,
  type World,
} from "./selectors";
import type { Task } from "./types";

const tasks: Task[] = [
  makeTask({ id: "overdue-pay", kind: "pay", dueAt: at(-3) }),
  makeTask({ id: "today-sign", kind: "sign", dueAt: at(0) }),
  makeTask({ id: "week-file", kind: "file", dueAt: at(5), hearingAt: at(6, 5), isBlocking: true }),
  makeTask({ id: "draft-file", kind: "file", status: "draft", dueAt: at(9), draft: { by: junior.id, savedAt: at(-1) } }),
  makeTask({ id: "ready-sign", kind: "sign", status: "ready", dueAt: at(2), prepared: { by: junior.id, at: at(-1) } }),
  makeTask({ id: "hearing", kind: "hearing", dueAt: at(3, 5), hearingAt: at(3, 5), isBlocking: true }),
  makeTask({ id: "returned", kind: "returned", dueAt: at(1), returned: { by: "scrutiny", at: at(-1), defects: [] } }),
  makeTask({ id: "waiting", kind: "file", status: "awaiting-court", dueAt: at(-1) }),
  makeTask({ id: "confirming", kind: "pay", status: "payment-confirming" }),
  makeTask({ id: "done", kind: "pay", status: "done", completion: { at: at(-2), how: "event" } }),
  makeTask({ id: "archived", kind: "sign", status: "archived", dueAt: at(4), archived: { at: at(-1), from: "open" } }),
  makeTask({ id: "other-case", kind: "sign", caseId: otherCase.id, dueAt: at(-5) }),
];

const world = (user = senior): World => ({ people: PEOPLE, cases: [kase, otherCase], tasks, user, now: NOW });

describe("visibility and views — per viewer", () => {
  it("a signatory's chair: open/ready completing work needs their action", () => {
    assert.deepEqual(viewCounts(world(senior)), {
      "needs-action": 7,
      waiting: 2,
      completed: 1,
      archived: 1,
    });
  });

  it("a junior's chair: the same items wait on the vakalatnama holders", () => {
    // Drafts and the hearing task stay theirs; open/ready sign/pay/file/returned wait.
    assert.deepEqual(viewCounts(world(junior)), {
      "needs-action": 2,
      waiting: 7,
      completed: 1,
      archived: 1,
    });
  });

  it("an actors-only task is hidden from viewers who cannot act on it", () => {
    const actorsOnly = makeTask({ id: "actors-sign", kind: "sign", visibility: "actors", dueAt: at(1) });
    const w = (user = senior): World => ({ ...world(user), tasks: [...tasks, actorsOnly] });
    // The signatory sees one more Needs-action item; the junior's counts do not move.
    assert.equal(viewCounts(w(senior))["needs-action"], 8);
    assert.deepEqual(viewCounts(w(junior)), viewCounts(world(junior)));
  });

  it("only tasks on the person's cases are counted", () => {
    assert.deepEqual(viewCounts(world(outsider)), {
      "needs-action": 1,
      waiting: 0,
      completed: 0,
      archived: 0,
    });
  });

  it("a search query narrows the counts on every tab", () => {
    const counts = viewCounts(world(senior), "process fee");
    // Every seeded fixture shares the same title; the archived and completed ones match too.
    assert.equal(counts["needs-action"] > 0, true);
    assert.deepEqual(viewCounts(world(senior), "zzz-no-match"), {
      "needs-action": 0,
      waiting: 0,
      completed: 0,
      archived: 0,
    });
  });

  it("the header summary counts overdue across open-state work", () => {
    assert.deepEqual(summaryOf(world(senior)), { action: 7, waiting: 2, overdue: 1 });
    // For the junior the overdue pay item sits in Waiting but is still overdue.
    assert.deepEqual(summaryOf(world(junior)), { action: 2, waiting: 7, overdue: 1 });
  });
});

describe("categoryCounts", () => {
  const counts = (f: Partial<typeof DEFAULT_FILTERS> = {}, user = senior) =>
    categoryCounts(world(user), { ...DEFAULT_FILTERS, ...f });

  it("counts each kind in the Needs-action view", () => {
    const c = counts();
    assert.equal(c.pay, 1);
    assert.equal(c.sign, 2);
    // The started filing stays under To file — a draft is a state, not an act.
    // A scrutiny return is File/Submit too, as the PRD files "Correct defects".
    assert.equal(c.file, 3);
    assert.equal(c.others, 1);
  });

  it("describes the other views too", () => {
    assert.equal(counts({ view: "waiting" }).file, 1);
    assert.equal(counts({ view: "waiting" }).pay, 1);
    assert.equal(counts({ view: "completed" }).pay, 1);
    assert.equal(counts({ view: "archived" }).sign, 1);
    // A junior's Waiting tab holds what waits on the signatories.
    assert.equal(counts({ view: "waiting" }, junior).sign, 2);
  });

  it("a pill's count is what pressing it yields — every filter but the kind applies", () => {
    // The overdue pay item is the only overdue row, so an Overdue list holds just it.
    const c = counts({ dues: ["overdue"] });
    assert.equal(c.pay, 1);
    assert.equal(c.sign, 0);
    assert.equal(c.file, 0);
    // And the pill ignores a kind already pressed, so pressing another is never a
    // count that shrinks to zero behind the press.
    assert.deepEqual(counts({ kinds: ["sign"] }), counts());
    // The count matches the rows the table will list.
    const rows = applyFilters(world(), { ...DEFAULT_FILTERS, dues: ["overdue"], kinds: ["pay"] });
    assert.equal(rows.length, c.pay);
  });

  it("a search narrows the pills with the list", () => {
    assert.deepEqual(counts({ query: "zzz-no-match" }), {
      pay: 0,
      sign: 0,
      file: 0,
      others: 0,
    });
  });
});

describe("due bands", () => {
  it("only the main list is banded", () => {
    // Waiting on others must not be: nothing there binds, so `dueBucketOf` would file a
    // filing that has been with the court since August under "Due today", above a cell
    // reading "Due 14 Aug". A band has to be true of every row beneath it.
    assert.deepEqual([...BANDED_VIEWS], ["needs-action"]);
  });

  it("names when a task bites", () => {
    const byId = (id: string) => tasks.find((t) => t.id === id)!;
    assert.equal(dueBucketOf(byId("overdue-pay"), NOW), "overdue");
    assert.equal(dueBucketOf(byId("today-sign"), NOW), "today");
    assert.equal(dueBucketOf(byId("week-file"), NOW), "week");
    assert.equal(dueBucketOf(byId("draft-file"), NOW), "later");
    assert.equal(dueBucketOf(byId("confirming"), NOW), "none");
  });

  it("a settled task past its date is not overdue — the cell and the band agree", () => {
    // Awaiting the court with yesterday's date: the Due cell refuses the word, so the
    // band must too, or the row would sit under a heading its own cell contradicts.
    const waiting = tasks.find((t) => t.id === "waiting")!;
    assert.equal(dueBucketOf(waiting, NOW), "today");
    assert.equal(applyFilters(world(), { ...DEFAULT_FILTERS, dues: ["overdue"] }).length, 1);
  });

  it("bands run in date order and drop the empty ones", () => {
    const rows = applyFilters(world(), DEFAULT_FILTERS);
    const bands = bandByDue(rows, NOW);
    assert.deepEqual(
      bands.map((b) => b.bucket),
      ["overdue", "today", "week", "later"]
    );
    // Every task is placed exactly once.
    assert.equal(
      bands.reduce((n, b) => n + b.tasks.length, 0),
      rows.length
    );
  });

  it("keeps the urgency order inside a band, and lets the band outrank it across bands", () => {
    const rows = applyFilters(world(), DEFAULT_FILTERS);
    const bands = bandByDue(rows, NOW);
    const rank = new Map(rows.map((t, i) => [t.id, i]));
    for (const band of bands) {
      const ranks = band.tasks.map((t) => rank.get(t.id)!);
      assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), `band ${band.bucket} kept its order`);
    }
    // Across bands the date wins: the blocking filing for a hearing six days out reads
    // under "This week", below the signature due today, though `compareUrgency` ranks
    // it first. The band answers when it bites.
    const week = bands.find((b) => b.bucket === "week")!;
    const today = bands.find((b) => b.bucket === "today")!;
    assert.equal(today.tasks.some((t) => t.id === "today-sign"), true);
    assert.equal(week.tasks.some((t) => t.id === "week-file"), true);
    assert.equal(rank.get("week-file")! < rank.get("today-sign")!, true);
    // And inside This week the blocking pair still leads, ahead of two items due sooner.
    assert.deepEqual(
      week.tasks.map((t) => t.id),
      ["hearing", "week-file", "returned", "ready-sign"]
    );
  });
});

describe("applyFilters", () => {
  const ids = (f: Partial<typeof DEFAULT_FILTERS>) => applyFilters(world(), { ...DEFAULT_FILTERS, ...f }).map((t) => t.id);

  it("default: the Needs-action view sorted by urgency", () => {
    assert.deepEqual(ids({}), [
      "overdue-pay",
      "hearing",
      "week-file",
      "today-sign",
      "returned",
      "ready-sign",
      "draft-file",
    ]);
  });

  it("a pill narrows to one category, and started work stays in its own queue", () => {
    assert.deepEqual(ids({ kinds: ["sign"] }), ["today-sign", "ready-sign"]);
    // The half-written filing and the scrutiny return sit under File/Submit beside the
    // untouched filing.
    assert.deepEqual(ids({ kinds: ["file"] }), ["week-file", "returned", "draft-file"]);
    // The junior sees only the filing they are on; visibility is unchanged by this.
    assert.deepEqual(
      applyFilters(world(junior), { ...DEFAULT_FILTERS, kinds: ["file"] }).map((t) => t.id),
      ["draft-file"]
    );
  });

  it("due filters", () => {
    assert.deepEqual(ids({ dues: ["overdue"] }), ["overdue-pay"]);
    assert.deepEqual(ids({ dues: ["today"] }), ["today-sign"]);
    assert.deepEqual(ids({ dues: ["week"] }), ["hearing", "week-file", "today-sign", "returned", "ready-sign"]);
    assert.deepEqual(ids({ dues: ["before-hearing"] }), ["hearing", "week-file"]);
  });

  it("choices inside one filter widen, and filters narrow each other", () => {
    // Overdue OR due today.
    assert.deepEqual(ids({ dues: ["overdue", "today"] }), ["overdue-pay", "today-sign"]);
    // Pay OR sign, AND overdue: only the overdue payment is both.
    assert.deepEqual(ids({ kinds: ["pay", "sign"], dues: ["overdue"] }), ["overdue-pay"]);
  });

  it("court, advocate and search", () => {
    assert.deepEqual(ids({ courts: ["JMFC Court 1"] }), []);
    assert.equal(ids({ courts: [kase.court] }).length, 7);
    assert.equal(ids({ advocates: [junior.id] }).length, 7);
    assert.deepEqual(ids({ advocates: [outsider.id] }), []);
    assert.deepEqual(ids({ query: "process" }).length, 7);
    assert.deepEqual(ids({ query: "ST 1/2025 zzz" }), []);
  });

  it("other views", () => {
    assert.deepEqual(ids({ view: "waiting" }), ["waiting", "confirming"]);
    assert.deepEqual(ids({ view: "completed" }), ["done"]);
    assert.deepEqual(ids({ view: "archived" }), ["archived"]);
    // The junior's tabs hold different populations for the same URL.
    assert.deepEqual(
      applyFilters(world(junior), DEFAULT_FILTERS).map((t) => t.id),
      ["hearing", "draft-file"]
    );
    assert.equal(applyFilters(world(junior), { ...DEFAULT_FILTERS, view: "waiting" }).length, 7);
  });

  it("isNarrowed", () => {
    assert.equal(isNarrowed(DEFAULT_FILTERS), false);
    assert.equal(isNarrowed({ ...DEFAULT_FILTERS, view: "waiting" }), false);
    assert.equal(isNarrowed({ ...DEFAULT_FILTERS, kinds: ["pay"] }), true);
    assert.equal(isNarrowed({ ...DEFAULT_FILTERS, query: " x" }), true);
  });

  it("courtsOf lists the courts of the person's cases", () => {
    assert.deepEqual(courtsOf(world(senior)), [kase.court]);
    assert.deepEqual(courtsOf(world(outsider)), [otherCase.court]);
  });
});
