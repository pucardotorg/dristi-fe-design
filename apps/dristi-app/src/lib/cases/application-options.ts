/**
 * The choices the Raise application form offers that come from the case:
 * who can raise it, whom it is for, and the litigants a type acts on.
 *
 * Two people lists meet here and stay apart on purpose. Raised by and
 * Litigant are saved on the application (Application Raised By, Application
 * Raised On Behalf Of), so they use the applications file's person ids, the
 * same ones the register reads back. The litigants a type acts on — whose
 * details change, who appoints a PoA holder, which accused a warrant is for —
 * are the case's litigants as the Parties tab lists them, with their kind
 * (individual or institution) and designation.
 */
import { accusedAddressesOnFile } from "./complaint";
import { applicationsFile, type SubmissionPerson } from "./applications";
import { participantsFile } from "./parties";
import type { CaseRecord } from "./types";
import type { Address } from "@/lib/filing/types";

export type PersonOption = { id: string; name: string };

export type CaseLitigant = {
  id: string;
  name: string;
  side: "complainant" | "accused";
  institution: boolean;
  designation?: string;
  /** "Partnership firm" — institutions only. */
  entityType?: string;
};

/**
 * PRD "Every application": Raised by lists everyone with advocate access on
 * the filer's side, and a party in person raises for themselves. Litigant
 * lists the litigants the person in Raised by represents.
 */
export function raisingOptions(
  record: CaseRecord,
  seat: {
    role: string | null;
    side?: "complainant" | "accused";
    personId?: string;
  }
): {
  raisedBy: PersonOption[];
  litigantsFor: (raisedById: string) => PersonOption[];
} {
  let people: SubmissionPerson[] = [];
  try {
    people = applicationsFile(record).people;
  } catch {
    people = [];
  }
  const side = seat.side;
  const parties = people.filter(
    (person) => person.kind === "party" && person.side === side
  );
  const self = people.find((person) => person.id === seat.personId);
  const raisedBy: PersonOption[] =
    seat.role === "pip" && self
      ? [{ id: self.id, name: self.name }]
      : people
          .filter((person) => person.kind === "advocate" && person.side === side)
          .map((person) => ({ id: person.id, name: person.name }));

  return {
    raisedBy,
    litigantsFor(raisedById) {
      const raiser = people.find((person) => person.id === raisedById);
      if (!raiser) return [];
      if (raiser.kind === "party") return [{ id: raiser.id, name: raiser.name }];
      return parties
        .filter((party) => party.side === raiser.side)
        .map((party) => ({ id: party.id, name: party.name }));
    },
  };
}

/**
 * Who Raised by starts on (PRD "Every application"): the filer's own name
 * for an advocate or a party in person; for a clerk, the advocate they work
 * for — left empty if there is more than one.
 */
export function preselectedRaiser(
  options: PersonOption[],
  seat: { role: string | null; personId?: string; signerId?: string }
): string {
  if (seat.role === "clerk") {
    if (seat.signerId && options.some((option) => option.id === seat.signerId)) {
      return seat.signerId;
    }
    return options.length === 1 ? options[0].id : "";
  }
  return options.some((option) => option.id === seat.personId)
    ? (seat.personId ?? "")
    : "";
}

/** The case's litigants, in cause-title order. */
export function caseLitigants(record: CaseRecord): CaseLitigant[] {
  try {
    return participantsFile(record).litigants.map((litigant) => ({
      id: litigant.id,
      name: litigant.name,
      side: litigant.side,
      institution: litigant.kind === "entity",
      designation: litigant.designation,
      entityType: litigant.entityType,
    }));
  } catch {
    // A case the parties register does not know (one just joined): the
    // cause title is all there is, and its kind is unknown.
    return (["complainant", "accused"] as const).map((side) => ({
      id: `${record.id}-${side}`,
      name: record.parties[side],
      side,
      institution: false,
    }));
  }
}

/** Where a warrant for this accused can be delivered, from the case file. */
export function accusedAddresses(
  record: CaseRecord,
  accusedName: string
): Address[] {
  return accusedAddressesOnFile(record.id)
    .filter((entry) => entry.name === accusedName)
    .map((entry) => entry.address);
}
