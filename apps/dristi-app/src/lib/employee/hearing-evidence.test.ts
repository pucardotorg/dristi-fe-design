import assert from "node:assert/strict";
import { test } from "node:test";

import type { CasePerson } from "./case-people";
import {
  accusedOf,
  blanksIn,
  deponentsFor,
  evidenceAtHearing,
  evidenceLabel,
  firstKindFor,
  newEvidenceRecord,
  nextWitnessNumber,
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
      "deposition",
      { caseNumber: "ST/241/2026", hearingId: "h-241", today: "2026-10-27" },
      new Date(0),
    ),
    ...fields,
  };
}

test("an empty view offers the record the hearing is listed for", () => {
  assert.equal(firstKindFor("examination-of-accused-351"), "examination");
  assert.equal(firstKindFor("evidence-of-complainant"), "deposition");
  assert.equal(firstKindFor("arguments"), "deposition");
  assert.equal(firstKindFor(undefined), "deposition");
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
  assert.deepEqual(witnessNumberOf({}, complainant, deponents), { number: "PW-3", fixed: false });

  const signed = record({ id: "s", personId: "complainant", status: "signed", witnessNumber: "PW-3" });
  const after = deponentsFor("ST/241/2026", PEOPLE, ADDED, { s: signed });
  assert.equal(after[0].number, "PW-3");
  assert.equal(nextWitnessNumber("complainant", after), "PW-4");
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
});
