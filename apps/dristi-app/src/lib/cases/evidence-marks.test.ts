import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextEvidenceNumber } from "./evidence-marks";

describe("evidence numbers (DSB-13, DSB-14)", () => {
  it("counts each side on its own, from 1", () => {
    assert.equal(nextEvidenceNumber([], "P"), "P1");
    assert.equal(nextEvidenceNumber(["P1", "P2"], "D"), "D1");
  });

  it("follows the highest number given on that side", () => {
    assert.equal(nextEvidenceNumber(["P1", "P2", "P3", "D1"], "P"), "P4");
    assert.equal(nextEvidenceNumber(["P1", "P3"], "P"), "P4");
    assert.equal(nextEvidenceNumber(["D1", null, "P2", undefined], "D"), "D2");
  });

  it("ignores what is not an evidence number", () => {
    assert.equal(nextEvidenceNumber(["DOC-4", "PW-1", "P12x"], "P"), "P1");
  });
});
