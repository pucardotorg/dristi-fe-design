import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CAUSE_LIST, courtHearingPurposeLabel, formatListingDate } from "./hearings";
import { CURRENT_STAFF, PRESIDING_MAGISTRATE } from "./content";
import {
  A_DIARY_PENDING_COUNT,
  DEFAULT_A_DIARY_FILTERS,
  aDiaryDayDocumentFilename,
  aDiaryDayDocumentText,
  aDiaryDocumentFilename,
  aDiaryDocumentText,
  aDiaryEntries,
  buildADiaryDayDocument,
  buildADiaryDocument,
  canSignADiaryDay,
  filterADiary,
  resolveADiaryDay,
  saveBusinessOfTheDay,
  signADiaryDay,
  signableADiaryDays,
} from "./sign-a-diary";

/* An arbitrary day, well away from any date in the fixtures. The register is built from
   offsets, so every assertion below has to hold whatever day it is asked for — which is
   the property these tests exist to hold on to. */
const TODAY = "2027-03-15";
const ENTRIES = aDiaryEntries(TODAY);

describe("aDiaryEntries", () => {
  it("resolves its dates against the day it is given, not a fixture", () => {
    const other = aDiaryEntries("2029-11-02");
    assert.equal(ENTRIES[0].dated, TODAY);
    assert.equal(other[0].dated, "2029-11-02");
    assert.equal(ENTRIES.length, other.length);
  });

  it("carries the whole unsigned diary, and the rail counts the days that can be signed", () => {
    assert.equal(ENTRIES.length, 8);
    assert.equal(A_DIARY_PENDING_COUNT, signableADiaryDays(ENTRIES, TODAY).length);
    assert.equal(A_DIARY_PENDING_COUNT, 2);
  });

  it("holds five entries for the day the court is sitting, and a backlog before it", () => {
    const today = ENTRIES.filter((entry) => entry.dated === TODAY);
    assert.equal(today.length, 5);
    assert.equal(ENTRIES.length - today.length, 3);
    for (const entry of ENTRIES) {
      assert.ok(entry.dated <= TODAY, `${entry.id} records a day not yet sat`);
    }
  });

  it("runs newest day first — the order a diary is read back and signed", () => {
    const days = ENTRIES.map((entry) => entry.dated);
    assert.deepEqual(
      days,
      [...days].sort((a, b) => b.localeCompare(a)),
    );
  });

  it("lists every case for a date the court has not yet reached", () => {
    for (const entry of ENTRIES) {
      assert.ok(
        entry.nextHearing > TODAY,
        `${entry.id} comes back on ${entry.nextHearing}, which is not ahead of today`,
      );
    }
  });

  it("ends every entry with the sentence that fixes the next date", () => {
    for (const entry of ENTRIES) {
      const opening = `Next hearing is scheduled on ${formatListingDate(entry.nextHearing)} for `;
      assert.ok(
        entry.business.includes(opening) && entry.business.endsWith("."),
        `${entry.id} does not end with its own next-hearing sentence`,
      );
      const purpose = courtHearingPurposeLabel(entry.nextPurpose);
      assert.ok(
        entry.business.includes(purpose.replace(/^For /, "")),
        `${entry.id} does not name what it is listed for`,
      );
    }
  });

  it("never writes the preposition twice, whatever the purpose is called", () => {
    /* "For reports (to be received from forensics, ADR, etc)" is a label that already
       opens with "for". The register must not read "for For reports". */
    for (const entry of ENTRIES) {
      assert.ok(
        !entry.business.includes("for For "),
        `${entry.id} doubles the preposition`,
      );
    }
    const reports = ENTRIES.find((entry) => entry.nextPurpose === "for-reports");
    assert.ok(reports, "no entry exercises a purpose whose label opens with 'For'");
    assert.ok(reports.business.includes("for reports (to be received"));
  });

  it("keeps a business line long enough to clamp in its column", () => {
    assert.ok(ENTRIES.some((entry) => entry.business.length > 200));
  });

  it("opens the business on what was done, never on who turned up", () => {
    /* The table clamps this column to two lines and it is the row's only opener, so the
       first sentence has to be the one fact that tells one day from another. Recite the
       appearances here and five rows open "Both sides are represented by counsel" — which
       is what `attendance` exists to carry instead. */
    for (const entry of ENTRIES) {
      assert.ok(
        !entry.business.startsWith(entry.attendance),
        `${entry.id} opens its business with the appearance recital`,
      );
      assert.ok(
        !/^(Both sides are|The complainant is|The accused is) represented by counsel/.test(
          entry.business,
        ),
        `${entry.id} opens its business on who appeared`,
      );
    }
  });

  it("gives the clamped column a distinct opening sentence on every row", () => {
    const openings = ENTRIES.map(
      (entry) => entry.business.split(". ")[0],
    );
    assert.equal(new Set(openings).size, openings.length);
  });

  it("holds a side with no vakalat, so the appearance table has an empty row to answer for", () => {
    assert.ok(
      ENTRIES.some((entry) => entry.counsel.length < 2),
      "no entry exercises a side without counsel",
    );
  });

  it("restates no case that is on today's board", () => {
    const board = new Set(CAUSE_LIST.map((hearing) => hearing.caseNumber));
    for (const entry of ENTRIES) {
      assert.ok(
        !board.has(entry.caseNumber),
        `${entry.caseNumber} is both a listing and a diary entry`,
      );
    }
  });
});

describe("filterADiary", () => {
  it("opens on the day the court is sitting", () => {
    assert.equal(resolveADiaryDay(DEFAULT_A_DIARY_FILTERS, TODAY), TODAY);
    const rows = filterADiary(ENTRIES, DEFAULT_A_DIARY_FILTERS, TODAY);
    assert.equal(rows.length, 5);
    assert.ok(rows.every((entry) => entry.dated === TODAY));
  });

  it("reads one day at a time — never a mix the table could not tell apart", () => {
    const days = new Set(
      filterADiary(ENTRIES, DEFAULT_A_DIARY_FILTERS, TODAY).map(
        (entry) => entry.dated,
      ),
    );
    assert.equal(days.size, 1);
  });

  it("cuts to one asked-for day, and says nothing rather than borrowing another", () => {
    const yesterday = ENTRIES.find((entry) => entry.dated < TODAY)?.dated;
    assert.ok(yesterday);
    const rows = filterADiary(ENTRIES, { dated: yesterday }, TODAY);
    assert.ok(rows.length > 0);
    assert.ok(rows.every((entry) => entry.dated === yesterday));
    /* A day this bench did not sit on. The register says so rather than borrowing the
       nearest day's matters to look populated — the answer `hearingsForDay` gives too. */
    assert.equal(filterADiary(ENTRIES, { dated: "2027-03-10" }, TODAY).length, 0);
  });
});

describe("saveBusinessOfTheDay", () => {
  it("replaces the day's business, trimmed, and leaves every other entry alone", () => {
    const target = ENTRIES[0];
    const rows = saveBusinessOfTheDay(
      ENTRIES,
      target.id,
      "  Heard both sides and adjourned.  ",
    );
    assert.equal(
      rows.find((entry) => entry.id === target.id)?.business,
      "Heard both sides and adjourned.",
    );
    assert.equal(rows[1].business, ENTRIES[1].business);
    assert.equal(target.business, ENTRIES[0].business, "the input was mutated");
  });

  it("ignores a blank record and an id that names no entry", () => {
    assert.deepEqual(saveBusinessOfTheDay(ENTRIES, ENTRIES[0].id, "   "), ENTRIES);
    assert.deepEqual(
      saveBusinessOfTheDay(ENTRIES, "ad-nothing", "Recorded."),
      ENTRIES,
    );
  });
});

describe("buildADiaryDocument", () => {
  it("draws the reference's four appearance rows, in its order", () => {
    const entry = ENTRIES[0];
    const document = buildADiaryDocument(entry);
    assert.deepEqual(
      document.appearances.map(({ label }) => label),
      ["Complainant 1", "Advocate(s)", "Accused 1", "Advocate(s)"],
    );
    assert.equal(document.appearances[0].value, entry.parties.complainant);
    assert.equal(document.appearances[2].value, entry.parties.accused);
  });

  it("names a side with no counsel rather than leaving the row blank", () => {
    const entry = ENTRIES.find((row) => row.counsel.length < 2);
    assert.ok(entry);
    const values = buildADiaryDocument(entry).appearances.map((row) => row.value);
    assert.ok(values.includes("No advocate on record"));
  });

  it("recites who was before the court, beside the table that names them", () => {
    for (const entry of ENTRIES) {
      const document = buildADiaryDocument(entry);
      assert.equal(document.attendance, entry.attendance);
      assert.ok(
        document.attendance.trim().endsWith("."),
        `${entry.id} does not recite its attendance as a sentence`,
      );
    }
  });

  it("heads the page with the order this day passed, and the offence under it", () => {
    for (const entry of ENTRIES) {
      const document = buildADiaryDocument(entry);
      assert.equal(document.title, entry.orderTitle);
      assert.ok(
        document.title.startsWith("Order"),
        `${entry.id} does not head its page with an order`,
      );
      assert.equal(
        document.offence,
        "Offence under S. 138 of the Negotiable Instruments Act, 1881",
      );
    }
  });

  it("gives every entry its own order, never the same one twice", () => {
    const titles = ENTRIES.map((entry) => entry.orderTitle);
    assert.equal(new Set(titles).size, titles.length);
  });

  it("breaks the operative passage where the bench broke it", () => {
    const entry = ENTRIES[0];
    const { paragraphs } = buildADiaryDocument(entry);
    assert.ok(paragraphs.length > 1, "the order reads as a single block");
    assert.equal(paragraphs.join("\n\n"), entry.business);
    /* The last paragraph is where an order sheet fixes the next date. */
    assert.ok(
      paragraphs[paragraphs.length - 1].includes(
        formatListingDate(entry.nextHearing),
      ),
    );
  });

  it("keeps the order text when the entry is corrected (ADY-09)", () => {
    const target = ENTRIES[0];
    const before = buildADiaryDocument(target).paragraphs;
    const rows = saveBusinessOfTheDay(
      ENTRIES,
      target.id,
      "Heard both sides.\n\nThe case is adjourned.",
    );
    const corrected = rows.find((entry) => entry.id === target.id);
    assert.ok(corrected);
    assert.equal(corrected.business, "Heard both sides.\n\nThe case is adjourned.");
    assert.equal(corrected.orderText, target.orderText);
    assert.deepEqual(buildADiaryDocument(corrected).paragraphs, before);
  });

  it("starts every entry with its A-Diary text the same as its order text", () => {
    for (const entry of ENTRIES) {
      assert.equal(entry.business, entry.orderText, `${entry.id} starts out different`);
    }
  });

  it("shows the order as signed — an entry exists only once its order is", () => {
    const { signature } = buildADiaryDocument(ENTRIES[0]);
    assert.ok(signature.startsWith("Signed by "));
    assert.ok(signature.includes(PRESIDING_MAGISTRATE.name));
    assert.ok(signature.includes(PRESIDING_MAGISTRATE.designation));
    /* Never the seat working the screen — the order is not the bench clerk's to sign. */
    assert.ok(!signature.includes(CURRENT_STAFF.name));
  });

  it("writes a download that carries the order the court passed", () => {
    const entry = ENTRIES[0];
    const document = buildADiaryDocument(entry);
    const text = aDiaryDocumentText(document);
    assert.ok(text.includes(entry.caseNumber));
    assert.ok(text.includes(entry.orderTitle));
    assert.ok(text.includes(document.offence));
    assert.ok(text.includes(document.attendance));
    for (const paragraph of document.paragraphs) {
      assert.ok(text.includes(paragraph), "a paragraph is missing from the download");
    }
    assert.ok(text.includes(document.signature));
  });

  it("names the download for the order and the day it was passed", () => {
    const entry = ENTRIES[0];
    assert.equal(
      aDiaryDocumentFilename(entry),
      `ST-655-2026-order-${entry.dated}.txt`,
    );
  });
});

describe("signing a day", () => {
  it("signs only a day that is over, never today (ADY-12b)", () => {
    assert.equal(canSignADiaryDay(TODAY, TODAY), false);
    const yesterday = ENTRIES.find((entry) => entry.dated < TODAY)?.dated;
    assert.ok(yesterday);
    assert.equal(canSignADiaryDay(yesterday, TODAY), true);
    assert.ok(!signableADiaryDays(ENTRIES, TODAY).includes(TODAY));
  });

  it("lists the signable days once each, newest first", () => {
    const days = signableADiaryDays(ENTRIES, TODAY);
    assert.equal(new Set(days).size, days.length);
    assert.deepEqual(days, [...days].sort((a, b) => b.localeCompare(a)));
  });

  it("takes every entry of the day out together, and nothing else (ADY-12)", () => {
    const day = signableADiaryDays(ENTRIES, TODAY)[0];
    const rows = signADiaryDay(ENTRIES, day);
    assert.ok(rows.every((entry) => entry.dated !== day));
    assert.equal(
      rows.length,
      ENTRIES.filter((entry) => entry.dated !== day).length,
    );
  });

  it("builds the day's document from the entries as they stand (ADY-12a)", () => {
    const day = signableADiaryDays(ENTRIES, TODAY)[0];
    const target = ENTRIES.find((entry) => entry.dated === day);
    assert.ok(target);
    const rows = saveBusinessOfTheDay(ENTRIES, target.id, "Corrected just now.");
    const document = buildADiaryDayDocument(day, rows);
    assert.equal(
      document.entries.length,
      ENTRIES.filter((entry) => entry.dated === day).length,
    );
    assert.ok(
      document.entries.some((entry) => entry.paragraphs.join() === "Corrected just now."),
    );
    const text = aDiaryDayDocumentText(document);
    assert.ok(text.includes("Corrected just now."));
    assert.ok(text.includes(target.caseNumber));
    assert.ok(text.includes(document.signature));
    assert.equal(aDiaryDayDocumentFilename(day), `a-diary-${day}.txt`);
  });
});
