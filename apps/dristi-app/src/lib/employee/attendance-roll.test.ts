import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { CAUSE_LIST } from "./hearings";
import { appearancesFor, attendanceRecital } from "./order-draft";

/* `ATT-01`: every complainant, every accused and every PoA holder; one advocate line
   per litigant, named for them; none for a party in person. */
describe("the attendance roll", () => {
  const hearing = CAUSE_LIST.find((entry) => entry.id === "h-254")!;

  it("lists every party with their advocate and PoA holder under them", () => {
    assert.deepEqual(
      appearancesFor(hearing).map((row) => `${row.kind}:${row.name}:${row.party}`),
      [
        "party:Priya Menon:Priya Menon",
        "counsel:Advocate for Priya Menon:Priya Menon",
        "poa:Arun Menon:Priya Menon",
        "party:Sabari Textiles:Sabari Textiles",
        "counsel:Advocate for Sabari Textiles:Sabari Textiles",
        /* The partner appears in person: no advocate line. */
        "party:Ramesh Kumar:Ramesh Kumar",
      ],
    );
  });

  it("gives a litigant with several advocates one line and one mark", () => {
    const counsel = appearancesFor(hearing).filter((row) => row.kind === "counsel");
    assert.deepEqual(
      counsel.map((row) => [row.name, row.advocates]),
      [
        ["Advocate for Priya Menon", ["Adv. Anitha George"]],
        ["Advocate for Sabari Textiles", ["Adv. Feroz Hameed", "Adv. Latha Krishnan"]],
      ],
    );
  });

  it("names each complainant's own advocate after them, never the side", () => {
    const rows = appearancesFor({
      ...hearing,
      otherParties: [{ name: "Meera Menon", side: "complainant" }],
      counsel: [
        { name: "Adv. Anitha George", side: "complainant", party: "Priya Menon" },
        { name: "Adv. Nisha Thomas", side: "complainant", party: "Meera Menon" },
      ],
      poaHolders: [],
    });
    assert.deepEqual(
      rows.filter((row) => row.side === "complainant").map((row) => row.name),
      ["Priya Menon", "Advocate for Priya Menon", "Meera Menon", "Advocate for Meera Menon"],
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

  /* Skip is asked of each person (owner, 2026-10-29): a skipped person is not printed. */
  it("leaves a skipped person off the order", () => {
    const lines = attendanceRecital(appearancesFor(hearing), {
      complainant: "present",
      "complainant-poa-1": "not-required",
      "accused-2": "not-required",
    });
    assert.deepEqual(lines, [{ label: "Present", value: "Priya Menon, the complainant." }]);
  });
});
