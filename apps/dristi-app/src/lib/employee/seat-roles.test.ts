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
      "typist",
      "ahlmad",
      "post-officer",
    ]);
  });

  it("gives the Post officer e-Post dispatch and report, and no signing", () => {
    for (const court of ["kerala", "gujarat", "punjab-haryana"] as const) {
      assert.deepEqual(rolesOf("post-officer", court), ["process-dispatcher", "process-reporter"]);
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
    assert.deepEqual(rolesOf("typist", "kerala"), [
      "order-drafter",
      "order-data-filler",
      "next-hearing-setter",
      "evidence-marker",
    ]);
    assert.deepEqual(rolesOf("typist", "gujarat"), ["order-drafter", "order-data-filler", "evidence-marker"]);
    /* Punjab & Haryana's Typist / Steno: one person, drafting only. */
    assert.deepEqual(rolesOf("typist", "punjab-haryana"), ["order-drafter"]);
  });

  it("makes Punjab & Haryana's Ahlmad its Scrutiny officer", () => {
    assert.deepEqual(rolesOf("ahlmad", "punjab-haryana"), [
      "scrutiny-officer",
      "case-registerer",
      "order-data-filler",
      "account-approver",
    ]);
    assert.deepEqual(rolesOf("scrutiny-officer", "punjab-haryana"), []);
    assert.deepEqual(rolesOf("ahlmad", "kerala"), []);
  });

  it("fills order data from the Reader, except in Punjab & Haryana", () => {
    assert.equal(seatHolds("bench-clerk", "kerala", "order-data-filler"), true);
    assert.equal(seatHolds("bench-clerk", "gujarat", "order-data-filler"), true);
    assert.equal(seatHolds("bench-clerk", "punjab-haryana", "order-data-filler"), false);
    for (const court of ["kerala", "gujarat", "punjab-haryana"] as const) {
      assert.equal(seatHolds("magistrate", court, "order-data-filler"), false);
    }
  });

  it("registers cases from the Magistrate in Kerala and the scrutiniser elsewhere", () => {
    assert.equal(seatHolds("magistrate", "kerala", "case-registerer"), true);
    assert.equal(seatHolds("scrutiny-officer", "kerala", "case-registerer"), false);
    assert.equal(seatHolds("magistrate", "gujarat", "case-registerer"), false);
    assert.equal(seatHolds("scrutiny-officer", "gujarat", "case-registerer"), true);
    assert.equal(seatHolds("magistrate", "punjab-haryana", "case-registerer"), false);
    assert.equal(seatHolds("ahlmad", "punjab-haryana", "case-registerer"), true);
  });

  it("keeps the A-Diary with Kerala's Magistrate only", () => {
    assert.equal(seatHolds("magistrate", "kerala", "a-diary-signer"), true);
    assert.equal(seatHolds("magistrate", "gujarat", "a-diary-signer"), false);
    assert.equal(seatHolds("magistrate", "punjab-haryana", "a-diary-editor"), false);
  });

  it("gives Account approver to the Gujarat Scrutiny officer and the P&H Ahlmad", () => {
    assert.equal(seatHolds("scrutiny-officer", "gujarat", "account-approver"), true);
    assert.equal(seatHolds("ahlmad", "punjab-haryana", "account-approver"), true);
    assert.equal(seatHolds("scrutiny-officer", "kerala", "account-approver"), false);
  });

  it("makes the Reader the process dispatcher, reporter and envelope receiver everywhere", () => {
    for (const court of ["kerala", "gujarat", "punjab-haryana"] as const) {
      for (const role of ["envelope-receiver", "process-dispatcher", "process-reporter"] as const) {
        assert.equal(seatHolds("bench-clerk", court, role), true, `${court} ${role}`);
      }
    }
  });

  it("marks evidence from the bench, never the scrutiny officer, post officer or Ahlmad", () => {
    for (const court of ["kerala", "gujarat", "punjab-haryana"] as const) {
      assert.equal(seatHolds("magistrate", court, "evidence-marker"), true);
      assert.equal(seatHolds("bench-clerk", court, "evidence-marker"), true);
      assert.equal(seatHolds("scrutiny-officer", court, "evidence-marker"), false);
      assert.equal(seatHolds("post-officer", court, "evidence-marker"), false);
    }
    assert.equal(seatHolds("ahlmad", "punjab-haryana", "evidence-marker"), false);
    assert.equal(seatHolds("typist", "punjab-haryana", "evidence-marker"), false);
  });
});

import { seatHasNavRow } from "./navigation";

describe("Approve registrations follows the Account approver", () => {
  it("shows it to the approver in each state, and keeps Kerala as it was", () => {
    assert.equal(seatHasNavRow("scrutiny-officer", "approve-registrations", "gujarat"), true);
    assert.equal(seatHasNavRow("ahlmad", "approve-registrations", "punjab-haryana"), true);
    assert.equal(seatHasNavRow("magistrate", "approve-registrations", "gujarat"), false);
    /* Kerala's table names no approver yet: the scrutiny officer keeps it. */
    assert.equal(seatHasNavRow("scrutiny-officer", "approve-registrations", "kerala"), true);
  });
});

describe("Scrutinise submitted cases follows the Scrutiny officer role", () => {
  it("shows it to the Ahlmad in Punjab & Haryana and the Scrutiny officer elsewhere", () => {
    assert.equal(seatHasNavRow("scrutiny-officer", "scrutiny", "kerala"), true);
    assert.equal(seatHasNavRow("scrutiny-officer", "scrutiny", "gujarat"), true);
    assert.equal(seatHasNavRow("ahlmad", "scrutiny", "punjab-haryana"), true);
    for (const court of ["kerala", "gujarat", "punjab-haryana"] as const) {
      assert.equal(seatHasNavRow("magistrate", "scrutiny", court), false);
      assert.equal(seatHasNavRow("bench-clerk", "scrutiny", court), false);
    }
  });
});
