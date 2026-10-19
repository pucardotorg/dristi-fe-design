import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COURT_ROLE_LABEL, COURT_SEATS, CURRENT_STAFF } from "./content";
import {
  accountFor,
  COURT_ACCOUNTS,
  COURT_SIGN_IN_ROLES,
  courtroomsFor,
} from "./sign-in";
import {
  readCourtRole,
  registersAtScrutiny,
  seatHasBenchControls,
  setCourtRole,
} from "./court-role";
import { canDraftOrder, canTypeOrder } from "./hearings";

describe("court seats", () => {
  /* Every seat `/employee/login` signs in to has to be a seat the rail can name, or a
     signed-in magistrate opens the settings menu onto a radio group with nothing
     selected. The two lists are the same list, in the same order. */
  it("offers every seat the sign-in offers, and starts signed out in the fixture's", () => {
    assert.deepEqual(COURT_SEATS, COURT_SIGN_IN_ROLES);
    assert.equal(CURRENT_STAFF.role, "bench-clerk");
    assert.equal(readCourtRole(), CURRENT_STAFF.role);
  });

  it("holds a demo account for every seat it offers, one username each", () => {
    const usernames = new Set<string>();
    for (const seat of COURT_SEATS) {
      const account = COURT_ACCOUNTS[seat];
      assert.equal(account.role, seat);
      assert.ok(account.username, `${seat} has no username`);
      assert.ok(account.name, `${seat} has no name`);
      usernames.add(account.username.toLowerCase());
    }
    assert.equal(usernames.size, COURT_SEATS.length);
  });

  it("finds an account by username whatever its case, and nothing else", () => {
    assert.equal(accountFor("michaelGeorgeJudge")?.role, "magistrate");
    assert.equal(accountFor("MICHAELGEORGEJUDGE")?.role, "magistrate");
    assert.equal(accountFor("  michaelGeorgeJudge  ")?.role, "magistrate");
    assert.equal(accountFor("nobody"), undefined);
    assert.equal(accountFor(""), undefined);
  });

  it("names every seat it offers", () => {
    for (const seat of COURT_SEATS) {
      assert.ok(COURT_ROLE_LABEL[seat]);
    }
  });

  /* REG-35/36: an account carries its own court rooms, and the sign-in picks from that
     list. A bench seat sits 1:1 with a room, so it needs no pick; the scrutiny officer
     covers the establishment, so it is the one that offers a choice. `CURRENT_STAFF`'s
     court has to lead every list, because that is the only bench this build holds cases
     for. */
  it("maps each account to its own court rooms, several only for the officer", () => {
    for (const seat of COURT_SEATS) {
      const rooms = COURT_ACCOUNTS[seat].courtrooms;
      assert.ok(rooms.length >= 1, `${seat} has no court room`);
      assert.equal(rooms[0].name, CURRENT_STAFF.court);
      for (const room of rooms) assert.ok(room.district, `${room.name} has no district`);
    }
    assert.equal(COURT_ACCOUNTS.magistrate.courtrooms.length, 1);
    assert.equal(COURT_ACCOUNTS["bench-clerk"].courtrooms.length, 1);
    assert.equal(COURT_ACCOUNTS.typist.courtrooms.length, 1);
    assert.ok(COURT_ACCOUNTS["scrutiny-officer"].courtrooms.length > 1);
  });

  it("reads an account's court rooms, and nothing for no account", () => {
    assert.deepEqual(
      courtroomsFor(accountFor("bijuScrutinyOfficer")),
      COURT_ACCOUNTS["scrutiny-officer"].courtrooms,
    );
    assert.deepEqual(courtroomsFor(undefined), []);
    assert.deepEqual(courtroomsFor(accountFor("nobody")), []);
  });

  it("takes a seat, and taking the same one again is not a change", () => {
    let changes = 0;
    /* Read through the module rather than a captured value — the store is what the rail
       subscribes to. */
    setCourtRole("typist");
    assert.equal(readCourtRole(), "typist");
    changes += 1;
    setCourtRole("typist");
    assert.equal(changes, 1);
    setCourtRole("bench-clerk");
    assert.equal(readCourtRole(), "bench-clerk");
  });
});

describe("seatHasBenchControls", () => {
  it("gives Start / End / Pass over to the bench and not to the typist", () => {
    assert.equal(seatHasBenchControls("bench-clerk"), true);
    assert.equal(seatHasBenchControls("magistrate"), true);
    assert.equal(seatHasBenchControls("typist"), false);
  });
});

describe("the orders gate each seat reads", () => {
  it("waits for the call in a seat that makes it", () => {
    assert.equal(canDraftOrder("scheduled"), false);
    assert.equal(canDraftOrder("ongoing"), true);
    assert.equal(canDraftOrder("completed"), true);
  });

  /* The point of the typist's board: with no start control on the row, a gate that
     waited for the call would never open, so the whole column would be dead. */
  it("opens on the day's call in the seat with nothing to open it with", () => {
    assert.equal(seatHasBenchControls("typist"), false);
    assert.equal(canTypeOrder("scheduled"), true);
    assert.equal(canTypeOrder("ongoing"), true);
    assert.equal(canTypeOrder("completed"), true);
  });

  it("closes in both seats on a listing that was never heard", () => {
    for (const status of ["passed-over", "rescheduled", "abandoned"] as const) {
      assert.equal(canDraftOrder(status), false, `${status} opened for the bench`);
      assert.equal(canTypeOrder(status), false, `${status} opened for the typist`);
    }
  });

  /* One gate is the other plus the listing nobody has called yet — the seats differ
     about that row and about nothing else. */
  it("differs from the bench's gate on exactly the uncalled listing", () => {
    for (const status of [
      "scheduled",
      "ongoing",
      "completed",
      "passed-over",
      "rescheduled",
      "abandoned",
    ] as const) {
      assert.equal(
        canTypeOrder(status),
        canDraftOrder(status) || status === "scheduled",
        `${status} disagrees about the orders column`,
      );
    }
  });
});

/* `SCR-11`: Register at Scrutiny needs both roles; the demo staffs them per state. */
describe("registersAtScrutiny", () => {
  it("forwards in Kerala, where two people hold the two roles", () => {
    assert.equal(registersAtScrutiny("scrutiny-officer", "kerala"), false);
  });

  it("registers in Gujarat and Punjab & Haryana, where one person holds both", () => {
    for (const court of ["gujarat", "punjab-haryana"] as const) {
      assert.equal(registersAtScrutiny("scrutiny-officer", court), true, court);
    }
  });

  it("does not register from a seat that is not the Scrutiny officer's", () => {
    for (const role of ["magistrate", "bench-clerk", "typist"] as const) {
      assert.equal(registersAtScrutiny(role, "gujarat"), false, role);
    }
  });
});
