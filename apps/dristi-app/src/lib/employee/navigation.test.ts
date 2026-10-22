import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COURT_CASES_PAGE,
  COURT_DASHBOARD,
  COURT_NAV_GROUPS,
  COURT_NAV_LINKS,
  COURT_NAV_TRAILING,
  courtHasNavRow,
  courtNavClubbed,
  courtNavGroupsForCourt,
  courtNavClubbedTotal,
  courtNavKeptApart,
  courtNavRowsFor,
  courtTrail,
  courtWaitingGroups,
  isCourtNavActive,
  isCourtNavCombinedActive,
  isCourtNavCombinedRow,
  seatHasNavRow,
} from "./navigation";
import { REGISTERS_PAGE } from "./registers";

/**
 * Two contracts, set a day apart.
 *
 * 2026-09-11: **every trail ends with the current page**, as a step with no href, which
 * the bar renders through the DS `BreadcrumbPage` slot. Until then the page was
 * deliberately never a step.
 *
 * 2026-09-14: **no trail has a root**. `Court home` was a placeholder screen nothing
 * linked to; the rail is what gets you anywhere, so the trail says where you are and
 * lets you climb one step, and nothing more. The argument is in `courtTrail`'s own
 * comment.
 */
describe("courtTrail", () => {
  it("is empty on the dashboard — nothing nests under it", () => {
    assert.deepEqual(courtTrail(COURT_DASHBOARD.href), []);
  });

  it("on a queue, is the section and the queue — no root", () => {
    /* Two steps: the section as context, and the page. The section carries no href
       because it is a disclosure in the rail — there is no page called "Sign" — and the
       queue carries none because it is where the reader already is. */
    assert.deepEqual(courtTrail("/employee/hearings"), [
      { label: "Hearings" },
      { label: "Today’s hearings" },
    ]);
    assert.deepEqual(courtTrail("/employee/sign-orders"), [
      { label: "Sign" },
      { label: "Sign orders" },
    ]);
    assert.deepEqual(courtTrail("/employee/scrutiny"), [
      { label: "Actions" },
      { label: "Scrutinise submitted cases" },
    ]);
  });

  it("on a listing, ends with the case number and makes Hearings a way back", () => {
    /* The record's identifier, never its cause title: the title is this page's own `h1`,
       and a crumb repeating it would say the loudest thing on the screen in the quietest
       type. The order composer is the same view of the same listing, so it reads the
       same — the composer is not a second record. */
    const trail = [
      { label: "Hearings", href: "/employee/hearings" },
      { label: "Today’s hearings", href: "/employee/hearings" },
      /* The record crumb carries `mono`: its label *is* a number, so the bar gives it
         the identifier face the record wears on the page below. */
      { label: "ST/241/2026", mono: true },
    ];
    assert.deepEqual(courtTrail("/employee/hearings/h-241"), trail);
  });

  it("on an order, goes one step past its record and makes the record the way back", () => {
    /* Owner, 2026-10-15: the order is a page of its own under the record, so the trail
       says so — `ST/241/2026 › Order` — and the record's crumb returns to it. Only where
       the record's own route is a page: a listing and a complaint both are. */
    assert.deepEqual(courtTrail("/employee/hearings/h-241/order"), [
      { label: "Hearings", href: "/employee/hearings" },
      { label: "Today’s hearings", href: "/employee/hearings" },
      { label: "ST/241/2026", mono: true, href: "/employee/hearings/h-241" },
      { label: "Order" },
    ]);
    const cognizance = courtTrail("/employee/cognizance/c-2041/order");
    assert.deepEqual(cognizance.slice(-2).map((crumb) => crumb.href), [
      "/employee/cognizance/c-2041",
      undefined,
    ]);
    assert.equal(cognizance.at(-1)?.label, "Order");
    assert.equal(cognizance.at(-2)?.mono, true);
  });

  it("on a complaint's file, ends with the complaint's number", () => {
    assert.deepEqual(courtTrail("/employee/register-cases/r-1840"), [
      { label: "Actions", href: "/employee/register-cases" },
      { label: "Register cases", href: "/employee/register-cases" },
      { label: "KL-001840-2025", mono: true },
    ]);
  });

  it("ends at the case number whether or not the full file is open", () => {
    /* **The complaint has one view again** (brief D25, 2026-09-11 late). It had two for a
       day — the glance at `/<id>` and the whole file at `/<id>/file` — and the trail grew
       a leaf to say which one a magistrate was on. The file is now a disclosure of the
       complaint's own route with its state in the query, so there is nothing for a leaf
       to name and the trail ends at the identifier again. A query never reaches the
       trail, which is the point: the crumb says which record, not which part of it is
       unfolded. */
    const trail = [
      { label: "Actions", href: "/employee/register-cases" },
      { label: "Register cases", href: "/employee/register-cases" },
      { label: "KL-001840-2025", mono: true },
    ];
    assert.deepEqual(courtTrail("/employee/register-cases/r-1840"), trail);
    assert.deepEqual(courtTrail("/employee/register-cases/r-1840/"), trail);
  });

  it("keeps the rail on Register cases while the complaint is open", () => {
    /* The row a nested route lights up is the queue the record came from. */
    assert.ok(
      isCourtNavActive(
        "/employee/register-cases/r-1840",
        "/employee/register-cases",
      ),
    );
  });

  it("on an application, ends at its number once the browser can name it", () => {
    /* The applications store lives in this browser, so the server and the first client
       paint stop at the queue; the number arrives with the resolver after hydration. */
    const path = "/employee/applications/app-sample-1";
    const queue = [
      { label: "Actions", href: "/employee/applications" },
      { label: "Review Applications", href: "/employee/applications" },
    ];
    assert.deepEqual(courtTrail(path), queue);
    assert.deepEqual(
      courtTrail(path, (q, id) =>
        q === "/employee/applications" && id === "app-sample-1" ? "AP/12/2026" : undefined,
      ),
      [...queue, { label: "AP/12/2026", mono: true }],
    );
    /* Not found: still the queue's two steps, never an invented label. */
    assert.deepEqual(courtTrail(path, () => undefined), queue);
    /* The order on it: one step past the number, which goes back to the workstation —
       and the way back lands on the list it was being worked in (owner, 2026-10-15). */
    const named = (q: string, id: string) =>
      q === "/employee/applications" && id === "app-sample-1" ? "AP/12/2026" : undefined;
    assert.deepEqual(courtTrail(`${path}/order`, named, "decision=accept&view=decide"), [
      { label: "Actions", href: "/employee/applications?view=decide" },
      { label: "Review Applications", href: "/employee/applications?view=decide" },
      {
        label: "AP/12/2026",
        mono: true,
        href: "/employee/applications/app-sample-1?view=decide",
      },
      { label: "Order" },
    ]);
    assert.deepEqual(courtTrail(path, named, "view=onboard"), [
      { label: "Actions", href: "/employee/applications?view=onboard" },
      { label: "Review Applications", href: "/employee/applications?view=onboard" },
      { label: "AP/12/2026", mono: true },
    ]);
    assert.ok(isCourtNavActive(path, "/employee/applications"));
    assert.ok(isCourtNavActive(`${path}/order`, "/employee/applications"));
    assert.ok(!isCourtNavActive("/employee/applications/a/b", "/employee/applications"));
  });

  it("does not treat an unknown complaint as nested", () => {
    assert.deepEqual(courtTrail("/employee/register-cases/r-nope"), []);
  });

  it("on a scrutiny workbench, ends with the filing number it decoded", () => {
    /* A filing number carries slashes, so the segment arrives percent-encoded and the
       crumb has to be the decoded form the queue holds — not the escape sequence. */
    assert.deepEqual(
      courtTrail(`/employee/scrutiny/${encodeURIComponent("F/AHM/2026/00341")}`),
      [
          { label: "Actions", href: "/employee/scrutiny" },
        { label: "Scrutinise submitted cases", href: "/employee/scrutiny" },
        { label: "F/AHM/2026/00341", mono: true },
      ],
    );
  });

  it("does not treat an unknown complaint id as nested", () => {
    /* The nested segment resolves against the queue, so a stale link matches no row
       at all and gets the way home and nothing else — rather than claiming to sit
       under a complaint that is not there, or naming a record it cannot identify. The
       screen behind it says the same thing in its own words. */
    assert.deepEqual(courtTrail("/employee/register-cases/r-nope"), []);
  });

  it("does not treat a hearings sibling as a nested listing", () => {
    /* `schedule` is a row of its own at the foot of the rail (owner, 2026-10-14), not a
       listing under today's list — a standalone row, so no trail. */
    assert.deepEqual(courtTrail("/employee/hearings/schedule"), []);
  });

  it("still offers the way home on a route the rail does not know", () => {
    assert.deepEqual(courtTrail("/employee/not-a-queue"), []);
  });

  it("gives every trail it can name a last step that goes nowhere", () => {
    /* The rule itself, rather than one route's spelling of it: on any route this file
       can identify, the step the reader is standing on is not a link. The two
       exceptions are stated above and are both "there is no current step to give" — the
       court home, which has no trail at all, and a route the rail does not know, where
       naming the page would mean inventing a label. */
    for (const path of [
      "/employee/hearings",
      "/employee/sign-orders",
      "/employee/register-cases",
      /* One entry, not two: the complaint's file is a query and `courtTrail` reads a
         pathname, which is why the leaf could go (brief D25). */
      "/employee/register-cases/r-1840",
      "/employee/hearings/h-241/order",
      `/employee/scrutiny/${encodeURIComponent("F/AHM/2026/00341")}`,
    ]) {
      const trail = courtTrail(path);
      assert.ok(trail.length > 1, path);
      assert.equal(trail.at(-1)?.href, undefined, path);
    }
  });
});

describe("the court's standalone rows", () => {
  /* Dashboard and All cases were dead external rows transcribed from the reference and
     are now built and internal. Configurations used to lead them; it now closes the rail
     instead (`COURT_NAV_TRAILING`, owner 2026-09-23), because it is the one row here that
     is not somewhere the bench works. */
  it("are the dashboard, all cases and the registers, all internal and built", () => {
    assert.deepEqual(
      COURT_NAV_LINKS.map((row) => row.href),
      [COURT_DASHBOARD.href, COURT_CASES_PAGE.href, REGISTERS_PAGE.href],
    );
    for (const row of [...COURT_NAV_LINKS, ...COURT_NAV_TRAILING]) {
      assert.ok(row.href, `${row.id} still goes nowhere`);
      assert.equal(row.external, undefined, `${row.id} still leaves the app`);
      /* The rail paints its counts in destructive red, and none of these numbers is
         a backlog — except Schedule hearing's, a real queue moved to the foot of the
         rail (owner, 2026-10-14). */
      if (row.id !== "schedule-hearing")
        assert.equal(row.count, undefined, `${row.id} carries a count`);
    }
  });

  it("carry no trail on their own pages", () => {
    assert.deepEqual(courtTrail("/employee/configurations"), []);
    assert.deepEqual(courtTrail(COURT_DASHBOARD.href), []);
    assert.deepEqual(courtTrail(COURT_CASES_PAGE.href), []);
    assert.deepEqual(courtTrail(REGISTERS_PAGE.href), []);
  });
});

describe("the registers row", () => {
  it("sits after All cases, and is not the Register cases queue", () => {
    const ids = COURT_NAV_LINKS.map((row) => row.id);
    assert.equal(ids.indexOf("registers"), ids.indexOf("all-cases") + 1);
    const registers = COURT_NAV_LINKS.find((row) => row.id === "registers")!;
    const queue = COURT_NAV_GROUPS.flatMap((g) => g.items).find(
      (row) => row.id === "register-cases",
    )!;
    assert.notEqual(registers.label, queue.label);
    assert.notEqual(registers.href, queue.href);
    assert.notEqual(registers.icon, queue.icon);
  });

  it("stays lit on a register's own page, and only for a register that exists", () => {
    assert.ok(isCourtNavActive(REGISTERS_PAGE.href, REGISTERS_PAGE.href));
    assert.ok(isCourtNavActive("/employee/registers/statements", REGISTERS_PAGE.href));
    assert.ok(!isCourtNavActive("/employee/registers/nope", REGISTERS_PAGE.href));
    assert.ok(!isCourtNavActive("/employee/register-cases", REGISTERS_PAGE.href));
  });

  it("gives a register a trail back to the index, ending at its number", () => {
    assert.deepEqual(courtTrail("/employee/registers/statements"), [
      { label: "Registers", href: REGISTERS_PAGE.href },
      { label: "Register 3" },
    ]);
    assert.deepEqual(courtTrail("/employee/registers/batta-orders/"), [
      { label: "Registers", href: REGISTERS_PAGE.href },
      { label: "Register 18" },
    ]);
    assert.deepEqual(courtTrail("/employee/registers/nope"), []);
  });
});

describe("courtWaitingGroups", () => {
  it("keeps the rail's groups, and only built, non-empty queues in them", () => {
    const groups = courtWaitingGroups("kerala");
    assert.ok(groups.length > 0);
    for (const group of groups) {
      assert.ok(group.label, `${group.id} has no label`);
      assert.ok(group.icon, `${group.id} has no mark`);
      assert.ok(group.items.length > 0, `${group.id} is an empty heading`);
      for (const queue of group.items) {
        assert.ok(queue.href, `${queue.id} has no destination`);
        assert.ok(queue.count > 0, `${queue.id} is empty and still listed`);
      }
    }
  });

  it("totals each group from its own rows", () => {
    for (const group of courtWaitingGroups("kerala")) {
      const sum = group.items.reduce((total, item) => total + item.count, 0);
      assert.equal(group.total, sum, `${group.id} total disagrees with its rows`);
    }
  });

  /* The panel reads the rail's own data so the two cannot disagree about a queue. */
  it("takes each row's label and count from the rail's own row", () => {
    const rows = COURT_NAV_GROUPS.flatMap((group) => group.items);
    for (const group of courtWaitingGroups("kerala")) {
      for (const queue of group.items) {
        const row = rows.find((item) => item.id === queue.id);
        assert.ok(row);
        assert.equal(queue.label, row.label);
        assert.equal(queue.count, row.count);
      }
    }
  });
});

/**
 * The two combined rail layouts ("actions" and "schedule", `nav-layout.ts`) each fold
 * `COURT_NAV_GROUPS` into one row, differing in what they keep apart from it (owner,
 * 2026-09-21): "actions" keeps Today's hearings a tab of its own next to Bulk
 * reschedule hearings and Sign process; "schedule" keeps only the latter two, and folds
 * hearings in with everything else instead. Both read `COURT_NAV_GROUPS` rather than a
 * second list, so a row added to a group is folded in or kept apart by this same rule
 * without anyone updating a layout by hand.
 */
describe("the combined rail layouts", () => {
  const allIds = COURT_NAV_GROUPS.flatMap((group) => group.items.map((i) => i.id));

  it("keeps hearings a tab of its own under \"actions\", but not under \"schedule\"", () => {
    assert.deepEqual(
      courtNavKeptApart("actions", "kerala").map((item) => item.id),
      ["todays-hearings", "pending-orders", "sign-process"],
    );
    assert.deepEqual(
      courtNavKeptApart("schedule", "kerala").map((item) => item.id),
      ["pending-orders", "sign-process"],
    );
  });

  it("clubs every other row, none twice, in the rail's own order", () => {
    for (const layout of ["actions", "schedule"] as const) {
      const apart = new Set(courtNavKeptApart(layout, "kerala").map((item) => item.id));
      const clubbed = courtNavClubbed(layout, "kerala").map((item) => item.id);
      /* Every id `COURT_NAV_GROUPS` holds except what this layout keeps apart — same
         set, same relative order, nothing dropped and nothing duplicated. */
      assert.deepEqual(clubbed, allIds.filter((id) => !apart.has(id)));
      assert.equal(new Set(clubbed).size, clubbed.length);
    }
    /* The one row that tells the two layouts apart: hearings are due work under
       "actions" and are not under "schedule". */
    assert.ok(courtNavClubbed("actions", "kerala").every((item) => item.id !== "todays-hearings"));
    assert.ok(
      courtNavClubbed("schedule", "kerala").some((item) => item.id === "todays-hearings"),
    );
  });

  it("totals the combined row from the clubbed rows it stands for", () => {
    for (const layout of ["actions", "schedule"] as const) {
      const sum = courtNavClubbed(layout, "kerala").reduce(
        (total, item) => total + (item.count ?? 0),
        0,
      );
      assert.equal(courtNavClubbedTotal(layout, "kerala"), sum);
      assert.ok(sum > 0);
    }
    /* "actions" excludes hearings from its total, "schedule" folds them in — so the
       two totals disagree by exactly what Today's hearings carries. */
    const hearings = COURT_NAV_GROUPS.flatMap((g) => g.items).find(
      (item) => item.id === "todays-hearings",
    );
    assert.ok(hearings);
    assert.equal(
      courtNavClubbedTotal("schedule", "kerala") - courtNavClubbedTotal("actions", "kerala"),
      hearings.count ?? 0,
    );
  });

  it("builds \"actions\" as hearings and pending orders, the combined row, then Sign process", () => {
    const rows = courtNavRowsFor("actions", "kerala");
    assert.deepEqual(
      rows.map((item) => item.id),
      ["todays-hearings", "pending-orders", "todays-actions", "sign-process"],
    );
    assert.equal(rows[2].count, courtNavClubbedTotal("actions", "kerala"));
    assert.equal(rows[2].href, "/employee/todays-actions");
    assert.ok(isCourtNavCombinedRow(rows[2]));
    /* Every row a combined layout renders needs a mark of its own — the folded strip
       has no group left to carry it for a row promoted out of one. */
    for (const item of rows) {
      assert.ok(item.icon, `${item.id} has no mark for the folded rail`);
    }
  });

  it("builds \"schedule\" as the combined row, then Pending orders and Sign process", () => {
    const rows = courtNavRowsFor("schedule", "kerala");
    assert.deepEqual(
      rows.map((item) => item.id),
      ["todays-schedule", "pending-orders", "sign-process"],
    );
    assert.equal(rows[0].count, courtNavClubbedTotal("schedule", "kerala"));
    assert.equal(rows[0].href, "/employee/todays-schedule");
    assert.ok(isCourtNavCombinedRow(rows[0]));
    for (const item of rows) {
      assert.ok(item.icon, `${item.id} has no mark for the folded rail`);
    }
  });

  it("does not call a kept-apart row combined", () => {
    for (const layout of ["actions", "schedule"] as const) {
      for (const item of courtNavKeptApart(layout, "kerala")) {
        assert.ok(!isCourtNavCombinedRow(item), `${item.id} is not the combined row`);
      }
    }
  });

  it("answers active for the combined row on any clubbed destination", () => {
    assert.ok(isCourtNavCombinedActive("/employee/scrutiny", "actions", "kerala"));
    assert.ok(isCourtNavCombinedActive("/employee/sign-orders", "actions", "kerala"));
    /* Nested under a clubbed queue counts too — the same rule `isCourtNavActive`
       already gives that queue's own row. */
    assert.ok(isCourtNavCombinedActive("/employee/register-cases/r-1840", "schedule", "kerala"));
    /* Hearings are clubbed under "schedule" and are not under "actions" — the one
       route the two layouts must disagree about. */
    assert.ok(isCourtNavCombinedActive("/employee/hearings", "schedule", "kerala"));
    assert.ok(!isCourtNavCombinedActive("/employee/hearings", "actions", "kerala"));
  });

  it("does not answer active for a row it kept apart, or an unknown route", () => {
    for (const layout of ["actions", "schedule"] as const) {
      assert.ok(!isCourtNavCombinedActive("/employee/hearings/bulk-reschedule", layout, "kerala"));
      assert.ok(!isCourtNavCombinedActive("/employee/sign-process", layout, "kerala"));
      assert.ok(!isCourtNavCombinedActive("/employee/not-a-queue", layout, "kerala"));
    }
  });
});

/*
 * Who holds Case registerer alongside Scrutiny officer is staffed per state in this demo
 * (`scrutinyRegistersIn`, `SCR-11`). Where the Scrutiny officer registers, there is no
 * Register cases queue anywhere the court side lists its work.
 */
describe("Register cases by who registers", () => {
  it("keeps Register cases where someone else registers", () => {
    assert.ok(courtHasNavRow("kerala", "register-cases"));
    assert.ok(courtNavClubbed("actions", "kerala").some((item) => item.id === "register-cases"));
  });

  it("drops Register cases where scrutiny registers, and nothing else", () => {
    for (const court of ["gujarat", "punjab-haryana"] as const) {
      const ids = (groups: typeof COURT_NAV_GROUPS) =>
        groups.flatMap((group) => group.items.map((item) => item.id));
      assert.deepEqual(
        ids(courtNavGroupsForCourt(COURT_NAV_GROUPS, court)),
        ids(COURT_NAV_GROUPS).filter((id) => id !== "register-cases"),
      );
      for (const layout of ["actions", "schedule"] as const) {
        assert.ok(courtNavClubbed(layout, court).every((item) => item.id !== "register-cases"));
      }
      for (const group of courtWaitingGroups(court)) {
        assert.ok(group.items.every((item) => item.id !== "register-cases"));
      }
    }
  });
});

describe("rows hidden from the bench", () => {
  const hidden = ["scrutiny", "approve-copy", "approve-registrations"];

  it("hides scrutiny and both approval queues from the magistrate and bench clerk", () => {
    for (const seat of ["magistrate", "bench-clerk"] as const) {
      for (const id of hidden) assert.equal(seatHasNavRow(seat, id), false, `${seat} ${id}`);
      assert.ok(seatHasNavRow(seat, "applications"));
      const clubbed = courtNavClubbed("schedule", "kerala", seat).map((item) => item.id);
      assert.ok(hidden.every((id) => !clubbed.includes(id)));
    }
  });

  it("leaves them with the seats that still work them", () => {
    assert.ok(seatHasNavRow("scrutiny-officer", "scrutiny"));
    assert.ok(seatHasNavRow("scrutiny-officer", "approve-registrations"));
    assert.equal(seatHasNavRow("typist", "approve-copy"), false);
    assert.equal(seatHasNavRow("typist", "sign-orders"), false);
    assert.equal(seatHasNavRow("magistrate", "sign-orders"), false);
    assert.ok(seatHasNavRow("magistrate", "pending-orders"));
    assert.ok(seatHasNavRow("typist", "pending-orders"));
  });
});

describe("the rail's orders rows", () => {
  it("puts Pending orders under Today's hearings and scheduling at the foot", () => {
    const hearings = COURT_NAV_GROUPS.find((group) => group.id === "hearings");
    assert.deepEqual(
      hearings?.items.map((item) => item.id),
      ["todays-hearings", "pending-orders"],
    );
    assert.deepEqual(
      COURT_NAV_TRAILING.map((item) => item.id),
      ["schedule-hearing", "bulk-reschedule", "configurations"],
    );
    assert.equal(seatHasNavRow("magistrate", "sign-orders"), false);
  });
});
