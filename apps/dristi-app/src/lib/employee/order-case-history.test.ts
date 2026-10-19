import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ORDER_EXCERPT_LIMIT,
  orderCaseHistory,
  orderExcerpt,
} from "./order-case-history";

test("orders and events merge oldest first, and the newest order is the last order", () => {
  const entries = orderCaseHistory(
    [
      { id: "case-filed", label: "Case Filed", on: "2026-03-12", status: "past" },
      { id: "cognizance-taken", label: "Cognizance Taken", on: "2026-03-28", status: "past" },
      { id: "accused-joined", label: "Accused Joined Case", on: "2026-05-25", status: "past" },
    ],
    [
      { on: "2026-08-19", purpose: "Evidence", order: "Posted.", directed: true },
      { on: "2026-08-05", purpose: "Evidence", order: "No order.", directed: false },
      { on: "2026-05-25", purpose: "Appearance", order: "Bail.", directed: true },
    ],
  );
  assert.deepEqual(
    entries.map((entry) => entry.id),
    [
      "case-filed",
      "cognizance-taken",
      "accused-joined",
      "order-2026-05-25",
      "order-2026-08-19",
    ],
  );
  assert.equal(entries.filter((entry) => entry.last).length, 1);
  assert.equal(entries.at(-1)?.last, true);
  assert.equal(entries[0].type, "case");
  assert.equal(entries.find((e) => e.id === "cognizance-taken")?.kind, "order");
  assert.equal(
    entries.find((e) => e.id === "cognizance-taken")?.caseFileDoc,
    "order-cognizance",
  );
});

test("the demo listing's example events follow its last order", () => {
  const entries = orderCaseHistory(
    [],
    [{ on: "2026-08-19", purpose: "Evidence", order: "Posted.", directed: true }],
    "h-241",
  );
  const last = entries.findIndex((entry) => entry.last);
  assert.equal(last, 0);
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.slice(1).map((entry) => entry.type),
    ["application", "document"],
  );
});

test("an order within the limit is shown whole", () => {
  assert.deepEqual(orderExcerpt("Posted for plea."), {
    text: "Posted for plea.",
    cut: false,
  });
});

test("a long order is cut at a word before the limit", () => {
  const long = "word ".repeat(100).trim();
  const { text, cut } = orderExcerpt(long);
  assert.equal(cut, true);
  assert.ok(text.length <= ORDER_EXCERPT_LIMIT + 1);
  assert.ok(text.endsWith("word…"));
});
