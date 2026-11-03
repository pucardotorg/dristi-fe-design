import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LifecycleApplication } from "@/lib/applications/lifecycle";

import {
  applicationIdOfOrderKey,
  nextApplicationOrderKey,
} from "./application-order-draft";
import {
  initialApplicationOutcome,
  setApplicationOutcome,
  type ApplicationOutcome,
} from "./application-outcome";
import { applyApplicationOutcome } from "./application-outcome-steps";

const ON = "2026-10-21";

function app(patch: Partial<LifecycleApplication> = {}): LifecycleApplication {
  return {
    id: "app-1",
    caseId: "c-1",
    type: "postpone",
    typeLabel: "Postpone",
    side: "complainant",
    status: "pending-review",
    createdBy: "advocate",
    createdByName: "Adv. A",
    onBehalfOf: "A",
    createdOn: "2026-10-18",
    updatedOn: "2026-10-18",
    review: { defaultDueOn: "2026-10-19", dueOn: "2026-10-19" },
    form: null,
    documents: [],
    history: [],
    ...patch,
  };
}

function answers(change: Partial<ApplicationOutcome>): ApplicationOutcome {
  return setApplicationOutcome(initialApplicationOutcome(), change);
}

const order = (key = "application:app-1") => ({
  key,
  id: "ORD-1",
  title: "Order",
  text: "Ordered.",
  signedOn: ON,
});

const options = { allotNumber: () => "CMP/1/2026", workflow: "Rescheduling of hearing" };

describe("an application's order, once triggered", () => {
  it("onboards and lists it, calling for a response by the date given", () => {
    const next = applyApplicationOutcome(
      app(),
      answers({
        decided: "no",
        responseNeeded: "yes",
        respondBy: "2026-10-28",
        bringForwardOn: "2026-10-29",
      }),
      order(),
      options,
    );
    assert.ok(next);
    assert.equal(next.status, "pending-decision");
    assert.equal(next.applicationNumber, "CMP/1/2026");
    assert.deepEqual(next.decide, { dueOn: "2026-10-29", mode: "date" });
    assert.equal(next.objectionDueBy, "2026-10-28");
    assert.equal(next.review, undefined);
    assert.equal(next.orders?.length, 1);
  });

  it("onboards and decides it in one order", () => {
    const next = applyApplicationOutcome(
      app(),
      answers({ decided: "yes", decision: "partly-allowed", workflowTriggered: "yes" }),
      order(),
      { ...options, hearingOn: "2026-11-02" },
    );
    assert.equal(next?.status, "accepted");
    assert.equal(next?.decisionLabel, "Partly allowed");
    assert.equal(next?.applicationNumber, "CMP/1/2026");
    assert.match(next?.workflowResult ?? "", /Rescheduling of hearing/);
  });

  it("dismisses it when it is not onboarded and a decision was passed", () => {
    const next = applyApplicationOutcome(
      app(),
      answers({ onboard: "no", decided: "yes", decision: "disallowed", workflowTriggered: "no" }),
      order(),
      options,
    );
    assert.equal(next?.status, "dismissed");
    assert.equal(next?.applicationNumber, undefined);
  });

  it("brings the review back on the date when it is neither onboarded nor decided", () => {
    const next = applyApplicationOutcome(
      app(),
      answers({ onboard: "no", decided: "no", responseNeeded: "no", bringForwardOn: "2026-10-30" }),
      order(),
      options,
    );
    assert.equal(next?.status, "pending-review");
    assert.equal(next?.review?.dueOn, "2026-10-30");
  });

  it("decides one already onboarded, without numbering it again", () => {
    const listed = app({
      status: "pending-decision",
      applicationNumber: "CMP/9/2026",
      review: undefined,
      decide: { dueOn: ON, mode: "date" },
    });
    const next = applyApplicationOutcome(
      listed,
      answers({ onboard: "no", decided: "yes", decision: "disallowed-with-cost", workflowTriggered: "no" }),
      order(),
      options,
    );
    assert.equal(next?.status, "rejected");
    assert.equal(next?.applicationNumber, "CMP/9/2026");
  });

  it("does nothing twice, or while the item is unanswered", () => {
    const done = applyApplicationOutcome(
      app(),
      answers({ decided: "no", responseNeeded: "no", bringForwardOn: "2026-10-29" }),
      order(),
      options,
    );
    assert.ok(done);
    assert.equal(
      applyApplicationOutcome(done, answers({ decided: "yes", decision: "allowed" }), order(), options),
      null,
    );
    assert.equal(applyApplicationOutcome(app(), initialApplicationOutcome(), order(), options), null);
  });
});

describe("order keys on an application", () => {
  it("keeps the plain key for the first order and numbers the rest", () => {
    assert.equal(nextApplicationOrderKey({ id: "app-1" }), "application:app-1");
    const second = nextApplicationOrderKey({
      id: "app-1",
      orders: [{ ...order(), summary: "" }],
    });
    assert.equal(second, "application:app-1#2");
    assert.equal(applicationIdOfOrderKey(second), "app-1");
    assert.equal(applicationIdOfOrderKey("hearing-1"), null);
  });
});
