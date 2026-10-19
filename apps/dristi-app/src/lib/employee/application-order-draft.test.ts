import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LifecycleApplication } from "@/lib/applications/lifecycle";

import { applicationOrderHref } from "./application-order-decision";
import { applicationOrderKey, quickOrderDraft } from "./application-order-draft";
import {
  applicationOrderOutcomes,
  outcomeHearingDate,
} from "./application-order-outcome";
import type { ItemBlock } from "./order-composer";

const item: ItemBlock = {
  id: "item-1",
  kind: "item",
  type: "accept-application",
  values: { applicationNumber: "AP101", applicationType: "Postpone" },
  text: "Application AP101 for Postpone is accepted.",
  edited: false,
  applicationId: "app-1",
};

describe("the quick order on an application", () => {
  it("is kept under the application's key, as the order screen keeps it", () => {
    assert.equal(applicationOrderKey("app-1"), "application:app-1");
  });

  it("carries the edited words as the editor's body and the decision as its item", () => {
    const draft = quickOrderDraft("editor", item, "  Allowed.\nCosts on the accused.  ");
    assert.equal(draft.body?.text, "Allowed.\nCosts on the accused.");
    assert.match(draft.body?.html ?? "", /^<p data-order-item="item-1">Allowed\.<\/p><p>/);
    assert.equal(draft.blocks.length, 1);
    assert.deepEqual(applicationOrderOutcomes(draft.blocks), [
      { applicationId: "app-1", kind: "accept" },
    ]);
  });

  it("keeps the words in the item itself on the block composers", () => {
    for (const variant of ["blocks", "proceedings", "option-d"] as const) {
      const draft = quickOrderDraft(variant, item, "Allowed.");
      assert.equal(draft.body, undefined, variant);
      const block = draft.blocks[0] as ItemBlock;
      assert.equal(block.text, "Allowed.", variant);
      assert.equal(block.edited, true, variant);
    }
    const untouched = quickOrderDraft("blocks", item, item.text).blocks[0] as ItemBlock;
    assert.equal(untouched.edited, false);
  });

  it("gives a rescheduling acceptance its new hearing, where the outcome reads it", () => {
    const draft = quickOrderDraft("editor", item, item.text, "2026-10-22");
    const app = { type: "postpone" } as LifecycleApplication;
    assert.equal(
      outcomeHearingDate({ applicationId: "app-1", kind: "accept" }, app, draft),
      "2026-10-22",
    );
  });

  it("opens the order screen on the decision and the list being worked", () => {
    assert.equal(
      applicationOrderHref("app-1", "accept", "decide"),
      "/employee/applications/app-1/order?decision=accept&view=decide",
    );
    assert.equal(applicationOrderHref("app-1"), "/employee/applications/app-1/order");
  });
});
