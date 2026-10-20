import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COGNIZANCE_QUEUE, hasDelay } from "./cognizance";
import { cognizanceComposition } from "./cognizance-order";
import { CAUSE_LIST } from "./hearings";
import { applicationsForListing } from "./listing-applications";
import { composerContextFor } from "./order-context";
import { initialOrderDraft } from "./order-demo";
import { orderDraftKey, orderInitialDraft } from "./order-door";
import { EMPTY_ORDER_DRAFT } from "./order-draft";
import { hasDraftFor } from "./order-drafts";

const today = "2026-09-07";
/* A finished listing with applications on it, so its opening draft carries decisions. */
const hearing =
  CAUSE_LIST.find((entry) => applicationsForListing(entry.id).length > 0) ??
  CAUSE_LIST[0];
const heard = initialOrderDraft(hearing, "completed", today);

const late = COGNIZANCE_QUEUE.find(hasDelay) ?? COGNIZANCE_QUEUE[0];
const lateContext = composerContextFor({ ...late, stage: "cognizance" });
const cognizance = cognizanceComposition(late, "cognizance", lateContext);
const cognizanceDraft = { ...EMPTY_ORDER_DRAFT, blocks: cognizance.blocks };

describe("orderDraftKey", () => {
  it("keeps the key the order screen has always used, and the queue sees it", () => {
    assert.equal(orderDraftKey("h1"), "editor:h1");
    assert.equal(
      orderDraftKey("cognizance:c1:notice"),
      "editor:cognizance:c1:notice",
    );
    assert.ok(hasDraftFor({ [orderDraftKey("h1")]: EMPTY_ORDER_DRAFT }, "h1"));
  });
});

describe("orderInitialDraft", () => {
  it("opens with empty text, the door's items in its workflow, and the date asked once", () => {
    const draft = orderInitialDraft(cognizanceDraft);
    assert.equal(draft.body?.text, "");
    assert.ok(cognizance.blocks.some((block) => block.id === "scheduling-of-hearing"));
    assert.deepEqual(
      draft.blocks,
      cognizance.blocks.filter((block) => block.id !== "scheduling-of-hearing"),
    );
    assert.equal(draft.next, "list");
  });

  it("keeps an application's decision as an item", () => {
    const draft = orderInitialDraft(heard);
    assert.ok(
      draft.blocks.some((block) => block.kind === "item" && block.applicationId),
    );
  });
});
