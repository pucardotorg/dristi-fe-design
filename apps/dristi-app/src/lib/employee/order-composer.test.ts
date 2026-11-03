import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blockGaps,
  createItemBlock,
  setItemRecipients,
  setItemValue,
  writeItemText,
  type ComposerContext,
  type ItemBlock,
} from "./order-composer";
import { casePeopleFor } from "./case-people";
import { stepsFor } from "./process-variables";
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
const beforeJoining: ComposerContext = casePeopleFor({
  ...matter,
  stage: "cognizance",
});
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
      for (const slot of template.slots)
        assert.ok(keys.has(slot), `${template.id}: ${slot}`);
    }
  });

  it("offers contextual items only from an application", () => {
    for (const id of [
      "accept-application",
      "reject-application",
      "acceptance-of-bail",
      "dismiss-application",
    ] as const) {
      assert.equal(
        unavailableReason(orderTemplate(id), { hearingOngoing: false }),
        "Comes from an application",
      );
    }
  });

  it("offers rescheduling only outside a hearing, with a hearing listed", () => {
    const rescheduling = orderTemplate("rescheduling-of-hearing");
    assert.equal(
      unavailableReason(rescheduling, { hearingOngoing: false }),
      "No hearing is scheduled",
    );
    assert.equal(
      unavailableReason(rescheduling, {
        hearingOngoing: false,
        hearingScheduled: true,
      }),
      null,
    );
    assert.ok(
      unavailableReason(rescheduling, {
        hearingOngoing: true,
        hearingScheduled: true,
      }),
    );
  });

  it("asks rescheduling only for the new date and the purpose, purpose from the listing", () => {
    const block = createItemBlock("rescheduling-of-hearing", {
      people: [],
      accusedJoined: false,
      scheduledHearing: { date: "2026-11-04", purpose: "appearance" },
    });
    assert.deepEqual(
      orderTemplate("rescheduling-of-hearing")
        .fields.filter((field) => !field.derived)
        .map((field) => field.key),
      ["newDate", "purpose"],
    );
    assert.equal(block.values.purpose, "appearance");
    assert.equal(block.values.originalDate, "2026-11-04");
    assert.equal(block.values.newDate, undefined);
  });

  it("sets the next date in a hearing's own region, not with scheduling", () => {
    const scheduling = orderTemplate("scheduling-of-hearing");
    assert.ok(unavailableReason(scheduling, { hearingOngoing: true }));
    assert.equal(
      unavailableReason(scheduling, { hearingOngoing: false }),
      null,
    );
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
      "The complainant is directed to pay [Amount] to the accused as costs by [Date by which it must be paid].",
    );
  });

  it("opens each party choice on a side, never the same side twice", () => {
    const cost = createItemBlock("cost", beforeJoining);
    assert.equal(cost.values.payer, "complainant");
    assert.equal(cost.values.payee, "accused");
    const summons = createItemBlock("issue-of-summons", beforeJoining);
    /* The steps follow the person addressed, so they are not pre-answered here. */
    assert.equal(
      summons.values.steps,
      stepsFor(beforeJoining.people, summons.recipients?.person ?? ""),
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
  /* Words typed into an item — a quick order's, say (`application-order-draft.ts`). */
  const typed = (block: ItemBlock, text: string): ItemBlock => ({
    ...block,
    text,
    edited: true,
  });

  it("keeps a value in its field after it is taken out of the text", () => {
    const edited = typed(
      filled(),
      "The accused is directed to pay costs to the complainant by 12 November 2026.",
    );
    assert.equal(edited.edited, true);
    assert.equal(edited.values.amount, "5000");
    assert.deepEqual(blockGaps(edited, beforeJoining), []);
  });

  it("stops rewriting the text once it has been typed into", () => {
    const edited = typed(filled(), "Costs of ₹5,000 imposed.");
    const changed = setItemValue(edited, "amount", "9000", beforeJoining);
    assert.equal(changed.text, "Costs of ₹5,000 imposed.");
    assert.equal(changed.values.amount, "9000");
  });

  it("counts a bracket left in typed text as words to fill", () => {
    const edited = typed(filled(), "Pay by [date].");
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
    assert.deepEqual(summons.recipients?.destinations, [
      "accused-1-address-1",
      "accused-1-mobile-1",
      "accused-1-email-1",
    ]);
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
    assert.deepEqual(summons.recipients?.destinations, [
      "complainant-address-1",
      "complainant-mobile-1",
      "complainant-email-1",
    ]);
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
      { ...summons.recipients!, destinations: [] },
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
          assert.ok(
            (field.options ?? []).length > 0,
            `${template.id}: ${field.key}`,
          );
        }
      }
    }
    const notice = setItemValue(
      createItemBlock("issue-of-notice", beforeJoining),
      "noticeType",
      "DCA",
      beforeJoining,
    );
    assert.ok(
      notice.text.startsWith("Issue DCA notice to the accused Anand Traders."),
    );
  });
});

describe("templates", () => {
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
