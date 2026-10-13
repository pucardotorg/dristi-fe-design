import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { at, junior, kase, makeTask, otherCase, outsider, PEOPLE, senior, senior2 } from "./fixtures";
import { dueCueOf, outcomeOf, secondLineOf, viewOnlyLineOf, waitingOnOf } from "./format";
import {
  advocatesOf,
  canArchive,
  canComplete,
  canMarkDone,
  canView,
  canViewTask,
  categoryOf,
  isBinding,
  verbFor,
  viewOf,
  whoCanActOn,
} from "./permissions";
import type { TaskStatus, TaskView } from "./types";

describe("whoCanActOn — what the Who can act column shows", () => {
  const names = (t: Parameters<typeof whoCanActOn>[0]) =>
    whoCanActOn(t, kase, PEOPLE).map((p) => p.name);

  it("a signing task: the vakalatnama holders, not everyone on the case", () => {
    assert.deepEqual(names(makeTask({ kind: "sign", dueAt: at(1) })), ["Anjali Nair", "R. Manoj"]);
  });

  it("a courtroom task: everyone on the case, because anyone can mark it done", () => {
    assert.deepEqual(names(makeTask({ kind: "hearing", dueAt: at(2), hearingAt: at(2) })), [
      "Anjali Nair",
      "R. Manoj",
      "S. Prakash",
    ]);
  });

  it("nobody, once it is closed or with the court", () => {
    assert.deepEqual(names(makeTask({ kind: "pay", status: "done", completion: { at: at(-1), how: "event" } })), []);
    assert.deepEqual(names(makeTask({ kind: "file", status: "awaiting-court", dueAt: at(-1) })), []);
  });
});

describe("isBinding — whether the deadline still binds", () => {
  it("open work binds; closed, archived and waiting-on-others work does not", () => {
    assert.equal(isBinding(makeTask({ status: "open" })), true);
    assert.equal(isBinding(makeTask({ status: "draft" })), true);
    assert.equal(isBinding(makeTask({ status: "done" })), false);
    assert.equal(isBinding(makeTask({ status: "expired" })), false);
    assert.equal(isBinding(makeTask({ status: "archived" })), false);
    assert.equal(isBinding(makeTask({ status: "awaiting-court" })), false);
    assert.equal(isBinding(makeTask({ status: "payment-confirming" })), false);
  });
});

describe("canView / canComplete", () => {
  it("signatories and juniors on the case can view; only signatories complete", () => {
    assert.equal(canView(senior, kase), true);
    assert.equal(canView(junior, kase), true);
    assert.equal(canView(outsider, kase), false);
    assert.equal(canComplete(senior, kase), true);
    assert.equal(canComplete(senior2, kase), true);
    assert.equal(canComplete(junior, kase), false);
  });

  it("visibility 'actors' hides completing kinds from non-actors; 'case' is the default", () => {
    const signTask = makeTask({ kind: "sign", visibility: "actors" });
    assert.equal(canViewTask(senior, signTask, kase), true);
    assert.equal(canViewTask(junior, signTask, kase), false);
    assert.equal(canViewTask(outsider, signTask, kase), false);
    // Default and explicit "case": everyone on the case's side sees it.
    assert.equal(canViewTask(junior, makeTask({ kind: "sign" }), kase), true);
    assert.equal(canViewTask(junior, makeTask({ kind: "sign", visibility: "case" }), kase), true);
    // Kinds everyone acts on stay visible to everyone on the case.
    assert.equal(canViewTask(junior, makeTask({ kind: "hearing", visibility: "actors" }), kase), true);
    assert.equal(
      canViewTask(
        junior,
        makeTask({ kind: "file", status: "draft", visibility: "actors", draft: { by: junior.id, savedAt: at(-1) } }),
        kase
      ),
      true
    );
  });

  it("advocatesOf lists the main advocate first, then the rest", () => {
    assert.deepEqual(
      advocatesOf(kase, PEOPLE).map((p) => p.id),
      [senior.id, senior2.id, junior.id]
    );
  });
});

describe("viewOf — viewer-dependent tabs", () => {
  it("statuses that read the same from every chair", () => {
    const cases: [TaskStatus, TaskView][] = [
      ["awaiting-court", "waiting"],
      ["payment-confirming", "waiting"],
      ["done", "completed"],
      ["expired", "completed"],
      ["obsolete", "completed"],
      ["archived", "archived"],
    ];
    for (const [status, view] of cases) {
      assert.equal(viewOf(makeTask({ status }), senior, kase), view);
      assert.equal(viewOf(makeTask({ status }), junior, kase), view);
    }
  });

  it("open and ready items of completing kinds: Needs action for a signatory, Waiting for a junior", () => {
    for (const status of ["open", "ready"] as TaskStatus[]) {
      for (const kind of ["sign", "pay", "file", "returned"] as const) {
        const t = makeTask({ kind, status });
        assert.equal(viewOf(t, senior, kase), "needs-action");
        assert.equal(viewOf(t, senior2, kase), "needs-action");
        assert.equal(viewOf(t, junior, kase), "waiting");
      }
    }
  });

  it("review tasks: Respond for the addressee, Waiting for everyone else", () => {
    const t = makeTask({ kind: "review", review: { requestedBy: senior2.id, of: senior.id } });
    assert.equal(verbFor(senior, t, kase), "Respond");
    assert.equal(viewOf(t, senior, kase), "needs-action");
    assert.equal(verbFor(senior2, t, kase), "View");
    assert.equal(viewOf(t, senior2, kase), "waiting");
    assert.equal(verbFor(junior, t, kase), "View");
    assert.equal(waitingOnOf(t, kase, PEOPLE), `${senior.name} — decision`);
    // Actors-only visibility narrows a review task to its addressee.
    const actorsOnly = { ...t, visibility: "actors" as const };
    assert.equal(canViewTask(senior, actorsOnly, kase), true);
    assert.equal(canViewTask(junior, actorsOnly, kase), false);
  });

  it("drafts and hearing tasks: Needs action for anyone on the case", () => {
    const draft = makeTask({ kind: "file", status: "draft", draft: { by: junior.id, savedAt: at(-1) } });
    assert.equal(viewOf(draft, junior, kase), "needs-action");
    assert.equal(viewOf(draft, senior, kase), "needs-action");
    const hearing = makeTask({ kind: "hearing" });
    assert.equal(viewOf(hearing, junior, kase), "needs-action");
    assert.equal(viewOf(hearing, senior, kase), "needs-action");
  });
});

describe("categoryOf", () => {
  /*
   * The cards name acts, not states (owner, 2026-08-24). Started work stays in the queue
   * for the act it still needs, so a half-written filing is *to file* and a return being
   * worked on is still *returned* — the card must not move under someone just because
   * they opened the task.
   */
  it("a task being worked on still counts under the act it needs", () => {
    assert.equal(categoryOf(makeTask({ kind: "file", status: "draft" })), "file");
    assert.equal(categoryOf(makeTask({ kind: "returned", status: "draft" })), "file");
    assert.equal(categoryOf(makeTask({ kind: "sign", status: "draft" })), "sign");
  });
  it("a draft-kind task is a filing at every stage", () => {
    assert.equal(categoryOf(makeTask({ kind: "draft", status: "draft" })), "file");
    assert.equal(categoryOf(makeTask({ kind: "draft", status: "ready" })), "file");
    assert.equal(categoryOf(makeTask({ kind: "draft", status: "awaiting-court" })), "file");
  });
  it("an archived task counts by its kind, like any other", () => {
    assert.equal(
      categoryOf(makeTask({ kind: "file", status: "archived", archived: { at: at(0), from: "draft" } })),
      "file"
    );
    assert.equal(
      categoryOf(makeTask({ kind: "sign", status: "archived", archived: { at: at(0), from: "open" } })),
      "sign"
    );
  });
  it("kinds fold into the PRD categories", () => {
    assert.equal(categoryOf(makeTask({ kind: "returned" })), "file");
    assert.equal(categoryOf(makeTask({ kind: "hearing" })), "others");
    assert.equal(categoryOf(makeTask({ kind: "review" })), "others");
  });
});

describe("verbFor", () => {
  it("signatory: the completing verb on open and ready items", () => {
    assert.equal(verbFor(senior, makeTask({ kind: "sign" }), kase), "Sign");
    assert.equal(verbFor(senior, makeTask({ kind: "pay", status: "ready" }), kase), "Pay");
    assert.equal(verbFor(senior2, makeTask({ kind: "file" }), kase), "File");
    assert.equal(verbFor(senior, makeTask({ kind: "returned" }), kase), "Re-file");
    assert.equal(verbFor(senior, makeTask({ kind: "draft", status: "ready" }), kase), "File");
  });

  it("on the case but not a signatory: a quiet View on open and ready items", () => {
    assert.equal(verbFor(junior, makeTask({ kind: "sign" }), kase), "View");
    assert.equal(verbFor(junior, makeTask({ kind: "pay", status: "ready" }), kase), "View");
  });

  it("anyone on the case: Continue on a draft", () => {
    assert.equal(verbFor(junior, makeTask({ kind: "file", status: "draft" }), kase), "Continue");
    assert.equal(verbFor(senior, makeTask({ kind: "file", status: "draft" }), kase), "Continue");
  });

  it("hearing tasks: Mark done for anyone on the case while open", () => {
    assert.equal(verbFor(junior, makeTask({ kind: "hearing" }), kase), "Mark done");
    assert.equal(verbFor(senior, makeTask({ kind: "hearing" }), kase), "Mark done");
  });

  it("archived tasks: Unarchive for anyone on the case", () => {
    const t = makeTask({ status: "archived", archived: { at: at(0), from: "open" } });
    assert.equal(verbFor(junior, t, kase), "Unarchive");
    assert.equal(verbFor(outsider, t, kase), "View");
  });

  it("not on the case, waiting, or closed: View", () => {
    assert.equal(verbFor(outsider, makeTask({ kind: "sign" }), kase), "View");
    assert.equal(verbFor(senior, makeTask({ status: "awaiting-court" }), kase), "View");
    assert.equal(verbFor(senior, makeTask({ status: "done" }), kase), "View");
    assert.equal(verbFor(outsider, makeTask({ caseId: otherCase.id }), otherCase), "Pay");
  });
});

describe("canMarkDone / canArchive — outside-the-system completion", () => {
  it("anyone on the case may mark any open-state task done by hand", () => {
    assert.equal(canMarkDone(junior, makeTask({ kind: "pay" }), kase), true);
    assert.equal(canMarkDone(junior, makeTask({ kind: "sign", status: "ready" }), kase), true);
    assert.equal(canMarkDone(senior, makeTask({ kind: "hearing", systemObservable: true }), kase), true);
    assert.equal(canMarkDone(outsider, makeTask({ kind: "pay" }), kase), false);
    assert.equal(canMarkDone(senior, makeTask({ status: "awaiting-court" }), kase), false);
    assert.equal(canMarkDone(senior, makeTask({ status: "done" }), kase), false);
  });

  it("anything not closed can be archived by anyone on the case", () => {
    assert.equal(canArchive(junior, makeTask({ kind: "pay" }), kase), true);
    assert.equal(canArchive(junior, makeTask({ status: "awaiting-court" }), kase), true);
    assert.equal(canArchive(senior, makeTask({ status: "done" }), kase), false);
    assert.equal(
      canArchive(senior, makeTask({ status: "archived", archived: { at: at(0), from: "open" } }), kase),
      false
    );
    assert.equal(canArchive(outsider, makeTask({ kind: "pay" }), kase), false);
  });
});

describe("format — fixed vocabulary", () => {
  const NOW = "2026-08-18T12:00:00.000Z";

  it("due cues: relative primary + absolute caption while the deadline binds", () => {
    assert.deepEqual(dueCueOf(makeTask({ dueAt: at(-3) }), NOW), {
      primary: "3 days overdue",
      date: "15 Aug",
      overdue: true,
    });
    assert.deepEqual(dueCueOf(makeTask({ dueAt: at(0) }), NOW), {
      primary: "Due today",
      date: "18 Aug",
      overdue: false,
    });
    assert.deepEqual(dueCueOf(makeTask({ dueAt: at(4) }), NOW), {
      primary: "Due in 4 days",
      date: "22 Aug",
      overdue: false,
    });
    assert.deepEqual(dueCueOf(makeTask({ hearingAt: at(2, 5), dueAt: at(2, 5) }), NOW), {
      primary: "Before hearing in 2 days",
      date: "20 Aug",
      overdue: false,
    });
    assert.deepEqual(dueCueOf(makeTask({ dueKind: "none" }), NOW), { primary: "No date", overdue: false });
  });

  it("settled tasks recall the absolute date, never ink", () => {
    const waiting = dueCueOf(makeTask({ dueAt: at(-3), status: "awaiting-court" }), NOW);
    assert.equal(waiting.overdue, false);
    assert.equal(waiting.primary, "Due 15 Aug");
    assert.equal(waiting.date, undefined);
    const archived = dueCueOf(
      makeTask({ dueAt: at(-3), status: "archived", archived: { at: at(0), from: "open" } }),
      NOW
    );
    assert.equal(archived.overdue, false);
  });

  it("waiting-on: one phrase naming the wait", () => {
    assert.equal(waitingOnOf(makeTask({ status: "awaiting-court" }), kase, PEOPLE), "The court — scrutiny");
    assert.equal(waitingOnOf(makeTask({ status: "payment-confirming" }), kase, PEOPLE), "Payment confirming");
    assert.equal(waitingOnOf(makeTask({ kind: "sign" }), kase, PEOPLE), "Anjali Nair — signature");
    assert.equal(waitingOnOf(makeTask({ kind: "pay", status: "ready" }), kase, PEOPLE), "Anjali Nair — payment");
  });

  it("outcomes on Completed and Archived rows", () => {
    assert.match(outcomeOf(makeTask({ status: "done", completion: { at: at(-2), how: "event" } })), /^Done \d+ \w+$/);
    assert.equal(
      outcomeOf(makeTask({ status: "expired", statusNote: "cure window lapsed" })),
      "Expired — cure window lapsed"
    );
    assert.equal(
      outcomeOf(makeTask({ status: "obsolete", statusNote: "order withdrawn" })),
      "No longer needed — order withdrawn"
    );
    assert.match(
      outcomeOf(makeTask({ status: "archived", archived: { at: at(-1), from: "open" } })),
      /^Archived \d+ \w+$/
    );
  });

  it("second lines: the status note, or who holds the draft", () => {
    assert.equal(
      secondLineOf(makeTask({ status: "draft", draft: { by: junior.id, savedAt: at(0) } }), senior, PEOPLE),
      "Draft · S. Prakash"
    );
    assert.equal(
      secondLineOf(makeTask({ status: "draft", draft: { by: junior.id, savedAt: at(0) } }), junior, PEOPLE),
      "Draft · you"
    );
    assert.equal(
      secondLineOf(makeTask({ statusNote: "Payment failed — try again" }), senior, PEOPLE),
      "Payment failed — try again"
    );
    assert.equal(secondLineOf(makeTask({}), senior, PEOPLE), undefined);
  });

  it("the view-only line names every vakalatnama holder", () => {
    assert.equal(viewOnlyLineOf(kase, PEOPLE), "You can view this task. Anjali Nair and R. Manoj hold the vakalatnama.");
    assert.equal(viewOnlyLineOf(otherCase, PEOPLE), "You can view this task. Deepa Varghese holds the vakalatnama.");
  });
});
