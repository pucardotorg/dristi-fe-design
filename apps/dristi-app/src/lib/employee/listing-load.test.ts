import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listingLoad } from "./listing-load";

const TODAY = "2026-10-15";

describe("listingLoad", () => {
  it("counts only today and the days ahead, and the breakdown adds up", () => {
    const load = listingLoad(TODAY, {});
    assert.ok(load.size > 0);
    for (const [day, entry] of load) {
      assert.ok(day >= TODAY);
      assert.equal(
        entry.total,
        entry.purposes.reduce((sum, purpose) => sum + purpose.count, 0),
      );
      for (let i = 1; i < entry.purposes.length; i++) {
        assert.ok(entry.purposes[i - 1].count >= entry.purposes[i].count);
      }
    }
  });

  it("adds what the cause list has posted, except the listing being re-posted", () => {
    const day = "2026-12-31";
    const before = listingLoad(TODAY, {}).get(day)?.total ?? 0;
    const postings = {
      a: { next: "list" as const, nextPurpose: "plea" as const, nextDate: day },
      b: { next: "list" as const, nextPurpose: "plea" as const, nextDate: day },
      c: { next: "none" as const, nextPurpose: "" as const, nextDate: null },
    };
    assert.equal(listingLoad(TODAY, postings).get(day)?.total, before + 2);
    assert.equal(listingLoad(TODAY, postings, "a").get(day)?.total, before + 1);
  });
});
