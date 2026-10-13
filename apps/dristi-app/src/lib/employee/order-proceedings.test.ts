import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { casePeopleFor } from "./case-people";
import {
  createItemBlock,
  createTextBlock,
  setItemValue,
  type ComposerContext,
  type ItemBlock,
} from "./order-composer";
import { EMPTY_ORDER_DRAFT, type Appearance } from "./order-draft";
import {
  blanksIn,
  citedIds,
  closingItem,
  itemDefaultParts,
  itemParts,
  itemSentence,
  paraParts,
  paraText,
  parseTypedDate,
  PROCEEDINGS_TEMPLATES,
  proceedingsToFill,
  suggestedTemplates,
  templateBlocks,
} from "./order-proceedings";
import { orderTemplate } from "./order-templates";

const context: ComposerContext = casePeopleFor({
  caseNumber: "ST/900/2026",
  parties: { complainant: "Sunil Varghese", accused: "Anand Traders" },
  counsel: [],
  stage: "evidence",
});

const roll: Appearance[] = [
  { id: "complainant", name: "Sunil Varghese", role: "Complainant", side: "complainant", kind: "party" },
  { id: "accused", name: "Anand Traders", role: "Accused", side: "accused", kind: "party" },
];

describe("an order item's words", () => {
  it("writes the catalogue sentence as words around value pieces", () => {
    const cost = createItemBlock("cost", context);
    const parts = itemDefaultParts(cost, context);
    assert.ok(parts.some((part) => typeof part !== "string" && part.k === "amount"));
    assert.equal(
      itemSentence(cost, context),
      "The complainant is directed to pay [Amount] to the accused as costs by [Date by which it must be paid].",
    );
  });

  it("keeps a rewording that still carries every value, and drops one that lost a value", () => {
    let cost = createItemBlock("cost", context);
    cost = setItemValue(cost, "amount", "5000", context);
    const parts = itemDefaultParts(cost, context);
    const kept: ItemBlock = { ...cost, wording: ["Costs: ", ...parts.filter((part) => typeof part !== "string")] };
    assert.deepEqual(itemParts(kept, context), kept.wording);
    const lost: ItemBlock = { ...cost, wording: ["Costs of ", { k: "amount" }, "."] };
    assert.deepEqual(itemParts(lost, context), parts);
  });

  it("knows an item that closes the case", () => {
    const blocks = [createTextBlock("Heard."), createItemBlock("withdrawal-of-case", context)];
    assert.equal(closingItem(blocks)?.type, "withdrawal-of-case");
    assert.equal(orderTemplate("withdrawal-of-case").closing, true);
  });
});

describe("the typed text", () => {
  it("stores a cited document as a token and reads it back", () => {
    const parts = paraParts("The original @{return-memo} is produced.");
    assert.deepEqual(parts, ["The original ", { ref: "return-memo" }, " is produced."]);
    assert.equal(paraText(parts), "The original @{return-memo} is produced.");
    assert.deepEqual(citedIds([createTextBlock("See @{cheque} and @{cheque}.")]), ["cheque"]);
  });

  it("counts the blanks left in the words, not the citations", () => {
    assert.deepEqual(blanksIn("[Witness] examined. Exts. [P1 to P5] marked. @{memo}"), ["[Witness]", "[P1 to P5]"]);
  });
});

describe("a typed date", () => {
  const today = "2026-10-08";
  it("reads the ways a typist writes a date", () => {
    assert.deepEqual(parseTypedDate("12.11", today), { kind: "date", iso: "2026-11-12" });
    assert.deepEqual(parseTypedDate("12 Nov", today), { kind: "date", iso: "2026-11-12" });
    assert.deepEqual(parseTypedDate("12/11/26", today), { kind: "date", iso: "2026-11-12" });
    assert.deepEqual(parseTypedDate("2026-11-12", today), { kind: "date", iso: "2026-11-12" });
  });
  it("takes a day with no year as the next one to come", () => {
    assert.deepEqual(parseTypedDate("3.1", today), { kind: "date", iso: "2027-01-03" });
  });
  it("refuses a past day and a day that does not exist", () => {
    assert.deepEqual(parseTypedDate("1.1.2026", today), { kind: "past" });
    assert.deepEqual(parseTypedDate("31.2.2027", today), { kind: "bad" });
    assert.deepEqual(parseTypedDate("soon", today), { kind: "bad" });
  });
});

describe("what is left before signing", () => {
  it("counts attendance, item fields, blanks and the next date", () => {
    const draft = {
      ...EMPTY_ORDER_DRAFT,
      marks: { complainant: "present" as const },
      blocks: [createTextBlock("[Witness] examined."), createItemBlock("cost", context)],
    };
    const left = proceedingsToFill({ appearances: roll, draft, context });
    assert.deepEqual(left.steps.map((step) => step.kind), ["attendance", "blanks", "item", "next", "next"]);
    assert.equal(left.count, 1 + 1 + 2 + 2);
  });

  it("asks for no next date once an item closes the case", () => {
    const draft = { ...EMPTY_ORDER_DRAFT, blocks: [createItemBlock("withdrawal-of-case", context)] };
    const left = proceedingsToFill({ appearances: [], draft, context });
    assert.equal(left.steps.some((step) => step.kind === "next"), false);
  });
});

describe("the templates", () => {
  it("suggests the templates for this hearing's purpose", () => {
    assert.deepEqual(
      suggestedTemplates("evidence-of-complainant").map((template) => template.id),
      ["evidence", "witness-absent", "adjourn"],
    );
  });
  it("builds every template on the app's catalogue", () => {
    for (const template of PROCEEDINGS_TEMPLATES) {
      const blocks = templateBlocks(template, context);
      assert.equal(blocks.length, template.blocks.length, template.id);
    }
  });
});
