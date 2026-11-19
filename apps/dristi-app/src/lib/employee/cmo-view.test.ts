import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { summonsWithoutUpdate, unpaidProcess, PAYMENT_PENDING_DAYS, SUMMONS_UPDATE_DAYS } from "./cmo-view";
import { courtDocket, courtMeasures, daysBetween, isPending } from "./court-docket";

const docket = courtDocket("2026-11-17");

describe("the CMO / FSO's process lists", () => {
  it("lists unpaid process past the limit, longest unpaid first, matching the dashboard's count", () => {
    const rows = unpaidProcess(docket);
    assert.ok(rows.length > 0);
    assert.equal(rows.length, courtMeasures(docket).paymentPending.length);
    for (const r of rows) {
      assert.equal(r.process.paid, null);
      assert.ok(r.days > PAYMENT_PENDING_DAYS);
      assert.equal(r.days, daysBetween(r.process.issued, docket.today));
    }
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].days >= rows[i].days);
  });

  it("lists summons paid for more than 7 days ago and not delivered, on pending cases, longest first", () => {
    const rows = summonsWithoutUpdate(docket);
    assert.ok(rows.length > 0);
    for (const r of rows) {
      assert.equal(r.process.type, "Summons");
      assert.notEqual(r.process.paid, null);
      assert.equal(r.process.delivered, null);
      assert.equal(r.process.stage, r.case.stage);
      assert.ok(isPending(r.case));
      assert.ok(r.days > SUMMONS_UPDATE_DAYS);
    }
    for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].days >= rows[i].days);
  });
});
