import assert from "node:assert/strict";
import { test } from "node:test";

import { COLUMNS, LISTS } from "./excel-spec";
import { isCheckable, judgeColumn, namedFor, readBack } from "./read-back";

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
