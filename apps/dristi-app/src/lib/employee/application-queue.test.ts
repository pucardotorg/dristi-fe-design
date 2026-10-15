import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  draftOrder,
  listForLater,
  onboard,
  pay,
  proceedToSign,
  setReviewDate,
  sign,
  signOrder,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";

import {
  applicationsIn,
  bandsOf,
  countIn,
  matchesQuery,
  objectionLine,
  queueOf,
  statusLine,
} from "./application-queue";

/* 2026-10-07 is a Wednesday. */
const TODAY = "2026-10-07";
const ADVOCATE = { side: "complainant", role: "advocate" } as const;

function filed(id: string, on: string): LifecycleApplication {
  let app: LifecycleApplication = {
    id,
    caseId: "c-1001",
    type: "withdrawal",
    typeLabel: "Case withdrawal",
    side: "complainant",
    status: "draft",
    createdBy: "advocate",
    createdByName: "Adv. Anjali Nair",
    onBehalfOf: "Sunil Varghese",
    createdOn: on,
    updatedOn: on,
    form: {},
    documents: [],
    history: [],
  };
  app = proceedToSign(app, on);
  app = sign(app, ADVOCATE, "Adv. Anjali Nair", on);
  return pay(app, ADVOCATE, `TMP-${id}`, on);
}

describe("where an application stands", () => {
  it("is To onboard while its review is due, and Upcoming once deferred", () => {
    const fresh = filed("a", "2026-10-06");
    assert.equal(queueOf(fresh, TODAY), "onboard");
    const deferred = setReviewDate(fresh, "magistrate", "2026-10-14", TODAY);
    assert.equal(queueOf(deferred, TODAY), "later");
    assert.equal(queueOf(deferred, "2026-10-14"), "onboard");
  });

  it("is To decide on its listed day and Upcoming before it", () => {
    const listed = onboard(
      filed("b", "2026-10-05"),
      "magistrate",
      "CMP/1/2026",
      { mode: "date", decideOn: "2026-10-21", inviteObjections: true },
      TODAY,
    );
    assert.equal(queueOf(listed, TODAY), "later");
    assert.equal(queueOf(listed, "2026-10-21"), "decide");
    const now = onboard(filed("c", "2026-10-05"), "magistrate", "CMP/2/2026", { mode: "now" }, TODAY);
    assert.equal(queueOf(now, TODAY), "decide");
    assert.equal(queueOf(listForLater(now, "magistrate", "2026-10-21", false, TODAY), TODAY), "later");
  });

  it("leaves the working lists while its order waits for signature", () => {
    const now = onboard(filed("d", "2026-10-05"), "magistrate", "CMP/3/2026", { mode: "now" }, TODAY);
    const drafted = draftOrder(now, "bench-clerk", { kind: "accept", text: "Allowed." }, TODAY);
    assert.equal(queueOf(drafted, TODAY), "signing");
    assert.equal(countIn([drafted], "decide", TODAY), 0);
    assert.equal(countIn([drafted], "all", TODAY), 1);
  });

  it("closes on the signed order and moves to the archive after 30 days", () => {
    const now = onboard(filed("e", "2026-08-01"), "magistrate", "CMP/4/2026", { mode: "now" }, "2026-08-03");
    const drafted = draftOrder(now, "magistrate", { kind: "reject", text: "Rejected." }, "2026-08-03");
    const signed = signOrder(drafted, "magistrate", "ORD/1", "2026-08-03");
    assert.equal(queueOf(signed, "2026-08-20"), "closed");
    assert.equal(queueOf(signed, TODAY), "archive");
  });
});

describe("the lists", () => {
  const due = filed("due", "2026-10-02");
  const fresh = filed("fresh", "2026-10-06");
  const later = setReviewDate(filed("later", "2026-10-05"), "magistrate", "2026-10-12", TODAY);
  const decide = onboard(filed("decide", "2026-10-01"), "magistrate", "CMP/9/2026", { mode: "now" }, "2026-10-05");
  const all = [later, fresh, decide, due];

  it("groups All by band, soonest due first inside each", () => {
    const rows = applicationsIn(all, "all", TODAY);
    assert.deepEqual(rows.map((app) => app.id), ["due", "fresh", "decide", "later"]);
    assert.deepEqual(bandsOf(rows, TODAY).map((band) => band.id), ["onboard", "decide", "later"]);
  });

  it("counts only what the view holds", () => {
    assert.equal(countIn(all, "onboard", TODAY), 2);
    assert.equal(countIn(all, "decide", TODAY), 1);
    assert.equal(countIn(all, "later", TODAY), 1);
  });

  it("searches the type, the parties and both numbers", () => {
    assert.ok(matchesQuery(due, "withdrawal"));
    assert.ok(matchesQuery(due, "TMP-due"));
    assert.ok(!matchesQuery(due, "postpone"));
  });
});

describe("what a row says", () => {
  it("says overdue, deferred and listed in words", () => {
    const overdue = filed("x", "2026-10-01");
    assert.deepEqual(statusLine(overdue, TODAY), {
      word: "Awaiting onboarding",
      detail: "Due 2 Oct",
      due: "overdue",
    });
    const deferred = setReviewDate(filed("y", "2026-10-05"), "magistrate", "2026-10-12", TODAY);
    assert.equal(statusLine(deferred, TODAY).word, "Review deferred to 12 Oct");
  });

  it("states the objection the way the bench reads it", () => {
    const invited = onboard(
      filed("z", "2026-10-05"),
      "magistrate",
      "CMP/5/2026",
      { mode: "date", decideOn: "2026-10-21", inviteObjections: true },
      TODAY,
    );
    assert.equal(objectionLine(invited, TODAY), "Objection due by 20 Oct");
    assert.equal(objectionLine(invited, "2026-10-21"), "No objection received");
    assert.equal(objectionLine({ ...invited, objectionId: "o" }, TODAY), "Objection received");
    const now = onboard(filed("w", "2026-10-05"), "magistrate", "CMP/6/2026", { mode: "now" }, TODAY);
    assert.equal(objectionLine(now, TODAY), "No objection called for");
  });
});
