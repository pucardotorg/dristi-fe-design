import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { rolesOf, seatHolds, seatsIn } from "./seat-roles";

/* court-roles.md §3, row by row. If the PRD's table changes, this test is what says the
   prototype has to follow. */
describe("seat roles follow court-roles §3", () => {
  it("gives each state its own seats", () => {
    assert.deepEqual(seatsIn("kerala"), [
      "magistrate",
      "bench-clerk",
      "scrutiny-officer",
      "typist",
      "post-officer",
    ]);
    assert.deepEqual(seatsIn("gujarat"), [
      "magistrate",
      "bench-clerk",
      "scrutiny-officer",
      "typist",
      "post-officer",
    ]);
    assert.deepEqual(seatsIn("punjab-haryana"), [
      "magistrate",
      "bench-clerk",
      "scrutiny-officer",
      "typist",
      "steno",
      "ahlmad",
      "post-officer",
    ]);
  });

  it("gives the Post officer e-Post dispatch and report, and no signing", () => {
    for (const court of ["kerala", "gujarat", "punjab-haryana"] as const) {
      assert.deepEqual(rolesOf("post-officer", court), [
        "process-dispatcher",
        "process-reporter",
        "evidence-marker",
      ]);
      assert.equal(seatHolds("post-officer", court, "process-signer"), false);
    }
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
    assert.deepEqual(rolesOf("ahlmad", "punjab-haryana"), ["order-data-filler", "account-approver"]);
    assert.deepEqual(rolesOf("steno", "kerala"), []);
  });

  it("fills order data from the bench clerk, never the magistrate", () => {
    for (const court of ["kerala", "gujarat", "punjab-haryana"] as const) {
      assert.equal(seatHolds("bench-clerk", court, "order-data-filler"), true);
      assert.equal(seatHolds("magistrate", court, "order-data-filler"), false);
    }
  });

  it("gives Account approver to the Gujarat Scrutiny officer and the P&H Ahlmad", () => {
    assert.equal(seatHolds("scrutiny-officer", "gujarat", "account-approver"), true);
    assert.equal(seatHolds("ahlmad", "punjab-haryana", "account-approver"), true);
    assert.equal(seatHolds("scrutiny-officer", "punjab-haryana", "account-approver"), false);
  });

  it("makes the Reader the Process dispatcher in Gujarat and P&H, not Kerala", () => {
    assert.equal(seatHolds("bench-clerk", "gujarat", "process-dispatcher"), true);
    assert.equal(seatHolds("bench-clerk", "punjab-haryana", "process-dispatcher"), true);
    assert.equal(seatHolds("bench-clerk", "kerala", "process-dispatcher"), false);
  });
});

import { seatHasNavRow } from "./navigation";

describe("Approve registrations follows the Account approver", () => {
  it("shows it to the approver in each state, and keeps Kerala as it was", () => {
    assert.equal(seatHasNavRow("scrutiny-officer", "approve-registrations", "gujarat"), true);
    assert.equal(seatHasNavRow("ahlmad", "approve-registrations", "punjab-haryana"), true);
    assert.equal(seatHasNavRow("scrutiny-officer", "approve-registrations", "punjab-haryana"), false);
    assert.equal(seatHasNavRow("magistrate", "approve-registrations", "gujarat"), false);
    /* Kerala's table names no approver yet: the scrutiny officer keeps it. */
    assert.equal(seatHasNavRow("scrutiny-officer", "approve-registrations", "kerala"), true);
  });
});
