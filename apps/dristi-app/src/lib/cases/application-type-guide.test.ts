import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APPLICATION_TYPE_MATCH_FLOOR,
  searchApplicationTypes,
} from "./application-type-guide";

/** What a filer types, in their own words, and the type they mean. */
const ASKS: [string, string][] = [
  ["my client is sick and cannot come to court", "absent-application"],
  ["i cant attend the hearing", "absent-application"],
  ["accused will be abroad on the hearing day", "absent-application"],
  ["exemption from appearance", "absent-application"],
  ["need the hearing earlier", "advancement-reschedule"],
  ["hearing date is too far, want it sooner", "advancement-reschedule"],
  ["move the date later", "postpone"],
  ["adjourn the hearing", "postpone"],
  ["counsel is not available, need adjournment", "postpone"],
  ["get the accused out of jail", "bail"],
  ["accused arrested need release", "bail"],
  ["parties compromised and settled", "settlement"],
  ["we want to close the case after payment", "settlement"],
  ["move case to another court", "transfer"],
  ["withdraw the complaint", "withdrawal"],
  ["drop the case", "withdrawal"],
  ["complaint was filed late", "condonation-of-delay"],
  ["filed after the limitation period", "condonation-of-delay"],
  ["need bank records", "production-of-documents"],
  ["call for the bank account statement", "production-of-documents"],
  ["add a new witness", "addition-of-witness"],
  ["change power of attorney", "poa-change"],
  ["wrong address of the accused", "edit-litigant-details"],
  ["warrant to be served by hand", "warrant-by-hand"],
  ["reopen evidence", "reopen-evidence"],
];

/** Half typed, or typed with a slip. */
const PARTIAL: [string, string][] = [
  ["bai", "bail"],
  ["postp", "postpone"],
  ["settl", "settlement"],
  ["transf", "transfer"],
  ["adjurn", "postpone"],
  ["withdrw", "withdrawal"],
];

describe("searching application types in your own words", () => {
  for (const [ask, type] of [...ASKS, ...PARTIAL]) {
    it(`"${ask}" finds ${type}`, () => {
      const [top] = searchApplicationTypes(ask);
      assert.ok(top.score >= APPLICATION_TYPE_MATCH_FLOOR, ask);
      assert.equal(top.guide.id, type);
    });
  }
});
