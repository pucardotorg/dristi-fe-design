import assert from "node:assert/strict";
import test from "node:test";
import { courtIdentity, courtNumberFor } from "./courts";

test("court designations separate from names without confusing 24×7 service hours", () => {
  assert.deepEqual(courtIdentity("JMFC Court 4"), { name: "JMFC Court", number: "4" });
  assert.deepEqual(courtIdentity("24×7 ON Court"), { name: "24×7 ON Court", number: null });
  assert.equal(courtNumberFor("24×7 ON Court"), "1");
  // Every court on the demo docket carries a number; NI Act has no trailing
  // designation, so it is supplied from the demo table rather than shown as N/A.
  assert.equal(courtNumberFor("NI Act Court"), "9");
  // A court genuinely absent from every source still resolves to no number.
  assert.equal(courtNumberFor("Village Court"), null);
});

test("structured court number takes precedence over demo and legacy designations", () => {
  assert.equal(courtNumberFor("24×7 ON Court", "12"), "12");
  assert.deepEqual(courtIdentity("JMFC Court 4", "9"), { name: "JMFC Court", number: "9" });
  assert.equal(courtNumberFor("Court No. 11"), "11");
});
