import assert from "node:assert/strict";
import { test } from "node:test";

import { createBlankDraft } from "../filing/blank";

import { applyFix, editable } from "./actions.server";

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
