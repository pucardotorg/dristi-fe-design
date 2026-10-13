import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CAUSE_LIST, parseIsoDay } from "./hearings";
import { applicationsForListing } from "./listing-applications";
import { blockGaps } from "./order-composer";
import { composerContextFor } from "./order-context";
import { appearancesFor } from "./order-draft";
import { initialOrderDraft, nextSittingDay } from "./order-demo";

const today = "2026-09-07";
const hearing = CAUSE_LIST[0];

describe("initialOrderDraft", () => {
  it("leaves a listing that has not been heard empty", () => {
    for (const status of ["scheduled", "ongoing", "passed-over"] as const) {
      const draft = initialOrderDraft(hearing, status, today);
      assert.deepEqual(draft.blocks, []);
      assert.deepEqual(draft.marks, {});
      assert.equal(draft.nextDate, null);
    }
  });

  it("marks every appearance on the roll present", () => {
    const draft = initialOrderDraft(hearing, "completed", today);
    assert.deepEqual(
      Object.keys(draft.marks).sort(),
      appearancesFor(hearing).map((row) => row.id).sort(),
    );
  });

  it("decides every application that was pending, ahead of the directions", () => {
    const applications = applicationsForListing(hearing.id);
    assert.ok(applications.length > 0);
    const draft = initialOrderDraft(hearing, "completed", today);
    for (const application of applications) {
      assert.equal(draft.applications[application.id], "allowed");
    }
    const decided = draft.blocks.slice(0, applications.length);
    assert.ok(
      decided.every(
        (block) => block.kind === "item" && block.applicationId !== undefined,
      ),
    );
  });

  it("gives a cognizance listing the finding and the summons", () => {
    const row = CAUSE_LIST.find((entry) => entry.purpose === "cognizance");
    assert.ok(row);
    const draft = initialOrderDraft(row, "completed", today);
    assert.deepEqual(
      draft.blocks
        .filter((block) => block.kind === "item" && !block.applicationId)
        .map((block) => (block.kind === "item" ? block.type : "text")),
      ["cognizance", "issue-of-summons"],
    );
  });

  it("keeps block ids stable, so a block does not jump under the typist", () => {
    const first = initialOrderDraft(hearing, "completed", today);
    const second = initialOrderDraft(hearing, "completed", today);
    assert.deepEqual(
      first.blocks.map((block) => block.id),
      second.blocks.map((block) => block.id),
    );
  });

  it("posts a judgement listing to no next date", () => {
    const judgement = CAUSE_LIST.find((row) => row.purpose === "judgement");
    assert.ok(judgement);
    const draft = initialOrderDraft(judgement, "completed", today);
    assert.equal(draft.next, "none");
    assert.equal(draft.nextDate, null);
  });

  /* What a completed sitting opens on is a written order. Only a process item may still
     ask for something — its recipients follow the pre-selection rules, which leave the
     choice open once the accused has joined (`AUT-06`), and the party taking steps is
     worked out from the recipient (`AUT-02`). */
  it("opens with nothing to fill but an open process recipient", () => {
    for (const row of CAUSE_LIST) {
      const context = composerContextFor(row);
      const draft = initialOrderDraft(row, "completed", today);
      for (const block of draft.blocks) {
        const gaps = blockGaps(block, context).filter(
          (gap) => !gap.key.startsWith("recipients") && gap.key !== "steps",
        );
        assert.deepEqual(gaps, [], `${row.caseNumber} ${block.id}`);
      }
    }
  });
});

describe("nextSittingDay", () => {
  it("keeps the next date off a Saturday or a Sunday", () => {
    for (let offset = 0; offset < 14; offset += 1) {
      const from = `2026-09-${String(7 + offset).padStart(2, "0")}`;
      const day = parseIsoDay(nextSittingDay(from)).getDay();
      assert.ok(day !== 0 && day !== 6, `${from} landed on day ${day}`);
    }
  });

  it("counts the days from the day it is given", () => {
    assert.equal(nextSittingDay("2026-09-07", 7), "2026-09-14");
  });
});
