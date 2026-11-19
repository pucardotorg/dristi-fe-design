import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { type CaseUpdate, SLIDE_CAP, demoUpdates, listFrom, orderUpdates, slidesOf, updateHref, whenLabel } from "./updates";

const u = (id: string, hoursAgo: number, bookmarked = false): CaseUpdate => ({
  id,
  caseId: "c-1001",
  caseNumber: "CMP/1842/2026",
  category: "Orders",
  caseTitle: "A v. B",
  what: id,
  at: new Date(Date.UTC(2026, 10, 19, 12) - hoursAgo * 3_600_000).toISOString(),
  bookmarked,
});

describe("orderUpdates", () => {
  it("bookmarked first, then newest", () => {
    const order = orderUpdates([u("old", 9), u("new", 1), u("marked-old", 20, true), u("marked-new", 5, true)]).map((x) => x.id);
    assert.deepEqual(order, ["marked-new", "marked-old", "new", "old"]);
  });
  it("same time: stable by id", () => {
    assert.deepEqual(orderUpdates([u("b", 1), u("a", 1)]).map((x) => x.id), ["a", "b"]);
  });
});

describe("slidesOf", () => {
  it("caps the carousel at 10, the most important first", () => {
    const many = Array.from({ length: 40 }, (_, i) => u(`u${String(i).padStart(2, "0")}`, i, i % 7 === 0));
    const s = slidesOf(many);
    assert.equal(s.length, SLIDE_CAP);
    assert.ok(s.slice(0, 6).every((x) => x.bookmarked), "all 6 bookmarked ones lead");
  });
  it("fewer than 10: all of them", () => {
    assert.equal(slidesOf([u("a", 1), u("b", 2)]).length, 2);
  });
  it("none: none", () => {
    assert.deepEqual(slidesOf([]), []);
  });
});

describe("listFrom", () => {
  const all = [u("a", 1), u("b", 2, true), u("c", 3)];
  it("the tapped update leads, the rest keep their order", () => {
    assert.deepEqual(listFrom(all, "c").map((x) => x.id), ["c", "b", "a"]);
  });
  it("opened from the count: plain order", () => {
    assert.deepEqual(listFrom(all).map((x) => x.id), ["b", "a", "c"]);
  });
  it("every update appears once", () => {
    assert.equal(new Set(listFrom(all, "a").map((x) => x.id)).size, 3);
  });
});

describe("links and labels", () => {
  it("an update opens its case's history", () => {
    assert.equal(updateHref(u("a", 1)), "/cases/c-1001?section=case-history");
  });
  it("when: today, yesterday, then the date", () => {
    const now = new Date(2026, 10, 19, 15, 0);
    assert.match(whenLabel(new Date(2026, 10, 19, 9, 20).toISOString(), now), /^Today, 9:20 am$/);
    assert.match(whenLabel(new Date(2026, 10, 18, 16, 5).toISOString(), now), /^Yesterday, 4:05 pm$/);
    assert.match(whenLabel(new Date(2026, 10, 17, 10, 0).toISOString(), now), /17 Nov/);
  });
});

describe("demo", () => {
  it("14 updates on real demo cases, titles and bookmarks from their records", () => {
    const d = demoUpdates(new Date(2026, 10, 19, 12));
    assert.equal(d.length, 14);
    assert.ok(d.every((x) => x.caseTitle.includes(" v. ")));
    assert.ok(d.every((x) => x.caseNumber && !x.caseNumber.startsWith("c-")), "case numbers from the records");
    assert.ok(d.some((x) => x.bookmarked));
  });
});
