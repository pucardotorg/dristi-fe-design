import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  courtTasks,
  decisionText,
  dismissalText,
  draftOrder,
  listForLater,
  moveDecisionDate,
  nextWorkingDay,
  objectionDeadline,
  objectionTaskOpen,
  onboard,
  pay,
  proceedToSign,
  setADateUsed,
  setReviewDate,
  sign,
  signOrder,
  suggestedDate,
  typeAvailable,
  visibleToSeat,
  type LifecycleApplication,
} from "./lifecycle";

const ADVOCATE = { side: "complainant", role: "advocate" } as const;
const CLERK = { side: "complainant", role: "clerk" } as const;
const LITIGANT = { side: "complainant", role: "litigant" } as const;
const OTHER_ADVOCATE = { side: "accused", role: "advocate" } as const;

/* 2026-10-01 is a Thursday. */
const THU = "2026-10-01";
const FRI = "2026-10-02";
const MON = "2026-10-05";

function draft(patch: Partial<LifecycleApplication> = {}): LifecycleApplication {
  return {
    id: "a-1",
    caseId: "c-1001",
    type: "withdrawal",
    typeLabel: "Withdrawal",
    side: "complainant",
    status: "draft",
    createdBy: "advocate",
    createdByName: "Anjali Nair",
    onBehalfOf: "Sunil Varghese",
    createdOn: THU,
    updatedOn: THU,
    form: {},
    documents: [],
    history: [],
    ...patch,
  };
}

function filed(on = THU): LifecycleApplication {
  const signed = sign(proceedToSign(draft(), on), ADVOCATE, "Anjali Nair", on);
  return pay(signed, LITIGANT, "TMP-1", on);
}

describe("working days and deadlines", () => {
  it("skips the weekend for the review due date", () => {
    assert.equal(nextWorkingDay(THU), FRI);
    assert.equal(nextWorkingDay(FRI), MON);
  });

  it("puts the objection deadline on the day before the decision", () => {
    assert.equal(objectionDeadline("2026-10-21"), "2026-10-20");
  });

  it("pre-fills only a next hearing that is still ahead", () => {
    assert.equal(suggestedDate("2026-10-20", THU), "2026-10-20");
    assert.equal(suggestedDate("2026-08-19", THU), undefined);
    assert.equal(suggestedDate(undefined, THU), undefined);
  });
});

describe("raising an application", () => {
  it("runs Draft → Pending signature → Pending payment → Pending review", () => {
    const app = filed();
    assert.equal(app.status, "pending-review");
    assert.equal(app.temporaryId, "TMP-1");
    assert.equal(app.submittedOn, THU);
    assert.deepEqual(app.review, { defaultDueOn: FRI, dueOn: FRI });
    assert.equal(app.raisedBy, "Anjali Nair");
    assert.equal(app.paidBy, "litigant");
  });

  it("does not let a clerk sign", () => {
    const pending = proceedToSign(draft(), THU);
    assert.throws(() => sign(pending, CLERK, "S. Prakash", THU));
  });

  it("ends an objection at Submitted, with no review task", () => {
    const objection = draft({ type: "objection", side: "accused" });
    const signed = sign(
      proceedToSign(objection, THU),
      OTHER_ADVOCATE,
      "P. Balachandran",
      THU,
    );
    const done = pay(signed, OTHER_ADVOCATE, "TMP-2", THU);
    assert.equal(done.status, "submitted");
    assert.equal(done.review, undefined);
  });
});

describe("taken up now, then listed after all", () => {
  const takenNow = () =>
    onboard(filed(), "magistrate", "CMP/402/2026", { mode: "now" }, FRI);

  it("keeps it onboarded and lists it, with or without an objection", () => {
    const listed = listForLater(takenNow(), "magistrate", "2026-10-21", true, FRI);
    assert.equal(listed.status, "pending-decision");
    assert.equal(listed.applicationNumber, "CMP/402/2026");
    assert.deepEqual(listed.decide, { dueOn: "2026-10-21", mode: "date" });
    assert.equal(listed.objectionsInvited, true);
    assert.equal(listed.objectionDueBy, "2026-10-20");

    const quiet = listForLater(takenNow(), "magistrate", "2026-10-21", false, FRI);
    assert.equal(quiet.objectionDueBy, undefined);
  });

  it("is the magistrate's or bench clerk's, needs a later date, and only applies to 'now'", () => {
    assert.throws(() => listForLater(takenNow(), "typist", "2026-10-21", true, FRI));
    assert.throws(() => listForLater(takenNow(), "magistrate", FRI, true, FRI));
    const listed = listForLater(takenNow(), "magistrate", "2026-10-21", true, FRI);
    assert.throws(() => listForLater(listed, "magistrate", "2026-10-23", true, FRI));
  });
});

describe("the first gate", () => {
  it("defers the review, magistrate or bench clerk only, and allows it again with a warning", () => {
    const app = filed();
    assert.throws(() => setReviewDate(app, "typist", "2026-10-09", THU));
    assert.ok(setADateUsed(setReviewDate(app, "bench-clerk", "2026-10-09", THU)));
    assert.equal(setADateUsed(app), false);
    const moved = setReviewDate(app, "magistrate", "2026-10-09", THU);
    assert.equal(moved.status, "pending-review");
    assert.ok(setADateUsed(moved));
    /* Product, 2026-10-08: a second deferral is warned about, not blocked. */
    const again = setReviewDate(moved, "magistrate", "2026-10-12", THU);
    assert.equal(again.review?.dueOn, "2026-10-12");
    assert.throws(() => setReviewDate(moved, "magistrate", THU, THU));
  });

  it("onboards with a decision date, inviting objections", () => {
    const app = onboard(
      filed(),
      "magistrate",
      "CMP/401/2026",
      { mode: "date", decideOn: "2026-10-21", inviteObjections: true },
      FRI,
    );
    assert.equal(app.status, "pending-decision");
    assert.equal(app.applicationNumber, "CMP/401/2026");
    assert.equal(app.onboardedOn, FRI);
    assert.equal(app.objectionDueBy, "2026-10-20");
    assert.ok(objectionTaskOpen(app));
    assert.deepEqual(app.decide, { dueOn: "2026-10-21", mode: "date" });
  });

  it("lets the bench clerk onboard, but not the typist or scrutiny officer", () => {
    const app = onboard(filed(), "bench-clerk", "CMP/1/2026", { mode: "now" }, FRI);
    assert.equal(app.status, "pending-decision");
    for (const seat of ["typist", "scrutiny-officer"] as const) {
      assert.throws(() => onboard(filed(), seat, "CMP/1/2026", { mode: "now" }, FRI));
    }
  });

  it("lets the bench clerk move the decision date and draft, but never sign", () => {
    const onboarded = onboard(filed(), "bench-clerk", "CMP/1/2026", { mode: "now" }, FRI);
    const moved = moveDecisionDate(onboarded, "bench-clerk", "2026-10-21", FRI);
    assert.equal(moved.decide?.dueOn, "2026-10-21");
    const drafted = draftOrder(moved, "bench-clerk", { kind: "reject", text: "x" }, FRI);
    assert.throws(() => signOrder(drafted, "bench-clerk", "O-1", FRI));
  });

  it("dismisses on the magistrate's signature, without a number", () => {
    const app = filed();
    const text = dismissalText(app, "1 Oct 2026");
    assert.ok(!text.includes("CMP"));
    const drafted = draftOrder(app, "typist", { kind: "dismiss", text }, FRI);
    assert.throws(() => signOrder(drafted, "typist", "O-1", FRI));
    const done = signOrder(drafted, "magistrate", "O-1", FRI);
    assert.equal(done.status, "dismissed");
    assert.equal(done.linkedOrder?.kind, "dismiss");
  });
});

describe("the second gate", () => {
  const onboarded = () =>
    onboard(
      filed(),
      "magistrate",
      "CMP/401/2026",
      { mode: "date", decideOn: "2026-10-21", inviteObjections: true },
      FRI,
    );

  it("moves the objection deadline with the decision date", () => {
    const moved = moveDecisionDate(onboarded(), "magistrate", "2026-10-28", FRI);
    assert.equal(moved.decide?.dueOn, "2026-10-28");
    assert.equal(moved.objectionDueBy, "2026-10-27");
  });

  it("accepts through a signed order and closes the decide task", () => {
    const app = onboarded();
    const text = decisionText(app, "accept");
    assert.equal(text, "Application CMP/401/2026 for Withdrawal is accepted.");
    const done = signOrder(
      draftOrder(app, "bench-clerk", { kind: "accept", text }, FRI),
      "magistrate",
      "O-2",
      FRI,
    );
    assert.equal(done.status, "accepted");
    assert.equal(done.decide, undefined);
    assert.deepEqual(courtTasks([done]), []);
  });

  it("asks for the new hearing date when accepting a postponement", () => {
    const app = { ...onboarded(), type: "postpone" };
    assert.throws(() =>
      draftOrder(app, "magistrate", { kind: "accept", text: "x" }, FRI),
    );
    const done = signOrder(
      draftOrder(
        app,
        "magistrate",
        { kind: "accept", text: "x", newHearingOn: "2026-11-02" },
        FRI,
      ),
      "magistrate",
      "O-3",
      FRI,
    );
    assert.equal(done.workflowResult, "Hearing rescheduled to 2026-11-02");
  });
});

describe("visibility", () => {
  it("hides an application from the other side until it is onboarded", () => {
    const app = filed();
    assert.ok(visibleToSeat(app, ADVOCATE));
    assert.ok(!visibleToSeat(app, OTHER_ADVOCATE));
    const on = onboard(app, "magistrate", "CMP/1/2026", { mode: "now" }, FRI);
    assert.ok(visibleToSeat(on, OTHER_ADVOCATE));
  });

  it("shows the litigant nothing until there is something to pay", () => {
    assert.ok(!visibleToSeat(draft(), LITIGANT));
    assert.ok(visibleToSeat(draft({ status: "pending-payment" }), LITIGANT));
  });
});

describe("availability", () => {
  it("follows each type's rule", () => {
    const complainant = { side: "complainant", hearingScheduled: false } as const;
    const accused = { side: "accused", hearingScheduled: true } as const;
    assert.ok(!typeAvailable("bail", complainant));
    assert.ok(typeAvailable("bail", accused));
    assert.ok(typeAvailable("condonation-of-delay", complainant));
    assert.ok(!typeAvailable("condonation-of-delay", accused));
    assert.ok(!typeAvailable("postpone", complainant));
    assert.ok(typeAvailable("postpone", accused));
    assert.ok(!typeAvailable("objection", accused));
    assert.ok(typeAvailable("withdrawal", complainant));
  });
});
