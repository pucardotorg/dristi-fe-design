import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  causeListForDay,
  NEARBY_COUNT,
  NEARBY_RADIUS,
  nearbySittingDays,
  stepSittingDay,
} from "./cause-list-days";
import { EMPTY_SESSION } from "./hearing-session";
import { CAUSE_LIST, isSittingDay } from "./hearings";
import { listingLoad } from "./listing-load";

const TODAY = "2026-10-22";
const AHEAD = "2026-10-26";
const BEHIND = "2026-10-20";

describe("causeListForDay", () => {
  it("lists a day ahead as many matters as the Next hearing calendar counts on it", () => {
    const load = listingLoad(TODAY, EMPTY_SESSION.postings).get(AHEAD);
    assert.ok(load && load.total > 0);
    assert.equal(causeListForDay(AHEAD, TODAY, EMPTY_SESSION).length, load.total);
  });

  it("numbers a day's items from one, and nothing on a day ahead has been heard", () => {
    const list = causeListForDay(AHEAD, TODAY, EMPTY_SESSION);
    assert.deepEqual(
      list.map((hearing) => hearing.item),
      list.map((_, index) => index + 1),
    );
    assert.ok(list.every((hearing) => hearing.status === "scheduled"));
  });

  it("shows a past day as heard", () => {
    const list = causeListForDay(BEHIND, TODAY, EMPTY_SESSION);
    assert.ok(list.length > 0);
    assert.ok(list.every((hearing) => hearing.status === "completed"));
  });

  it("puts a matter posted from today's list on the day it was posted to", () => {
    const posted = CAUSE_LIST[0];
    const session = {
      ...EMPTY_SESSION,
      postings: {
        [posted.id]: { next: "list" as const, nextDate: AHEAD, nextPurpose: "arguments" as const },
      },
    };
    const before = causeListForDay(AHEAD, TODAY, EMPTY_SESSION).length;
    const list = causeListForDay(AHEAD, TODAY, session);
    assert.equal(list.length, before + 1);
    const entry = list.find((hearing) => hearing.caseNumber === posted.caseNumber);
    assert.equal(entry?.purpose, "arguments");
  });

  it("keeps today as the live board", () => {
    assert.equal(
      causeListForDay(TODAY, TODAY, EMPTY_SESSION).length,
      CAUSE_LIST.filter((hearing) => hearing.status !== "rescheduled" && hearing.status !== "abandoned").length,
    );
  });
});

describe("nearbySittingDays", () => {
  it("puts the chosen day in the middle of eleven, stepping over weekends", () => {
    const days = nearbySittingDays("2026-10-26", TODAY);
    assert.equal(days.length, NEARBY_COUNT);
    assert.equal(days[NEARBY_RADIUS], "2026-10-26");
    assert.equal(days[NEARBY_RADIUS - 1], "2026-10-23");
    assert.ok(days.every((day) => isSittingDay(day)));
  });

  it("steps from a Friday to the Monday", () => {
    assert.equal(stepSittingDay("2026-10-23", 1, TODAY), "2026-10-26");
    assert.equal(stepSittingDay("2026-10-26", -1, TODAY), "2026-10-23");
  });

  it("keeps a weekend today reachable", () => {
    assert.equal(stepSittingDay("2026-10-23", 1, "2026-10-24"), "2026-10-24");
  });
});
