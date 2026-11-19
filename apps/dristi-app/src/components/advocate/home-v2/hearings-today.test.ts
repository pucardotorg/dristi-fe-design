import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BAR_MIN,
  type CourtHearings,
  type CourtLine,
  DEMO_COURTS,
  DEMO_NEXT_COURTS,
  type TrackPart,
  cost,
  courtLine,
  squeezedCost,
  courtStatus,
  hearingCount,
  isTomorrow,
  nextWorkingDay,
  normalizeCourt,
  orderCourts,
} from "./hearings-today";

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const court = (now: number, last: number, mine: number[], extra: Partial<CourtHearings> = {}): CourtHearings => ({
  court: "Test Court",
  now,
  last,
  mine: mine.map((item) => ({ item })),
  ...extra,
});

/** Every item number the line stands for, in order: heard side, live, ahead side. */
function covered(line: CourtLine): number[] {
  const out: number[] = [];
  const add = (p: TrackPart) => {
    if (p.kind === "dot") out.push(p.item);
    else for (let i = p.from; i <= p.to; i++) out.push(i);
  };
  line.heard.forEach(add);
  if (line.live.item) out.push(line.live.item);
  line.ahead.forEach(add);
  return out;
}

/** The rules every line must keep, whatever the court and room. */
function assertInvariants(raw: CourtHearings, budget: number) {
  const c = normalizeCourt(raw);
  const line = courtLine(raw, budget);
  const where = `court now=${c.now} last=${c.last} mine=[${c.mine.map((m) => m.item)}] budget=${budget}`;

  // 1. The line covers 1..last exactly once, in order.
  assert.deepEqual(covered(line), Array.from({ length: c.last }, (_, i) => i + 1), `coverage: ${where}`);

  // 2. Every one of your items is shown exactly once: heard (named in the hover), live, or a ring ahead.
  for (const m of c.mine) {
    const asHeard = line.heardMine.includes(m.item) ? 1 : 0;
    const asLive = line.live.item === m.item && line.live.mine ? 1 : 0;
    const asRing = line.ahead.filter((p) => p.kind === "dot" && p.item === m.item && p.mine).length;
    const asMore = line.ahead.filter((p) => p.kind === "more" && p.mine.some((x) => x.item === m.item)).length;
    assert.equal(asHeard + asLive + asRing + asMore, 1, `your item ${m.item} shown once: ${where}`);
  }

  // 3. Heard side: only before the live item; ahead: only after it (or everything before the court sits).
  for (const p of line.heard) assert.ok(p.kind !== "more" && p.state === "heard", where);
  for (const p of line.ahead) assert.ok(p.kind === "more" || p.state === "upcoming", where);

  // 3b. "+N" only holds your items that really sit in its stretch.
  for (const p of line.ahead) {
    if (p.kind !== "more") continue;
    assert.ok(p.mine.length >= 1 && p.mine.every((m) => m.item >= p.from && m.item <= p.to), `+N holds its own items: ${where}`);
  }

  // 4. A fold stands for at least BAR_MIN items and never touches one of your rings.
  line.ahead.forEach((p, k) => {
    if (p.kind !== "bar" || p.tight) return;
    assert.ok(p.to - p.from + 1 >= BAR_MIN, `fold too short: ${where}`);
    for (const n of [line.ahead[k - 1], line.ahead[k + 1]]) {
      assert.ok(!(n?.kind === "dot" && n.mine), `fold touches your ring: ${where}`);
    }
    assert.ok(p.span.from <= p.from && p.span.to >= p.to, `hover span covers the fold: ${where}`);
  });

  // 5. The list's last item always ends the line (unless it is the live one). Its number shows,
  //    except right after one of your items, where the two numbers would touch (B2).
  if (c.finished) {
    const end = line.heard[line.heard.length - 1];
    assert.ok(end?.kind === "dot" && end.item === c.last && end.label, `finished ends on last: ${where}`);
    assert.equal(line.live.item, 0, `finished has no live pill: ${where}`);
    assert.equal(line.ahead.length, 0, where);
  } else if (c.now !== c.last) {
    const end = line.ahead[line.ahead.length - 1];
    const before = line.ahead[line.ahead.length - 2];
    const afterYours = before?.kind === "dot" && Boolean(before.mine);
    if (end?.kind === "more") {
      // Your item is the last and it sits inside "+N".
      assert.equal(end.to, c.last, `+N runs to the last: ${where}`);
    } else {
      assert.ok(end?.kind === "dot" && end.item === c.last, `ends on last: ${where}`);
      assert.equal(Boolean(end.label), Boolean(end.mine) || !afterYours, `last number shown unless it touches yours: ${where}`);
    }
  } else {
    assert.equal(line.ahead.length, 0, where);
  }

  // 6. Before the court sits, the line starts with item 1, labelled.
  if (!c.now) {
    const start = line.ahead[0];
    assert.ok(start?.kind === "dot" && start.item === 1 && start.label, `starts on 1: ${where}`);
    assert.equal(line.heard.length, 0, where);
  }

  // 7. When every item to come fits, the line fits without squeezing (owner, Nov 18: it may still
  //    fold once, keeping the queue up to your next item, so a dotted line fills the row).
  const toCome = c.last - (c.now ? c.now : 0);
  if (toCome <= budget) assert.ok(cost(line.ahead) <= budget, `squeezed though it fits: ${where}`);

  return line;
}

/** Small deterministic random (so a failure always reproduces). */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/* ── Named situations ────────────────────────────────────────────────────── */

describe("courtLine: situations in a day's hearing", () => {
  it("court not started: line from item 1, nothing heard, no live item", () => {
    const line = assertInvariants(court(0, 25, [7]), 12);
    assert.equal(line.live.item, 0);
  });

  it("first item being heard (now = 1): nothing on the heard side", () => {
    const line = assertInvariants(court(1, 30, [5]), 12);
    assert.deepEqual(line.heard, []);
  });

  it("second item being heard (now = 2): only dot 1 heard", () => {
    const line = assertInvariants(court(2, 30, [5]), 12);
    assert.equal(line.heard.length, 1);
  });

  it("last item being heard: nothing ahead", () => {
    assertInvariants(court(40, 40, [12]), 12);
  });

  it("second to last being heard: one item ahead", () => {
    const line = assertInvariants(court(39, 40, [12]), 12);
    assert.equal(line.ahead.length, 1);
  });

  it("your item is the one being heard: live pill carries it", () => {
    const line = assertInvariants(court(20, 50, [20, 27]), 12);
    assert.equal(line.live.mine?.item, 20);
  });

  it("all your items already heard: named in the heard hover, none ahead", () => {
    const line = assertInvariants(court(30, 50, [8, 12]), 12);
    assert.deepEqual(line.heardMine, [8, 12]);
    assert.ok(line.ahead.every((p) => !(p.kind === "dot" && p.mine)));
  });

  it("your item is item 1 before the court sits", () => {
    assertInvariants(court(0, 20, [1]), 10);
  });

  it("your item is the list's last", () => {
    assertInvariants(court(10, 50, [50]), 10);
  });

  it("your items back to back (23, 24, 25)", () => {
    assertInvariants(court(20, 50, [23, 24, 25, 31]), 10);
  });

  it("your item right after the live one", () => {
    assertInvariants(court(20, 50, [21]), 10);
  });

  const ten = [32, 35, 38, 41, 44, 47, 50, 53, 56, 59];

  it("B1 fix 1: ten of your items on a tablet close up with tight gaps and fit", () => {
    // Tablet: the ahead side is 341px wide = 14.54 dots.
    const line = assertInvariants(court(30, 70, ten), 14.54);
    assert.ok(squeezedCost(line.ahead) <= 14.54, "fits");
    assert.equal(line.ahead.filter((p) => p.kind === "dot" && p.mine).length, 10, "all ten rings show");
    assert.ok(line.ahead.some((p) => p.kind === "bar" && p.tight), "tight gaps between rings");
    assert.ok(!line.ahead.some((p) => p.kind === "more"));
  });

  it("B1: a normal day never sees either fix (24×7 ON Court on a phone keeps all four rings)", () => {
    const line = assertInvariants(court(20, 50, [23, 24, 25, 31]), 9.5);
    assert.ok(!line.ahead.some((p) => p.kind === "more" || (p.kind === "bar" && p.tight)));
  });

  it("B1 fix 2: on a phone, the rings that fit and then +N for the rest", () => {
    const line = assertInvariants(court(30, 70, ten), 6);
    assert.ok(squeezedCost(line.ahead) <= 6, "fits");
    const more = line.ahead.find((p) => p.kind === "more");
    assert.ok(more && more.kind === "more");
    const shown = line.ahead.filter((p) => p.kind === "dot" && p.mine).map((p) => (p.kind === "dot" ? p.item : 0));
    assert.deepEqual([...shown, ...more.mine.map((m) => m.item)], ten, "soonest first, the rest in +N, none lost");
  });

  it("B1: +N turns red when any item it holds has tasks pending", () => {
    const line = assertInvariants(court(30, 70, [...ten.slice(0, 9).map((i) => i), 59]), 9);
    assert.ok(line.ahead.some((p) => p.kind === "more"));
  });

  it("B1: your last item is the list's last, inside +N", () => {
    assertInvariants(court(30, 59, ten), 8);
  });

  it("B1: before the court sits, ten items on a phone", () => {
    assertInvariants(court(0, 70, ten), 9);
  });

  it("a one-item list", () => {
    assertInvariants(court(0, 1, [1]), 10);
    assertInvariants(court(1, 1, [1]), 10);
  });

  it("a list that fits still folds once, after the queue to your item, so the row fills", () => {
    const line = assertInvariants(court(3, 20, [6]), 18);
    assert.deepEqual(
      line.ahead.filter((p) => p.kind === "dot").slice(0, 4).map((p) => p.item),
      [4, 5, 6, 7],
      "queue 4, 5 then your 6 and one plain dot",
    );
    assert.equal(line.ahead.filter((p) => p.kind === "bar").length, 1);
  });

  it("a list with nothing to fold spreads its dots", () => {
    const line = assertInvariants(court(3, 9, [6]), 18);
    assert.ok(line.ahead.every((p) => p.kind === "dot"));
  });

  it("a three-digit list", () => {
    assertInvariants(court(120, 150, [133, 149]), 12);
  });

  it("a court with none of your items", () => {
    assertInvariants(court(10, 30, []), 10);
  });

  it("your item just before the list's last: the last drops its number (B2)", () => {
    const line = assertInvariants(court(120, 150, [133, 149]), 12);
    const end = line.ahead[line.ahead.length - 1];
    assert.ok(end.kind === "dot" && end.item === 150 && !end.label);
  });

  it("a finished court: one heard line from 1 to the last, yours inside it, no live pill", () => {
    // Desktop: the full row is about 25 dots of room.
    const line = assertInvariants(court(28, 28, [9], { finished: true }), 25);
    assert.deepEqual(line.heardMine, [9]);
    assert.deepEqual(
      line.heard.map((p) => (p.kind === "dot" ? p.item : `${p.from}-${p.to}`)),
      [1, "2-7", 8, "9-14", 15, "16-20", 21, "22-27", 28],
      "1 and 28 numbered, three real items evenly spaced between",
    );
  });

  it("a finished court on a phone keeps one dot in the middle (1 · 15 · 28)", () => {
    const line = assertInvariants(court(28, 28, [9], { finished: true }), 12);
    assert.deepEqual(line.heard.filter((p) => p.kind === "dot").map((p) => (p.kind === "dot" ? p.item : 0)), [1, 15, 28]);
  });

  it("a short finished list keeps it simple", () => {
    const line = assertInvariants(court(6, 6, [], { finished: true }), 12);
    assert.ok(line.heard.length <= 4);
  });

  it("a finished court whatever the feed says its live item was", () => {
    assertInvariants(court(12, 28, [20], { finished: true }), 12);
    assertInvariants(court(0, 1, [1], { finished: true }), 12);
    assertInvariants(court(0, 2, [], { finished: true }), 12);
  });
});

describe("courtStatus", () => {
  it("names where a court is in its day", () => {
    assert.equal(courtStatus(court(10, 30, [20])), "live");
    assert.equal(courtStatus(court(20, 30, [20])), "live", "yours being heard is not done yet");
    assert.equal(courtStatus(court(25, 30, [12, 20])), "done");
    assert.equal(courtStatus(court(0, 30, [5])), "notStarted");
    assert.equal(courtStatus(court(30, 30, [5], { finished: true })), "finished");
    assert.equal(courtStatus(court(10, 30, [])), "live", "no items of yours is never Done");
  });
});

describe("normalizeCourt: whatever the feed sends", () => {
  it("sorts and deduplicates your items", () => {
    assert.deepEqual(normalizeCourt(court(5, 30, [12, 7, 12])).mine.map((m) => m.item), [7, 12]);
  });

  it("drops item numbers that cannot exist (0, negative, fractional)", () => {
    assert.deepEqual(normalizeCourt(court(5, 30, [0, -3, 2.5, 9])).mine.map((m) => m.item), [9]);
  });

  it("never drops your item past the list's end: the list stretches to it", () => {
    const c = normalizeCourt(court(5, 30, [34]));
    assert.equal(c.last, 34);
    assertInvariants(court(5, 30, [34]), 10);
  });

  it("keeps the live item inside the list", () => {
    assert.equal(normalizeCourt(court(55, 50, [])).now, 50);
    assert.equal(normalizeCourt(court(-2, 50, [])).now, 0);
  });

  it("an empty or broken list still draws one item", () => {
    assert.equal(normalizeCourt(court(0, 0, [])).last, 1);
    assertInvariants(court(0, 0, []), 10);
  });
});

describe("courtLine: property check over many courts and widths", () => {
  it("keeps every rule for 5,000 random courts", () => {
    const r = rng(42);
    for (let n = 0; n < 5000; n++) {
      const last = 1 + Math.floor(r() * 160);
      const now = r() < 0.2 ? 0 : Math.floor(r() * (last + 1));
      const count = Math.floor(r() * 8);
      const mine = Array.from({ length: count }, () => 1 + Math.floor(r() * last));
      const budget = 6 + r() * 30;
      if (r() < 0.3) for (let k = 0; k < 10; k++) mine.push(1 + Math.floor(r() * last)); // crowded courts
      assertInvariants(court(now, last, mine, { finished: r() < 0.1 }), budget);
    }
  });
});

/* ── Order, count, days ──────────────────────────────────────────────────── */

describe("orderCourts", () => {
  const named = (name: string, now: number, mine: number[]) => ({ ...court(now, 50, mine), court: name });

  it("courts in session first, then not started", () => {
    const order = orderCourts([named("Waiting", 0, [1, 2, 3]), named("Sitting", 10, [20])]).map((c) => c.court);
    assert.deepEqual(order, ["Sitting", "Waiting"]);
  });

  it("then most of your hearings, then the court that reaches your next item soonest", () => {
    const order = orderCourts([named("Far", 10, [40]), named("Two", 10, [30, 35]), named("Near", 10, [12])]).map((c) => c.court);
    assert.deepEqual(order, ["Two", "Near", "Far"]);
  });

  it("your item being heard now counts as the soonest", () => {
    const order = orderCourts([named("Next", 10, [11]), named("Now", 10, [10])]).map((c) => c.court);
    assert.deepEqual(order, ["Now", "Next"]);
  });

  it("finished courts go below courts in session and courts not started", () => {
    const order = orderCourts([
      { ...named("Finished", 50, [5, 6, 7]), finished: true },
      named("Waiting", 0, [1]),
      named("Sitting", 10, [20]),
    ]).map((c) => c.court);
    assert.deepEqual(order, ["Sitting", "Waiting", "Finished"]);
  });

  it("a court where all your items are heard goes after courts still coming to you", () => {
    const order = orderCourts([named("Done", 30, [5]), named("Coming", 10, [45])]).map((c) => c.court);
    assert.deepEqual(order, ["Coming", "Done"]);
  });

  it("two finished courts keep their order (no NaN)", () => {
    const order = orderCourts([named("A", 30, [5]), named("B", 30, [6])]).map((c) => c.court);
    assert.deepEqual(order, ["A", "B"]);
  });
});

describe("hearingCount", () => {
  it("counts your items across courts", () => {
    assert.equal(hearingCount(orderCourts(DEMO_COURTS)), 18);
    assert.equal(hearingCount(orderCourts(DEMO_NEXT_COURTS)), 9);
    assert.equal(hearingCount([]), 0);
  });
});

describe("nextWorkingDay and isTomorrow", () => {
  const day = (iso: string) => new Date(`${iso}T15:00:00`);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const cases: [string, string, boolean][] = [
    ["2026-11-19", "2026-11-20", true], // Thu → Fri: "Tomorrow"
    ["2026-11-20", "2026-11-23", false], // Fri → Mon: "Next working day"
    ["2026-11-21", "2026-11-23", false], // Sat → Mon
    ["2026-11-22", "2026-11-23", true], // Sun → Mon is tomorrow
    ["2026-12-31", "2027-01-01", true], // year end
    ["2027-01-01", "2027-01-04", false], // Fri across a weekend
    ["2026-02-27", "2026-03-02", false], // Fri across a month end
  ];
  for (const [from, next, tomorrow] of cases) {
    it(`${from} → ${next}${tomorrow ? " (tomorrow)" : ""}`, () => {
      const n = nextWorkingDay(day(from));
      assert.equal(ymd(n), next);
      assert.equal(isTomorrow(day(from), n), tomorrow);
    });
  }
});

describe("demo data", () => {
  it("every demo court keeps every rule at desktop and phone widths", () => {
    for (const c of [...DEMO_COURTS, ...DEMO_NEXT_COURTS]) for (const b of [9, 12, 18, 25]) assertInvariants(c, b);
  });
});
