import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { localizeCourtText } from "@/lib/court/localize";

import { APPLICATION_COURT_HEADING, datedThis } from "./application-document";

describe("the generated application's heading", () => {
  it("names the selected state's court and seat", () => {
    assert.equal(localizeCourtText(APPLICATION_COURT_HEADING, "kerala"), APPLICATION_COURT_HEADING);
    const gujarat = localizeCourtText(APPLICATION_COURT_HEADING, "gujarat");
    assert.ok(gujarat.includes("SARAS Court"), gujarat);
    assert.ok(!gujarat.includes("Kollam"), gujarat);
    for (const court of ["punjab-haryana"] as const) {
      assert.ok(!localizeCourtText(APPLICATION_COURT_HEADING, court).includes("Kollam"), court);
    }
  });
});

describe("the dated line", () => {
  it("reads as the template's", () => {
    assert.equal(datedThis("18 November 2025"), "Dated this 18th day of November 2025");
    assert.equal(datedThis("1 October 2026"), "Dated this 1st day of October 2026");
    assert.equal(datedThis("22 October 2026"), "Dated this 22nd day of October 2026");
    assert.equal(datedThis("12 October 2026"), "Dated this 12th day of October 2026");
  });
});
