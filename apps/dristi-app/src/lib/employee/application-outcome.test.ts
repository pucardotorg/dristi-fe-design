import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applicationOutcomeGaps,
  applicationWorkflow,
  initialApplicationOutcome,
  setApplicationOutcome,
} from "./application-outcome";

describe("the Application item", () => {
  it("opens on onboard yes, with the decision question to answer", () => {
    const outcome = initialApplicationOutcome();
    assert.equal(outcome.onboard, "yes");
    assert.deepEqual(applicationOutcomeGaps(outcome, false), [
      "Decision passed",
    ]);
  });

  it("asks what was decided, and the workflow only when the type has one", () => {
    const decided = setApplicationOutcome(initialApplicationOutcome(), {
      decided: "yes",
    });
    assert.deepEqual(applicationOutcomeGaps(decided, false), ["Decision"]);
    assert.deepEqual(applicationOutcomeGaps(decided, true), [
      "Decision",
      "Workflow triggered",
    ]);
  });

  it("asks for a response date and a date to bring it forward when nothing was decided", () => {
    const open = setApplicationOutcome(initialApplicationOutcome(), {
      decided: "no",
      responseNeeded: "yes",
    });
    assert.deepEqual(applicationOutcomeGaps(open, false), [
      "Respond by",
      "Bring forward on",
    ]);
    const noResponse = setApplicationOutcome(open, { responseNeeded: "no" });
    assert.deepEqual(applicationOutcomeGaps(noResponse, false), [
      "Bring forward on",
    ]);
  });

  it("clears the answers a changed question hides", () => {
    const decided = setApplicationOutcome(initialApplicationOutcome(), {
      decided: "yes",
      decision: "allowed",
      workflowTriggered: "yes",
    });
    const undecided = setApplicationOutcome(decided, { decided: "no" });
    assert.equal(undecided.decision, "");
    assert.equal(undecided.workflowTriggered, "");
  });

  it("knows Postpone's workflow, and gives every other type one for now", () => {
    assert.equal(applicationWorkflow("postpone"), "Rescheduling of hearing");
    assert.equal(
      applicationWorkflow("reopen-evidence"),
      "The application's own workflow",
    );
  });
});
