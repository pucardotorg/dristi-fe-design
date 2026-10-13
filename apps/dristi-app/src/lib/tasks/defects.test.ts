import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allResolved,
  breadcrumbOf,
  countResolved,
  defectState,
  firstUnresolved,
  intendedResolution,
  isResolved,
  resolutionLabel,
  resolutionSatisfies,
  sameResolution,
  targetKey,
  formOrder,
} from "./defects";
import { at, makeDefect, makeDocDefect } from "./fixtures";
import type { Defect } from "./types";

const AT = at(0);

describe("defect resolution — derived, never certified", () => {
  it("an untouched field is open, whatever an edit record says", () => {
    const d = makeDefect({ resolution: { how: "edited", value: "x", at: AT } });
    // The record claims an edit; the filing still holds what scrutiny saw.
    assert.equal(defectState(d, "KLGB0040231"), "open");
    assert.equal(isResolved(d, "KLGB0040231"), false);
  });

  it("a changed value resolves — no reason asked for", () => {
    const d = makeDefect();
    assert.equal(defectState(d, "KLGB0040213"), "resolved");
    assert.equal(resolutionLabel(d, "KLGB0040213"), "Corrected");
  });

  it("blank and whitespace read the same as the value at return", () => {
    const d = makeDefect({ valueAtReturn: "" });
    assert.equal(defectState(d, "   "), "open");
    assert.equal(defectState(d, "47"), "resolved");
  });

  it("keeping the filed value resolves it, with no reason (owner, 2026-10-08)", () => {
    const d = makeDefect();
    assert.equal(defectState(d, "KLGB0040231"), "open");

    const kept: Defect = { ...d, resolution: { how: "kept", value: "KLGB0040231", at: AT } };
    assert.equal(defectState(kept, "KLGB0040231"), "resolved");
    assert.equal(resolutionLabel(kept, "KLGB0040231"), "Kept as filed");
    assert.equal(resolutionSatisfies(kept), true);
  });

  it("a document defect resolves only on a replacement upload", () => {
    const d = makeDocDefect();
    assert.equal(defectState(d, "old-file-id"), "open");

    const replaced: Defect = {
      ...d,
      resolution: {
        how: "replaced",
        at: AT,
        replacement: { id: "f2", name: "ad-card.pdf", size: 10, type: "application/pdf", ext: "PDF" },
      },
    };
    assert.equal(defectState(replaced, "f2"), "resolved");
    assert.equal(resolutionLabel(replaced, "f2"), "Document replaced");

    // A "replaced" record with nothing attached is not a replacement.
    const empty: Defect = { ...d, resolution: { how: "replaced", at: AT } };
    assert.equal(defectState(empty, "f2"), "open");
  });
});

describe("resolutionSatisfies — the task-side half, with no draft in hand", () => {
  it("agrees with the screen on the cases the task can see", () => {
    assert.equal(resolutionSatisfies(makeDefect()), false);
    assert.equal(
      resolutionSatisfies(makeDefect({ resolution: { how: "edited", value: "x", at: AT } })),
      true
    );
    assert.equal(
      resolutionSatisfies(makeDefect({ resolution: { how: "kept", value: "x", at: AT } })),
      true
    );
  });
});

describe("what the record should say — written on commit, not per keystroke", () => {
  it("names the act: edited, kept, or nothing done", () => {
    const bare = makeDefect();
    assert.equal(intendedResolution(bare, "KLGB0040231", false, AT), undefined);
    assert.deepEqual(intendedResolution(bare, "KLGB0040213", false, AT), {
      how: "edited",
      value: "KLGB0040213",
      at: AT,
    });
    assert.deepEqual(intendedResolution(bare, "KLGB0040231", true, AT), {
      how: "kept",
      value: "KLGB0040231",
      at: AT,
    });
  });

  it("a changed value wins over an earlier keep", () => {
    assert.equal(intendedResolution(makeDefect(), "KLGB0040213", true, AT)?.how, "edited");
  });

  it("a document is answered by a new file, and by nothing else", () => {
    const d = makeDocDefect();
    assert.equal(intendedResolution(d, "old-file-id", true, AT), undefined);
    assert.equal(defectState(d, "old-file-id"), "open");
  });

  it("compares records on substance, so a re-run writes no second line", () => {
    const d = makeDefect();
    const first = intendedResolution(d, "KLGB0040213", false, at(0));
    const again = intendedResolution(d, "KLGB0040213", false, at(1));
    assert.equal(sameResolution(first, again), true);
    assert.equal(sameResolution(first, intendedResolution(d, "KLGB0040214", false, AT)), false);
    assert.equal(sameResolution(undefined, undefined), true);
    assert.equal(sameResolution(first, undefined), false);
  });
});

describe("counting the round", () => {
  const defects = [
    makeDefect({ n: 1, valueAtReturn: "a" }),
    makeDefect({ n: 2, valueAtReturn: "b" }),
    makeDefect({ n: 3, valueAtReturn: "c" }),
  ];
  const values: Record<number, string> = { 1: "changed", 2: "b", 3: "c" };
  const valueOf = (d: Defect) => values[d.n];

  it("counts only what is actually resolved", () => {
    assert.deepEqual(countResolved(defects, valueOf), { resolved: 1, total: 3 });
    assert.equal(allResolved(defects, valueOf), false);
    assert.equal(firstUnresolved(defects, valueOf)?.n, 2);
  });

  it("an empty return never counts as complete — there is nothing to submit", () => {
    assert.equal(allResolved([], valueOf), false);
  });

  it("all resolved opens the gate", () => {
    const done = (d: Defect) => `${values[d.n]}-fixed`;
    assert.equal(allResolved(defects, done), true);
    assert.equal(firstUnresolved(defects, done), null);
  });
});

describe("saying where a defect is", () => {
  it("breadcrumbs section › instance › field, and drops the instance when there is none", () => {
    assert.deepEqual(breadcrumbOf(makeDefect().target), ["Case details", "Cheque 1", "IFSC code"]);
    assert.deepEqual(breadcrumbOf(makeDocDefect().target), [
      "Documents",
      "Proof of delivery of demand notice (AD card)",
    ]);
  });

  it("keys distinguish two instances of the same field", () => {
    const one = makeDefect().target;
    const base = makeDefect().target;
    assert.equal(base.kind, "field");
    const two = makeDefect({
      target: base.kind === "field" ? { ...base, instance: 1 } : base,
    }).target;
    assert.notEqual(targetKey(one), targetKey(two));
    assert.equal(targetKey(one), "field:cheque:0:ifsc");
  });
});

describe("the queue's order — the form's, not the memo's", () => {
  const field = (n: number, step: string, instance: number): Defect =>
    makeDefect({
      n,
      target: { ...makeDefect().target, step, instance } as Defect["target"],
    });

  it("sorts by the form's walking order, then instance, then the officer's number", () => {
    // The officer numbered the cheque defects first, but the form reads Documents,
    // then Complainant, then Cheque — and cheque 1 before cheque 2.
    const memo = [
      field(1, "cheque", 1),
      field(2, "cheque", 0),
      makeDocDefect({ n: 3 }),
      field(4, "complainant", 0),
    ];
    const sorted = [...memo].sort(formOrder);
    assert.deepEqual(
      sorted.map((d) => d.n),
      [3, 4, 2, 1]
    );
  });

  it("inside one instance the officer's numbering is the tiebreak", () => {
    const a = field(5, "cheque", 0);
    const b = field(2, "cheque", 0);
    assert.deepEqual([a, b].sort(formOrder).map((d) => d.n), [2, 5]);
  });
});
