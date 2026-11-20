import assert from "node:assert/strict";
import { test } from "node:test";

import { closeness, suggestOption, wordsOf } from "./value-suggest";

const pick = (...args: Parameters<typeof suggestOption>) => suggestOption(...args)?.label ?? null;

test("a value's words: case, punctuation and filler gone, abbreviations spelled out", () => {
  assert.deepEqual(wordsOf("A/C CLOSED"), ["account", "closed"]);
  assert.deepEqual(wordsOf("INSUFF. FUNDS"), ["insufficient", "funds"]);
  assert.deepEqual(wordsOf("Regd. Post A/D"), ["registered", "post", "ad"]);
  assert.deepEqual(wordsOf("Drawer's signature differs / incomplete"), ["drawer", "signature", "differs", "incomplete"]);
  assert.deepEqual(wordsOf("Payment stopped by drawer"), ["payment", "stopped", "drawer"]);
  assert.deepEqual(wordsOf("E-mail"), ["email"]);
});

test("the same words in another order are the same value", () => {
  assert.equal(closeness("INSUFFICIENT FUNDS", "Funds insufficient"), 1);
  assert.equal(closeness("Exceeds arrangement.", "Exceeds arrangement"), 1);
});

test("a recovery team's words become the court's option", () => {
  assert.equal(pick("returnReason", "INSUFFICIENT FUNDS"), "Funds insufficient");
  assert.equal(pick("returnReason", "INSUFF FUNDS"), "Funds insufficient");
  assert.equal(pick("returnReason", "Funds Insuff"), "Funds insufficient");
  assert.equal(pick("returnReason", "A/C CLOSED"), "Account closed");
  assert.equal(pick("returnReason", "PAYMENT STOPPED"), "Payment stopped by drawer");
  assert.equal(pick("returnReason", "PAYMENT STOPPED BY DRAWER"), "Payment stopped by drawer");
  assert.equal(pick("returnReason", "SIGNATURE MISMATCH"), "Drawer's signature differs / incomplete");
  assert.equal(pick("modeOfService", "SPEED POST"), "Speed post");
  assert.equal(pick("modeOfService", "E-mail"), "Email");
  assert.equal(pick("accusedEntity", "PVT LTD"), "Private limited company");
});

test("initials that an option carries as a word suggest it", () => {
  assert.equal(pick("modeOfService", "Regd. Post A/D"), "Registered post (RPAD)");
});

test("a one-letter answer is spelled out", () => {
  assert.equal(pick("yesNo", "Y"), "Yes");
  assert.equal(pick("yesNo", "N"), "No");
});

test("no suggestion when nothing reads as the word", () => {
  assert.equal(suggestOption("yesNo", "SERVED"), null);
  assert.equal(suggestOption("returnReason", "TECHNICAL"), null);
  assert.equal(suggestOption("accusedType", "FIRM"), null);
});

test("no suggestion when two options read as the word equally", () => {
  // Drawer is in three return reasons; post in three modes; company in two entities.
  assert.equal(suggestOption("returnReason", "DRAWER"), null);
  assert.equal(suggestOption("modeOfService", "Post"), null);
  assert.equal(suggestOption("accusedEntity", "COMPANY"), null);
});

test("a suggestion says how close it is", () => {
  const s = suggestOption("returnReason", "A/C CLOSED");
  assert.deepEqual(s, { value: "account-closed", label: "Account closed", score: 1 });
});
