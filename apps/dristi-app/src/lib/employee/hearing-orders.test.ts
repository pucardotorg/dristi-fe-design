import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ordersForSitting } from "./hearing-orders";
import type { CourtHearing } from "./hearings";
import { EMPTY_ORDER_DRAFT, type OrderDraft } from "./order-draft";

const TODAY = "2026-10-12";

function hearing(overrides: Partial<CourtHearing> = {}): CourtHearing {
  return {
    id: "h-1",
    item: 1,
    caseNumber: "ST/700/2026",
    stage: "evidence",
    parties: { complainant: "Sunil Varghese", accused: "Anand Traders" },
    counsel: [{ name: "Adv. Suresh Menon", side: "complainant" }],
    purpose: "evidence-of-complainant",
    status: "ongoing",
    ...overrides,
  };
}

function draft(text: string, overrides: Partial<OrderDraft> = {}): OrderDraft {
  return { ...EMPTY_ORDER_DRAFT, body: { html: text, text }, ...overrides };
}

describe("ordersForSitting", () => {
  it("leaves out a listing with no order on it", () => {
    assert.deepEqual(ordersForSitting([hearing()], {}, {}, TODAY), []);
  });

  it("is a draft until the composer adds it to the signing list", () => {
    const drafts = { "h-1": draft("Heard.") };
    assert.equal(ordersForSitting([hearing()], drafts, {}, TODAY)[0].status, "draft");
    assert.equal(
      ordersForSitting([hearing()], drafts, { "h-1": "ready" }, TODAY)[0].status,
      "ready",
    );
    assert.equal(
      ordersForSitting([hearing()], drafts, { "h-1": "signed" }, TODAY)[0].status,
      "signed",
    );
  });

  it("takes a listing added to the signing list with no draft key", () => {
    const rows = ordersForSitting([hearing()], {}, { "h-1": "ready" }, TODAY);
    assert.deepEqual(rows.map((row) => row.hearing.id), ["h-1"]);
  });

  it("reads what is left to fill off the text, once per placeholder", () => {
    const drafts = {
      "h-1": draft("Summons on [date of summons]; again [date of summons].", {
        next: "list",
        nextDate: null,
      }),
    };
    const [row] = ordersForSitting([hearing()], drafts, {}, TODAY);
    assert.deepEqual(row.gaps, ["Date of summons missing", "Next hearing date missing"]);
    assert.equal(row.nextDate, null);
  });

  it("carries the next date only when the order lists the matter", () => {
    const listed = { "h-1": draft("Heard.", { next: "list", nextDate: "2026-11-16" }) };
    assert.equal(ordersForSitting([hearing()], listed, {}, TODAY)[0].nextDate, "2026-11-16");
    const closed = { "h-1": draft("Heard.", { next: "none", nextDate: "2026-11-16" }) };
    assert.equal(ordersForSitting([hearing()], closed, {}, TODAY)[0].nextDate, null);
  });

  it("keeps the court's serial order", () => {
    const rows = ordersForSitting(
      [hearing({ id: "b", item: 4 }), hearing({ id: "a", item: 2 })],
      { a: draft("x"), b: draft("y") },
      {},
      TODAY,
    );
    assert.deepEqual(rows.map((row) => row.hearing.id), ["a", "b"]);
  });
});
