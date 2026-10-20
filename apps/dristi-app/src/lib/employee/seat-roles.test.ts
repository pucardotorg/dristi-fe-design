import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { rolesOf, seatHolds, seatsIn } from "./seat-roles";

/* court-roles.md §3, row by row. If the PRD's table changes, this test is what says the
   prototype has to follow. */
describe("seat roles follow court-roles §3", () => {
  it("gives each state its own seats", () => {
    assert.deepEqual(seatsIn("kerala"), ["magistrate", "bench-clerk", "scrutiny-officer", "typist"]);
    assert.deepEqual(seatsIn("gujarat"), ["magistrate", "bench-clerk", "scrutiny-officer", "typist"]);
    assert.deepEqual(seatsIn("punjab-haryana"), [
      "magistrate",
      "bench-clerk",
      "scrutiny-officer",
      "typist",
      "steno",
      "ahlmad",
    ]);
  });

  it("lets only the magistrate sign orders", () => {
    for (const court of ["kerala", "gujarat", "punjab-haryana"] as const) {
      for (const seat of seatsIn(court)) {
        assert.equal(seatHolds(seat, court, "order-signer"), seat === "magistrate", `${court} ${seat}`);
      }
    }
  });

  it("gives the typist different roles in each state", () => {
    assert.deepEqual(rolesOf("typist", "kerala"), ["order-drafter", "order-data-filler", "next-hearing-setter"]);
    assert.deepEqual(rolesOf("typist", "gujarat"), ["order-drafter", "order-data-filler"]);
    assert.deepEqual(rolesOf("typist", "punjab-haryana"), ["order-drafter", "next-hearing-setter"]);
  });

  it("splits Punjab & Haryana's Steno and Ahlmad", () => {
    assert.deepEqual(rolesOf("steno", "punjab-haryana"), ["order-drafter"]);
    assert.deepEqual(rolesOf("ahlmad", "punjab-haryana"), ["order-data-filler"]);
    assert.deepEqual(rolesOf("steno", "kerala"), []);
  });

  it("fills order data from the bench clerk, never the magistrate", () => {
    for (const court of ["kerala", "gujarat", "punjab-haryana"] as const) {
      assert.equal(seatHolds("bench-clerk", court, "order-data-filler"), true);
      assert.equal(seatHolds("magistrate", court, "order-data-filler"), false);
    }
  });
});
