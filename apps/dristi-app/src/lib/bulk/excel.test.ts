import assert from "node:assert/strict";
import { test } from "node:test";

import { autoMap, buildRequest, columnFit, instancesIn, sourceFor, unmatchedRequired, type Workbookish } from "./excel";
import { COLUMNS, parseHeader } from "./excel-spec";

const complainant = {
  type: "institution" as const,
  name: "Tata Capital Ltd",
  address: { line1: "x", city: "Mumbai", pin: "400013" },
};

function book(headers: string[], ...rows: string[][]): Workbookish {
  return { cases: { name: "Cases", headers, rows, discarded: 0 } };
}

test("a header splits into its column and its repeat", () => {
  assert.deepEqual(parseHeader("Cheque number_2"), { base: "Cheque number", instance: [2] });
  assert.deepEqual(parseHeader("Accused address_1_2"), { base: "Accused address", instance: [1, 2] });
  assert.deepEqual(parseHeader("Cheque number"), { base: "Cheque number", instance: [] });
});

test("_2 columns become the second cheque, accused and witness; _1_2 a second address", () => {
  const headers = [
    "Case reference", "Accused name", "Accused address", "Accused address_1_2", "Accused name_2", "Accused address_2",
    "Cheque number", "Cheque number_2", "Witness name", "Witness name_2", "Complainant name_2", "Complainant type_2",
  ];
  const row = ["R-1", "A One", "Addr 1", "Addr 1b", "A Two", "Addr 2", "111111", "222222", "W1", "W2", "Co Two", "Individual"];
  const inst = instancesIn(headers);
  assert.deepEqual(inst.accused, [[1], [2]]);
  // Accused 2 mirrors accused 1's two address slots; the blank one adds nothing below.
  assert.deepEqual(inst.address, [[1, 1], [1, 2], [2, 1], [2, 2]]);
  const req = buildRequest(book(headers, row), autoMap(headers), {}, { complainant, barNumbers: ["K/1450/2012"], adr: "no", fileName: "t" });
  const c = req.cases[0];
  assert.deepEqual(c.accused.map((a) => a.name), ["A One", "A Two"]);
  assert.deepEqual(c.accused[0].addresses.map((a) => a.line1), ["Addr 1", "Addr 1b"]);
  assert.deepEqual(c.accused[1].addresses.map((a) => a.line1), ["Addr 2"]);
  assert.deepEqual(c.cheques.map((q) => q.number), ["111111", "222222"]);
  assert.deepEqual(c.witnesses?.map((w) => w.name), ["W1", "W2"]);
  assert.equal(c.complainants?.[0].name, "Co Two");
});

test("an optional section left blank on a row adds nothing to that case", () => {
  const headers = ["Case reference", "Cheque number", "Witness name", "Witness name_2"];
  const req = buildRequest(book(headers, ["R-1", "111111", "", ""]), autoMap(headers), {}, { complainant, barNumbers: [], adr: "no", fileName: "t" });
  assert.equal(req.cases[0].witnesses?.length, 0);
  assert.equal(req.cases[0].cheques.length, 1);
});

test("in a filer's own layout, a matched column's _2 is read for the second instance", () => {
  const headers = ["LAN", "Chq No", "Chq No_2"];
  const map = { ...autoMap(headers), chequeNumber: 1 };
  const col = COLUMNS.find((c) => c.key === "chequeNumber")!;
  assert.equal(sourceFor(col, [2], map, headers), 2);
  const req = buildRequest(book(headers, ["R-1", "333333", "444444"]), map, {}, { complainant, barNumbers: [], adr: "no", fileName: "t" });
  assert.deepEqual(req.cases[0].cheques.map((q) => q.number), ["333333", "444444"]);
});

test("repeats are per case: one row uses the _2 columns, the next leaves them blank", () => {
  const headers = ["Case reference", "Accused name", "Accused address", "Accused name_2", "Accused address_2", "Cheque number", "Cheque number_2"];
  const req = buildRequest(
    book(headers, ["R-1", "A One", "Addr 1", "A Two", "Addr 2", "111111", "222222"], ["R-2", "B One", "Addr 3", "", "", "333333", ""]),
    autoMap(headers),
    {},
    { complainant, barNumbers: [], adr: "no", fileName: "t" }
  );
  assert.equal(req.cases[0].accused.length, 2);
  assert.equal(req.cases[0].cheques.length, 2);
  assert.equal(req.cases[1].accused.length, 1);
  assert.equal(req.cases[1].cheques.length, 1);
});

test("a matched column is checked against its field: dates, pincodes, list words", () => {
  const col = (key: string) => COLUMNS.find((c) => c.key === key)!;
  assert.equal(columnFit(col("chequeDate"), ["01/09/2026", "14-09-2026", ""]).ok, true);
  assert.deepEqual(columnFit(col("chequeDate"), ["Harsh", "Mehta", "01/09/2026"]), { ok: false, note: "2 of 3 values are not dates" });
  assert.equal(columnFit(col("accusedPin"), ["380015", "380 006"]).ok, true);
  assert.equal(columnFit(col("accusedName"), []).ok, false);
  const reason = columnFit(col("returnReason"), ["INSUFFICIENT FUNDS"]);
  assert.equal(reason.ok, false);
});

test("a required field no column fills is reported, so every case is known to lack it", () => {
  const headers = ["LAN", "Customer Name", "Chq No", "Bounce Date"];
  const missing = unmatchedRequired(headers, autoMap(headers)).map((c) => c.key);
  assert.ok(missing.includes("chequeDate"));
  assert.ok(missing.includes("presentDate"));
  assert.ok(!missing.includes("chequeNumber"));
  // Optional fields and sections a case may not have are never reported.
  assert.ok(!missing.includes("accusedAge"));
  assert.ok(!missing.includes("witnessName"));
});

test("deposited and replied with no column are left unstated, not read as Yes and No", () => {
  const headers = ["Case reference", "Cheque number"];
  const req = buildRequest(book(headers, ["R-1", "111111"]), autoMap(headers), {}, { complainant, barNumbers: [], adr: "no", fileName: "t" });
  assert.equal(req.cases[0].jurisdiction.depositedInOwnAccount, null);
  assert.equal(req.cases[0].notices[0].replied, null);
});
