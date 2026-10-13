import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankComplainant } from "./blank";
import { cinPanAnswered, complainantsMissingCinPan, isCinOrPan, normaliseCinPan } from "./selectors";

describe("CIN / PAN", () => {
  it("accepts a CIN and a PAN, however they were typed", () => {
    assert.equal(isCinOrPan("L17110MH1973PLC019786"), true);
    assert.equal(isCinOrPan("u74999dl2015ptc123456"), true);
    assert.equal(isCinOrPan("ABCDE1234F"), true);
    assert.equal(isCinOrPan(" abcde 1234 f "), true);
    assert.equal(normaliseCinPan(" abcde 1234 f "), "ABCDE1234F");
  });

  it("rejects what is neither", () => {
    assert.equal(isCinOrPan(""), false);
    assert.equal(isCinOrPan("ABCDE1234"), false);
    assert.equal(isCinOrPan("12345ABCDE"), false);
    assert.equal(isCinOrPan("X17110MH1973PLC019786"), false);
    assert.equal(isCinOrPan("AAB-1234"), false);
  });

  it("asks only about institutions without a usable number", () => {
    const person = blankComplainant();
    const filled = { ...blankComplainant(), type: "institution" as const, entCinPan: "ABCDE1234F" };
    const empty = { ...blankComplainant(), type: "institution" as const };
    const typo = { ...blankComplainant(), type: "institution" as const, entCinPan: "ABCDE12" };
    assert.deepEqual(complainantsMissingCinPan([person, filled, empty, typo]), [2, 3]);
  });

  it("is mandatory, but a recorded declaration skips it (LIT-18a)", () => {
    const empty = { ...blankComplainant(), type: "institution" as const };
    const skipped = { ...empty, entCinPanSkippedAt: "2026-10-08T10:00:00.000Z" };
    assert.equal(cinPanAnswered(empty), false);
    assert.equal(cinPanAnswered(skipped), true);
    assert.deepEqual(complainantsMissingCinPan([empty, skipped]), [0]);
  });
});
