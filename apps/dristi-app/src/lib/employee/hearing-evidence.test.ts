import assert from "node:assert/strict";
import { test } from "node:test";

import type { CasePerson } from "./case-people";
import {
  accusedOf,
  blanksIn,
  deponentsFor,
  evidenceAtHearing,
  evidenceLabel,
  firstStatementTypeFor,
  heldMarks,
  kindForStatementType,
  newEvidenceRecord,
  nextWitnessNumber,
  sideOfMark,
  statementTypeOf,
  unsignedCount,
  witnessNumberOf,
  type AddedWitness,
  type EvidenceRecord,
} from "./hearing-evidence";

function personOf(fields: Pick<CasePerson, "id" | "name" | "kind" | "role" | "side">): CasePerson {
  return { ...fields, addresses: [], mobiles: [], emails: [] };
}

const PEOPLE = [
  personOf({ id: "accused-1", name: "Anand Traders", kind: "accused", role: "Accused", side: "accused" }),
  personOf({ id: "complainant", name: "Sunil Varghese", kind: "complainant", role: "Complainant", side: "complainant" }),
  personOf({ id: "pw-2", name: "Bank manager", kind: "witness", role: "PW-2", side: "complainant" }),
];

function record(fields: Partial<EvidenceRecord>): EvidenceRecord {
  return {
    ...newEvidenceRecord(
      "witness-deposition",
      { caseNumber: "ST/241/2026", hearingId: "h-241", today: "2026-10-27" },
      new Date(0),
    ),
    ...fields,
  };
}

test("a new draft opens as the type the hearing is listed for", () => {
  assert.equal(firstStatementTypeFor("examination-of-accused-351"), "accused-examination");
  assert.equal(firstStatementTypeFor("evidence-of-complainant"), "complainant-evidence");
  assert.equal(firstStatementTypeFor("arguments"), "witness-deposition");
  assert.equal(firstStatementTypeFor(undefined), "witness-deposition");
  assert.equal(kindForStatementType("accused-examination"), "examination");
  assert.equal(kindForStatementType("complainant-evidence"), "deposition");
});

test("older drafts without statementType still resolve a type from kind", () => {
  assert.equal(statementTypeOf({ kind: "examination" }), "accused-examination");
  assert.equal(statementTypeOf({ kind: "deposition" }), "witness-deposition");
  assert.equal(
    statementTypeOf({ kind: "deposition", statementType: "complainant-evidence" }),
    "complainant-evidence",
  );
});

const ADDED: Record<string, AddedWitness> = {
  w1: { id: "w1", caseNumber: "ST/241/2026", name: "Village Officer", side: "court", addedOn: "2026-10-27T10:00:00.000Z" },
  w2: { id: "w2", caseNumber: "ST/999/2026", name: "Someone elsewhere", side: "accused", addedOn: "2026-10-27T10:00:00.000Z" },
};

test("a deposition is of a party, a listed witness or one added here", () => {
  const deponents = deponentsFor("ST/241/2026", PEOPLE, ADDED, {});
  assert.deepEqual(deponents.map((d) => d.id), ["complainant", "pw-2", "w1", "accused-1"]);
  assert.equal(deponents[0].number, undefined);
  assert.equal(nextWitnessNumber(deponents[3].side, deponents), "DW-1");
  assert.deepEqual(accusedOf(PEOPLE).map((p) => p.id), ["accused-1"]);
});

test("a party already listed as a witness is not offered twice", () => {
  const listed = [
    ...PEOPLE,
    personOf({ id: "pw-1", name: "Sunil  varghese", kind: "witness", role: "PW-1", side: "complainant" }),
    personOf({ id: "dw-1", name: "anand traders", kind: "witness", role: "DW-1", side: "accused" }),
  ];
  assert.deepEqual(deponentsFor("ST/241/2026", listed, {}, {}).map((d) => d.id), ["pw-2", "pw-1", "dw-1"]);
});

test("a new witness takes the next free number on their side, and keeps it once signed", () => {
  const deponents = deponentsFor("ST/241/2026", PEOPLE, ADDED, {});
  assert.equal(nextWitnessNumber("complainant", deponents), "PW-3");
  assert.equal(nextWitnessNumber("accused", deponents), "DW-1");
  assert.equal(nextWitnessNumber("court", deponents), "CW-1");
  const complainant = deponents[0];
  const draft = record({ id: "d", personId: "complainant" });
  assert.deepEqual(witnessNumberOf(draft, complainant, deponents, { d: draft }), {
    number: "PW-3",
    fixed: false,
  });

  const signed = record({ id: "s", personId: "complainant", status: "signed", witnessNumber: "PW-3" });
  const after = deponentsFor("ST/241/2026", PEOPLE, ADDED, { s: signed });
  assert.equal(after[0].number, "PW-3");
  assert.equal(nextWitnessNumber("complainant", after), "PW-4");
});

test("unsigned witnesses hold distinct marks on the side chosen for them", () => {
  const added: Record<string, AddedWitness> = {
    a: { id: "a", caseNumber: "ST/241/2026", name: "Clerk", side: "complainant", addedOn: "2026-10-27T10:00:00.000Z" },
    b: { id: "b", caseNumber: "ST/241/2026", name: "Driver", side: "complainant", addedOn: "2026-10-27T10:01:00.000Z" },
  };
  const deponents = deponentsFor("ST/241/2026", PEOPLE, added, {});
  const first = record({ id: "1", personId: "a", witnessSide: "accused", createdOn: "2026-10-27T10:00:00.000Z" });
  const second = record({ id: "2", personId: "b", witnessSide: "accused", createdOn: "2026-10-27T10:05:00.000Z" });
  const all = { 1: first, 2: second };
  const of = (id: string) => deponents.find((d) => d.id === id)!;

  assert.deepEqual(heldMarks("ST/241/2026", deponents, all), new Map([["a", "DW-1"], ["b", "DW-2"]]));
  assert.equal(witnessNumberOf(second, of("b"), deponents, all).number, "DW-2");
  // What the second would hold on each side, for Witness mark as's list.
  assert.equal(witnessNumberOf(second, of("b"), deponents, all, "complainant").number, "PW-3");
  assert.equal(witnessNumberOf(second, of("b"), deponents, all, "court").number, "CW-1");
  // A listed witness keeps their own mark, whatever side is asked.
  const listed = record({ id: "3", personId: "pw-2" });
  assert.deepEqual(witnessNumberOf(listed, of("pw-2"), deponents, { ...all, 3: listed }, "court"), {
    number: "PW-2",
    fixed: true,
  });
  assert.equal(sideOfMark("DW-2"), "accused");
  assert.equal(sideOfMark("CW-1"), "court");
});

test("the switch counts what the person has not signed", () => {
  const list = [
    record({ id: "a", status: "draft" }),
    record({ id: "b", status: "awaiting-signature" }),
    record({ id: "c", status: "signed" }),
  ];
  assert.equal(unsignedCount(list), 2);
});

test("a hearing's records, in the order they were taken, and only that hearing's", () => {
  const all = {
    late: record({ id: "late", createdOn: "2026-10-27T11:00:00.000Z" }),
    early: record({ id: "early", createdOn: "2026-10-27T10:00:00.000Z" }),
    other: record({ id: "other", hearingId: "h-253" }),
  };
  assert.deepEqual(evidenceAtHearing(all, "h-241").map((r) => r.id), ["early", "late"]);
});

test("a record is dated by the court's day, not the clock", () => {
  assert.equal(record({}).takenOn, "2026-10-27");
});

test("blanks are counted, and a record is named by its person", () => {
  assert.equal(blanksIn("Q: Did you? A: [answer] and [date]"), 2);
  assert.equal(blanksIn("No blanks here."), 0);
  const deponents = deponentsFor("ST/241/2026", PEOPLE, ADDED, {});
  assert.equal(evidenceLabel({ kind: "deposition", personId: "pw-2" }, PEOPLE, deponents), "PW-2 · Bank manager");
  assert.equal(evidenceLabel({ kind: "deposition", personId: "w1" }, PEOPLE, deponents), "Village Officer");
  assert.equal(
    evidenceLabel({ kind: "deposition", personId: "w1", witnessNumber: "CW-1" }, PEOPLE, deponents),
    "CW-1 · Village Officer",
  );
  assert.equal(evidenceLabel({ kind: "examination", personId: "accused-1" }, PEOPLE, deponents), "Anand Traders");
  assert.equal(evidenceLabel({ kind: "deposition", personId: "" }, PEOPLE, deponents), "New deposition");
  assert.equal(
    evidenceLabel(
      { kind: "deposition", statementType: "complainant-evidence", personId: "" },
      PEOPLE,
      deponents,
    ),
    "New complainant evidence",
  );
});
