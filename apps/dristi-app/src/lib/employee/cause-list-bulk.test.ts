import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  markHearingsEnded,
  markHearingsPassedOver,
  readHearingSession,
  resetHearingSession,
  setHearingsNext,
} from "./hearing-session";
import {
  advocatesOnList,
  EMPTY_FILTERS,
  filterHearings,
  hearingsForDay,
  withHearingSession,
} from "./hearings";
import { NO_CAUSE_POSTING } from "./order-draft";

const TODAY = "2026-10-15";
const board = () => hearingsForDay(TODAY, TODAY);

describe("cause list bulk filters", () => {
  it("narrows by stage", () => {
    const rows = filterHearings(board(), { ...EMPTY_FILTERS, stages: ["evidence"] });
    assert.ok(rows.length > 0);
    assert.ok(rows.every((hearing) => hearing.stage === "evidence"));
  });

  it("narrows by any of several advocates on record, on either side", () => {
    const names = advocatesOnList(board()).slice(0, 2);
    const rows = filterHearings(board(), { ...EMPTY_FILTERS, advocates: names });
    assert.ok(rows.length > 0);
    assert.ok(
      rows.every((hearing) => hearing.counsel.some((c) => names.includes(c.name))),
    );
    const one = filterHearings(board(), { ...EMPTY_FILTERS, advocates: [names[0]] });
    assert.ok(rows.length >= one.length);
  });

  it("takes several stages and purposes at once", () => {
    const rows = filterHearings(board(), {
      ...EMPTY_FILTERS,
      stages: ["evidence", "appearance"],
      purposes: ["admission", "appearance"],
    });
    assert.ok(
      rows.every(
        (hearing) =>
          ["evidence", "appearance"].includes(hearing.stage) &&
          ["admission", "appearance"].includes(hearing.purpose),
      ),
    );
  });

  it("lists each advocate once, sorted", () => {
    const names = advocatesOnList(board());
    assert.deepEqual(names, [...new Set(names)].sort((a, b) => a.localeCompare(b)));
  });
});

describe("cause list bulk acts", () => {
  beforeEach(() => resetHearingSession());

  it("marks many hearings completed or passed over in one write", () => {
    const [a, b, c] = board();
    markHearingsEnded([a.id, b.id]);
    markHearingsPassedOver([c.id]);
    const rows = withHearingSession(board(), readHearingSession());
    const status = (id: string) => rows.find((row) => row.id === id)?.status;
    assert.equal(status(a.id), "completed");
    assert.equal(status(b.id), "completed");
    assert.equal(status(c.id), "passed-over");
  });

  it("sets only what was given and keeps the rest of each posting", () => {
    const [a, b] = board();
    setHearingsNext([a.id], { nextPurpose: "plea" }, NO_CAUSE_POSTING);
    setHearingsNext(
      [a.id, b.id],
      { next: "list", nextDate: "2026-11-02" },
      NO_CAUSE_POSTING,
    );
    const session = readHearingSession();
    assert.deepEqual(session.postings[a.id], {
      next: "list",
      nextPurpose: "plea",
      nextDate: "2026-11-02",
    });
    assert.equal(session.postings[b.id].nextPurpose, "");
  });
});
