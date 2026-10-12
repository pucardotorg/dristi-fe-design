import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blockGaps,
  changeBlockType,
  createItemBlock,
  createTextBlock,
  moveBlock,
  resetItemText,
  setItemRecipients,
  setItemText,
  setItemValue,
  writeItemText,
  type ComposerContext,
  type ItemBlock,
} from "./order-composer";
import { casePeopleFor } from "./case-people";
import {
  combinationConflict,
  ORDER_TEMPLATES,
  openSlots,
  orderTemplate,
  unavailableReason,
} from "./order-templates";

/* A matter with no extra people on record: one accused, one complainant, one address
   each (`case-people.ts`). */
const matter = {
  caseNumber: "ST/900/2026",
  parties: { complainant: "Sunil Varghese", accused: "Anand Traders" },
  counsel: [],
};
const beforeJoining: ComposerContext = casePeopleFor({ ...matter, stage: "cognizance" });
const afterJoining: ComposerContext = { ...beforeJoining, accusedJoined: true };

describe("the catalogue", () => {
  it("has the twenty-six order items, numbered as the catalogue numbers them", () => {
    assert.equal(ORDER_TEMPLATES.length, 26);
    assert.deepEqual(
      ORDER_TEMPLATES.map((entry) => entry.number).sort((a, b) => a - b),
      Array.from({ length: 26 }, (_, index) => index + 1),
    );
  });

  it("gives every bracketed token in a template a field to fill it", () => {
    for (const template of ORDER_TEMPLATES) {
      assert.equal(
        openSlots(template.botd).length,
        template.slots.length,
        template.id,
      );
      const keys = new Set(template.fields.map((field) => field.key));
      for (const slot of template.slots) assert.ok(keys.has(slot), `${template.id}: ${slot}`);
    }
  });

  it("offers contextual items only from an application", () => {
    for (const id of [
      "accept-application",
      "reject-application",
      "acceptance-of-bail",
      "rescheduling-of-hearing",
      "dismiss-application",
    ] as const) {
      assert.equal(
        unavailableReason(orderTemplate(id), { hearingOngoing: false }),
        "Comes from an application",
      );
    }
  });

  it("sets the next date in a hearing's own region, not with scheduling", () => {
    const scheduling = orderTemplate("scheduling-of-hearing");
    assert.ok(unavailableReason(scheduling, { hearingOngoing: true }));
    assert.equal(unavailableReason(scheduling, { hearingOngoing: false }), null);
  });
});

describe("combination restrictions", () => {
  it("allows one case-closing item", () => {
    assert.equal(
      combinationConflict("case-settlement", [{ type: "withdrawal-of-case" }]),
      "You cannot add both Case settlement and Withdrawal of case",
    );
  });

  it("keeps cognizance and dismissal apart, and neither repeats", () => {
    assert.ok(combinationConflict("dismiss-case", [{ type: "cognizance" }]));
    assert.equal(
      combinationConflict("cognizance", [{ type: "cognizance" }]),
      "You cannot add two Cognizance items",
    );
  });

  it("allows two summonses, which are two order items", () => {
    assert.equal(
      combinationConflict("issue-of-summons", [{ type: "issue-of-summons" }]),
      null,
    );
  });

  it("allows one decision per application", () => {
    assert.ok(
      combinationConflict(
        "reject-application",
        [{ type: "accept-application", applicationId: "a" }],
        "a",
      ),
    );
  });
});

describe("an item's text, written from its fields", () => {
  it("names each missing answer in brackets, by what it is", () => {
    const cost = createItemBlock("cost", beforeJoining);
    assert.equal(
      cost.text,
      "The [Paying party] is directed to pay [Amount] to the [Receiving party] as costs by [Date by which it must be paid].",
    );
  });

  it("follows the fields while nobody has typed into it", () => {
    let cost = createItemBlock("cost", beforeJoining);
    cost = setItemValue(cost, "payer", "accused", beforeJoining);
    cost = setItemValue(cost, "amount", "150000", beforeJoining);
    cost = setItemValue(cost, "payee", "court", beforeJoining);
    cost = setItemValue(cost, "date", "2026-11-12", beforeJoining);
    assert.equal(
      cost.text,
      "The accused is directed to pay ₹1,50,000 to the court as costs by 12 November 2026.",
    );
    assert.deepEqual(blockGaps(cost, beforeJoining), []);
  });

  it("drops the withdrawal's application clause when there is no application", () => {
    assert.equal(
      createItemBlock("withdrawal-of-case", beforeJoining).text,
      "Complainant has sought to withdraw the complaint. Permission under Section 280 of the BNSS is granted and the Accused is acquitted.",
    );
    assert.equal(
      createItemBlock("withdrawal-of-case", beforeJoining, {
        values: { applicationNumber: "CMP/341/2026" },
      }).text,
      "As per application CMP/341/2026 complainant has sought to withdraw the complaint. Permission under Section 280 of the BNSS is granted and the Accused is acquitted.",
    );
  });

  it("writes nothing for an item with no template", () => {
    const judgement = createItemBlock("judgement", beforeJoining);
    assert.equal(judgement.text, "");
    assert.deepEqual(
      blockGaps(judgement, beforeJoining).map((gap) => gap.key),
      ["text"],
    );
  });
});

describe("loose coupling between fields and text", () => {
  const filled = () => {
    let cost = createItemBlock("cost", beforeJoining);
    for (const [key, value] of [
      ["payer", "accused"],
      ["amount", "5000"],
      ["payee", "complainant"],
      ["date", "2026-11-12"],
    ]) {
      cost = setItemValue(cost, key, value, beforeJoining);
    }
    return cost;
  };

  it("keeps a value in its field after it is taken out of the text", () => {
    const edited = setItemText(
      filled(),
      "The accused is directed to pay costs to the complainant by 12 November 2026.",
      beforeJoining,
    );
    assert.equal(edited.edited, true);
    assert.equal(edited.values.amount, "5000");
    assert.deepEqual(blockGaps(edited, beforeJoining), []);
  });

  it("stops rewriting the text once it has been typed into", () => {
    const edited = setItemText(filled(), "Costs of ₹5,000 imposed.", beforeJoining);
    const changed = setItemValue(edited, "amount", "9000", beforeJoining);
    assert.equal(changed.text, "Costs of ₹5,000 imposed.");
    assert.equal(changed.values.amount, "9000");
  });

  it("writes it from the fields again on Reset wording", () => {
    const edited = setItemValue(
      setItemText(filled(), "Costs imposed.", beforeJoining),
      "amount",
      "9000",
      beforeJoining,
    );
    const reset = resetItemText(edited, beforeJoining);
    assert.equal(reset.edited, false);
    assert.ok(reset.text.includes("₹9,000"));
  });

  it("follows the fields again when the text is typed back to what they write", () => {
    const block = filled();
    const back = setItemText(
      setItemText(block, "x", beforeJoining),
      block.text,
      beforeJoining,
    );
    assert.equal(back.edited, false);
  });

  it("counts a bracket left in typed text as words to fill", () => {
    const edited = setItemText(filled(), "Pay by [date].", beforeJoining);
    assert.deepEqual(
      blockGaps(edited, beforeJoining).map((gap) => gap.label),
      ["[date]"],
    );
  });
});

describe("process items", () => {
  it("go to the accused, at every address on record, with steps on the complainant", () => {
    const summons = createItemBlock("issue-of-summons", beforeJoining);
    assert.equal(summons.recipients?.person, "accused-1");
    assert.deepEqual(summons.recipients?.addresses, ["accused-1-address-1"]);
    assert.deepEqual(summons.recipients?.channels, ["sms", "email", "rpad"]);
    assert.equal(summons.values.steps, "complainant");
    assert.deepEqual(blockGaps(summons, beforeJoining), []);
    assert.equal(
      summons.text,
      "Issue summons to the accused Anand Traders. The complainant is directed to make the appropriate payments and take steps to issue summons.",
    );
  });

  it("leave the person open once the accused has joined and no witness is pending", () => {
    const summons = createItemBlock("issue-of-summons", afterJoining);
    assert.equal(summons.recipients?.person, "");
    assert.equal(
      summons.text,
      "Issue summons to the [Addressed to]. The [Party directed to take steps] is directed to make the appropriate payments and take steps to issue summons.",
    );
  });

  it("bring a newly chosen person's addresses, and move the steps with them", () => {
    let summons = createItemBlock("issue-of-summons", afterJoining);
    summons = setItemRecipients(
      summons,
      { ...summons.recipients!, person: "complainant" },
      afterJoining,
    );
    assert.deepEqual(summons.recipients?.addresses, ["complainant-address-1"]);
    assert.equal(summons.values.steps, "accused");
  });

  it("keep the steps the drafter chose when the person changes", () => {
    let summons = createItemBlock("issue-of-summons", afterJoining);
    summons = setItemValue(summons, "steps", "complainant", afterJoining);
    summons = setItemRecipients(
      summons,
      { ...summons.recipients!, person: "accused-1" },
      afterJoining,
    );
    assert.equal(summons.values.steps, "complainant");
  });

  it("ask for an address when every one is unticked", () => {
    const summons = createItemBlock("issue-of-summons", beforeJoining);
    const none = setItemRecipients(
      summons,
      { ...summons.recipients!, addresses: [] },
      beforeJoining,
    );
    assert.deepEqual(
      blockGaps(none, beforeJoining).map((gap) => gap.label),
      ["Addresses"],
    );
  });

  it("ask for a station when an address has none", () => {
    const warrant = createItemBlock("issue-of-warrants", beforeJoining);
    const missing = {
      ...warrant,
      recipients: { ...warrant.recipients!, policeStations: {} },
    };
    assert.deepEqual(
      blockGaps(missing, beforeJoining).map((gap) => gap.label),
      ["Police station"],
    );
  });
});

describe("master data", () => {
  it("is chosen from a list, never typed, and the choice is what the order says", () => {
    for (const template of ORDER_TEMPLATES) {
      for (const field of template.fields) {
        if (field.master) {
          assert.equal(field.kind, "master", `${template.id}: ${field.key}`);
          assert.ok((field.options ?? []).length > 0, `${template.id}: ${field.key}`);
        }
      }
    }
    const notice = setItemValue(
      createItemBlock("issue-of-notice", beforeJoining),
      "noticeType",
      "DCA",
      beforeJoining,
    );
    assert.ok(notice.text.startsWith("Issue DCA notice to the accused Anand Traders."));
  });
});

describe("blocks", () => {
  it("keep a text block's words when it becomes an order item", () => {
    const text = createTextBlock("Costs of ₹500.");
    const cost = changeBlockType(text, "cost", beforeJoining) as ItemBlock;
    assert.equal(cost.kind, "item");
    assert.equal(cost.text, "Costs of ₹500.");
    assert.equal(cost.edited, true);
  });

  it("carry shared answers across a change of order item", () => {
    let cost = createItemBlock("cost", beforeJoining);
    cost = setItemValue(cost, "amount", "700", beforeJoining);
    const batta = changeBlockType(cost, "witness-batta", beforeJoining) as ItemBlock;
    assert.equal(batta.values.amount, "700");
    assert.ok(batta.text.includes("as witness batta"));
  });

  it("move one place at a time and stop at either end", () => {
    assert.deepEqual(moveBlock(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
    assert.deepEqual(moveBlock(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
  });

  it("write every template without a stray token", () => {
    for (const template of ORDER_TEMPLATES) {
      const text = writeItemText(
        createItemBlock(template.id, beforeJoining),
        beforeJoining,
      );
      assert.ok(!text.includes("[Party Type]"), template.id);
    }
  });
});
