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
  filledSpan,
  resolveDetails,
  staleDetails,
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

describe("filling the text from the form", () => {
  it("fills what the form holds and leaves the rest as brackets", () => {
    const draft = createBlankDraft("r1");
    draft.cheques[0].chequeNumber = "004512";
    const { html, changed } = resolveDetails(
      "<p>Cheque [Cheque Number] dated [Cheque Date]. [How they met]</p>",
      draft,
    );
    assert.equal(changed, 1);
    assert.equal(
      html,
      `<p>Cheque ${filledSpan("Cheque Number", "004512")} dated [Cheque Date]. [How they met]</p>`,
    );
  });

  it("refreshes a filled value when the form changes, and fills a newly entered one", () => {
    const draft = createBlankDraft("r2");
    draft.cheques[0].chequeNumber = "004512";
    const first = resolveDetails("[Cheque Number] on [Cheque Date]", draft).html;
    assert.equal(staleDetails(first, draft), 0);

    draft.cheques[0].chequeNumber = "004599";
    draft.cheques[0].dateOnCheque = "2026-03-15";
    assert.equal(staleDetails(first, draft), 2);
    assert.equal(
      resolveDetails(first, draft).html,
      `${filledSpan("Cheque Number", "004599")} on ${filledSpan("Cheque Date", "15 March 2026")}`,
    );
  });

  it("puts the bracket back when the form no longer holds the value", () => {
    const draft = createBlankDraft("r3");
    draft.accused[0].name = "Juned M.";
    const filled = resolveDetails("[Accused Name]", draft).html;
    draft.accused[0].name = "";
    assert.equal(resolveDetails(filled, draft).html, "[Accused Name]");
  });

  it("keeps the filer's own writing around the values", () => {
    const draft = createBlankDraft("r4");
    draft.accused[0].name = "A & B";
    const filled = resolveDetails("<p><b>Note:</b> [Accused Name] owes.</p>", draft).html;
    assert.ok(filled.startsWith("<p><b>Note:</b> <span"));
    assert.ok(filled.includes(">A &amp; B</span> owes.</p>"));
    assert.equal(staleDetails(filled, draft), 0);
  });

  it("prints filled values as shown and missing fields as not provided", () => {
    const draft = createBlankDraft("r5");
    const html = `${filledSpan("Accused Name", "Juned M.")} [Cheque Date]`;
    assert.equal(fillDetails(html, draft), `${filledSpan("Accused Name", "Juned M.")} ${NOT_PROVIDED}`);
  });
});
