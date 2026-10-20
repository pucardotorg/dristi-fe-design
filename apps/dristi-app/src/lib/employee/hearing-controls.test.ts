import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  EMPTY_SESSION,
  markHearingEnded,
  markHearingOngoing,
  markHearingPassedOver,
  markHearingsEnded,
  readHearingSession,
  resetHearingSession,
} from "./hearing-session";
import {
  boardForDay,
  canEndHearing,
  canEndHearingInBulk,
  canPassOver,
  canStartHearing,
  closeDay,
  EMPTY_FILTERS,
  filterHearings,
  groupByStatus,
  hearingsForDay,
  isoDay,
  withHearingSession,
  type CourtHearing,
} from "./hearings";
import { nextOngoingListing } from "./order-draft";

/* The session stamps its marks with the real date, so the board is read for that day. */
const TODAY = isoDay(new Date());
const board = () => hearingsForDay(TODAY, TODAY);
const live = () => withHearingSession(board(), readHearingSession());
const statusOf = (id: string) => live().find((row) => row.id === id)?.status;

describe("hearing controls (order-generation §10)", () => {
  beforeEach(() => resetHearingSession(EMPTY_SESSION));

  it("lets several hearings be ongoing at once (HRG-06)", () => {
    const [a, b] = board();
    markHearingOngoing(a.id);
    markHearingOngoing(b.id);
    assert.equal(statusOf(a.id), "ongoing");
    assert.equal(statusOf(b.id), "ongoing");
  });

  it("starts a passed-over listing again the same day (HRG-04)", () => {
    const [a] = board();
    markHearingOngoing(a.id);
    markHearingPassedOver(a.id);
    assert.equal(statusOf(a.id), "passed-over");
    assert.ok(canStartHearing("passed-over"));
    markHearingOngoing(a.id);
    assert.equal(statusOf(a.id), "ongoing");
    assert.equal(readHearingSession().passedOverIds.has(a.id), false);
  });

  it("ends a Scheduled listing only from bulk, and never a passed-over one (HRG-02, CLS-10)", () => {
    assert.equal(canEndHearing("scheduled"), false);
    assert.equal(canEndHearingInBulk("scheduled"), true);
    assert.equal(canEndHearingInBulk("ongoing"), true);
    assert.equal(canEndHearingInBulk("passed-over"), false);
    assert.equal(canEndHearingInBulk("completed"), false);
    const [a] = board();
    markHearingsEnded([a.id]);
    assert.equal(statusOf(a.id), "completed");
  });

  it("treats Heard as final (HRG-03)", () => {
    assert.equal(canStartHearing("completed"), false);
    assert.equal(canPassOver("completed"), false);
    assert.equal(canPassOver("passed-over"), false);
  });

  it("groups by status in the board's order, keeping the sequence within (CLS-02)", () => {
    const rows: CourtHearing[] = [
      { ...board()[0], id: "x1", item: 1, status: "completed" },
      { ...board()[0], id: "x2", item: 2, status: "passed-over" },
      { ...board()[0], id: "x3", item: 3, status: "scheduled" },
      { ...board()[0], id: "x4", item: 4, status: "abandoned" },
      { ...board()[0], id: "x5", item: 5, status: "ongoing" },
      { ...board()[0], id: "x6", item: 6, status: "scheduled" },
    ];
    assert.deepEqual(
      groupByStatus(rows).map((row) => row.id),
      ["x5", "x3", "x6", "x2", "x1", "x4"],
    );
  });

  it("abandons what a past day left unheard, and keeps what was heard (HRG-05)", () => {
    const [a, b, c, d] = board();
    const closed = closeDay([
      { ...a, status: "scheduled" },
      { ...b, status: "ongoing" },
      { ...c, status: "passed-over" },
      { ...d, status: "completed" },
    ]).map((row) => row.status);
    assert.deepEqual(closed, [
      "abandoned",
      "abandoned",
      "abandoned",
      "completed",
    ]);
  });

  it("shows the last worked day closed, and nothing for any other past day", () => {
    const [a, b] = board();
    const yesterday = "2000-01-03";
    const session = {
      ...EMPTY_SESSION,
      previous: {
        day: yesterday,
        ongoingIds: new Set([a.id]),
        endedIds: new Set([b.id]),
        passedOverIds: new Set<string>(),
      },
    };
    const rows = boardForDay(yesterday, TODAY, session);
    assert.equal(rows.find((row) => row.id === a.id)?.status, "abandoned");
    assert.equal(rows.find((row) => row.id === b.id)?.status, "completed");
    assert.ok(
      rows.every(
        (row) => row.status === "abandoned" || row.status === "completed",
      ),
    );
    assert.deepEqual(boardForDay("2000-01-04", TODAY, session), []);
  });

  it("stamps today's marks with the day they were made on", () => {
    markHearingEnded(board()[0].id);
    assert.equal(readHearingSession().day, TODAY);
  });
});

describe("Next case (HRG-10)", () => {
  beforeEach(() => resetHearingSession(EMPTY_SESSION));

  it("is empty while no other hearing is ongoing, and starts nothing", () => {
    const [a] = board();
    markHearingOngoing(a.id);
    assert.equal(nextOngoingListing(a, readHearingSession()), undefined);
  });

  it("names the next ongoing hearing down the board, coming round to the top", () => {
    const rows = board();
    const [first, , third, , fifth] = rows;
    markHearingOngoing(first.id);
    markHearingOngoing(third.id);
    markHearingOngoing(fifth.id);
    const session = readHearingSession();
    assert.equal(nextOngoingListing(third, session)?.id, fifth.id);
    assert.equal(nextOngoingListing(fifth, session)?.id, first.id);
    assert.equal(session.ongoingIds.size, 3);
  });
});

describe("cause list filters (CLS-07)", () => {
  const rows = (): CourtHearing[] => [
    { ...board()[0], id: "y1", status: "scheduled" },
    { ...board()[1], id: "y2", status: "ongoing" },
    { ...board()[2], id: "y3", status: "completed" },
  ];
  const facts = {
    orderMark: (hearing: CourtHearing) =>
      hearing.id === "y2"
        ? ("draft" as const)
        : hearing.status === "completed"
          ? ("recorded" as const)
          : ("none" as const),
    nextHearingSet: (hearing: CourtHearing) => hearing.id === "y3",
  };
  const ids = (filters: Partial<typeof EMPTY_FILTERS>) =>
    filterHearings(rows(), { ...EMPTY_FILTERS, ...filters }, facts).map(
      (row) => row.id,
    );

  it("takes several statuses at once", () => {
    assert.deepEqual(ids({ statuses: ["scheduled", "completed"] }), [
      "y1",
      "y3",
    ]);
  });

  it("filters on the Orders column", () => {
    assert.deepEqual(ids({ orders: ["draft"] }), ["y2"]);
    assert.deepEqual(ids({ orders: ["none", "recorded"] }), ["y1", "y3"]);
  });

  it("filters on whether the next hearing is set", () => {
    assert.deepEqual(ids({ nextHearing: ["set"] }), ["y3"]);
    assert.deepEqual(ids({ nextHearing: ["unset"] }), ["y1", "y2"]);
  });

  it("narrows nothing when nothing is picked", () => {
    assert.deepEqual(ids({}), ["y1", "y2", "y3"]);
  });
});
