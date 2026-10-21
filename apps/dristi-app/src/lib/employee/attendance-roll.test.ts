import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CAUSE_LIST } from "./hearings";
import { appearancesFor, attendanceRecital } from "./order-draft";

/* `ATT-01`: every complainant, every accused and every PoA holder; one advocate line
   per party; none for a party in person. */
describe("the attendance roll", () => {
  const hearing = CAUSE_LIST.find((entry) => entry.id === "h-254")!;

  it("lists every party and PoA holder, with one advocate line per represented party", () => {
    assert.deepEqual(
      appearancesFor(hearing).map((row) => `${row.kind}:${row.name}`),
      [
        "party:Priya Menon",
        "counsel:Advocate for the complainant",
        "poa:Arun Menon",
        "party:Sabari Textiles",
        "counsel:Advocate for Sabari Textiles",
        /* The partner appears in person: no advocate line. */
        "party:Ramesh Kumar",
      ],
    );
  });

  it("keeps the ids a draft's saved marks use", () => {
    const ids = appearancesFor(hearing).map((row) => row.id);
    assert.ok(ids.includes("complainant"));
    assert.ok(ids.includes("complainant-counsel"));
    assert.ok(ids.includes("accused"));
  });

  it("prints only those marked; anyone unmarked is not required", () => {
    const lines = attendanceRecital(appearancesFor(hearing), {
      complainant: "present",
      "complainant-poa-1": "present",
      "accused-2": "absent",
    });
    assert.deepEqual(lines, [
      { label: "Present", value: "Priya Menon, the complainant; Arun Menon, PoA holder for Priya Menon." },
      { label: "Absent", value: "Ramesh Kumar, the accused." },
    ]);
  });
});
