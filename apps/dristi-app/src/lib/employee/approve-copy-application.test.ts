import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APPROVE_COPY_QUEUE_COUNT,
  COPY_APPLICATION_QUEUE,
  COPY_RECORD_KINDS,
  EMPTY_COPY_APPLICATION_FILTERS,
  buildCopyApplicationDocument,
  copiesLine,
  copyApplicationDocumentFilename,
  copyApplicationDocumentText,
  copyApplicationFiler,
  copyPurposeLabel,
  copyRecordKindLabel,
  filterCopyApplications,
  formatCopyApplicationDate,
  formatCopyApplicationLongDate,
} from "./approve-copy-application";

describe("COPY_APPLICATION_QUEUE", () => {
  it("is long enough to page at 10, 20 and 30, and the count the rail shows is the list's own", () => {
    assert.equal(COPY_APPLICATION_QUEUE.length, 30);
    assert.equal(APPROVE_COPY_QUEUE_COUNT, COPY_APPLICATION_QUEUE.length);
  });

  it("gives every row, application number and case its own identity", () => {
    for (const key of ["id", "applicationNumber", "caseNumber"] as const) {
      const values = COPY_APPLICATION_QUEUE.map((row) => row[key]);
      assert.equal(new Set(values).size, values.length, `duplicate ${key}`);
    }
  });

  it("offers a row for every kind of record the vocabulary names", () => {
    const kinds = new Set(COPY_APPLICATION_QUEUE.map((row) => row.record.kind));
    for (const kind of COPY_RECORD_KINDS) {
      assert.ok(
        kinds.has(kind.id),
        `the vocabulary names ${kind.id} but no row asks for one`,
      );
    }
  });

  it("numbers a matter the way the record it holds does — a judgement, a deposition and an exhibit only exist once the case is on file", () => {
    const afterCognizanceOnly = new Set(["judgement", "deposition", "exhibit"]);
    for (const row of COPY_APPLICATION_QUEUE) {
      if (!afterCognizanceOnly.has(row.record.kind)) continue;
      assert.ok(
        row.caseNumber.startsWith("ST/"),
        `${row.caseNumber} holds a ${row.record.kind} and should start ST/`,
      );
    }
  });

  it("never asks for a record the court had not made yet", () => {
    for (const row of COPY_APPLICATION_QUEUE) {
      assert.ok(
        row.record.dated <= row.raisedOn,
        `${row.applicationNumber} was raised on ${row.raisedOn} for a record dated ${row.record.dated}`,
      );
    }
  });

  it("keeps the counter's serial in step with the year and the date", () => {
    for (const row of COPY_APPLICATION_QUEUE) {
      const [, , year] = row.applicationNumber.split("/");
      assert.equal(
        year,
        row.raisedOn.slice(0, 4),
        `${row.applicationNumber} was raised in ${row.raisedOn.slice(0, 4)}`,
      );
    }
  });

  it("is ordered newest first, the way a counter queue is worked", () => {
    const raised = COPY_APPLICATION_QUEUE.map((row) => row.raisedOn);
    assert.deepEqual(raised, [...raised].sort().reverse());
  });

  it("names a petitioner who is actually a party to the cause", () => {
    for (const row of COPY_APPLICATION_QUEUE) {
      const expected =
        row.applicant.side === "complainant"
          ? row.parties.complainant
          : row.parties.accused;
      assert.equal(
        row.applicant.name,
        expected,
        `${row.applicationNumber} names a petitioner who is not on either side of the cause`,
      );
    }
  });

  it("carries the shapes the screen has to survive — a wrapping petitioner, a wrapping record, and applicants with no counsel", () => {
    assert.ok(
      COPY_APPLICATION_QUEUE.some((row) => row.applicant.name.length > 40),
      "no petitioner long enough to wrap its column",
    );
    assert.ok(
      COPY_APPLICATION_QUEUE.some((row) => row.record.description.length > 100),
      "no record description long enough to wrap",
    );
    const withoutCounsel = COPY_APPLICATION_QUEUE.filter(
      (row) =>
        !row.counsel.some((counsel) => counsel.side === row.applicant.side),
    );
    assert.ok(
      withoutCounsel.length >= 3,
      "too few applicants appearing without counsel",
    );
    const months = new Set(
      COPY_APPLICATION_QUEUE.map((row) => row.raisedOn.slice(0, 7)),
    );
    assert.ok(months.size >= 8, "the dates do not spread across enough months");
  });
});

describe("filterCopyApplications", () => {
  it("returns the queue unchanged when nothing is searched for", () => {
    assert.equal(
      filterCopyApplications(
        COPY_APPLICATION_QUEUE,
        EMPTY_COPY_APPLICATION_FILTERS,
      ).length,
      COPY_APPLICATION_QUEUE.length,
    );
  });

  it("treats surrounding spaces as no query", () => {
    assert.equal(
      filterCopyApplications(COPY_APPLICATION_QUEUE, { query: "   " }).length,
      COPY_APPLICATION_QUEUE.length,
    );
  });

  it("finds an application by its own number", () => {
    const rows = filterCopyApplications(COPY_APPLICATION_QUEUE, {
      query: "CA/307/2026",
    });
    assert.deepEqual(
      rows.map((row) => row.id),
      ["ca-307"],
    );
  });

  it("finds an application by its case number", () => {
    const rows = filterCopyApplications(COPY_APPLICATION_QUEUE, {
      query: "st/1032/2025",
    });
    assert.deepEqual(
      rows.map((row) => row.id),
      ["ca-511"],
    );
  });

  it("finds an application by the petitioner, and by the other side of the cause", () => {
    assert.deepEqual(
      filterCopyApplications(COPY_APPLICATION_QUEUE, {
        query: "nedumpaikulam coir",
      }).map((row) => row.id),
      ["ca-276"],
    );
    assert.deepEqual(
      filterCopyApplications(COPY_APPLICATION_QUEUE, {
        query: "tony vadakkan",
      }).map((row) => row.id),
      ["ca-276"],
    );
  });

  it("reaches counsel on record", () => {
    const rows = filterCopyApplications(COPY_APPLICATION_QUEUE, {
      query: "adv. meera john",
    });
    assert.ok(rows.length > 0);
    assert.ok(
      rows.every((row) =>
        row.counsel.some((counsel) => counsel.name === "Adv. Meera John"),
      ),
    );
  });

  it("returns nothing when no application matches", () => {
    assert.equal(
      filterCopyApplications(COPY_APPLICATION_QUEUE, { query: "CA/9999/2030" })
        .length,
      0,
    );
  });
});

describe("who filed the application", () => {
  it("names counsel on record for the petitioner's own side", () => {
    const row = COPY_APPLICATION_QUEUE.find((entry) => entry.id === "ca-318")!;
    assert.equal(
      copyApplicationFiler(row),
      "Adv. Saurabh Verma, counsel for the accused",
    );
  });

  it("never borrows the other side's advocate", () => {
    /* Counsel on record for the complainant, and it is the accused applying. */
    const row = COPY_APPLICATION_QUEUE.find((entry) => entry.id === "ca-276")!;
    assert.equal(
      copyApplicationFiler(row),
      "Nedumpaikulam Coir Cooperative, accused, appearing without counsel",
    );
  });

  it("says so plainly when there is no vakalat at all", () => {
    const row = COPY_APPLICATION_QUEUE.find((entry) => entry.id === "ca-303")!;
    assert.equal(row.counsel.length, 0);
    assert.equal(
      copyApplicationFiler(row),
      "Muhammed Ashraf, complainant, appearing without counsel",
    );
  });
});

describe("the words the screen puts on a row", () => {
  it("spells the singular out", () => {
    const one = COPY_APPLICATION_QUEUE.find((row) => row.copies === 1)!;
    assert.ok(copiesLine(one).startsWith("1 copy ·"));
    const several = COPY_APPLICATION_QUEUE.find((row) => row.copies > 1)!;
    assert.ok(copiesLine(several).startsWith(`${several.copies} copies ·`));
  });

  it("marks the urgent ones and leaves the rest ordinary", () => {
    const urgent = COPY_APPLICATION_QUEUE.find(
      (row) => row.urgency === "urgent",
    )!;
    assert.ok(copiesLine(urgent).endsWith("· Urgent"));
  });

  it("uses the court-side date registers — short in a column, long in prose", () => {
    assert.equal(formatCopyApplicationDate("2026-09-03"), "3 Sept 2026");
    assert.equal(
      formatCopyApplicationLongDate("2026-09-03"),
      "3 September 2026",
    );
  });

  it("re-cases the vocabulary the way the DS Laws want it", () => {
    assert.equal(copyRecordKindLabel("judgement"), "Judgement");
    assert.equal(copyPurposeLabel("appeal"), "To prefer an appeal");
    assert.equal(copyPurposeLabel("own-record"), "For the applicant's own record");
  });
});

describe("buildCopyApplicationDocument", () => {
  it("writes a genuinely different application for each kind of record", () => {
    const bodies = new Set<string>();
    for (const kind of COPY_RECORD_KINDS) {
      const row = COPY_APPLICATION_QUEUE.find(
        (entry) => entry.record.kind === kind.id,
      )!;
      const document = buildCopyApplicationDocument(row);
      bodies.add(document.paragraphs[0]!);
      assert.ok(
        document.title.toLowerCase().includes("certified copy"),
        `${kind.id} does not say what it is asking for`,
      );
    }
    assert.equal(bodies.size, COPY_RECORD_KINDS.length);
  });

  it("titles each kind for the record it asks about", () => {
    const titles = new Set(
      COPY_APPLICATION_QUEUE.map(
        (row) => buildCopyApplicationDocument(row).title,
      ),
    );
    assert.equal(titles.size, COPY_RECORD_KINDS.length);
  });

  it("recites the row's own particulars rather than a template's", () => {
    const row = COPY_APPLICATION_QUEUE.find((entry) => entry.id === "ca-307")!;
    const document = buildCopyApplicationDocument(row);
    assert.equal(document.applicationNumber, "CA/307/2026");
    assert.equal(document.caseNumber, "ST/1186/2026");
    assert.equal(
      document.matter,
      "Harbour Bunkering and Marine Fuels Private Limited v. Adarsh Vijayan",
    );
    assert.equal(document.court, "JMFC Court 1");
    assert.equal(document.place, "Sample District");
    assert.ok(
      document.paragraphs.some((paragraph) => paragraph.includes("11 folios")),
    );
    assert.ok(document.paragraphs.some((paragraph) => paragraph.includes("₹33")));
    assert.ok(document.prayer.includes("19 August 2026"));
    assert.equal(document.filedBy, "Adv. Suresh Menon, counsel for the complainant");
  });

  it("carries the particulars the copying counter reads off the top", () => {
    const row = COPY_APPLICATION_QUEUE.find((entry) => entry.id === "ca-292")!;
    const terms = buildCopyApplicationDocument(row).facts.map(
      (fact) => fact.term,
    );
    assert.deepEqual(terms, [
      "Applicant",
      "Record sought",
      "Date of the record",
      "Copies required",
      "Ordinary or urgent",
      "Purpose",
      "Folios estimated",
      "Fee tendered",
    ]);
  });

  it("quotes no rule, form number or fee schedule", () => {
    /* `docs/product/` does not define copy applications for §138, so the demo wording
       must not pretend to cite the provision that entitles it. */
    const forbidden =
      /\b(?:section|sec\.|s\.|rule|order [IVX]+|form no\.?|schedule [IVX0-9])\b/i;
    for (const row of COPY_APPLICATION_QUEUE) {
      const text = copyApplicationDocumentText(
        buildCopyApplicationDocument(row),
      );
      const hit = text.match(forbidden);
      assert.equal(
        hit,
        null,
        `${row.applicationNumber} cites "${hit?.[0]}" — see the module header`,
      );
    }
  });
});

describe("the plain-text download", () => {
  it("writes every part of the document, in reading order", () => {
    const row = COPY_APPLICATION_QUEUE.find((entry) => entry.id === "ca-303")!;
    const document = buildCopyApplicationDocument(row);
    const text = copyApplicationDocumentText(document);
    const positions = [
      document.court,
      document.applicationNumber,
      document.caseNumber,
      document.matter,
      document.title,
      document.facts[0]!.term,
      document.paragraphs[0]!,
      document.prayer,
      document.filedBy,
    ].map((part) => text.indexOf(part));
    assert.ok(positions.every((at) => at >= 0), "a part of the document is missing");
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
    /* The capacity is recited twice — once in the particulars at the top, once under the
       signature at the bottom — so the block that signs it is found from the end. */
    assert.ok(
      text.lastIndexOf(document.applicant.capacity) > text.indexOf(document.prayer),
    );
  });

  it("numbers the paragraphs the way the paper does", () => {
    const row = COPY_APPLICATION_QUEUE[0]!;
    const text = copyApplicationDocumentText(
      buildCopyApplicationDocument(row),
    );
    assert.ok(text.includes("\n1. "));
    assert.ok(text.includes("\n3. "));
  });

  it("names the file after the application, with nothing a filesystem will choke on", () => {
    const row = COPY_APPLICATION_QUEUE.find((entry) => entry.id === "ca-511")!;
    assert.equal(
      copyApplicationDocumentFilename(row),
      "CA-511-2025-copy-application.txt",
    );
  });
});
