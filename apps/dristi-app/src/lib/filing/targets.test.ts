import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SCRUTINY_DEFECTS } from "@/lib/tasks/scrutiny-return";
import type { DefectTarget } from "@/lib/tasks/types";
import { blankCheque, blankComplainant, blankNotice, createBlankDraft } from "./blank";
import type { FilingDraft } from "./types";
import {
  TARGETABLE_FIELDS,
  TARGETABLE_STEPS,
  displayTargetValue,
  isTargetable,
  readTarget,
  targetControlKind,
  writeTarget,
} from "./targets";

const draft = () => createBlankDraft("d-test");

/** A draft with enough repeating records to hold this target — "Cheque 2" needs two. */
function draftWith(target: DefectTarget): FilingDraft {
  const d = draft();
  if (target.kind !== "field") return d;
  const wanted = (target.instance ?? 0) + 1;
  while (d.cheques.length < wanted) d.cheques.push(blankCheque());
  while (d.complainants.length < wanted) d.complainants.push(blankComplainant());
  while (d.notices.length < wanted) d.notices.push(blankNotice());
  return d;
}

/**
 * The trap this guards against: a defect whose target the form cannot render. It shows no
 * frame, so it can never be resolved, so the submit gate never opens — and nothing on the
 * screen says why. Every target the type admits has to reach a real place on the draft.
 */
describe("every target the type admits is a place the form can show", () => {
  it("reads and writes every listed field on a blank draft", () => {
    for (const step of TARGETABLE_STEPS) {
      for (const field of TARGETABLE_FIELDS[step]) {
        const target: DefectTarget = {
          kind: "field",
          step,
          instance: 0,
          field,
          label: field,
          sectionLabel: step,
        };
        const d = draft();
        assert.equal(
          typeof readTarget(d, target),
          "string",
          `${step} › ${field} does not resolve on the draft`
        );
        writeTarget(d, target, "corrected");
        assert.equal(readTarget(d, target), "corrected", `${step} › ${field} is not writable`);
      }
    }
  });

  it("admits no step without a row mapping", () => {
    assert.ok(TARGETABLE_STEPS.length > 0);
    for (const step of TARGETABLE_STEPS) {
      assert.ok(TARGETABLE_FIELDS[step].length > 0, `${step} lists no fields`);
    }
  });

  it("the seeded scrutiny return only points at targets the form can render", () => {
    for (const defect of SCRUTINY_DEFECTS) {
      assert.ok(
        isTargetable(defect.target),
        `defect ${defect.n} points at something the form cannot show`
      );
      if (defect.target.kind === "field") {
        assert.equal(
          typeof readTarget(draftWith(defect.target), defect.target),
          "string",
          `defect ${defect.n} does not resolve on a draft`
        );
      }
    }
  });

  it("rejects a field the form has not wired", () => {
    assert.equal(
      isTargetable({
        kind: "field",
        step: "cheque",
        field: "notAField",
        label: "x",
        sectionLabel: "x",
      }),
      false
    );
  });
});

describe("showing a target's value the way the form does", () => {
  it("formats amounts and dates, and leaves everything else alone", () => {
    const amount: DefectTarget = {
      kind: "field",
      step: "cheque",
      field: "amount",
      label: "Amount",
      sectionLabel: "Case details",
    };
    assert.equal(displayTargetValue(amount, "185000"), "₹1,85,000");
    assert.equal(displayTargetValue(amount, ""), "");

    const date: DefectTarget = { ...amount, field: "returnDate", label: "Return date" };
    assert.equal(displayTargetValue(date, "2026-03-15"), "15/03/2026");

    const code: DefectTarget = { ...amount, field: "ifsc", label: "IFSC code" };
    assert.equal(displayTargetValue(code, "KLGB0040213"), "KLGB0040213");
  });
});

describe("the control the inset offers for a corrected value", () => {
  it("matches the kind the flagged field itself uses", () => {
    const field = (step: "cheque" | "demand-notice", name: string): DefectTarget => ({
      kind: "field",
      step,
      field: name,
      label: name,
      sectionLabel: "Case details",
    });
    assert.equal(targetControlKind(field("cheque", "amount")), "amount");
    assert.equal(targetControlKind(field("cheque", "dateOnCheque")), "date");
    assert.equal(targetControlKind(field("demand-notice", "dispatchDate")), "date");
    assert.equal(targetControlKind(field("cheque", "ifsc")), "text");
  });

  it("a document has no value control — its inset holds the replacement instead", () => {
    assert.equal(
      targetControlKind({
        kind: "doc",
        step: "upload",
        slotKey: "n1ad",
        label: "AD card",
        sectionLabel: "Documents",
      }),
      "text"
    );
  });
});
