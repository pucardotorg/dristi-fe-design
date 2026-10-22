import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBlankDraft } from "./blank";
import {
  DETAILS_FORMAT,
  DETAIL_FIELDS,
  NOT_PROVIDED,
  bracketsIn,
  detailField,
  fillDetails,
} from "./detail-fields";

describe("additional details fields", () => {
  it("fills a field from the form and says when it is missing", () => {
    const draft = createBlankDraft("d1");
    draft.cheques[0].chequeNumber = "004512";
    draft.cheques[0].dateOnCheque = "2026-03-15";
    const html = "<p>Cheque no. [Cheque Number] dated [Cheque Date], drawn on [Drawer Bank].</p>";
    assert.equal(
      fillDetails(html, draft),
      `<p>Cheque no. 004512 dated 15 March 2026, drawn on ${NOT_PROVIDED}.</p>`,
    );
  });

  it("leaves a blank the filer has to write, and never touches markup", () => {
    const draft = createBlankDraft("d2");
    const html = '<p class="[x]">[Describe the debt]</p>';
    assert.equal(fillDetails(html, draft), html);
  });

  it("escapes values typed into the form", () => {
    const draft = createBlankDraft("d3");
    draft.accused[0].name = "A <b>& Co";
    assert.equal(fillDetails("[accused name]", draft), "A &lt;b&gt;&amp; Co");
  });

  it("joins one value per cheque as a sentence", () => {
    const draft = createBlankDraft("d4");
    draft.cheques[0].amount = "100000";
    draft.cheques.push({ ...draft.cheques[0], id: "c2", amount: "50000" });
    assert.equal(detailField("Cheque Amount")?.resolve(draft), "₹1,00,000 and ₹50,000");
    assert.equal(detailField("Total Cheque Amount")?.resolve(draft), "₹1,50,000");
    draft.cheques[1].amount = "100000";
    assert.equal(detailField("Cheque Amount")?.resolve(draft), "₹1,00,000 and ₹1,00,000");
  });

  it("says a value two cheques share once", () => {
    const draft = createBlankDraft("d5");
    draft.cheques[0].dateOnCheque = "2026-08-20";
    draft.cheques.push({ ...draft.cheques[0], id: "c2" });
    assert.equal(detailField("Cheque Date")?.resolve(draft), "20 August 2026");
  });

  it("names only real fields in the format, apart from its two blanks", () => {
    assert.equal(new Set(DETAIL_FIELDS.map((f) => f.name)).size, DETAIL_FIELDS.length);
    const blanks = bracketsIn(DETAILS_FORMAT).filter((name) => !detailField(name));
    assert.equal(blanks.length, 2);
    assert.ok(blanks.every((name) => name.startsWith("Describe")));
  });
});
