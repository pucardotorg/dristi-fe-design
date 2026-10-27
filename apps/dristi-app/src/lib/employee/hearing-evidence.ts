/**
 * The evidence recorded at a hearing: a witness's deposition, or the court's examination
 * of an accused under S. 351 BNSS (owner, 2026-10-27: the order screen's Examinations view).
 *
 * **A record of the hearing, not of the order.** It is typed while the order is open, by
 * the same person, but an order item belongs to one order and its workflow runs only once
 * the order is signed and its data complete — and a witness signs before leaving court,
 * and their evidence can run over several hearings. So each record names the hearing it
 * was taken at and the case it belongs to, and is signed on its own path: the witness or
 * the accused first, then the magistrate. Anshumanth's entity explainer (2026-10-26)
 * draws attendance the same way: entered on the order, owned by the hearing.
 *
 * One record per person per sitting: a witness cross-examined again at the next hearing
 * gets a new record there. Whether a sheet should instead grow over sittings is open
 * (`docs/design/features/witness-deposition.md`).
 *
 * Kept in this browser (`browser-record.ts`), like order drafts, so a half-typed
 * deposition outlives a reload. A backend holds them for real.
 */

import type { CourtHearingPurposeId } from "./hearings";
import type { CasePerson } from "./case-people";
import { restoreRecord, saveRecord, watchRecord } from "./browser-record";

export type EvidenceKind = "deposition" | "examination";

export type EvidenceStatus =
  /** Being typed. */
  | "draft"
  /** An examination sent to the accused to sign on their own phone. */
  | "awaiting-signature"
  /** Signed by the witness or the accused; with the magistrate. */
  | "signed";

export type EvidenceRecord = {
  id: string;
  kind: EvidenceKind;
  caseNumber: string;
  /** The listing it was taken at. */
  hearingId: string;
  /** The witness or the accused, from the case's people. Empty until chosen. */
  personId: string;
  html: string;
  text: string;
  status: EvidenceStatus;
  signedWith?: "aadhaar" | "paper";
  /** A deposition's witness number, fixed when the witness signs: "PW-3". */
  witnessNumber?: string;
  /** Where the accused's signing link went. */
  sentTo?: string;
  /** ISO timestamp it was started, for ordering. */
  createdOn: string;
  /** The court's day it was taken on — what the sheet is dated. Not the browser's clock. */
  takenOn: string;
};

export type EvidenceRecords = Readonly<Record<string, EvidenceRecord>>;

/**
 * One keyed object in this browser, restored with its first subscriber (after hydration)
 * and kept in step across tabs. The records and the witnesses added here are two.
 */
function browserStore<T extends object>(key: string, opening: T) {
  let value = opening;
  let restored = false;
  const listeners = new Set<() => void>();
  function restore(): void {
    if (restored || typeof window === "undefined") return;
    restored = true;
    value = restoreRecord(key, opening);
  }
  function notify(): void {
    for (const listener of listeners) listener();
  }
  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      if (!restored) {
        restore();
        notify();
      }
      watchRecord(key, () => {
        value = restoreRecord(key, opening);
        notify();
      });
      return () => {
        listeners.delete(listener);
      };
    },
    read: (): T => value,
    server: (): T => opening,
    current(): T {
      restore();
      return value;
    },
    write(next: T): void {
      value = next;
      saveRecord(key, next);
      notify();
    },
  };
}

const OPENING: EvidenceRecords = Object.freeze({});
const records = browserStore<EvidenceRecords>("dristi.hearing-evidence.v1", OPENING);

export const subscribeToEvidence = records.subscribe;
export const readEvidence = records.read;
export const serverEvidence = records.server;

export function saveEvidence(record: EvidenceRecord): void {
  records.write({ ...records.current(), [record.id]: record });
}

export function updateEvidence(
  id: string,
  change: Partial<Omit<EvidenceRecord, "id">>,
): void {
  const all = records.current();
  const current = all[id];
  if (!current) return;
  records.write({ ...all, [id]: { ...current, ...change } });
}

export function discardEvidence(id: string): void {
  const all = records.current();
  if (!all[id]) return;
  records.write(Object.fromEntries(Object.entries(all).filter(([key]) => key !== id)));
}

export function newEvidenceRecord(
  kind: EvidenceKind,
  at: { caseNumber: string; hearingId: string; today: string },
  now: Date = new Date(),
): EvidenceRecord {
  return {
    id: `evidence-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    caseNumber: at.caseNumber,
    hearingId: at.hearingId,
    personId: "",
    /* An empty paragraph, so every line typed is one: a shortcut accepted on a bare line
       would otherwise land inside it rather than after it. */
    html: "<p><br></p>",
    text: "",
    status: "draft",
    createdOn: now.toISOString(),
    takenOn: at.today,
  };
}

/** This hearing's records, oldest first — the order they were taken in. */
export function evidenceAtHearing(
  all: EvidenceRecords,
  hearingId: string,
): EvidenceRecord[] {
  return Object.values(all)
    .filter((record) => record.hearingId === hearingId)
    .sort((a, b) => a.createdOn.localeCompare(b.createdOn));
}

/** Not yet signed by the person who gave it: the count the view's switch carries. */
export function unsignedCount(records: readonly EvidenceRecord[]): number {
  return records.filter((record) => record.status !== "signed").length;
}

/** What an empty Examinations view offers first: the record the hearing is listed for. */
export function firstKindFor(
  purpose: CourtHearingPurposeId | undefined,
): EvidenceKind {
  return purpose === "examination-of-accused-351" ? "examination" : "deposition";
}

/** The accused a record can be about. A deposition's witnesses are `deponentsFor`'s. */
export function accusedOf(people: readonly CasePerson[]): CasePerson[] {
  return people.filter((person) => person.kind === "accused");
}

/** How many square-bracket blanks are still in the text. */
export function blanksIn(text: string): number {
  return text.match(/\[[^\]]*\]/g)?.length ?? 0;
}

/** "PW-2 · Branch Manager…" for a numbered witness; the name otherwise. */
export function evidenceLabel(
  record: Pick<EvidenceRecord, "kind" | "personId" | "witnessNumber">,
  people: readonly CasePerson[],
  deponents: readonly Deponent[],
): string {
  if (record.kind === "examination") {
    return people.find((entry) => entry.id === record.personId)?.name ?? "New examination";
  }
  const deponent = deponents.find((entry) => entry.id === record.personId);
  if (!deponent) return "New deposition";
  const number = record.witnessNumber ?? deponent.number;
  return number ? `${number} · ${deponent.name}` : deponent.name;
}

/** What the record's tab says about where it stands. */
export function evidenceStatusLabel(record: EvidenceRecord): string {
  if (record.status === "signed") {
    return record.kind === "deposition" ? "Signed by the witness" : "Signed by the accused";
  }
  if (record.status === "awaiting-signature") return "Sent to sign";
  return "Not signed";
}

/* ─────────────────────────────── witnesses ─────────────────────────────────── */

/** Who called a witness — and so the letters of their number. */
export type WitnessSide = "complainant" | "accused" | "court";

const PREFIX: Record<WitnessSide, string> = {
  complainant: "PW",
  accused: "DW",
  court: "CW",
};

/**
 * A witness the court added while recording, because the one in the box was not on the
 * case's list (owner, 2026-10-27: "there are no witnesses on the case"). DRISTI 1.0 had
 * an Add New Witness form in the same place. Kept per case, so they are on the list at
 * the next hearing. Whether they also join the case's Parties tab is Anshumanth's call.
 */
export type AddedWitness = {
  id: string;
  caseNumber: string;
  name: string;
  side: WitnessSide;
  /** Ten digits, for the Aadhaar OTP; optional. */
  mobile?: string;
  addedOn: string;
};

export type AddedWitnesses = Readonly<Record<string, AddedWitness>>;

const NO_WITNESSES: AddedWitnesses = Object.freeze({});
const added = browserStore<AddedWitnesses>("dristi.added-witnesses.v1", NO_WITNESSES);

export const subscribeToAddedWitnesses = added.subscribe;
export const readAddedWitnesses = added.read;
export const serverAddedWitnesses = added.server;

export function addWitness(
  witness: Omit<AddedWitness, "id" | "addedOn">,
  now: Date = new Date(),
): AddedWitness {
  const entry: AddedWitness = {
    ...witness,
    id: `witness-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    addedOn: now.toISOString(),
  };
  added.write({ ...added.current(), [entry.id]: entry });
  return entry;
}

/** Someone a deposition can be of. */
export type Deponent = {
  id: string;
  name: string;
  side: WitnessSide;
  /**
   * Their witness number once they have one: from the case's witness list, or given
   * when an earlier deposition of theirs was signed. Absent until then.
   */
  number?: string;
  examined?: boolean;
  mobile?: string;
  /** Listed on the case, the complainant, or added here. */
  source: "listed" | "complainant" | "added";
};

function sameName(a: string, b: string): boolean {
  const plain = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");
  return plain(a) === plain(b);
}

/**
 * Who a deposition can be of, in the order a clerk looks for them. The complainant first
 * when not already a listed witness: in a cheque case they are almost always the first
 * witness, PW-1. Then the case's listed witnesses, then those added here.
 */
export function deponentsFor(
  caseNumber: string,
  people: readonly CasePerson[],
  addedWitnesses: AddedWitnesses,
  all: EvidenceRecords,
): Deponent[] {
  const signedNumber = (personId: string) =>
    Object.values(all).find(
      (record) =>
        record.caseNumber === caseNumber &&
        record.kind === "deposition" &&
        record.personId === personId &&
        record.witnessNumber,
    )?.witnessNumber;
  const listed = people.filter((person) => person.kind === "witness");
  const complainant = people.find((person) => person.kind === "complainant");
  const mobileOf = (person: CasePerson) =>
    person.mobiles[0]?.value.replace(/^\+91\s*/, "").replace(/\s/g, "");
  return [
    ...(complainant && !listed.some((person) => sameName(person.name, complainant.name))
      ? [
          {
            id: complainant.id,
            name: complainant.name,
            side: "complainant" as const,
            number: signedNumber(complainant.id),
            mobile: mobileOf(complainant),
            source: "complainant" as const,
          },
        ]
      : []),
    ...listed.map((person) => ({
      id: person.id,
      name: person.name,
      side: person.side,
      number: person.role,
      examined: person.examined,
      mobile: mobileOf(person),
      source: "listed" as const,
    })),
    ...Object.values(addedWitnesses)
      .filter((witness) => witness.caseNumber === caseNumber)
      .sort((a, b) => a.addedOn.localeCompare(b.addedOn))
      .map((witness) => ({
        id: witness.id,
        name: witness.name,
        side: witness.side,
        number: signedNumber(witness.id),
        mobile: witness.mobile,
        source: "added" as const,
      })),
  ];
}

/** The next free number on a side: after PW-1 and PW-2, "PW-3". */
export function nextWitnessNumber(
  side: WitnessSide,
  deponents: readonly Deponent[],
): string {
  const prefix = PREFIX[side];
  const taken = deponents
    .map((deponent) => new RegExp(`^${prefix}-(\\d+)$`).exec(deponent.number ?? ""))
    .map((match) => (match ? Number(match[1]) : 0));
  return `${prefix}-${Math.max(0, ...taken) + 1}`;
}

/**
 * The number a deposition's witness is shown with: theirs if they have one, otherwise the
 * next free number on their side, which becomes theirs when they sign. Two unsigned
 * depositions can show the same next number; the first signed takes it.
 */
export function witnessNumberOf(
  record: Pick<EvidenceRecord, "witnessNumber">,
  deponent: Deponent,
  deponents: readonly Deponent[],
): { number: string; fixed: boolean } {
  const number = record.witnessNumber ?? deponent.number;
  return number
    ? { number, fixed: true }
    : { number: nextWitnessNumber(deponent.side, deponents), fixed: false };
}
