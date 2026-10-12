import assert from "node:assert/strict";
import { test } from "node:test";

import { policeStationsFor as courtSide } from "../employee/case-people";
import { policeStationsFor } from "./options";

test("Panchkula is offered only to a Punjab and Haryana court", () => {
  for (const court of ["punjab", "haryana"] as const) {
    assert.ok(policeStationsFor(court).includes("Panchkula Police Station"), court);
    assert.ok(courtSide(court).includes("Panchkula"), court);
  }
  for (const court of ["kerala", "gujarat"] as const) {
    assert.ok(!policeStationsFor(court).includes("Panchkula Police Station"), court);
    assert.ok(!courtSide(court).includes("Panchkula"), court);
  }
});
