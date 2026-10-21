import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { attendanceHistory, RECENT_SITTINGS } from "./attendance-history";
import { hearingSittings } from "./hearing-overview";
import { appearancesFor } from "./order-draft";
import { CAUSE_LIST } from "./hearings";

describe("attendanceHistory", () => {
  const hearing = CAUSE_LIST.find((entry) => entry.id === "h-241")!;
  const history = attendanceHistory(hearing);

  it("has one row per person on the roll, in roll order", () => {
    assert.deepEqual(
      history.rows.map((row) => row.appearance.id),
      appearancesFor(hearing).map((entry) => entry.id),
    );
  });

  it("shows at most the last five sittings, oldest first", () => {
    const sittings = hearingSittings(hearing.id);
    assert.equal(history.total, sittings.length);
    assert.equal(history.recent.length, Math.min(RECENT_SITTINGS, sittings.length));
    assert.equal(history.recent.at(-1)?.on, sittings[0].on);
    for (const row of history.rows) assert.equal(row.recent.length, history.recent.length);
  });

  it("counts the percentage over the sittings each person was required at", () => {
    for (const row of history.rows) {
      assert.ok(row.present <= row.required);
      assert.equal(row.percent, Math.round((row.present / row.required) * 100));
    }
  });

  it("is the same every time it is drawn", () => {
    assert.deepEqual(attendanceHistory(hearing), history);
  });
});
