import assert from "node:assert/strict";
import { test } from "node:test";

import { createBlankDraft } from "../filing/blank";

import { applyFix, editable, removeCase } from "./actions.server";
import type { Batch } from "./types";

test("fixes write the field and redo what hangs off it", async () => {
  const d = createBlankDraft("t", null);
  d.accused[0].type = "institution";
  d.accused[0].reps = [];
  await applyFix(d, "accused.0.reps.0.name", " Nikhil S. Desai ");
  assert.equal(d.accused[0].reps[0].name, "Nikhil S. Desai");

  await applyFix(d, "advocates.0.barNumber", "g/831/2011");
  assert.equal(d.advocates[0].barNumber, "G/831/2011");
  assert.equal(d.advocates[0].name, "Thomas K. George");

  await applyFix(d, "cheques.0.ifsc", "sbin0060421");
  assert.equal(d.cheques[0].bankName, "State Bank of India");

  await applyFix(d, "accused.0.contacts.0.mobile", "+91 98250 12345");
  assert.equal(d.accused[0].contacts[0].mobile, "9825012345");
});

test("only listed fields can be written", () => {
  assert.ok(editable("notices.0.delivered"));
  assert.ok(!editable("sign.paid"));
  assert.ok(!editable("status"));
});

test("a case leaves its batch unless it is signed or filed", () => {
  const one = (id: string) => ({ id, reference: id, draft: createBlankDraft(id, null), skipped: [], noContactDeclared: [] });
  const batch = { cases: [one("a"), one("b"), one("c")] } as unknown as Batch;
  assert.equal(removeCase(batch, "b"), null);
  assert.deepEqual(batch.cases.map((c) => c.id), ["a", "c"]);
  (batch.cases[0] as { signedWith?: string }).signedWith = "dsc";
  assert.match(removeCase(batch, "a") ?? "", /signed or filed/);
  assert.match(removeCase(batch, "x") ?? "", /not in this batch/);
  assert.equal(batch.cases.length, 2);
});
