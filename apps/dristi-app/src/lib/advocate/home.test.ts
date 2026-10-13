import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  at,
  junior,
  kase,
  makeTask,
  NOW,
  otherCase,
  PEOPLE,
  senior,
  senior2,
} from "@/lib/tasks/fixtures";
import type { Case } from "@/lib/tasks/types";
import type { World } from "@/lib/tasks/selectors";
import { canView } from "@/lib/tasks/permissions";
import {
  accessOf,
  advocateRosterOn,
  filterSlotHearings,
  NO_SLOT_FILTER,
  peopleOptionsOf,
  boardOf,
  caseRecordFor,
  causeListOn,
  courtLabelsOf,
  courtRooms,
  dayKeyOf,
  daySlotsOn,
  hearingsOn,
  holdsVakalatnama,
  inOneCourt,
  matterCountOn,
  nextHearingDayAfter,
  prepAhead,
  prepGroups,
  railGroups,
  railTasks,
  teamOf,
  timelineOn,
  weekOf,
  weightOf,
} from "./home";
import { V1_LAUNCH, V1_TWO_SITTINGS, V3_FULL } from "./config";

const NOW_MS = new Date(NOW).getTime();

/** A case listed `days` from NOW at a local hour, in a court, viewable by senior. */
function listed(id: string, days: number, hour: number, court = kase.court): Case {
  return {
    ...kase,
    id,
    stNumber: `ST ${id}/2025`,
    parties: `${id} v. X`,
    court,
    nextHearingAt: at(days, hour),
  };
}

function world(cases: Case[], tasks: World["tasks"] = []): World {
  return { people: PEOPLE, cases, tasks, user: senior, now: NOW };
}

describe("dayKeyOf", () => {
  it("keys by the local calendar day", () => {
    assert.equal(dayKeyOf(at(0, 10)), dayKeyOf(at(0, 16)));
    assert.notEqual(dayKeyOf(at(0, 10)), dayKeyOf(at(1, 10)));
  });
});

describe("hearingsOn", () => {
  it("numbers the day's items in time order and splits status by the clock", () => {
    // NOW is 12:00Z; local hours here bracket it.
    const w = world([
      listed("late", 0, 22),
      listed("early", 0, 6),
      listed("tomorrow", 1, 10),
    ]);
    const today = dayKeyOf(at(0, 12));
    const items = hearingsOn(w, kase.court, today, NOW_MS);

    assert.deepEqual(
      items.map((h) => h.kase.id),
      ["early", "late"]
    );
    assert.deepEqual(
      items.map((h) => h.item),
      [1, 2]
    );
    assert.equal(items[0].status, "concluded");
    assert.equal(items[1].status, "upcoming");
  });

  it("marks an item live while the clock sits inside its listed window", () => {
    const startedJustNow = new Date(NOW_MS - 10 * 60 * 1000).toISOString();
    const w = world([{ ...kase, nextHearingAt: startedJustNow }]);
    const items = hearingsOn(w, kase.court, dayKeyOf(startedJustNow), NOW_MS);
    assert.equal(items[0].status, "now");
  });

  it("excludes cases the user cannot view", () => {
    const w: World = { ...world([listed("mine", 0, 15), { ...otherCase, nextHearingAt: at(0, 15) }]), user: senior };
    const today = dayKeyOf(at(0, 12));
    assert.equal(hearingsOn(w, kase.court, today, NOW_MS).length, 1);
    assert.equal(hearingsOn(w, otherCase.court, today, NOW_MS).length, 0);
  });

  it("attaches only actionable blocking tasks as blockers, and ready follows", () => {
    const c = listed("blocked", 0, 15);
    const w = world(
      [c, listed("clear", 0, 16)],
      [
        makeTask({ id: "t-block", caseId: c.id, isBlocking: true, status: "open" }),
        makeTask({ id: "t-done", caseId: c.id, isBlocking: true, status: "done" }),
        makeTask({ id: "t-plain", caseId: c.id, isBlocking: false, status: "open" }),
      ]
    );
    const today = dayKeyOf(at(0, 12));
    const [blocked, clear] = hearingsOn(w, kase.court, today, NOW_MS);
    assert.deepEqual(blocked.blockers.map((t) => t.id), ["t-block"]);
    assert.equal(blocked.ready, false);
    assert.equal(clear.ready, true);
  });
});

describe("passedOver", () => {
  it("carries a matter's passed-over flag onto the hearing and cause-list row", () => {
    const w = world([
      { ...listed("po", 0, 6), passedOver: true },
      listed("done", 0, 6),
    ]);
    const day = dayKeyOf(at(0, 12));
    const items = hearingsOn(w, kase.court, day, NOW_MS);
    assert.equal(items.find((h) => h.kase.id === "po")?.passedOver, true);
    assert.equal(items.find((h) => h.kase.id === "done")?.passedOver, false);
    assert.equal(causeListOn(w, day, NOW_MS).find((r) => r.id === "po")?.passedOver, true);
  });

  it("keeps a matter passed over today among the upcoming, not the concluded", () => {
    const w = world([
      { ...listed("po", 0, 6), passedOver: true },
      listed("done", 0, 6),
    ]);
    const day = dayKeyOf(at(0, 12));
    const items = hearingsOn(w, kase.court, day, NOW_MS);
    assert.equal(items.find((h) => h.kase.id === "po")?.status, "upcoming");
    assert.equal(items.find((h) => h.kase.id === "done")?.status, "concluded");
  });

  it("tags a matter carried over from an earlier day with that day, and lists it normally", () => {
    const carried = "2026-01-01T12:00:00.000Z";
    const w = world([{ ...listed("co", 0, 22), passedOverOn: carried }]);
    const day = dayKeyOf(at(0, 12));
    const [h] = hearingsOn(w, kase.court, day, NOW_MS);
    assert.equal(h.status, "upcoming");
    assert.equal(h.passedOver, true);
    assert.equal(h.passedOverOn, carried);
  });
});

describe("boardOf", () => {
  it("splits the day into now, upcoming and concluded", () => {
    const startedJustNow = new Date(NOW_MS - 10 * 60 * 1000).toISOString();
    const w = world([
      listed("gone", 0, 6),
      { ...listed("live", 0, 12), nextHearingAt: startedJustNow },
      listed("next", 0, 22),
    ]);
    const board = boardOf(w, kase.court, dayKeyOf(at(0, 12)), NOW_MS);
    assert.equal(board.now?.kase.id, "live");
    assert.deepEqual(board.upcoming.map((h) => h.kase.id), ["next"]);
    assert.deepEqual(board.concluded.map((h) => h.kase.id), ["gone"]);
  });

  it("keeps a second live item on the board, as still to be called", () => {
    // Two listed windows overlapping: only one matter is being called, and the
    // other must not fall through every filter.
    const a = new Date(NOW_MS - 20 * 60 * 1000).toISOString();
    const b = new Date(NOW_MS - 5 * 60 * 1000).toISOString();
    const w = world([
      { ...listed("first", 0, 12), nextHearingAt: a },
      { ...listed("second", 0, 12), nextHearingAt: b },
    ]);
    const board = boardOf(w, kase.court, dayKeyOf(a), NOW_MS);
    assert.equal(board.now?.kase.id, "first");
    assert.deepEqual(board.upcoming.map((h) => h.kase.id), ["second"]);
    assert.deepEqual(board.concluded, []);
  });
});

describe("courtRooms", () => {
  it("puts the ON court first and counts the selected day per court", () => {
    const w = world([
      listed("j1", 0, 15, "JMFC Court 1"),
      listed("on1", 0, 15),
      listed("on2", 0, 16),
      listed("cjm-tomorrow", 1, 15, "CJM Court"),
    ]);
    const rooms = courtRooms(w, dayKeyOf(at(0, 12)), NOW_MS);
    assert.deepEqual(
      rooms.map((r) => [r.court, r.count]),
      [
        ["24×7 ON Court", 2],
        ["CJM Court", 0],
        ["JMFC Court 1", 1],
      ]
    );
    assert.equal(matterCountOn(w, dayKeyOf(at(0, 12)), NOW_MS), 3);
  });
});

describe("inOneCourt", () => {
  it("lists every matter in the one court, numbered as one cause list", () => {
    const w = inOneCourt(
      world([
        listed("j1", 0, 15, "JMFC Court 1"),
        listed("on1", 0, 11),
        listed("cjm1", 0, 13, "CJM Court"),
      ]),
      "24×7 ON Court"
    );
    const day = dayKeyOf(at(0, 12));
    assert.deepEqual(courtRooms(w, day, NOW_MS).map((r) => [r.court, r.count]), [["24×7 ON Court", 3]]);
    assert.deepEqual(
      hearingsOn(w, "24×7 ON Court", day, NOW_MS).map((h) => [h.kase.id, h.item]),
      [["on1", 1], ["cjm1", 2], ["j1", 3]]
    );
  });

  it("returns the same world when every case is already in the court", () => {
    const w = world([listed("on1", 0, 11)]);
    assert.equal(inOneCourt(w, "24×7 ON Court"), w);
  });
});

describe("courtLabelsOf", () => {
  const SAMPLE_COURTS = [
    "24×7 ON Court, Sample District",
    "JMFC Court 1, Sample District",
    "JMFC Court 2, Sample District",
    "CJM Court, Sample District",
  ];

  it("names the shared trailing run once and strips it from every court", () => {
    const { establishment, shortOf } = courtLabelsOf(SAMPLE_COURTS);
    assert.equal(establishment, "Sample District");
    assert.equal(shortOf("JMFC Court 1, Sample District"), "JMFC Court 1");
    assert.equal(shortOf("24×7 ON Court, Sample District"), "24×7 ON Court");
  });

  it("takes the longest common run, not just the last segment", () => {
    const { establishment, shortOf } = courtLabelsOf([
      "JMFC Court 1, Sample District, Kerala",
      "CJM Court, Sample District, Kerala",
    ]);
    assert.equal(establishment, "Sample District, Kerala");
    assert.equal(shortOf("CJM Court, Sample District, Kerala"), "CJM Court");
  });

  it("falls through to full names when nothing is shared", () => {
    const unrelated = ["Sessions Court, Sample District", "JMFC Court 1, Kochi"];
    const { establishment, shortOf } = courtLabelsOf(unrelated);
    assert.equal(establishment, null);
    for (const court of unrelated) assert.equal(shortOf(court), court);
  });

  it("falls through for a single court — there is nothing to say once", () => {
    const { establishment, shortOf } = courtLabelsOf(["CJM Court, Sample District"]);
    assert.equal(establishment, null);
    assert.equal(shortOf("CJM Court, Sample District"), "CJM Court, Sample District");
  });

  it("never strips a court down to nothing", () => {
    // "Sample District" is the whole name of one court, so the run has to stop before it
    // — otherwise that heading would render empty.
    const { establishment, shortOf } = courtLabelsOf(["Sample District", "CJM Court, Sample District"]);
    assert.equal(establishment, null);
    assert.equal(shortOf("Sample District"), "Sample District");
  });

  it("is unaffected by a repeated court name", () => {
    const { establishment } = courtLabelsOf([
      "CJM Court, Sample District",
      "CJM Court, Sample District",
    ]);
    assert.equal(establishment, null);
  });
});

describe("advocateRosterOn", () => {
  const today = () => dayKeyOf(at(0, 12));

  it("leads with the signed-in advocate, then the rest by name", () => {
    // senior (Anjali) sees both; senior2 (R. Manoj) is on one, junior (S. Prakash)
    // on the other. Alphabetical after self: "R. Manoj" then "S. Prakash".
    const withManoj: Case = {
      ...listed("a", 0, 15),
      signatories: [senior.id],
      advocates: [senior.id, senior2.id],
    };
    const withPrakash: Case = {
      ...listed("b", 0, 16),
      signatories: [senior.id],
      advocates: [senior.id, junior.id],
    };
    const roster = advocateRosterOn(world([withManoj, withPrakash]), today(), NOW_MS);

    assert.deepEqual(
      roster.map((o) => [o.person.id, o.count, o.you]),
      [
        [senior.id, 2, true],
        [senior2.id, 1, false],
        [junior.id, 1, false],
      ]
    );
  });

  it("counts a colleague's share of the day, not their own board", () => {
    // The world is viewer-scoped, so a matter the viewer cannot see is not in it
    // to be counted — the colleague's number is the matters they *share*.
    const shared: Case = {
      ...listed("shared", 0, 15),
      signatories: [senior.id],
      advocates: [senior.id, senior2.id],
    };
    const mineAlone: Case = {
      ...listed("mine", 0, 16),
      signatories: [senior.id],
      advocates: [senior.id],
    };
    const theirs: Case = {
      ...otherCase,
      id: "theirs",
      court: kase.court,
      nextHearingAt: at(0, 17),
      signatories: [senior2.id],
      advocates: [senior2.id],
    };
    const roster = advocateRosterOn(
      world([shared, mineAlone, theirs]),
      today(),
      NOW_MS
    );

    assert.deepEqual(
      roster.map((o) => [o.person.id, o.count]),
      [
        [senior.id, 2],
        [senior2.id, 1],
      ]
    );
  });

  it("counts everyone on the case, whether or not they hold the vakalatnama", () => {
    const c: Case = {
      ...listed("c", 0, 15),
      signatories: [senior.id],
      advocates: [senior.id, junior.id],
    };
    const roster = advocateRosterOn(world([c]), today(), NOW_MS);
    assert.deepEqual(
      roster.map((o) => o.person.id),
      [senior.id, junior.id]
    );
  });

  it("keeps the signed-in advocate on a day that lists nothing", () => {
    const roster = advocateRosterOn(world([listed("later", 4, 15)]), today(), NOW_MS);
    assert.deepEqual(
      roster.map((o) => [o.person.id, o.count, o.you]),
      [[senior.id, 0, true]]
    );
  });

  it("counts a matter once, however many courts the day spans", () => {
    const w = world([
      listed("on", 0, 15),
      listed("jmfc", 0, 15, "JMFC Court 1"),
    ]);
    const roster = advocateRosterOn(w, today(), NOW_MS);
    assert.equal(roster[0].count, 2);
  });
});

describe("advocate chips (board filter)", () => {
  // The toolbar's avatar chips replaced the R4 Select but drive the same path:
  // the roster comes from `advocateRosterOn`, and clicking a chip filters the
  // board with `canView(active, h.kase)`. These pin the two behaviours the chips
  // depend on — the default is you, and a colleague chip narrows the board to
  // the matters shared with them.
  const today = () => dayKeyOf(at(0, 12));
  const shared: Case = {
    ...listed("shared", 0, 15),
    signatories: [senior.id],
    advocates: [senior.id, senior2.id],
  };
  const mineAlone: Case = {
    ...listed("mine", 0, 16),
    signatories: [senior.id],
    advocates: [senior.id],
  };

  it("defaults to you, with the whole board visible", () => {
    const w = world([shared, mineAlone]);
    const roster = advocateRosterOn(w, today(), NOW_MS);
    assert.equal(roster[0].you, true);
    assert.equal(roster[0].person.id, senior.id);

    const visible = hearingsOn(w, kase.court, today(), NOW_MS).filter((h) =>
      canView(senior.id, h.kase)
    );
    assert.deepEqual(visible.map((h) => h.kase.id).sort(), ["mine", "shared"]);
  });

  it("narrows the board to the matters a chosen colleague shares", () => {
    const w = world([shared, mineAlone]);
    // senior2 is on the control (they share one matter today)…
    const roster = advocateRosterOn(w, today(), NOW_MS);
    assert.ok(roster.some((o) => o.person.id === senior2.id && !o.you));

    // …and picking their chip filters the board to that one matter.
    const visible = hearingsOn(w, kase.court, today(), NOW_MS).filter((h) =>
      canView(senior2.id, h.kase)
    );
    assert.deepEqual(visible.map((h) => h.kase.id), ["shared"]);
  });
});

describe("weekOf", () => {
  it("runs Monday to Sunday around now, dotting hearing and due days", () => {
    const w = world(
      // `kase` itself is in the world so its task is visible to the user.
      [listed("h", 1, 15), kase],
      [makeTask({ id: "t-due", caseId: kase.id, dueAt: at(2, 17), status: "open" })]
    );
    const cells = weekOf(w, NOW_MS);
    assert.equal(cells.length, 7);
    assert.equal(cells[0].at.getDay(), 1); // Monday
    assert.equal(cells.filter((c) => c.today).length, 1);
    const byKey = new Map(cells.map((c) => [c.key, c]));
    assert.equal(byKey.get(dayKeyOf(at(1, 12)))?.hearings, 1);
    assert.equal(byKey.get(dayKeyOf(at(2, 12)))?.due, 1);
  });
});

describe("nextHearingDayAfter", () => {
  it("finds the nearest later day with anything listed, across courts", () => {
    const w = world([
      listed("today", 0, 15),
      listed("in3", 3, 15, "JMFC Court 1"),
      listed("in3b", 3, 16),
      listed("in9", 9, 15),
    ]);
    const next = nextHearingDayAfter(w, dayKeyOf(at(0, 12)));
    assert.deepEqual(next, { key: dayKeyOf(at(3, 12)), count: 2 });
    assert.equal(nextHearingDayAfter(w, dayKeyOf(at(9, 12))), null);
  });
});

describe("weekOf anchor", () => {
  it("pages to another week while today stays in this one", () => {
    const w = world([kase]);
    const nextWeek = weekOf(w, NOW_MS, NOW_MS + 7 * 24 * 60 * 60 * 1000);
    assert.equal(nextWeek.length, 7);
    assert.equal(nextWeek[0].at.getDay(), 1);
    assert.equal(nextWeek.filter((c) => c.today).length, 0);
    assert.equal(nextWeek[0].key > dayKeyOf(NOW_MS), true);
  });
});

describe("railGroups", () => {
  it("buckets into exactly today (overdue folded in) and the next 3 days", () => {
    const w = world(
      [kase],
      [
        makeTask({ id: "t-over", dueAt: at(-2, 17), status: "open" }),
        makeTask({ id: "t-today", dueAt: at(0, 17), status: "open" }),
        makeTask({ id: "t-tomorrow", dueAt: at(1, 17), status: "open" }),
        makeTask({ id: "t-day3", dueAt: at(3, 17), status: "open" }),
        makeTask({ id: "t-day5", dueAt: at(5, 17), status: "open" }),
        makeTask({ id: "t-beyond", dueAt: at(12, 17), status: "open" }),
        makeTask({ id: "t-undated", dueKind: "none", dueAt: undefined, status: "open" }),
      ]
    );
    const groups = railGroups(w, NOW_MS);
    assert.deepEqual(
      groups.map((g) => [g.key, g.tasks.map((t) => t.id)]),
      [
        ["today", ["t-over", "t-today"]],
        ["soon", ["t-tomorrow", "t-day3"]],
      ]
    );
  });
});

describe("weightOf", () => {
  it("calls a posting substantial when it records or decides something", () => {
    for (const stage of [
      "Evidence of the complainant",
      "Evidence of the accused",
      "Cross-examination",
      "Plea",
      "Arguments",
      "Judgment",
    ]) {
      assert.equal(weightOf(stage), "substantial", stage);
    }
    for (const stage of ["Appearance", "Cognizance", "Pre-filing"]) {
      assert.equal(weightOf(stage), "procedural", stage);
    }
  });
});

describe("prepAhead", () => {
  it("lists substantial postings ahead of today, soonest first, inside the horizon", () => {
    const evidenceToday = { ...listed("today", 0, 15), stage: "Arguments" };
    const evidenceSoon = { ...listed("soon", 2, 10), stage: "Evidence of the complainant" };
    const argumentsLater = { ...listed("later", 9, 10), stage: "Arguments" };
    const appearanceSoon = { ...listed("appearance", 1, 10), stage: "Appearance" };
    const beyondHorizon = { ...listed("far", 30, 10), stage: "Arguments" };
    const w = world([
      evidenceToday,
      evidenceSoon,
      argumentsLater,
      appearanceSoon,
      beyondHorizon,
    ]);

    // Today is the board's business; an appearance needs presence, not preparation.
    const queue = prepAhead(w, NOW_MS);
    assert.deepEqual(queue.map((i) => i.kase.id), ["soon", "later"]);
    assert.deepEqual(queue.map((i) => i.inDays), [2, 9]);
  });

  it("queues a substantial posting with nothing pending — lead time is the point", () => {
    const clear = { ...listed("clear", 4, 10), stage: "Cross-examination" };
    const w = world([clear]);
    const [item] = prepAhead(w, NOW_MS);
    assert.equal(item.kase.id, "clear");
    assert.deepEqual(item.blockers, []);
  });

  it("carries open blocking work as a second cue", () => {
    const c = { ...listed("blocked", 3, 10), stage: "Evidence of the complainant" };
    const w = world(
      [c],
      [
        makeTask({ id: "b1", caseId: c.id, isBlocking: true, status: "open" }),
        makeTask({ id: "done", caseId: c.id, isBlocking: true, status: "done" }),
      ]
    );
    assert.deepEqual(prepAhead(w, NOW_MS)[0].blockers.map((t) => t.id), ["b1"]);
  });

  it("splits into the next seven days and the fortnight after", () => {
    const w = world([
      { ...listed("wk", 5, 10), stage: "Arguments" },
      { ...listed("later", 15, 10), stage: "Evidence of the complainant" },
    ]);
    assert.deepEqual(
      prepGroups(w, NOW_MS).map((g) => [g.key, g.items.map((i) => i.kase.id)]),
      [
        ["week", ["wk"]],
        ["later", ["later"]],
      ]
    );
  });
});

describe("teamOf", () => {
  it("puts vakalatnama holders first and marks who acts and who is you", () => {
    const shared: Case = {
      ...kase,
      signatories: ["p-sen2", senior.id],
      advocates: ["p-jun", "p-sen2", senior.id],
    };
    const team = teamOf(world([shared]), shared);
    assert.deepEqual(
      team.map((m) => [m.person.id, m.acts]),
      [["p-sen2", true], [senior.id, true], ["p-jun", false]]
    );
    assert.deepEqual(
      team.filter((m) => m.you).map((m) => m.person.id),
      [senior.id]
    );
  });
});

describe("caseRecordFor", () => {
  it("bridges a sandbox case to its cases-world record, hearing overriding", () => {
    const sandboxCase = { ...kase, id: "c-412", stage: "Evidence of the complainant" };
    const record = caseRecordFor(sandboxCase, at(0, 10));
    assert.ok(record);
    assert.equal(record.id, "tw-c-412");
    assert.equal(record.nextHearing?.on, dayKeyOf(at(0, 10)));
    assert.equal(record.nextHearing?.purpose, "Evidence of the complainant");
    assert.equal(caseRecordFor({ ...kase, id: "c-nope" }), null);
  });
});

describe("holdsVakalatnama", () => {
  it("is true only for signatories", () => {
    const w = world([kase]);
    assert.equal(holdsVakalatnama(w, kase), true);
    assert.equal(
      holdsVakalatnama(w, { ...kase, signatories: ["p-sen2"] }),
      false
    );
  });
});

describe("railTasks", () => {
  it("is the needs-action view in canonical order, unsliced", () => {
    const w = world(
      [kase],
      [
        makeTask({ id: "t-later", dueAt: at(6, 17), status: "open" }),
        makeTask({ id: "t-overdue", dueAt: at(-2, 17), status: "open" }),
        makeTask({ id: "t-block", isBlocking: true, dueAt: at(4, 17), status: "open" }),
        makeTask({ id: "t-waiting", status: "awaiting-court" }),
        makeTask({ id: "t-outside", caseId: otherCase.id, status: "open" }),
      ]
    );
    // Outsider's case is invisible to senior; waiting tasks sit in another tab.
    // Order is whatever `sortTasks`/`compareUrgency` decree — the rail mirrors
    // /tasks exactly rather than re-deriving its own ranking.
    assert.deepEqual(
      railTasks(w).map((t) => t.id),
      ["t-overdue", "t-block", "t-later"]
    );
  });
});

describe("timelineOn", () => {
  const startedJustNow = new Date(NOW_MS - 10 * 60 * 1000).toISOString();
  // A day across two courts: a concluded slot both share, one matter being
  // called now, a clear upcoming slot, and an upcoming slot both share.
  const day = dayKeyOf(at(0, 12));
  const scene = () =>
    world([
      listed("c1", 0, 6, "Court A"),
      listed("c2", 0, 6, "Court B"),
      { ...listed("live", 0, 12, "Court A"), nextHearingAt: startedJustNow },
      listed("u1", 0, 22, "Court A"),
      listed("x1", 0, 23, "Court A"),
      listed("x2", 0, 23, "Court B"),
    ]);

  it("groups matters across courts into time slots, splitting the day into zones", () => {
    const t = timelineOn(scene(), day, NOW_MS);

    assert.deepEqual(t.concluded.map((s) => s.key), ["06:00"]);
    assert.equal(t.now.length, 1);
    assert.equal(t.now[0].hearings[0].kase.id, "live");
    assert.deepEqual(t.upcoming.map((s) => s.key), ["22:00", "23:00"]);
  });

  it("flags a slot with two or more hearings as a conflict", () => {
    const t = timelineOn(scene(), day, NOW_MS);
    const conflict = t.slots.find((s) => s.key === "23:00")!;
    assert.equal(conflict.conflict, true);
    assert.equal(conflict.hearings.length, 2);
    assert.deepEqual(conflict.courts.sort(), ["Court A", "Court B"]);

    const clear = t.slots.find((s) => s.key === "22:00")!;
    assert.equal(clear.conflict, false);
  });

  it("counts the summary over every slot", () => {
    const { summary } = timelineOn(scene(), day, NOW_MS);
    assert.equal(summary.total, 6);
    assert.equal(summary.conflictSlots, 2); // 06:00 and 23:00
    assert.equal(summary.overlap, 4); // two hearings in each conflict slot
    assert.equal(summary.clearSlots, 2); // the now slot and 22:00
    assert.equal(summary.courts, 2);
  });

  it("keeps each court's own cause-list numbering inside a shared slot", () => {
    const t = timelineOn(scene(), day, NOW_MS);
    const conflict = t.slots.find((s) => s.key === "23:00")!;
    const b = conflict.hearings.find((h) => h.court === "Court B")!;
    // Court B lists only c2 (06:00) then x2 (23:00), so x2 is its item 2.
    assert.equal(b.item, 2);
    assert.equal(b.courtLabel, "Court B");
  });

  it("marks only the latest started slot as now, not every recent one", () => {
    // Two slots both inside the 90-minute window; only the later one is "now",
    // the earlier has been called and concluded.
    const earlier = new Date(NOW_MS - 60 * 60 * 1000).toISOString();
    const later = new Date(NOW_MS - 10 * 60 * 1000).toISOString();
    const w = world([
      { ...listed("earlier", 0, 11, "Court A"), nextHearingAt: earlier },
      { ...listed("later", 0, 11, "Court A"), nextHearingAt: later },
    ]);
    const t = timelineOn(w, dayKeyOf(at(0, 12)), NOW_MS);
    assert.equal(t.now.length, 1);
    assert.equal(t.now[0].hearings[0].kase.id, "later");
    assert.equal(
      t.concluded.some((s) => s.hearings[0].kase.id === "earlier"),
      true
    );
  });

  it("points the next hint at the first upcoming slot", () => {
    const t = timelineOn(scene(), day, NOW_MS);
    assert.equal(t.next?.key, "22:00");
  });

  it("narrows to the chosen courts and rescopes the summary", () => {
    const t = timelineOn(scene(), day, NOW_MS, ["Court B"]);
    assert.deepEqual(
      t.slots.map((s) => s.key),
      ["06:00", "23:00"]
    );
    assert.equal(t.summary.total, 2);
    assert.equal(t.summary.conflictSlots, 0);
    assert.equal(t.summary.courts, 1);
  });

  it("treats an empty filter as every court", () => {
    const all = timelineOn(scene(), day, NOW_MS);
    const none = timelineOn(scene(), day, NOW_MS, []);
    assert.equal(none.summary.total, all.summary.total);
  });
});

describe("daySlotsOn", () => {
  const startedJustNow = new Date(NOW_MS - 10 * 60 * 1000).toISOString();
  const day = dayKeyOf(at(0, 12));
  // A day across two courts: a concluded pair (06:00), one matter being called
  // now, a clear upcoming matter (22:00), and an upcoming pair sharing a clock
  // time (23:00). Hours are picked to bracket NOW in any daytime timezone, as the
  // other selector tests do.
  const scene = () =>
    world([
      listed("c1", 0, 6, "Court A"),
      listed("c2", 0, 6, "Court B"),
      { ...listed("live", 0, 12, "Court A"), nextHearingAt: startedJustNow },
      listed("u1", 0, 22, "Court A"),
      listed("x1", 0, 23, "Court A"),
      listed("x2", 0, 23, "Court B"),
    ]);

  it("builds one flat board for a single sitting — ongoing grouped, the rest one slot each", () => {
    const slots = daySlotsOn(scene(), day, NOW_MS, V1_LAUNCH);
    assert.equal(slots.length, 1); // one sitting → one slot, no tab bar
    const { board } = slots[0];
    // Concluded and upcoming are single-hearing slots (a flat list), even where
    // two share a clock time — x1/x2 at 23:00 are NOT merged.
    assert.equal(board.concluded.length, 2);
    assert.ok(board.concluded.every((s) => s.hearings.length === 1));
    assert.equal(board.upcoming.length, 3);
    assert.ok(board.upcoming.every((s) => s.hearings.length === 1));
    // The matters being called now are the one group.
    assert.equal(board.now.length, 1);
    assert.deepEqual(board.now[0].hearings.map((h) => h.kase.id), ["live"]);
    // No conflict is surfaced in the flat view.
    assert.equal(board.summary.conflictSlots, 0);
    assert.equal(board.summary.total, 6);
  });

  it("restores time-grouping and conflicts under the full config", () => {
    const slots = daySlotsOn(scene(), day, NOW_MS, V3_FULL);
    assert.equal(slots.length, 1);
    const { board } = slots[0];
    // 23:00 is now one shared slot with both matters — a conflict.
    const conflict = board.upcoming.find((s) => s.key === "23:00")!;
    assert.equal(conflict.hearings.length, 2);
    assert.equal(conflict.conflict, true);
    assert.ok(board.summary.conflictSlots > 0);
  });

  it("splits the day into two sittings, nothing dropped", () => {
    const slots = daySlotsOn(scene(), day, NOW_MS, V1_TWO_SITTINGS);
    assert.equal(slots.length, 2);
    const idsIn = (i: number) =>
      slots[i].board.slots.flatMap((sl) => sl.hearings.map((h) => h.kase.id));
    // Matters outside both windows join the nearest sitting, so the concluded
    // pair (06:00) lands in the morning and the upcoming trio (22:00/23:00) in
    // the afternoon.
    assert.ok(["c1", "c2"].every((id) => idsIn(0).includes(id)));
    assert.ok(["u1", "x1", "x2"].every((id) => idsIn(1).includes(id)));
  });

  it("marks the sitting the clock is inside as live, today only", () => {
    // A window built around NOW's own local hour so it holds the clock whatever
    // the timezone; a second window that cannot.
    const h = new Date(NOW_MS).getHours();
    const pad = (n: number) => String(n).padStart(2, "0");
    const config = {
      ...V1_LAUNCH,
      sittings: [
        { start: `${pad(h)}:00`, end: `${pad(h)}:59` },
        { start: "00:00", end: "00:01" },
      ],
    };
    const today = daySlotsOn(scene(), day, NOW_MS, config);
    assert.equal(today[0].live, true);
    assert.equal(today[1].live, false);
    // A past day is over, so no sitting throbs even where the clock's hour falls.
    const past = daySlotsOn(scene(), dayKeyOf(at(-1, 12)), NOW_MS, config);
    assert.ok(past.every((s) => !s.live));
  });
});

describe("sitting filters", () => {
  const day = dayKeyOf(at(0, 12));
  // Senior (the viewer) holds the Vakalatnama on "own" with R. Manoj; on
  // "office" only S. Prakash holds it and the viewer is on the case through
  // office access.
  const scene = () =>
    world([
      listed("own", 0, 22),
      {
        ...listed("office", 0, 23, "Court B"),
        signatories: [junior.id],
        advocates: [junior.id, senior.id],
      },
    ]);
  const hearingsOf = (w: World) => daySlotsOn(w, day, NOW_MS, V1_LAUNCH)[0].hearings;
  const ids = (hs: { kase: Case }[]) => hs.map((h) => h.kase.id).sort();

  it("keeps everything by default, and only the viewer's Vakalatnama under My hearings", () => {
    const w = scene();
    assert.deepEqual(ids(filterSlotHearings(w, hearingsOf(w), NO_SLOT_FILTER)), ["office", "own"]);
    assert.deepEqual(
      ids(filterSlotHearings(w, hearingsOf(w), { ...NO_SLOT_FILTER, scope: "mine" })),
      ["own"]
    );
  });

  it("shows only office-access matters under Office access", () => {
    const w = scene();
    assert.deepEqual(
      ids(filterSlotHearings(w, hearingsOf(w), { ...NO_SLOT_FILTER, scope: "office" })),
      ["office"]
    );
  });

  it("keeps the viewer's own hearings when every colleague is unticked", () => {
    const w = scene();
    // Unticking S. Prakash drops the matter only he holds; "own" stays because
    // the viewer is on its Vakalatnama, and the viewer can never be unticked.
    const hidden = filterSlotHearings(w, hearingsOf(w), { ...NO_SLOT_FILTER, hidden: [junior.id] });
    assert.deepEqual(ids(hidden), ["own"]);
  });

  it("matches a ticked person on the Vakalatnama only, never on office access", () => {
    const w = scene();
    // S. Prakash is on "own" as an advocate but not its Vakalatnama: no match.
    const byPrakash = filterSlotHearings(w, hearingsOf(w), { ...NO_SLOT_FILTER, people: [junior.id] });
    assert.deepEqual(ids(byPrakash), ["office"]);
    const byManoj = filterSlotHearings(w, hearingsOf(w), { ...NO_SLOT_FILTER, people: [senior2.id] });
    assert.deepEqual(ids(byManoj), ["own"]);
  });

  it("narrows only the sitting the filter belongs to", () => {
    const w = scene();
    const slots = daySlotsOn(w, day, NOW_MS, V1_LAUNCH, {
      "sitting-0": { ...NO_SLOT_FILTER, courts: ["Court B"] },
    });
    assert.equal(slots[0].board.summary.total, 1);
    // The unfiltered matters stay on the slot for the filters' own options.
    assert.equal(slots[0].hearings.length, 2);
  });

  it("offers everyone else on the Vakalatnamas in scope, alphabetically, without the viewer", () => {
    const w = scene();
    const all = peopleOptionsOf(w, hearingsOf(w), "all").map((o) => o.person.name);
    assert.deepEqual(all, ["R. Manoj", "S. Prakash"]);
    const mine = peopleOptionsOf(w, hearingsOf(w), "mine").map((o) => o.person.name);
    assert.deepEqual(mine, ["R. Manoj"]);
  });

  it("says how the viewer reaches a matter and who holds its Vakalatnama", () => {
    const w = scene();
    const [office, own] = ["office", "own"].map((id) => w.cases.find((c) => c.id === id)!);
    assert.equal(accessOf(w, own).office, false);
    assert.deepEqual(accessOf(w, own).vakalatnama.map((p) => p.name), ["Anjali Nair", "R. Manoj"]);
    assert.equal(accessOf(w, office).office, true);
    assert.deepEqual(accessOf(w, office).vakalatnama.map((p) => p.name), ["S. Prakash"]);
  });
});
