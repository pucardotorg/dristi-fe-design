import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACCUSED_ENTITY_TYPES,
  ACCUSED_TYPES,
  MODE_OF_SERVICE,
  NATURE_OF_DEBT,
  NON_DELIVERY_REASONS,
  PAYMENT_STATUS,
  RETURN_REASONS,
} from "../filing/options";

import { COLUMNS, formatHint, isGuideRow, LISTS, listValue, normHeader } from "./excel-spec";

test("the template's lists are the form's lists", () => {
  assert.deepEqual(LISTS.accusedType, ACCUSED_TYPES);
  assert.deepEqual(LISTS.accusedEntity, ACCUSED_ENTITY_TYPES);
  assert.deepEqual(LISTS.returnReason, RETURN_REASONS);
  assert.deepEqual(LISTS.natureOfDebt, NATURE_OF_DEBT);
  assert.deepEqual(LISTS.modeOfService, MODE_OF_SERVICE);
  assert.deepEqual(LISTS.nonDelivery, NON_DELIVERY_REASONS);
  assert.deepEqual(LISTS.payment, PAYMENT_STATUS);
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
