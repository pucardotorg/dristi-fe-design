import assert from "node:assert/strict";
import { test } from "node:test";

import { answerFor } from "./excel";
import { COLUMNS, LISTS } from "./excel-spec";
import { isCheckable, judgeColumn, namedFor, readBack, unusualFor } from "./read-back";

const col = (key: string) => COLUMNS.find((c) => c.key === key)!;

test("values read as the court files them", () => {
  assert.deepEqual(readBack(col("chequeAmount"), "140500"), { kind: "ok", text: "₹1,40,500" });
  assert.deepEqual(readBack(col("chequeAmount"), "Rs. 1,40,500"), { kind: "ok", text: "₹1,40,500" });
  assert.deepEqual(readBack(col("chequeDate"), "14/10/2026"), { kind: "ok", text: "14 Oct 2026" });
  assert.deepEqual(readBack(col("chequeDate"), "2026-01-10"), { kind: "ok", text: "10 Jan 2026" });
  assert.deepEqual(readBack(col("chequeNumber"), "204511"), { kind: "ok", text: "204511" });
});

test("a column matched to the wrong field shows itself", () => {
  assert.equal(readBack(col("chequeNumber"), "450000.50").kind, "bad");
  assert.deepEqual(readBack(col("chequeAmount"), "2026-01-10"), {
    kind: "bad",
    text: "2026-01-10",
    note: "Not an amount",
  });
  assert.equal(readBack(col("chequeDate"), "Harsh V. Bhavsar").kind, "bad");
});

test("list words: the court's option, a word Match values takes, or the filer's choice", () => {
  const reason = col("returnReason");
  assert.deepEqual(readBack(reason, "A/C CLOSED"), { kind: "word", text: "A/C CLOSED" });
  const closed = readBack(reason, "account closed");
  assert.equal(closed.kind, "ok");
  const value = LISTS.returnReason.find((o) => o.label === "Account closed")!.value;
  assert.deepEqual(readBack(reason, "A/C CLOSED", { returnReason: { "A/C CLOSED": value } }), {
    kind: "ok",
    text: "Account closed",
  });
});

test("an empty cell is empty", () => {
  assert.deepEqual(readBack(col("chequeAmount"), "  "), { kind: "empty" });
});

test("only fields whose values can be checked are confirmed", () => {
  assert.equal(isCheckable(col("chequeAmount")), true);
  assert.equal(isCheckable(col("chequeNumber")), true);
  assert.equal(isCheckable(col("accusedPin")), true);
  assert.equal(isCheckable(col("returnReason")), true);
  assert.equal(isCheckable(col("accusedName")), false);
  assert.equal(isCheckable(col("accusedAddress")), false);
});

test("a tick needs the column's name and its values to agree", () => {
  const nums = ["1", "2", "3", "4", "5"];
  assert.deepEqual(judgeColumn(col("accusedAge"), "S.No", nums), { kind: "bad", note: "Looks like a serial number" });
  assert.equal(judgeColumn(col("returnDate"), "Bounce Date", ["14/10/2026", "12/10/2026"]).kind, "confirmed");
  // A date column under a date field it is not named for: examples, no tick.
  assert.equal(judgeColumn(col("chequeDate"), "Sanction Dt", ["14/10/2025", "12/10/2025"]).kind, "plain");
  assert.equal(judgeColumn(col("chequeAmount"), "Cust_Nm", ["Harsh V. Bhavsar", "Snehal K. Mistry"]).kind, "bad");
  assert.equal(namedFor(col("accusedPin"), "PIN"), true);
  assert.equal(namedFor(col("accusedPin"), "Postal"), false);
});

test("columns that do not look like their field are flagged, beyond their type", () => {
  const serial = Array.from({ length: 14 }, (_, k) => String(k + 1));
  const refs = Array.from({ length: 14 }, (_, k) => `TCL-AHD-PL-${1001 + k}`);
  const products = Array.from({ length: 14 }, (_, k) => (k % 2 ? "Personal Loan" : "Business Loan"));
  assert.equal(unusualFor(col("accusedType"), serial), "Not like the court's options");
  assert.equal(unusualFor(col("accusedJurisdiction"), refs), "Not like the court's options");
  assert.equal(unusualFor(col("finalRelief"), products), "Too short for this field");
  assert.equal(unusualFor(col("accusedName"), products), "Doesn't look like names");
  assert.equal(unusualFor(col("accusedName"), refs), "Doesn't look like names");
  assert.equal(unusualFor(col("accusedName"), ["+91 98790 12301", "+91 98790 12302", "+91 98790 12303"]), "Doesn't look like names");
  assert.equal(unusualFor(col("accusedAddress"), serial), "Doesn't look like an address");
  // What the right columns hold passes.
  assert.equal(unusualFor(col("accusedType"), ["IND", "INDIVIDUAL", "PVT LTD", "IND", "LLP", "IND"]), null);
  assert.equal(unusualFor(col("delivered"), ["DLVD", "Delivered", "SERVED", "RTO", "DLVD", "Returned", "DLVD"]), null);
  assert.equal(unusualFor(col("accusedName"), ["Harsh V. Bhavsar", "Snehal K. Mistry", "Pravin D. Solanki"]), null);
  assert.equal(unusualFor(col("accusedAddress"), ["B-12, Sundaram Flats, Vastrapur", "14, Gokul Row Houses", "7, Shreeji Society"]), null);
});

test("answers are per field, with an older per-list answer read as a fallback", () => {
  const replied = col("replied");
  const delivered = col("delivered");
  // Each field is its own decision: "Y" answered under Accused replied says nothing for Notice delivered.
  const own = { replied: { Y: "yes" } };
  assert.equal(answerFor(own, replied, "Y"), "yes");
  assert.equal(answerFor(own, delivered, "Y"), null);
  // An upload saved before answers were per field keyed them by list.
  assert.equal(answerFor({ yesNo: { Y: "yes" } }, delivered, "Y"), "yes");
  // A field's own "" (taken back) wins over an older list answer.
  assert.equal(answerFor({ yesNo: { Y: "yes" }, delivered: { Y: "" } }, delivered, "Y"), null);
});
