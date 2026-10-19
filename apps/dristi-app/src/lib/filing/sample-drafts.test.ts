import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { setSigningRules } from "./config";

import { ADVOCATE_LINK_SAMPLES, buildSampleDraft } from "./sample-drafts";
import { signatories } from "./selectors";

/* The oath and per-advocate signing are Gujarat's rules (`config.ts`); this sample is
   checked under them. */
describe("the two-advocate sample", () => {
  const gujarat = { oath: true, everyAdvocate: true };
  setSigningRules(gujarat);
  const draft = buildSampleDraft(ADVOCATE_LINK_SAMPLES[0], "2026-10-07");
  const { complainants, advocates } = signatories(draft, null, true, true);
  setSigningRules({ oath: false, everyAdvocate: false });
  before(() => setSigningRules(gujarat));
  after(() => setSigningRules({ oath: false, everyAdvocate: false }));

  it("has two complainants, each with their own advocate", () => {
    assert.equal(complainants.length, 2);
    assert.equal(advocates.length, 2);
  });

  it("puts you in the first advocate's seat, signed, with no oath of your own", () => {
    const [yours] = advocates;
    assert.equal(yours.you, true);
    assert.equal(yours.status, "signed");
    assert.equal(yours.oathTaken, undefined);
  });

  it("sends the second advocate a link for their signature only", () => {
    const theirs = advocates[1];
    assert.equal(theirs.you, false);
    assert.equal(theirs.status, "pending");
    assert.equal(theirs.oathTaken, undefined);
    assert.ok(draft.sign.notified[theirs.id], "their link has gone out");
  });

  it("asks each complainant, by link, for their signature and oath", () => {
    for (const c of complainants) {
      assert.equal(c.status, "pending");
      assert.equal(c.oathTaken, false);
      assert.ok(draft.sign.notified[c.id], "their link has gone out");
    }
  });
});
