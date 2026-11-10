import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { asMobileQuery, searchAdvocates } from "./registry";

describe("searchAdvocates — name, bar number or mobile", () => {
  it("finds an advocate by their full mobile number, however it is typed", async () => {
    for (const q of ["9000010421", "+91 90000 10421", "090000-10421"]) {
      const rows = await searchAdvocates(q);
      assert.deepEqual(rows.map((a) => a.name), ["Anitha Raveendran"], q);
    }
  });

  it("does not match on part of a mobile number", async () => {
    const rows = await searchAdvocates("900001");
    assert.equal(rows.length, 0);
  });

  it("still matches part of a bar number and part of a name", async () => {
    assert.deepEqual((await searchAdvocates("0421")).map((a) => a.barNumber), ["K/0421/2004"]);
    assert.deepEqual((await searchAdvocates("kurian")).map((a) => a.name), ["Thomas Kurian"]);
  });

  it("reads only a whole number as a mobile", () => {
    assert.equal(asMobileQuery("+91 90000 10421"), "9000010421");
    assert.equal(asMobileQuery("900001042"), null);
    assert.equal(asMobileQuery("K/0421/2004"), null);
  });
});
