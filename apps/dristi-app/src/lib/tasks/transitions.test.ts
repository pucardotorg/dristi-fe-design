import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { at, junior, kase, makeDefect, makeTask, NOW, outsider, PEOPLE, senior, senior2 } from "./fixtures";
import { verbFor, viewOf } from "./permissions";
import {
  archive,
  confirmPayment,
  courtAccepted,
  courtReturned,
  type Ctx,
  expire,
  file,
  resolveDefect,
  markDone,
  markReady,
  obsolete,
  recordPayment,
  redate,
  refile,
  respond,
  saveDraft,
  sign,
  TransitionError,
  unarchive,
} from "./transitions";
import type { Task, TaskStatus } from "./types";

const ctx = (actor = senior): Ctx => ({ actor, kase, now: NOW, people: PEOPLE });

const ALL: TaskStatus[] = ["open", "draft", "ready", "awaiting-court", "payment-confirming", "done", "expired", "obsolete", "archived"];

function throwsCode(fn: () => unknown, code: TransitionError["code"]) {
  assert.throws(fn, (e: unknown) => e instanceof TransitionError && e.code === code);
}

describe("drafts and ready (anyone on the case)", () => {
  it("a junior saves a draft from open; the task is theirs and stays Open", () => {
    const t = saveDraft(makeTask({ kind: "file" }), ctx(junior), "Paras 1–4 done");
    assert.equal(t.status, "draft");
    assert.equal(t.draft?.by, junior.id);
    assert.equal(t.draft?.note, "Paras 1–4 done");
    assert.equal(viewOf(t, junior, kase), "needs-action");
    assert.equal(verbFor(senior, t, kase), "Continue");
    assert.match(t.history.at(-1)!.text, /saved a draft/);
  });

  it("a junior marks it ready; the status note names them and the signatory's verb is the completing one", () => {
    const draft = saveDraft(makeTask({ kind: "sign" }), ctx(junior));
    const ready = markReady(draft, ctx(junior), "Ready for your signature");
    assert.equal(ready.status, "ready");
    assert.equal(ready.prepared?.by, junior.id);
    assert.equal(ready.statusNote, "Prepared by S. Prakash");
    assert.equal(verbFor(senior, ready, kase), "Sign");
    assert.equal(verbFor(junior, ready, kase), "View");
  });

  it("ready → saveDraft goes back to draft (rework)", () => {
    const ready = markReady(makeTask({ kind: "file" }), ctx(junior));
    const back = saveDraft(ready, ctx(junior));
    assert.equal(back.status, "draft");
    assert.equal(back.prepared, undefined);
  });

  it("an outsider may not draft; a hearing task cannot be drafted", () => {
    throwsCode(() => saveDraft(makeTask({ kind: "file" }), ctx(outsider)), "forbidden");
    throwsCode(() => saveDraft(makeTask({ kind: "hearing" }), ctx(senior)), "invalid");
    throwsCode(() => markReady(makeTask({ kind: "file", status: "ready" }), ctx(junior)), "illegal-state");
  });
});

describe("completing (signatories only)", () => {
  it("a non-signatory cannot sign, pay or file", () => {
    throwsCode(() => sign(makeTask({ kind: "sign" }), ctx(junior)), "forbidden");
    throwsCode(() => recordPayment(makeTask({ kind: "pay" }), ctx(junior), "success"), "forbidden");
    throwsCode(() => file(makeTask({ kind: "file" }), ctx(junior)), "forbidden");
    throwsCode(() => refile(makeTask({ kind: "returned" }), ctx(junior)), "forbidden");
  });

  it("sign closes by event with a receipt", () => {
    const t = sign(makeTask({ kind: "sign" }), ctx());
    assert.equal(t.status, "done");
    assert.equal(t.completion?.how, "event");
    assert.match(t.completion?.receipt ?? "", /^ESIGN-/);
    assert.match(t.history.at(-1)!.text, /^Anjali Nair signed/);
  });

  it("a signatory completing a ready item records who prepared it", () => {
    const ready = markReady(makeTask({ kind: "sign" }), ctx(junior), "note");
    const t = sign(ready, ctx(senior2));
    assert.equal(t.status, "done");
    assert.match(t.history.at(-1)!.text, /^Completed by R\. Manoj — prepared by S\. Prakash/);
  });

  it("a signatory completing someone else's draft records the same", () => {
    const draft = saveDraft(makeTask({ kind: "file" }), ctx(junior));
    const t = file(draft, ctx(senior));
    assert.equal(t.status, "awaiting-court");
    assert.match(t.history.at(-1)!.text, /Completed by Anjali Nair — prepared by S\. Prakash/);
  });

  it("a signatory completing their own draft does not say 'prepared by'", () => {
    const draft = saveDraft(makeTask({ kind: "file" }), ctx(senior));
    const t = file(draft, ctx(senior));
    assert.doesNotMatch(t.history.at(-1)!.text, /prepared by/);
  });

  it("payment: success closes, pending waits, failure keeps the state and says why", () => {
    const base = makeTask({ kind: "pay", amountPaise: 200 });
    assert.equal(recordPayment(base, ctx(), "success").status, "done");
    const pending = recordPayment(base, ctx(), "pending");
    assert.equal(pending.status, "payment-confirming");
    assert.equal(viewOf(pending, senior, kase), "waiting");
    const failed = recordPayment(base, ctx(), "failed");
    assert.equal(failed.status, "open");
    assert.equal(failed.statusNote, "Payment failed — try again");
    const failedReady = recordPayment(markReady(base, ctx(junior)), ctx(), "failed");
    assert.equal(failedReady.status, "ready");
    const confirmed = confirmPayment(pending, ctx(junior));
    assert.equal(confirmed.status, "done");
    assert.equal(confirmed.completion?.by, senior.id);
  });

  it("refile needs every defect resolved; resolveDefect is preparation anyone on the case can do", () => {
    const returned = makeTask({
      kind: "returned",
      returned: {
        by: "scrutiny",
        at: at(-1),
        defects: [makeDefect({ n: 1 }), makeDefect({ n: 2 })],
      },
    });
    throwsCode(() => refile(returned, ctx()), "invalid");

    const one = resolveDefect(returned, ctx(junior), 1, { how: "edited", value: "KLGB0040213", at: at(0) });
    assert.equal(one.status, "draft");
    assert.equal(one.draft?.by, junior.id);
    // Defect 2 still open, so the corrections cannot go back yet.
    throwsCode(() => refile(one, ctx(senior)), "invalid");

    // Keeping the filed value is enough — no reason, no forced edit.
    const justified = resolveDefect(one, ctx(junior), 2, { how: "kept", value: "KLGB0040231", at: at(0) });
    const filed = refile(justified, ctx(senior));
    assert.equal(filed.status, "awaiting-court");
    assert.match(filed.history.at(-1)!.text, /prepared by S\. Prakash/);
  });

  it("resolveDefect refuses a defect number this return does not carry", () => {
    const returned = makeTask({
      kind: "returned",
      returned: { by: "scrutiny", at: at(-1), defects: [makeDefect({ n: 1 })] },
    });
    throwsCode(() => resolveDefect(returned, ctx(junior), 9, { how: "edited", value: "x", at: at(0) }), "invalid");
  });

  it("markDone: any open-state task, any kind, by anyone on the case — records the manual close", () => {
    const t = markDone(makeTask({ kind: "hearing" }), ctx(junior));
    assert.equal(t.status, "done");
    assert.equal(t.completion?.how, "manual");
    assert.match(t.history.at(-1)!.text, /completed outside DRISTI/);
    // A junior closes a payment made at the counter; a ready item closes too.
    assert.equal(markDone(makeTask({ kind: "pay" }), ctx(junior)).status, "done");
    assert.equal(markDone(makeTask({ kind: "sign", status: "ready" }), ctx()).status, "done");
    throwsCode(() => markDone(makeTask({ kind: "pay" }), ctx(outsider)), "forbidden");
    throwsCode(() => markDone(makeTask({ kind: "hearing", status: "done" }), ctx()), "illegal-state");
    throwsCode(() => markDone(makeTask({ status: "awaiting-court" }), ctx()), "illegal-state");
  });
});

describe("the court", () => {
  it("courtAccepted closes with an acknowledgement, credited to the filer", () => {
    const filed = file(makeTask({ kind: "file" }), ctx(senior));
    const t = courtAccepted(filed, ctx(junior));
    assert.equal(t.status, "done");
    assert.match(t.completion?.receipt ?? "", /^ACK-/);
    assert.equal(t.completion?.by, senior.id);
  });

  it("courtReturned supersedes the filing and creates a returned task with the defects", () => {
    const filed = file(makeTask({ kind: "file", title: "File the proof affidavit of the complainant", dueAt: at(2) }), ctx());
    const { task, created } = courtReturned(filed, ctx(junior), ["Not attested", "", "Annexure missing"]);
    assert.equal(task.status, "obsolete");
    assert.equal(viewOf(task, senior, kase), "completed");
    assert.equal(created.kind, "returned");
    assert.equal(created.status, "open");
    assert.equal(created.title, "Fix 2 defects and re-file the proof affidavit of the complainant");
    assert.deepEqual(created.returned?.defects.map((d) => d.note), ["Not attested", "Annexure missing"]);
    // Free text from the sandbox registry control has no field to point at, so the
    // remark stands against the filed bundle rather than guessing.
    assert.deepEqual(created.returned?.defects.map((d) => d.target.kind), ["doc", "doc"]);
    assert.equal(created.dueAt, filed.dueAt);
    assert.equal(verbFor(senior, created, kase), "Re-file");
    assert.equal(verbFor(junior, created, kase), "View");
  });

  it("a returned draft complaint names the complaint", () => {
    const filed = file(makeTask({ kind: "draft", title: "Continue the draft complaint" }), ctx());
    const { created } = courtReturned(filed, ctx(), ["x"]);
    assert.equal(created.title, "Fix 1 defect and re-file the complaint");
  });

  it("courtReturned needs at least one defect and an awaiting-court task", () => {
    const filed = file(makeTask({ kind: "file" }), ctx());
    throwsCode(() => courtReturned(filed, ctx(), ["", " "]), "invalid");
    throwsCode(() => courtReturned(makeTask({ kind: "file" }), ctx(), ["x"]), "illegal-state");
  });
});

describe("responding (the addressee of a review task)", () => {
  const request = () =>
    makeTask({ kind: "review", review: { requestedBy: senior2.id, of: senior.id } });

  it("the addressee accepts; the decision and the closure are recorded", () => {
    const t = respond(request(), ctx(senior), true, "No objection");
    assert.equal(t.status, "done");
    assert.equal(t.review?.decision?.accepted, true);
    assert.equal(t.review?.decision?.note, "No objection");
    assert.equal(t.completion?.by, senior.id);
    assert.equal(t.completion?.how, "event");
    assert.match(t.history.at(-1)!.text, /accepted the request/);
  });

  it("declining closes it too — what happens next is the requester's move", () => {
    const t = respond(request(), ctx(senior), false);
    assert.equal(t.status, "done");
    assert.equal(t.review?.decision?.accepted, false);
    assert.match(t.history.at(-1)!.text, /declined the request/);
  });

  it("only the addressee responds; a review task is never drafted or prepared", () => {
    throwsCode(() => respond(request(), ctx(senior2), true), "forbidden");
    throwsCode(() => respond(request(), ctx(junior), true), "forbidden");
    throwsCode(() => respond(makeTask({ kind: "sign" }), ctx(senior), true), "invalid");
    throwsCode(() => saveDraft(request(), ctx(junior)), "invalid");
    throwsCode(() => markReady(request(), ctx(junior)), "invalid");
  });
});

describe("archiving", () => {
  it("archive keeps the state it left; unarchive restores it", () => {
    const t = archive(makeTask({ kind: "sign", status: "ready" }), ctx(junior));
    assert.equal(t.status, "archived");
    assert.equal(t.archived?.from, "ready");
    assert.equal(t.archived?.by, junior.id);
    assert.equal(viewOf(t, senior, kase), "archived");
    assert.equal(verbFor(senior, t, kase), "Unarchive");
    assert.match(t.history.at(-1)!.text, /archived this/);
    const back = unarchive(t, ctx(senior));
    assert.equal(back.status, "ready");
    assert.equal(back.archived, undefined);
    assert.match(back.history.at(-1)!.text, /restored this from the archive/);
  });

  it("any non-closed state can be archived — a filed task too", () => {
    assert.equal(archive(makeTask({ status: "awaiting-court" }), ctx()).archived?.from, "awaiting-court");
    assert.equal(archive(makeTask({ status: "draft", draft: { by: junior.id, savedAt: at(-1) } }), ctx()).status, "archived");
  });

  it("closed and already-archived tasks refuse; outsiders refuse", () => {
    throwsCode(() => archive(makeTask({ status: "done" }), ctx()), "illegal-state");
    throwsCode(() => archive(archive(makeTask(), ctx()), ctx()), "illegal-state");
    throwsCode(() => archive(makeTask(), ctx(outsider)), "forbidden");
    throwsCode(() => unarchive(makeTask(), ctx()), "illegal-state");
    throwsCode(() => unarchive(archive(makeTask(), ctx()), ctx(outsider)), "forbidden");
  });
});

describe("housekeeping", () => {
  it("redate keeps the old date and writes the status note", () => {
    const t = redate(makeTask({ dueAt: at(1), dueKind: "before-hearing" }), ctx(), at(4), "hearing adjourned");
    assert.equal(t.dueAt, at(4));
    assert.equal(t.redate?.from, at(1));
    assert.match(t.statusNote ?? "", /^Moved from .* — hearing adjourned$/);
  });

  it("expire and obsolete close with a reason; closed tasks cannot be touched again", () => {
    const e = expire(makeTask(), ctx(), "cure window lapsed");
    assert.equal(e.status, "expired");
    assert.equal(e.statusNote, "cure window lapsed");
    const o = obsolete(makeTask(), ctx(), "order withdrawn");
    assert.equal(o.status, "obsolete");
    throwsCode(() => obsolete(e, ctx(), "x"), "illegal-state");
    throwsCode(() => redate(o, ctx(), at(1), "x"), "illegal-state");
  });

  it("completing steps refuse every non-actionable state", () => {
    for (const status of ALL.filter((s) => !["open", "draft", "ready"].includes(s))) {
      const t: Task = makeTask({ kind: "sign", status });
      throwsCode(() => sign(t, ctx()), "illegal-state");
    }
  });
});
