import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CAUSE_LIST } from "./hearings";
import { createTextBlock } from "./order-composer";
import {
  appearancesFor,
  attendanceRecital,
  EMPTY_ORDER_DRAFT,
  hearingOrderDocument,
  nextListingRecital,
  postingSettled,
  recitalText,
} from "./order-draft";

const hearing = CAUSE_LIST[0];

describe("appearancesFor", () => {
  it("names the parties, then each counsel on that side — not a ghost advocate", () => {
    const noAccusedCounsel = CAUSE_LIST.find(
      (row) => row.counsel.every((c) => c.side !== "accused"),
    );
    assert.ok(noAccusedCounsel);
    const rows = appearancesFor(noAccusedCounsel);
    assert.equal(
      rows.some((row) => row.role === "Advocate for the accused"),
      false,
    );
    assert.equal(rows[0].role, "Complainant");
    assert.equal(rows[0].name, noAccusedCounsel.parties.complainant);
  });
});

describe("attendanceRecital", () => {
  it("recites nothing while the roll has not been called", () => {
    assert.deepEqual(attendanceRecital(appearancesFor(hearing), {}), []);
  });

  it("groups by the answer, so who was absent is one line and not a paragraph", () => {
    assert.deepEqual(
      attendanceRecital(appearancesFor(hearing), {
        complainant: "present",
        "complainant-counsel-0": "present",
        accused: "absent",
        "accused-counsel-0": "present",
      }),
      [
        {
          label: "Present",
          value:
            "Sunil Varghese, the complainant; Adv. Suresh Menon, advocate for the complainant; Adv. Rekha Pillai, advocate for the accused.",
        },
        { label: "Absent", value: "Anand Traders, the accused." },
      ],
    );
  });

  it("leaves out the roll nobody is on, rather than heading an empty line", () => {
    const lines = attendanceRecital(appearancesFor(hearing), {
      complainant: "present",
    });
    assert.deepEqual(
      lines.map((line) => line.label),
      ["Present"],
    );
  });

  it("grows one office at a time, so a part-called roll is still in the order", () => {
    const appearances = appearancesFor(hearing);
    const first = attendanceRecital(appearances, { complainant: "present" });
    assert.equal(first.map(recitalText).join("\n"), "Present: Sunil Varghese, the complainant.");
    const both = attendanceRecital(appearances, {
      complainant: "present",
      accused: "absent",
    });
    assert.equal(
      both.map(recitalText).join("\n"),
      "Present: Sunil Varghese, the complainant.\nAbsent: Anand Traders, the accused.",
    );
  });
});

describe("nextListingRecital", () => {
  it("closes the order on the date, then what it is for", () => {
    assert.deepEqual(
      nextListingRecital({
        next: "list",
        nextPurpose: "evidence-of-complainant",
        nextDate: "2026-10-06",
      }),
      [
        { label: "Next hearing", value: "6 October 2026" },
        { label: "Purpose", value: "Evidence of complainant" },
      ],
    );
  });

  it("says a matter is not being listed again, which is an answer", () => {
    assert.deepEqual(
      nextListingRecital({ next: "none", nextPurpose: "", nextDate: null }),
      [{ label: "Next hearing", value: "Not listed again." }],
    );
  });

  it("recites nothing while the posting is half given, either way round", () => {
    assert.deepEqual(
      nextListingRecital({
        next: "list",
        nextPurpose: "evidence-of-complainant",
        nextDate: null,
      }),
      [],
    );
    assert.deepEqual(
      nextListingRecital({
        next: "list",
        nextPurpose: "",
        nextDate: "2026-10-06",
      }),
      [],
    );
  });
});

describe("postingSettled", () => {
  it("takes a date with its purpose, or a decision not to list again", () => {
    assert.equal(postingSettled({ next: "none", nextPurpose: "", nextDate: null }), true);
    assert.equal(
      postingSettled({ next: "list", nextPurpose: "plea", nextDate: "2026-10-06" }),
      true,
    );
    assert.equal(postingSettled({ next: "list", nextPurpose: "plea", nextDate: null }), false);
  });
});

describe("hearingOrderDocument", () => {
  it("is the roll, then the blocks with words, then the posting", () => {
    const document = hearingOrderDocument(
      hearing,
      {
        ...EMPTY_ORDER_DRAFT,
        marks: { complainant: "present" },
        next: "none",
        blocks: [createTextBlock("The matter is adjourned."), createTextBlock("  ")],
      },
      "2026-09-07",
    );
    assert.deepEqual(document.paragraphs, [
      "Present: Sunil Varghese, the complainant.",
      "The matter is adjourned.",
      "Next hearing: Not listed again.",
    ]);
  });

  it("prints nothing for an untouched order", () => {
    const document = hearingOrderDocument(
      hearing,
      { ...EMPTY_ORDER_DRAFT, next: "list" },
      "2026-09-07",
    );
    assert.deepEqual(document.paragraphs, []);
  });
});
