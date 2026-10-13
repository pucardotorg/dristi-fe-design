import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COGNIZANCE_QUEUE, hasDelay } from "./cognizance";
import { cognizanceComposition } from "./cognizance-order";
import { CAUSE_LIST } from "./hearings";
import { applicationsForListing } from "./listing-applications";
import { composerContextFor } from "./order-context";
import { initialOrderDraft } from "./order-demo";
import {
  variantDocument,
  variantDraftKey,
  variantInitialDraft,
} from "./order-door";
import {
  appearancesFor,
  EMPTY_ORDER_DRAFT,
  hearingOrderDocument,
} from "./order-draft";
import { hasDraftFor } from "./order-drafts";
import { ORDER_LAYOUT_OPTIONS } from "./order-layout";
import { bodyFromBlocks } from "./order-text";

const today = "2026-09-07";
/* A finished listing with applications on it, so its opening draft carries decisions. */
const hearing =
  CAUSE_LIST.find((entry) => applicationsForListing(entry.id).length > 0) ??
  CAUSE_LIST[0];
const heard = initialOrderDraft(hearing, "completed", today);
const appearances = appearancesFor(hearing);

const late = COGNIZANCE_QUEUE.find(hasDelay) ?? COGNIZANCE_QUEUE[0];
const lateContext = composerContextFor({ ...late, stage: "cognizance" });
const cognizance = cognizanceComposition(late, "cognizance", lateContext);
const cognizanceDraft = { ...EMPTY_ORDER_DRAFT, blocks: cognizance.blocks };

describe("variantDraftKey", () => {
  it("keeps the keys each variant has always used", () => {
    assert.equal(variantDraftKey("blocks", "h1"), "h1");
    assert.equal(variantDraftKey("text", "h1"), "text:h1");
    assert.equal(variantDraftKey("proceedings", "h1"), "proceedings:h1");
    assert.equal(variantDraftKey("option-d", "h1"), "d:h1");
    assert.equal(
      variantDraftKey("text", "cognizance:c1:notice"),
      "text:cognizance:c1:notice",
    );
  });

  it("gives every variant its own draft, and the queue sees each", () => {
    const keys = ORDER_LAYOUT_OPTIONS.map(({ id }) => variantDraftKey(id, "h1"));
    assert.equal(new Set(keys).size, ORDER_LAYOUT_OPTIONS.length);
    for (const key of keys) {
      assert.ok(hasDraftFor({ [key]: EMPTY_ORDER_DRAFT }, "h1"));
    }
  });
});

describe("variantInitialDraft", () => {
  it("opens D as it opens C", () => {
    assert.deepEqual(
      variantInitialDraft("option-d", heard, appearances),
      variantInitialDraft("proceedings", heard, appearances),
    );
    assert.deepEqual(
      variantInitialDraft("option-d", cognizanceDraft),
      variantInitialDraft("proceedings", cognizanceDraft),
    );
  });

  it("hands A the door's draft as it is", () => {
    assert.equal(variantInitialDraft("blocks", heard, appearances), heard);
    assert.equal(
      variantInitialDraft("blocks", cognizanceDraft),
      cognizanceDraft,
    );
  });

  it("writes B's text from the blocks, with the roll and posting on a hearing", () => {
    const draft = variantInitialDraft("text", heard, appearances);
    assert.deepEqual(draft.blocks, heard.blocks);
    const text = draft.body?.text ?? "";
    for (const block of heard.blocks) {
      if (block.text) assert.ok(text.includes(block.text.split("\n")[0]));
    }
    assert.match(text, /Present/);
    assert.match(text, /Next hearing/);
  });

  it("writes B's text without the roll or posting outside a hearing", () => {
    const draft = variantInitialDraft("text", cognizanceDraft);
    const text = draft.body?.text ?? "";
    assert.deepEqual(draft.body, bodyFromBlocks(cognizance.blocks));
    assert.doesNotMatch(text, /^Present/m);
    for (const block of cognizance.blocks) {
      assert.ok(text.includes(block.text.split("\n")[0]));
    }
  });

  it("leaves decision blocks out of C, and nothing else", () => {
    const draft = variantInitialDraft("proceedings", heard, appearances);
    assert.ok(
      heard.blocks.some(
        (block) => block.kind === "item" && block.applicationId,
      ),
      "the fixture opens with a decision",
    );
    assert.deepEqual(
      draft.blocks,
      heard.blocks.filter(
        (block) => !(block.kind === "item" && block.applicationId),
      ),
    );
    assert.deepEqual(draft.applications, heard.applications);
  });

  it("moves a scheduling item into C's next-hearing section, and keeps the rest", () => {
    /* C lists the next hearing in its own section, so a cognizance order's *Scheduling of
       hearing date* item becomes that section rather than a second place for the date. */
    const draft = variantInitialDraft("proceedings", cognizanceDraft);
    assert.ok(cognizance.blocks.some((block) => block.id === "scheduling-of-hearing"));
    assert.deepEqual(
      draft.blocks,
      cognizance.blocks.filter((block) => block.id !== "scheduling-of-hearing"),
    );
    assert.equal(draft.next, "list");
    for (const id of cognizance.fixedIds) {
      if (id === "scheduling-of-hearing") continue;
      assert.ok(draft.blocks.some((block) => block.id === id));
    }
  });
});

describe("variantDocument", () => {
  const paper = {
    caseNumber: hearing.caseNumber,
    matter: "M",
    day: today,
  };

  it("prints a hearing's A order as the hearing's order always printed", () => {
    const document = variantDocument("blocks", paper, heard, appearances);
    assert.deepEqual(
      document.paragraphs,
      hearingOrderDocument(hearing, heard, today).paragraphs,
    );
  });

  it("prints only the blocks outside a hearing", () => {
    const document = variantDocument(
      "blocks",
      { ...paper, caseNumber: late.caseNumber },
      cognizanceDraft,
    );
    assert.equal(document.paragraphs.length, cognizance.blocks.length);
    assert.doesNotMatch(document.paragraphs.join(" "), /^Present/);
  });

  it("prints B's text a paragraph a line", () => {
    const draft = {
      ...EMPTY_ORDER_DRAFT,
      body: { html: "", text: "One.\n\n Two. \n" },
    };
    assert.deepEqual(variantDocument("text", paper, draft).paragraphs, [
      "One.",
      "Two.",
    ]);
  });
});
