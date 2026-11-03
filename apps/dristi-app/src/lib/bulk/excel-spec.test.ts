import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACCUSED_ENTITY_TYPES,
  ACCUSED_TYPES,
  ENTITY_TYPES,
  GENDER_OPTIONS,
  MODE_OF_SERVICE,
  NATURE_OF_DEBT,
  NON_DELIVERY_REASONS,
  PAYMENT_STATUS,
  RETURN_REASONS,
} from "../filing/options";

import { COLUMNS, formatHint, headerFor, isGuideRow, LISTS, listValue, matchTemplateHeader, normHeader, templateColumns } from "./excel-spec";

test("the template's lists are the form's lists", () => {
  assert.deepEqual(LISTS.accusedType, ACCUSED_TYPES);
  assert.deepEqual(LISTS.accusedEntity, ACCUSED_ENTITY_TYPES);
  assert.deepEqual(LISTS.returnReason, RETURN_REASONS);
  assert.deepEqual(LISTS.natureOfDebt, NATURE_OF_DEBT);
  assert.deepEqual(LISTS.modeOfService, MODE_OF_SERVICE);
  assert.deepEqual(LISTS.nonDelivery, NON_DELIVERY_REASONS);
  assert.deepEqual(LISTS.payment, PAYMENT_STATUS);
  assert.deepEqual(LISTS.complainantEntity, ENTITY_TYPES);
  assert.deepEqual(LISTS.gender, GENDER_OPTIONS);
});

test("every police station the PRD asks for is required in the sheet", () => {
  const req = (key: string) => COLUMNS.find((c) => c.key === key)!.required;
  assert.equal(req("accusedPolice"), "Yes");
  assert.equal(req("personPolice"), "When Institution");
  assert.equal(req("payeePolice"), "When deposited in complainant's account");
  assert.equal(req("drawerPolice"), "When not deposited in complainant's account");
});

test("the template is the PRD's 79 columns, every repeat numbered", () => {
  const all = templateColumns();
  assert.equal(all.length, 79);
  const headers = all.map((t) => t.header);
  assert.equal(new Set(headers).size, 79, "no header twice");
  for (const h of ["Case reference", "Accused 1 name", "Accused 2 name", "Accused 1 address 1 pincode", "Accused 2 person responsible 1 police station", "Cheque 1 complainant branch IFSC", "Demand notice 1 dispatch date", "Other complaint pending between the same parties", "Other pending case 1 case number", "Interim relief", "Affidavit", "Witness 1 address 1 pincode"])
    assert.ok(headers.includes(h), h);
  assert.ok(!headers.some((h) => /complainant (name|type)/i.test(h)), "no complainant columns: they are set on the upload screen");
});

test("a numbered header names its column and instance; an unnumbered one does not", () => {
  const m = matchTemplateHeader("Accused 2 address 1 pincode")!;
  assert.equal(m.column.key, "accusedPin");
  assert.deepEqual(m.instance, [2, 1]);
  assert.deepEqual(matchTemplateHeader("cheque-3 AMOUNT")!.instance, [3]);
  assert.equal(matchTemplateHeader("Cheque amount"), null);
  assert.equal(headerFor(COLUMNS.find((c) => c.key === "personName")!, [1, 2]), "Accused 1 person responsible 2 name");
});

test("headers and aliases never collide", () => {
  const seen = new Map<string, string>();
  for (const c of COLUMNS) {
    for (const h of [c.header, ...c.aliases]) {
      const n = normHeader(h);
      assert.ok(!seen.has(n) || seen.get(n) === c.key, `"${h}" names both ${seen.get(n)} and ${c.key}`);
      seen.set(n, c.key);
    }
  }
});

test("list values read leniently, unknowns stay unknown", () => {
  assert.equal(listValue("returnReason", "funds insufficient"), "funds-insufficient");
  assert.equal(listValue("modeOfService", "Registered Post (RPAD)"), "rpad");
  assert.equal(listValue("returnReason", "Funds Insuff."), null);
});

test("the template's format and example rows are spotted and discarded; real rows are not", () => {
  const example = COLUMNS.map((c) => c.example);
  assert.ok(isGuideRow(COLUMNS.map(formatHint)), "format row");
  assert.ok(isGuideRow(example), "example row");
  // Someone overwrote the example's reference but left the rest.
  assert.ok(isGuideRow(["GJ-PL-9999", ...example.slice(1)]), "edited example");
  const real = example.map((v, i) => (COLUMNS[i].kind === "list" ? v : `${v}`.replace(/\d/g, "7").replace(/[A-Za-z]/g, "q")));
  real[0] = "TCL-AHD-PL-1001";
  assert.ok(!isGuideRow(real), "a real case");
});
