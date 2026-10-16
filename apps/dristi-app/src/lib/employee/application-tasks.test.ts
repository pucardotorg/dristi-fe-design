import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LifecycleApplication } from "@/lib/applications/lifecycle";

import { isSittingDay } from "./hearings";
import { nextHearingOf } from "./application-tasks";

function on(caseId: string): LifecycleApplication {
  return { caseId } as LifecycleApplication;
}

describe("nextHearingOf", () => {
  /* 2026-10-07 is a Wednesday. */
  const WED = "2026-10-07";

  it("puts a sample case's hearing a few days ahead", () => {
    assert.equal(nextHearingOf(on("c-1001"), WED), "2026-10-12");
    assert.equal(nextHearingOf(on("c-1005"), WED), "2026-10-12");
  });

  it("rolls a weekend forward to the next sitting day", () => {
    /* Thursday + 3 is a Sunday, so it moves to Monday. */
    const day = nextHearingOf(on("c-1001"), "2026-10-08");
    assert.equal(day, "2026-10-12");
    for (const caseId of ["c-1001", "c-1002", "c-1004", "c-1005", "c-1006"]) {
      for (const today of ["2026-10-05", "2026-10-09", "2026-10-10", "2026-10-11"]) {
        const next = nextHearingOf(on(caseId), today)!;
        assert.ok(next > today);
        assert.ok(isSittingDay(next), `${caseId} on ${today} gave ${next}`);
      }
    }
  });

  it("lists nothing for a case with no hearing fixed", () => {
    assert.equal(nextHearingOf(on("c-1003"), WED), undefined);
  });

  it("lists nothing for an unknown case", () => {
    assert.equal(nextHearingOf(on("c-none"), WED), undefined);
  });
});
