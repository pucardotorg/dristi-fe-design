/**
 * Small, explicit fixtures for the tests — not the sandbox seed, so a test says
 * exactly what it depends on.
 */

import type { Case, Defect, Person, Task } from "./types";

export const NOW = "2026-08-18T12:00:00.000Z";

const DAY = 24 * 60 * 60 * 1000;

/** ISO for `days` from NOW at a local hour (due phrases are computed on the local calendar). */
export function at(days: number, hour = 17): string {
  const d = new Date(NOW);
  d.setHours(hour, 0, 0, 0);
  return new Date(d.getTime() + days * DAY).toISOString();
}

export const senior: Person = { id: "p-sen", name: "Anjali Nair", initials: "AN", role: "senior" };
export const senior2: Person = { id: "p-sen2", name: "R. Manoj", initials: "RM", role: "senior" };
export const junior: Person = { id: "p-jun", name: "S. Prakash", initials: "SP", role: "junior" };
export const outsider: Person = { id: "p-out", name: "Deepa Varghese", initials: "DV", role: "senior" };
export const PEOPLE = [senior, senior2, junior, outsider];

/** Two signatories (senior is the main advocate), one junior on the case, one outsider. */
export const kase: Case = {
  id: "c-1",
  stNumber: "ST 1/2025",
  cnr: "KLKL01-000001-2025",
  parties: "A v. B",
  court: "24×7 ON Court",
  stage: "Evidence",
  nextHearingAt: at(5, 5),
  signatories: [senior.id, senior2.id],
  advocates: [senior.id, senior2.id, junior.id],
};

export const otherCase: Case = {
  ...kase,
  id: "c-2",
  stNumber: "ST 2/2025",
  parties: "C v. D",
  court: "JMFC Court 1",
  signatories: [outsider.id],
  advocates: [outsider.id],
};

export function makeTask(over: Partial<Task> = {}): Task {
  const kind = over.kind ?? "pay";
  return {
    id: "t-1",
    caseId: kase.id,
    kind,
    title: "Pay the process fee for the summons",
    why: { event: "Summons issued", at: at(-3) },
    whatToDo: "Pay it.",
    dueKind: "court-set",
    isBlocking: false,
    createdAt: at(-3),
    systemObservable: kind !== "hearing",
    status: "open",
    history: [],
    ...over,
  };
}

/**
 * A field defect pointing at a real place in a filing. Defaults to Cheque 1 › IFSC code;
 * override `target` for anything else. `valueAtReturn` is what scrutiny saw — the
 * baseline the resolution derivation measures against.
 */
export function makeDefect(over: Partial<Defect> = {}): Defect {
  return {
    n: 1,
    note: "The IFSC does not belong to the branch named in the complaint.",
    valueAtReturn: "KLGB0040231",
    target: {
      kind: "field",
      step: "cheque",
      instance: 0,
      field: "ifsc",
      label: "IFSC code",
      sectionLabel: "Case details",
      instanceLabel: "Cheque 1",
    },
    ...over,
  };
}

/** A whole-document defect — the AD card of cheque 1. */
export function makeDocDefect(over: Partial<Defect> = {}): Defect {
  return {
    n: 1,
    note: "The acknowledgement card is cut off at the fold.",
    target: {
      kind: "doc",
      step: "upload",
      slotKey: "c1ad",
      label: "Proof of delivery of demand notice (AD card)",
      sectionLabel: "Documents",
    },
    ...over,
  };
}
