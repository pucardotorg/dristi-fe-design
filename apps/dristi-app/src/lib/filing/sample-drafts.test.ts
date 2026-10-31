import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { setSigningRules } from "./config";

import { ADVOCATE_LINK_SAMPLES, OATH_DEMO_LINK, OATH_DEMO_SAMPLES, buildSampleDraft } from "./sample-drafts";
import { complaintsNaming } from "./linked-complaints";
import { DEMO_ADVOCATE, EMPTY_PROFILE, asDemoAdvocate, asSignedIn } from "./profile";
import { createBlankDraft } from "./blank";
import { sameMobile, signatories } from "./selectors";

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

describe("the oath walkthrough sample", () => {
  const draft = buildSampleDraft(OATH_DEMO_SAMPLES[0], "2026-10-19");
  const { complainants } = signatories(draft, null, true, true);

  it("has the same signing link in every browser", () => {
    const second = complainants[1];
    assert.equal(second.id, "sig-c-sample-draft-14-c-2");
    assert.equal(OATH_DEMO_LINK, `/sign?draft=${draft.id}&as=${second.id}`);
  });

  it("waits on the second complainant's signature and oath", () => {
    const second = complainants[1];
    assert.equal(second.status, "pending");
    assert.equal(second.oathTaken, false);
  });
});

describe("a litigant's home", () => {
  const draft = buildSampleDraft(OATH_DEMO_SAMPLES[0], "2026-10-19");

  it("lists the complaint that names their mobile, in the complainant's seat", () => {
    assert.deepEqual(complaintsNaming([draft], "9000000001", sameMobile), [
      { draftId: "sample-draft-14", signatoryId: "sig-c-sample-draft-14-c-2" },
    ]);
  });

  it("lists nothing for a number the complaint does not name", () => {
    assert.deepEqual(complaintsNaming([draft], "9000000002", sameMobile), []);
  });

  it("leaves out a draft not yet sent for signature", () => {
    const unsent = { ...draft, sign: { ...draft.sign, requestedAt: null } };
    assert.deepEqual(complaintsNaming([unsent], "9000000001", sameMobile), []);
  });
});

describe("the signed-in litigant in File a case", () => {
  const draft = buildSampleDraft(OATH_DEMO_SAMPLES[0], "2026-10-19");
  const stored = { name: "Anjali Nair", mobile: "", email: "", barNumber: "K/1188/2011" };

  it("sits in their complainant seat, not the advocate's", () => {
    const { complainants, advocates } = signatories(draft, asSignedIn(stored, "9000000001"), true, true);
    assert.equal(complainants[1].you, true);
    assert.equal(advocates.some((a) => a.you), false);
  });

  it("leaves an advocate's profile alone", () => {
    assert.deepEqual(asSignedIn(stored, null), stored);
  });
});

describe("the signed-in demo advocate in File a case", () => {
  it("opens every new filing with them as Advocate 1, with no setup", () => {
    const profile = asDemoAdvocate(EMPTY_PROFILE, null, null);
    const [adv] = createBlankDraft("d-1", profile).advocates;
    assert.equal(adv.name, DEMO_ADVOCATE.name);
    assert.equal(adv.barNumber, DEMO_ADVOCATE.barNumber);
  });

  it("keeps details saved from the header avatar", () => {
    const saved = { ...EMPTY_PROFILE, name: "Anjali Nair", barNumber: "K/0042/2009" };
    assert.deepEqual(asDemoAdvocate(saved, "advocate", "Anjali Nair"), saved);
  });

  it("gives nothing to the litigant or clerk profile, or another account", () => {
    assert.equal(asDemoAdvocate(EMPTY_PROFILE, "litigant", null).barNumber, "");
    assert.equal(asDemoAdvocate(EMPTY_PROFILE, "clerk", null).barNumber, "");
    assert.equal(asDemoAdvocate(EMPTY_PROFILE, "advocate", "Arjun Menon").barNumber, "");
  });
});
