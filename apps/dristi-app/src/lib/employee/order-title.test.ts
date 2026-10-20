import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { orderTemplate } from "./order-templates";
import { orderTitle } from "./order-title";
import type { ComposerBlock } from "./order-composer";

const item = (type: string, id: string) => ({ kind: "item", type, id }) as unknown as ComposerBlock;

/* `TIT-01`, `TIT-02`: every order has a title, from its items until one is typed. */
describe("order title", () => {
  const first = orderTemplate("mandatory-submissions").label;

  it("is 'Order' with no items, the item's name with one", () => {
    assert.equal(orderTitle({ blocks: [] }), "Order");
    assert.equal(orderTitle({ blocks: [item("mandatory-submissions", "a")] }), first);
  });

  it("names the first item and other items when there are several", () => {
    assert.equal(
      orderTitle({ blocks: [item("mandatory-submissions", "a"), item("referral-to-adr", "b")] }),
      `${first} and other items`,
    );
  });

  it("keeps a typed title", () => {
    assert.equal(orderTitle({ blocks: [item("referral-to-adr", "b")], title: "Bail and ADR" }), "Bail and ADR");
    assert.equal(orderTitle({ blocks: [], title: "   " }), "Order");
  });
});
