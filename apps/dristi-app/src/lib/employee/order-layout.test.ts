import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLASSIC_ORDER_LAYOUT_OPTIONS,
  DEFAULT_ORDER_LAYOUT,
  effectiveOrderLayout,
} from "./order-layout";

describe("effectiveOrderLayout", () => {
  it("opens E in the Pending orders flow, whatever is stored", () => {
    for (const stored of ["blocks", "text", "proceedings", "option-d", "editor"] as const) {
      assert.equal(effectiveOrderLayout("pending", stored), "editor");
    }
  });

  it("opens the stored A–D in Classic, and the default for a stored E", () => {
    assert.equal(effectiveOrderLayout("classic", "proceedings"), "proceedings");
    assert.equal(effectiveOrderLayout("classic", "editor"), DEFAULT_ORDER_LAYOUT);
  });

  it("offers Classic A–D and not E", () => {
    assert.deepEqual(
      CLASSIC_ORDER_LAYOUT_OPTIONS.map(({ id }) => id),
      ["blocks", "text", "proceedings", "option-d"],
    );
  });
});
