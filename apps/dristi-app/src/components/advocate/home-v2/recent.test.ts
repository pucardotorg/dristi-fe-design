import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { QueueRow } from "@/lib/filing/queue";
import { recentItems, recentWhen } from "./recent";

const row = (id: string, recencyAt = "2026-01-01"): QueueRow => ({
  id,
  ref: `REF-${id}`,
  parties: `${id} v. X`,
  court: "",
  info: { lead: "", tone: "default" },
  action: { label: "Open", href: `/cases/${id}` },
  urgencyAt: "",
  recencyAt,
  haystack: id,
});

const base = {
  scrutiny: [row("s1")],
  returned: [row("r1", "2026-11-10")],
  registered: [row("g1"), row("g2")],
  joined: { g2: "2026-11-18" } as Record<string, string>,
  bookmarked: { g1: true } as Record<string, boolean>,
  filedOn: { s1: "2026-11-15", g1: "2026-11-01", g2: "2026-06-01" } as Record<string, string>,
};

describe("recentItems", () => {
  it("newest first across filed, returned and joined", () => {
    assert.deepEqual(
      recentItems(base).map((x) => `${x.kind}:${x.id}`),
      ["joined:g2", "scrutiny:s1", "returned:r1", "registered:g1"],
    );
  });
  it("a joined case is only Joined, never also Filed", () => {
    const items = recentItems(base).filter((x) => x.id === "g2");
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, "joined");
    assert.equal(items[0].on, "2026-11-18");
  });
  it("filed items are dated by their filing, returned by their return", () => {
    const by = Object.fromEntries(recentItems(base).map((x) => [x.id, x.on]));
    assert.equal(by.s1, "2026-11-15");
    assert.equal(by.r1, "2026-11-10");
  });
  it("bookmarks come from the case records", () => {
    const by = Object.fromEntries(recentItems(base).map((x) => [x.id, x.bookmarked]));
    assert.equal(by.g1, true);
    assert.equal(by.s1, false);
  });
  it("an unnumbered filing has no number, not the task id", () => {
    const r = { ...row("t-ret1"), ref: "T-RET1" };
    const [it] = recentItems({ ...base, scrutiny: [], registered: [], returned: [r] });
    assert.equal(it.ref, "");
  });
  it("nothing filed or joined: nothing", () => {
    assert.deepEqual(recentItems({ ...base, scrutiny: [], returned: [], registered: [] }), []);
  });
});

describe("recentWhen", () => {
  it("today, yesterday, then the date; the year only when it differs", () => {
    assert.equal(recentWhen("2026-11-19", "2026-11-19"), "Today");
    assert.equal(recentWhen("2026-11-18", "2026-11-19"), "Yesterday");
    assert.match(recentWhen("2026-11-12", "2026-11-19"), /^12 Nov$/);
    assert.match(recentWhen("2025-08-04", "2026-11-19"), /2025/);
  });
});
