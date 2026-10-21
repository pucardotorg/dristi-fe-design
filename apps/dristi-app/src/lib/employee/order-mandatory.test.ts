import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { casePeopleFor } from "./case-people";
import {
  createItemBlock,
  missingMandatory,
  setItemValue,
  type ComposerContext,
} from "./order-composer";

const context: ComposerContext = casePeopleFor({
  caseNumber: "ST/900/2026",
  parties: { complainant: "Sunil Varghese", accused: "Anand Traders" },
  counsel: [],
  stage: "appearance",
});

/* `VAR-05`, `VAR-06`, `CMP-02`: only fields the catalogue marks mandatory to enter are
   ever "still to fill"; an optional one never is, and no sentence blank counts. */
describe("mandatory fields only", () => {
  it("counts each unanswered mandatory field", () => {
    const adr = createItemBlock("referral-to-adr", context);
    assert.deepEqual(
      missingMandatory(adr, context).map((gap) => gap.key),
      ["mode", "endDate"],
    );
    const half = setItemValue(adr, "mode", "mediation", context);
    assert.deepEqual(missingMandatory(half, context).map((gap) => gap.key), ["endDate"]);
  });

  it("never counts an optional field", () => {
    /* Bail's plea is optional in the catalogue. */
    const bail = createItemBlock("bail", context);
    assert.equal(
      missingMandatory(bail, context).some((gap) => gap.key === "plea"),
      false,
    );
  });
});
