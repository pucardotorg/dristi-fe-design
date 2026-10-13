import assert from "node:assert/strict";
import { test } from "node:test";

import { nearbyDateIndex, nearbyDates } from "./date-scrubber";
import { dayKeyOf } from "./home";

test("nearby dates cross month and year boundaries in chronological order", () => {
  assert.deepEqual(nearbyDates("2026-12-31").map(dayKeyOf), [
    "2026-12-26", "2026-12-27",
    "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31",
    "2027-01-01", "2027-01-02", "2027-01-03", "2027-01-04", "2027-01-05",
  ]);
});

test("the eleven-day window includes leap day without skipping a date", () => {
  assert.deepEqual(nearbyDates("2028-03-01").map(dayKeyOf), [
    "2028-02-25", "2028-02-26",
    "2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01",
    "2028-03-02", "2028-03-03", "2028-03-04", "2028-03-05", "2028-03-06",
  ]);
});

test("preview mapping covers the whole square and clamps its edges", () => {
  assert.equal(nearbyDateIndex(100, 100, 140), 0);
  assert.equal(nearbyDateIndex(170, 100, 140), 5);
  assert.equal(nearbyDateIndex(240, 100, 140), 10);
  assert.equal(nearbyDateIndex(80, 100, 140), 0);
  assert.equal(nearbyDateIndex(260, 100, 140), 10);
  assert.equal(nearbyDateIndex(170, 100, 0), 5);
});
