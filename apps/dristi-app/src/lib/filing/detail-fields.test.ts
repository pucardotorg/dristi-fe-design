import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBlankDraft } from "./blank";
import {
  DETAILS_FORMAT,
  DETAIL_FIELDS,
  bracketsIn,
  detailField,
  generateDetails,
  unfilledFields,
  valueCount,
} from "./detail-fields";
import { COURT } from "./options";

describe("additional details fields", () => {
  it("generates plain text: values where the form has them, brackets where not", () => {
    const draft = createBlankDraft("d1");
    draft.cheques[0].chequeNumber = "004512";
    draft.cheques[0].dateOnCheque = "2026-03-15";
    const html =
      "<p>Cheque no. [Cheque Number] dated [Cheque Date], drawn on [Drawer Bank]. [How they met]</p>";
    assert.equal(
      generateDetails(html, draft),
      "<p>Cheque no. 004512 dated 15 March 2026, drawn on [Drawer Bank]. [How they met]</p>",
    );
  });

  it("bulk fills only a field with exactly one value; single filing joins (BLK-10h)", () => {
    const draft = createBlankDraft("d9");
    draft.accused[0].name = "Pravin D. Solanki";
    draft.accused.push({ ...structuredClone(draft.accused[0]), name: "Kusum P. Solanki" });
    draft.cheques[0].chequeNumber = "004512";
    const html = "<p>[Accused Name], cheque [Cheque Number], delivered [Notice Delivery Date].</p>";
    assert.equal(valueCount(detailField("Accused Name")!, draft), 2);
    assert.equal(valueCount(detailField("Cheque Number")!, draft), 1);
    assert.equal(valueCount(detailField("Notice Delivery Date")!, draft), 0);
    assert.equal(
      generateDetails(html, draft),
      "<p>Pravin D. Solanki and Kusum P. Solanki, cheque 004512, delivered [Notice Delivery Date].</p>",
    );
    const bulk = generateDetails(html, draft, undefined, { single: true });
    assert.equal(bulk, "<p>[Accused Name], cheque 004512, delivered [Notice Delivery Date].</p>");
    assert.deepEqual(unfilledFields(bulk, draft), [
      { name: "Accused Name", values: 2 },
      { name: "Notice Delivery Date", values: 0 },
    ]);
  });

  it("leaves the total in brackets until an amount is typed", () => {
    assert.equal(generateDetails("[Total Cheque Amount]", createBlankDraft("d7")), "[Total Cheque Amount]");
  });

  it("never touches markup", () => {
    const draft = createBlankDraft("d2");
    draft.accused[0].name = "Juned M.";
    assert.equal(generateDetails('<p class="[Accused Name]">x</p>', draft), '<p class="[Accused Name]">x</p>');
  });

  it("escapes values typed into the form", () => {
    const draft = createBlankDraft("d3");
    draft.accused[0].name = "A <b>& Co";
    assert.equal(generateDetails("[accused name]", draft), "A &lt;b&gt;&amp; Co");
  });

  it("words values for the court it is given", () => {
    const draft = createBlankDraft("d6");
    assert.equal(generateDetails("[Court Name]", draft, (t) => t.toUpperCase()), COURT.name.toUpperCase());
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
