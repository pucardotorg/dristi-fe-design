import assert from "node:assert/strict";
import test from "node:test";

import { createBlankDraft } from "@/lib/filing/blank";
import { feeBill } from "@/lib/filing/selectors";
import type { FilingDraft } from "@/lib/filing/types";

import { GUJARAT_FEES, KERALA_FEES, PUNJAB_HARYANA_FEES } from "./fees";

function draftWith(advocates: number): FilingDraft {
  const draft = createBlankDraft("fees-test");
  draft.advocates = Array.from({ length: advocates }, (_, i) => ({
    id: `adv-${i}`,
    forComplainants: [0],
    barNumber: `B/${i}/2020`,
    name: `Advocate ${i + 1}`,
  }));
  return draft;
}

const courtKeys = (draft: FilingDraft, schedule = KERALA_FEES) =>
  feeBill(draft, schedule).court.map((l) => `${l.key}:${l.amount}`);

test("Kerala's bill is the one the product was built with, unchanged", () => {
  const draft = draftWith(1);
  assert.deepEqual(feeBill(draft), feeBill(draft, KERALA_FEES));
  assert.equal(feeBill(draft, KERALA_FEES).courtTotal, 101);
});

test("Gujarat bills schedule 2: stamps, a flat welfare fund, per-advocate vakalatnama", () => {
  assert.deepEqual(courtKeys(draftWith(2), GUJARAT_FEES), [
    "court-fee:3",
    "advocate-welfare:20",
    "vakalatnama:4",
    "affidavit:2",
  ]);
  // No advocate on record, no vakalatnama to pay for.
  assert.deepEqual(courtKeys(draftWith(0), GUJARAT_FEES), [
    "court-fee:3",
    "advocate-welfare:20",
    "affidavit:2",
  ]);
});

test("Punjab and Haryana bill schedule 3: the court fee only with an advocate", () => {
  assert.deepEqual(courtKeys(draftWith(1), PUNJAB_HARYANA_FEES), [
    "court-fee:10",
    "advocate-welfare:50",
    "vakalatnama:2",
  ]);
  assert.deepEqual(courtKeys(draftWith(0), PUNJAB_HARYANA_FEES), ["advocate-welfare:50"]);
});

test("process fees take the state's rate, and name Talwana where the state does", () => {
  const draft = draftWith(1);
  const gujarat = feeBill(draft, GUJARAT_FEES).process;
  const punjab = feeBill(draft, PUNJAB_HARYANA_FEES).process;
  assert.ok(gujarat.length > 0);
  assert.ok(gujarat.every((l) => l.rate === 3));
  assert.ok(punjab.every((l) => l.rate === 50 && l.label.endsWith("(Talwana)")));
});
