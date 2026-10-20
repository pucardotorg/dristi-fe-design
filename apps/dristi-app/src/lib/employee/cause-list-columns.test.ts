import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  defaultColumns,
  moveColumn,
  normaliseColumns,
  shiftColumn,
  shownColumns,
  toggleColumn,
} from "./cause-list-columns";

const ids = (columns: ReturnType<typeof defaultColumns>) =>
  shownColumns(columns).map((column) => column.id);

describe("cause list columns", () => {
  it("opens the reader on Action then Next hearing, with no Status or Orders", () => {
    assert.deepEqual(ids(defaultColumns("bench-clerk", true)), [
      "item",
      "caseName",
      "caseNumber",
      "advocates",
      "purpose",
      "action",
      "nextHearing",
    ]);
  });

  it("keeps the magistrate's and the steno's boards as they were", () => {
    assert.deepEqual(ids(defaultColumns("magistrate", true)), [
      "item",
      "caseName",
      "caseNumber",
      "advocates",
      "purpose",
      "status",
      "orders",
      "action",
    ]);
    assert.deepEqual(ids(defaultColumns("typist", true)), [
      "item",
      "caseName",
      "caseNumber",
      "advocates",
      "purpose",
      "status",
      "orders",
    ]);
  });

  it("offers Next hearing to each state's next hearing setters, only when entered here", () => {
    assert.ok(defaultColumns("bench-clerk", true).order.includes("nextHearing"));
    assert.ok(!defaultColumns("bench-clerk", false).order.includes("nextHearing"));
    /* court-roles §3.1: the Kerala magistrate and typist set the next hearing too —
       offered, but not shown until they add it. */
    assert.ok(defaultColumns("magistrate", true).order.includes("nextHearing"));
    assert.ok(!defaultColumns("magistrate", true).visible.includes("nextHearing"));
    assert.ok(defaultColumns("typist", true, "kerala").order.includes("nextHearing"));
    assert.ok(!defaultColumns("typist", true, "gujarat").order.includes("nextHearing"));
    assert.ok(!defaultColumns("typist", true).order.includes("action"));
  });

  it("gives the reader the board as it was when the steno enters the next hearing", () => {
    assert.deepEqual(
      ids(defaultColumns("bench-clerk", false)),
      ids(defaultColumns("magistrate", true)),
    );
  });

  it("shows, hides and moves, keeping locked columns on", () => {
    const start = defaultColumns("bench-clerk", true);
    assert.equal(toggleColumn(start, "item"), start);
    const withStatus = toggleColumn(start, "status");
    assert.equal(ids(withStatus).at(-1), "status");
    const moved = moveColumn(withStatus, "status", "action", "before");
    assert.deepEqual(ids(moved).slice(4, 7), ["purpose", "status", "action"]);
    assert.deepEqual(ids(shiftColumn(moved, "status", -1)).slice(4, 6), [
      "status",
      "purpose",
    ]);
  });

  it("reads a stored choice back safely", () => {
    const read = normaliseColumns(
      { order: ["purpose", "bogus", "item", "action"], visible: ["purpose"] },
      "typist",
      true,
    );
    assert.equal(read.order[0], "purpose");
    assert.ok(!read.order.includes("action"));
    assert.deepEqual(read.visible, ["purpose", "item", "caseName"]);
    assert.deepEqual(
      normaliseColumns(null, "typist", true),
      defaultColumns("typist", true),
    );
  });
});
