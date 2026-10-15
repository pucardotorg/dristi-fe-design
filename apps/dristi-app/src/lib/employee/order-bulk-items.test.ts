import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hearingById } from "./hearings";
import {
  addItemsToDraft,
  bulkOrderItems,
  orderTextPreview,
} from "./order-bulk-items";
import { composerContextFor } from "./order-context";
import { EMPTY_ORDER_DRAFT } from "./order-draft";

const context = composerContextFor(hearingById("h-246")!);

describe("adding order items in bulk", () => {
  it("adds each chosen item once", () => {
    const result = addItemsToDraft(
      EMPTY_ORDER_DRAFT,
      ["issue-of-summons", "cost"],
      context,
    );
    assert.deepEqual(result.added, ["issue-of-summons", "cost"]);
    assert.equal(result.draft.blocks.length, 2);
  });

  it("leaves out an item the order already has", () => {
    const first = addItemsToDraft(EMPTY_ORDER_DRAFT, ["cost"], context).draft;
    const again = addItemsToDraft(first, ["cost"], context);
    assert.deepEqual(again.added, []);
    assert.equal(again.skipped[0].reason, "Already in this order");
    assert.equal(again.draft, first);
  });

  it("leaves out an item the catalogue forbids beside another", () => {
    const result = addItemsToDraft(
      EMPTY_ORDER_DRAFT,
      ["cognizance", "dismiss-case"],
      context,
    );
    assert.deepEqual(result.added, ["cognizance"]);
    assert.equal(result.skipped[0].type, "dismiss-case");
  });

  it("offers no contextual items", () => {
    assert.ok(bulkOrderItems().every((template) => template.dropdown !== "context"));
  });
});

describe("the order text preview", () => {
  it("skips the opening attendance", () => {
    assert.equal(
      orderTextPreview(
        "Complainant present. Accused absent; counsel for the accused present.\nHeard on the petition to condone delay.",
        5,
      ),
      "Heard on the petition to…",
    );
  });

  it("keeps a sentence that does more than record who came", () => {
    assert.equal(
      orderTextPreview("Issue bailable warrant against the accused."),
      "Issue bailable warrant against the accused.",
    );
  });

  it("falls back to the whole text when it is all attendance", () => {
    assert.equal(orderTextPreview("Complainant present."), "Complainant present.");
  });
});
