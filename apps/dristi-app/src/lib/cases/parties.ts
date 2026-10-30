/**
 * Who is on this case, and how they are attached to each other.
 *
 * Three populations, deliberately kept apart, and each one browsable in its
 * own right:
 *
 * - **Litigants** — the people and entities the case is between. Where the
 *   drawer is a company, the company *and* every person in charge of and
 *   responsible to it are accused (actors.md, company liability), so a §141
 *   accused is an entity litigant plus one litigant per officer — not one
 *   party carrying a list of officers.
 * - **Witnesses** — called by a side, or by neither.
 * - **Support people** — the juniors and clerks who work under an advocate on
 *   record. A junior is access delegation, not a party, which is why they are
 *   a population of their own and never a litigant.
 *
 * **The relationships live on the participant now.** An earlier build drew
 * them as edges on a map; the master-detail browser answers them where the
 * reader already is — an entity's detail names its representative and the
 * officers in charge of it, an officer's detail names the entity their
 * liability derives from, and a litigant's detail names their PoA-holder. The
 * §141 facts are the same facts; only where they are stated moved.
 *
 * **Side is a field, never a prefix.** An earlier build read the side off the
 * witness number — `PW-` meant complainant, `DW-` meant accused, anything else
 * fell into an "unassigned" bucket. That is a string doing a data model's job:
 * a court witness landed in "unassigned" rather than "neither party", and a
 * witness whose number had not been assigned yet had no side at all. `side`,
 * `numberPrefix` and `numberIndex` are now three authored fields, and
 * `assertWitnessNumbering` fails loudly when the prefix and the side disagree
 * rather than letting one quietly overrule the other.
 *
 * **Authored, then cross-checked.** Party type, designation, entity links,
 * PoA-holders, party-in-person status, legal-team staff and witnesses come
 * from `parties-dummy.json` — none of it is inferable from a cause title. What
 * the fixture record already knows stays the fixture's: the cause-title names
 * come from `record.parties` and the advocates on record from `record.counsel`,
 * so the section cannot name a party or an advocate that the case header does
 * not. Every join between the two throws instead of degrading, because a
 * parties screen that quietly drops an accused is worse than one that fails to
 * render.
 */
import pack from "./parties-dummy.json";
import { caseSectionHref } from "./sections";
import { counselFor, type CaseRecord, type CounselSide } from "./types";

export type PartySideId = CounselSide;

/* ------------------------------------------------------------------ */
/* Which participant is open                                            */
/* ------------------------------------------------------------------ */

/**
 * One list, two groups, one selection — and the selection lives in the URL.
 *
 * `?selected=` alongside the section's own `?section=`: a link to one witness
 * has to survive being sent to someone, a refresh has to land on the same
 * person, and the pane that renders on the server should be the one the link
 * asked for rather than one the browser picks after hydration. An earlier
 * build kept this in component state and that was ruled a defect.
 *
 * No `?tab=` any more. An old one is simply an unread query param — nothing
 * parses it, so nothing can fail on it.
 */
export function parseSelectedId(
  value: string | string[] | undefined
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.length > 0 ? raw : undefined;
}

/** The default selection stays off the URL, so the section link is canonical. */
export function participantHref(caseId: string, selectedId?: string): string {
  const base = caseSectionHref(caseId, "parties");
  return selectedId
    ? `${base}&selected=${encodeURIComponent(selectedId)}`
    : base;
}

/* ------------------------------------------------------------------ */
/* Domain shapes                                                        */
/* ------------------------------------------------------------------ */

/** What a party *is*. Drives the standing line and the litigant count. */
export type PartyKind = "individual" | "entity";

/** A witness belongs to a side, or to neither — the court's own witness. */
export type WitnessSideId = PartySideId | "neither";

/** Who put the witness on the record. "court" is not a side. */
export type WitnessAddedBy = PartySideId | "court";

/** Prosecution witness, defence witness, court witness. */
export type WitnessNumberPrefix = "PW" | "DW" | "CW";

/** A person attached to a party who is not themselves a party. */
export type PartyAttachment = {
  name: string;
  designation?: string;
  /** Set when this person is also a party in their own right (§141). */
  partyId?: string;
};

export type CaseParty = {
  id: string;
  side: PartySideId;
  name: string;
  kind: PartyKind;
  /** "Partnership firm" · "Private limited company" — entities only. */
  entityType?: string;
  /** "Managing partner" — how an individual stands inside an entity. */
  designation?: string;
  /**
   * The human who answers for an entity in court. On the accused side that
   * person is separately liable and so carries `partyId` as well; on the
   * complainant side a company files through an authorised representative
   * who is not a party, and that link is absent.
   *
   * Deliberately not "legal representative": §2(11) CPC gives that term to
   * whoever represents the estate of a *deceased* person, which is a
   * different thing entirely and the wrong one to put in front of an Indian
   * court user. The screen and the field say the same word.
   */
  entityRepresentative?: PartyAttachment;
  /**
   * The entity this individual answers for, when they are a person in charge.
   * `isEntityRepresentative` separates the officer the entity files through
   * from the other officers who are liable alongside it — both are accused,
   * only one of them speaks for the company.
   */
  represents?: {
    partyId: string;
    name: string;
    isEntityRepresentative: boolean;
  };
  /**
   * At most one. A PoA-holder acts for the party; they are not a second party
   * and never appear in the litigant list in their own right.
   */
  powerOfAttorneyHolder?: string;
  /**
   * The party is conducting their own case.
   *
   * **Not the same thing as an empty advocate list**, and the two must never
   * be collapsed. Party-in-person is a decision the party made and the record
   * carries — the product exposes it as an action ("Become PiP") — whereas an
   * empty list is the registry not yet holding a vakalatnama. One says "this
   * person is representing themselves"; the other says "we do not know who
   * represents them". A screen that renders them identically is telling the
   * reader something the record does not say.
   */
  partyInPerson: boolean;
  /** Advocate names on record for this party, resolved from the legal teams. */
  advocates: string[];
};

export type LegalTeam = {
  id: string;
  /** The advocate on record. Always one of `record.counsel[side]`. */
  advocate: string;
  side: PartySideId;
  /** The parties this advocate appears for, in party order. */
  clients: { id: string; name: string }[];
  /** True when this advocate appears for more than one party on the side. */
  shared: boolean;
  juniors: string[];
  clerks: string[];
};

export type CaseWitness = {
  id: string;
  name: string;
  side: WitnessSideId;
  numberPrefix: WitnessNumberPrefix;
  numberIndex: number;
  /** "PW-1" — composed here so no screen builds it from two fields. */
  number: string;
  description?: string;
  /** The party whose evidence this witness speaks to, when there is one. */
  linkedParty?: { id: string; name: string };
  addedBy: WitnessAddedBy;
};

/**
 * A junior or a clerk, once per person — not once per advocate they work
 * under.
 *
 * An earlier shape split a person into a row per advocate, on the reasoning
 * that each pairing reached a different set of parties. That reasoning came
 * from a tile claiming what the person "can reach", which was an access claim
 * this product has no model for and no longer makes. What is left is a count
 * chip saying "support people", and a person who works under two advocates is
 * one person — so the row is the person and the advocates are a list on it.
 */
export type SupportPerson = {
  id: string;
  name: string;
  /** "Junior" · "Clerk". */
  role: string;
  /** Every advocate on record this person works under, in team order. */
  advocates: string[];
  /** The sides those advocates appear on. Usually one. */
  sides: PartySideId[];
  /** Every party those advocates are on brief for, de-duplicated. */
  clients: string[];
  subline: string;
};

/** An officer whose liability derives from an entity on the same side. */
export type PersonInCharge = {
  id: string;
  name: string;
  /** "Entity representative" · "Person in charge". */
  role: string;
  designation?: string;
};

export type Litigant = CaseParty & {
  /**
   * "Individual" · "Partnership firm · Managing partner".
   *
   * No `subline` here. The register composes its own second line from these
   * fields, and a summary string on the model would be a *second* derivation
   * of the same sentence — the two drifted apart within one round, the model
   * still saying "represented by" after the view stopped. One derivation, in
   * the place that renders it.
   */
  standing: string;
  /** Entities only: the officers who answer for this company. */
  personsInCharge: PersonInCharge[];
  /** Everyone reachable through this litigant's advocates. */
  supportPeople: SupportPerson[];
};

/**
 * How many of each population this case holds.
 *
 * **The rule, one line each:**
 *
 * - *Litigants* — every party on the cause title, entities included. A company
 *   is a litigant: it is prosecuted, it is served, it is convicted. Splitting
 *   people from entities was the old summary's job and it made the number
 *   impossible to reconcile with the list underneath it; here the count is
 *   simply how many rows the Litigants tab has.
 * - *Witnesses* — every witness, the court's own included. They are all in the
 *   Witnesses tab, so they are all in the count.
 * - *Legal teams* — one per advocate on record, which is what the tab lists.
 * - *Support people* — every junior and clerk across every legal team on the
 *   case, de-duplicated by person. A clerk who works under two advocates is
 *   one person; the advocates are a list on that row. Not a tab of its own any
 *   more — support people are shown inside the advocate they work under — so
 *   this count is carried for the sublines rather than a chip.
 *
 * Every tab count equals the length of the list behind it. Nothing else.
 */
export type ParticipantCounts = {
  litigants: number;
  witnesses: number;
  legalTeams: number;
  support: number;
};

export type ParticipantsFile = {
  litigants: Litigant[];
  witnesses: CaseWitness[];
  /**
   * One per advocate on record. Exposed rather than reconstructed from
   * `supportPeople`: an advocate with no junior and no clerk appears in no
   * support row at all, so rebuilding the roster from staff would silently
   * drop every sole practitioner on the case.
   */
  legalTeams: LegalTeam[];
  supportPeople: SupportPerson[];
  counts: ParticipantCounts;
};

/* ------------------------------------------------------------------ */
/* The authored pack                                                    */
/* ------------------------------------------------------------------ */

type RegisterRow = { kind: string; entityType?: string };

type DummyParty = {
  id: string;
  side: string;
  name: string;
  designation?: string;
  entityRepresentative?: {
    name: string;
    designation?: string;
    partyId?: string;
  };
  representsPartyId?: string;
  powerOfAttorneyHolder?: string;
  partyInPerson?: boolean;
};

type DummyLegalTeam = {
  id: string;
  advocate: string;
  side: string;
  clientPartyIds: string[];
  juniors?: string[];
  clerks?: string[];
};

type DummyWitness = {
  id: string;
  name: string;
  side: string;
  numberPrefix: string;
  numberIndex: number;
  description?: string;
  linkedPartyId?: string;
  addedBy: string;
};

type DummyCase = {
  parties: DummyParty[];
  legalTeams?: DummyLegalTeam[];
  witnesses?: DummyWitness[];
};

/**
 * One row per named party in the fixture set: the cause title says *who*, this
 * says *what*. Keyed by name rather than by case because the same trader
 * appears in more than one fixture and is the same kind of party in each; a
 * per-case copy is a per-case chance for the two to disagree.
 */
const REGISTER = pack.partyRegister as Record<string, RegisterRow | undefined>;

const CASE_PACK = pack.cases as Partial<Record<string, DummyCase>>;

/** How a row names its side. */
export const PARTY_ROLE_LABEL: Record<PartySideId, string> = {
  complainant: "Complainant",
  accused: "Accused",
};

/**
 * The case's three actors in the form that reads mid-sentence — "called by
 * the complainant", "added by the court".
 *
 * Named for the actors rather than for one question about them: the same
 * register answers "who called this witness" and "who added them", and a map
 * called `ADDED_BY_*` doing duty for "called by" is how the next reader is
 * misled.
 *
 * **Both registers are authored, and both stay.** This one was deleted once
 * when the only surface reading it went away; the next layout needed a
 * mid-sentence form again and reached for `.toLowerCase()` at the call site
 * instead, which is the whole hazard returning by the back door. Casing a
 * display string in the view is a seam that only holds in English, and the
 * languages these deployments ship in do not all have a case distinction to
 * lower. A register with no reader this month is cheaper than the casing bug
 * it prevents next month.
 *
 * The third way this goes wrong is interpolating the enum itself —
 * `` `Called by the ${witness.side}` `` renders correctly only because the
 * union members happen to be English words. Never that either.
 */
export const PARTY_INLINE_LABEL: Record<WitnessAddedBy, string> = {
  complainant: "the complainant",
  accused: "the accused",
  court: "the court",
};

/** The same actors standing alone — a column header, or a value in a row. */
export const ADDED_BY_LABEL: Record<WitnessAddedBy, string> = {
  complainant: "Complainant",
  accused: "Accused",
  court: "Court",
};

/**
 * A witness number states which side called the witness, and so does `side`.
 * They are two authored fields saying one thing, which means they can be
 * authored into disagreeing — and the screen would then show a "PW-2" filed
 * under the accused with no way for a reader to tell which half is wrong.
 */
const PREFIX_FOR_SIDE: Record<WitnessSideId, WitnessNumberPrefix> = {
  complainant: "PW",
  accused: "DW",
  neither: "CW",
};

function isPartySide(value: string): value is PartySideId {
  return value === "complainant" || value === "accused";
}

function isWitnessSide(value: string): value is WitnessSideId {
  return isPartySide(value) || value === "neither";
}

function isAddedBy(value: string): value is WitnessAddedBy {
  return isPartySide(value) || value === "court";
}

/** Names are compared the way a clerk compares them — case and spacing aside. */
function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * What kind of party this is. Throws rather than defaulting: guessing
 * "individual" from a name is how "Anand Traders" ends up filed as a person,
 * and a missing row is a fixture that has not been finished rather than a
 * party whose type is genuinely unknown.
 */
function registerRow(name: string): { kind: PartyKind; entityType?: string } {
  const row = REGISTER[name];
  if (!row) {
    throw new Error(
      `No party register row for "${name}" — add it to parties-dummy.json`
    );
  }
  if (row.kind !== "individual" && row.kind !== "entity") {
    throw new Error(`Unknown party kind "${row.kind}" for "${name}"`);
  }
  if (row.kind === "entity" && !row.entityType) {
    throw new Error(`Entity "${name}" has no entityType in the party register`);
  }
  return { kind: row.kind, entityType: row.entityType };
}

/**
 * The cause title is the case's own record of who it is between, and the pack
 * is a second copy of that. Every authored case has to still contain both
 * sides of it — an accused pack that has drifted off the cause title is a
 * silent misfiling, and there is no way for the screen to tell which of the
 * two is right.
 */
function assertCauseTitle(record: CaseRecord, parties: CaseParty[]): void {
  for (const side of ["complainant", "accused"] as const) {
    /* A cause title may close on "and 1 other": the lead party is the one named. */
    const expected = normalize(record.parties[side]).replace(/ and \d+ others?$/, "");
    const found = parties.some(
      (party) => party.side === side && normalize(party.name) === expected
    );
    if (!found) {
      throw new Error(
        `${record.id}: the parties pack has no ${side} named "${record.parties[side]}"`
      );
    }
  }
}

function assertWitnessNumbering(
  caseId: string,
  witness: DummyWitness,
  side: WitnessSideId
): void {
  const expected = PREFIX_FOR_SIDE[side];
  if (witness.numberPrefix !== expected) {
    throw new Error(
      `${caseId}: witness ${witness.name} is on the ${side} side but numbered ` +
        `${witness.numberPrefix} — expected ${expected}`
    );
  }
  if (!Number.isInteger(witness.numberIndex) || witness.numberIndex < 1) {
    throw new Error(
      `${caseId}: witness ${witness.name} has a non-positive number index`
    );
  }
}

/**
 * A party-in-person with an advocate on record is a contradiction the record
 * cannot hold: either they are conducting their own case or counsel is. This
 * would otherwise render as "Party in person" over a list of advocates.
 */
function assertRepresentation(caseId: string, party: CaseParty): void {
  if (party.partyInPerson && party.advocates.length > 0) {
    throw new Error(
      `${caseId}: ${party.name} is marked party-in-person but has ` +
        `${party.advocates.join(", ")} on record`
    );
  }
}

/* ------------------------------------------------------------------ */
/* Building the file                                                    */
/* ------------------------------------------------------------------ */

/**
 * The cause title on its own, for the cases with no authored pack: two
 * parties, typed from the register, with whatever the fixture records as
 * counsel. Not a placeholder — most cases really are one complainant and one
 * accused, and the extra shapes (persons in charge, PoA-holders) are the
 * exception the featured cases carry.
 */
function causeTitleParties(record: CaseRecord): CaseParty[] {
  return (["complainant", "accused"] as const).map((side) => {
    const name = record.parties[side];
    return {
      id: `${record.id}-${side}`,
      side,
      name,
      ...registerRow(name),
      partyInPerson: false,
      advocates: [],
    };
  });
}

function packParties(record: CaseRecord, entry: DummyCase): CaseParty[] {
  const parties: CaseParty[] = entry.parties.map((party) => {
    if (!isPartySide(party.side)) {
      throw new Error(`${record.id}: unknown party side "${party.side}"`);
    }
    return {
      id: party.id,
      side: party.side,
      name: party.name,
      ...registerRow(party.name),
      designation: party.designation,
      entityRepresentative: party.entityRepresentative,
      powerOfAttorneyHolder: party.powerOfAttorneyHolder,
      partyInPerson: party.partyInPerson ?? false,
      advocates: [],
    };
  });

  const byId = new Map(parties.map((party) => [party.id, party]));

  /* Entity links are resolved to names here so no screen holds an id. */
  for (const authored of entry.parties) {
    const party = byId.get(authored.id);
    if (!party) continue;

    if (authored.representsPartyId) {
      const entity = byId.get(authored.representsPartyId);
      if (!entity) {
        throw new Error(
          `${record.id}: ${authored.name} represents unknown party ` +
            `"${authored.representsPartyId}"`
        );
      }
      party.represents = {
        partyId: entity.id,
        name: entity.name,
        isEntityRepresentative:
          entity.entityRepresentative?.partyId === party.id,
      };
    }

    const linkedId = authored.entityRepresentative?.partyId;
    if (linkedId && !byId.has(linkedId)) {
      throw new Error(
        `${record.id}: ${authored.name} names unknown entity representative ` +
          `party "${linkedId}"`
      );
    }
  }

  return parties;
}

/**
 * One team per advocate on record. Authored teams say which parties each
 * advocate appears for and who works under them; a case with no authored
 * teams gets one team per advocate on record, appearing for every party on
 * their side, with no staff.
 *
 * Either all of a case's teams are authored or none are. A half-authored case
 * would put the remaining advocates on the derived "appears for everyone"
 * default, which is a claim about who represents whom rather than an absence
 * of one — so the mismatch throws.
 */
function legalTeams(
  record: CaseRecord,
  parties: CaseParty[],
  entry: DummyCase | undefined
): LegalTeam[] {
  const byId = new Map(parties.map((party) => [party.id, party]));
  const authored = entry?.legalTeams ?? [];
  const teams: LegalTeam[] = [];

  for (const side of ["complainant", "accused"] as const) {
    const onRecord = counselFor(record, side);
    const sideTeams = authored.filter((team) => team.side === side);

    if (sideTeams.length > 0) {
      const named = new Set(sideTeams.map((team) => normalize(team.advocate)));
      const missing = onRecord.filter((name) => !named.has(normalize(name)));
      if (missing.length > 0) {
        throw new Error(
          `${record.id}: ${side} counsel ${missing.join(", ")} has no legal ` +
            `team in the parties pack — author every team or none`
        );
      }
    }

    for (const team of sideTeams) {
      const isOnRecord = onRecord.some(
        (name) => normalize(name) === normalize(team.advocate)
      );
      if (!isOnRecord) {
        throw new Error(
          `${record.id}: ${team.advocate} leads a ${side} team but is not ` +
            `counsel on record for that side`
        );
      }
      const clients = team.clientPartyIds.map((id) => {
        const party = byId.get(id);
        if (!party) {
          throw new Error(
            `${record.id}: ${team.advocate} is briefed by unknown party "${id}"`
          );
        }
        if (party.side !== side) {
          throw new Error(
            `${record.id}: ${team.advocate} appears for ${side} but ` +
              `${party.name} is on the ${party.side} side`
          );
        }
        return { id: party.id, name: party.name };
      });

      teams.push({
        id: team.id,
        advocate: team.advocate,
        side,
        clients,
        shared: clients.length > 1,
        juniors: team.juniors ?? [],
        clerks: team.clerks ?? [],
      });
    }

    if (sideTeams.length === 0) {
      /* A party conducting their own case is not a client of anybody, so a
         derived team never sweeps them in alongside the parties who are. */
      const sideParties = parties.filter(
        (party) => party.side === side && !party.partyInPerson
      );
      for (const [index, advocate] of onRecord.entries()) {
        teams.push({
          id: `${record.id}-${side}-team-${index}`,
          advocate,
          side,
          clients: sideParties.map((party) => ({
            id: party.id,
            name: party.name,
          })),
          shared: sideParties.length > 1,
          juniors: [],
          clerks: [],
        });
      }
    }
  }

  return teams;
}

function caseWitnesses(
  record: CaseRecord,
  parties: CaseParty[],
  entry: DummyCase | undefined
): CaseWitness[] {
  const byId = new Map(parties.map((party) => [party.id, party]));

  return (entry?.witnesses ?? []).map((witness) => {
    if (!isWitnessSide(witness.side)) {
      throw new Error(`${record.id}: unknown witness side "${witness.side}"`);
    }
    if (!isAddedBy(witness.addedBy)) {
      throw new Error(`${record.id}: unknown addedBy "${witness.addedBy}"`);
    }
    assertWitnessNumbering(record.id, witness, witness.side);

    let linkedParty: CaseWitness["linkedParty"];
    if (witness.linkedPartyId) {
      const party = byId.get(witness.linkedPartyId);
      if (!party) {
        throw new Error(
          `${record.id}: witness ${witness.name} is linked to unknown party ` +
            `"${witness.linkedPartyId}"`
        );
      }
      linkedParty = { id: party.id, name: party.name };
    }

    return {
      id: witness.id,
      name: witness.name,
      side: witness.side,
      numberPrefix: PREFIX_FOR_SIDE[witness.side],
      numberIndex: witness.numberIndex,
      /* Composed once here so no screen builds it from two fields — and the
         prefix comes from the side that called the witness, never from who
         added them. */
      number: `${PREFIX_FOR_SIDE[witness.side]}-${witness.numberIndex}`,
      description: witness.description,
      linkedParty,
      addedBy: witness.addedBy,
    };
  });
}

/**
 * Every junior and clerk on the case, one row per person.
 *
 * Keyed by name and role together: the same name appearing once as a junior
 * and once as a clerk is two roles on the case and two rows, while the same
 * junior under two advocates is one person with two advocates listed. Team
 * order is preserved, so a person's advocates read in the order the case
 * records them.
 */
function supportPeople(teams: LegalTeam[]): SupportPerson[] {
  const byPerson = new Map<string, SupportPerson>();

  for (const team of teams) {
    const staff = [
      ...team.juniors.map((name) => ({ role: "Junior", name })),
      ...team.clerks.map((name) => ({ role: "Clerk", name })),
    ];
    for (const [index, person] of staff.entries()) {
      const key = `${person.role} ${normalize(person.name)}`;
      const existing = byPerson.get(key);
      const clients = team.clients.map((client) => client.name);

      if (existing) {
        existing.advocates.push(team.advocate);
        if (!existing.sides.includes(team.side)) existing.sides.push(team.side);
        for (const client of clients) {
          if (!existing.clients.includes(client)) existing.clients.push(client);
        }
        continue;
      }

      byPerson.set(key, {
        id: `${team.id}-support-${index}`,
        name: person.name,
        role: person.role,
        advocates: [team.advocate],
        sides: [team.side],
        clients,
        subline: "",
      });
    }
  }

  const people = [...byPerson.values()];
  for (const person of people) {
    person.subline = `${person.role} · linked through ${formatNames(person.advocates)}`;
  }
  return people;
}

/** "A", "A and B", "A, B and C" — a list of people reads as a sentence. */
function formatNames(names: string[]): string {
  return new Intl.ListFormat("en-IN", {
    style: "long",
    type: "conjunction",
  }).format(names);
}

/**
 * The one thing a litigant's standing line says: what an entity is, or where
 * an individual sits inside one. "Individual" is the answer when a person
 * holds no office — a fact, not a fallback.
 */
export function partyStanding(party: CaseParty): string {
  const kind = party.kind === "entity" ? party.entityType ?? "Entity" : "Individual";
  return [kind, party.designation].filter(Boolean).join(" · ");
}

/** The officers whose liability derives from this entity (§141). */
function personsInCharge(entity: CaseParty, parties: CaseParty[]): PersonInCharge[] {
  if (entity.kind !== "entity") return [];
  return parties
    .filter((party) => party.represents?.partyId === entity.id)
    .map((officer) => ({
      id: officer.id,
      name: officer.name,
      role: officer.represents?.isEntityRepresentative
        ? "Entity representative"
        : "Person in charge",
      designation: officer.designation,
    }));
}

export function participantsFile(record: CaseRecord): ParticipantsFile {
  const entry = CASE_PACK[record.id];
  const parties = entry ? packParties(record, entry) : causeTitleParties(record);
  assertCauseTitle(record, parties);

  const teams = legalTeams(record, parties, entry);
  const witnesses = caseWitnesses(record, parties, entry);
  const support = supportPeople(teams);

  /* Advocates hang off the team, so the party reads them back rather than
     carrying a second list that can disagree with the Support tab. */
  for (const party of parties) {
    party.advocates = teams
      .filter((team) => team.clients.some((client) => client.id === party.id))
      .map((team) => team.advocate);
    assertRepresentation(record.id, party);
  }

  const litigants: Litigant[] = parties.map((party) => ({
    ...party,
    standing: partyStanding(party),
    personsInCharge: personsInCharge(party, parties),
    supportPeople: support.filter((person) =>
      person.advocates.some((advocate) =>
        party.advocates.some((onRecord) => normalize(onRecord) === normalize(advocate))
      )
    ),
  }));

  return {
    litigants,
    witnesses,
    legalTeams: teams,
    supportPeople: support,
    counts: {
      litigants: litigants.length,
      witnesses: witnesses.length,
      legalTeams: teams.length,
      support: support.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Selection                                                            */
/* ------------------------------------------------------------------ */

/**
 * Every row in the master list, in render order: the litigants in cause-title
 * order, then the witnesses. One flat list because one `?selected=` addresses
 * all of it — a row's id says which group it belongs to without the URL
 * having to.
 */
export function participantIds(file: ParticipantsFile): string[] {
  return [
    ...file.litigants.map((litigant) => litigant.id),
    ...file.witnesses.map((witness) => witness.id),
  ];
}

/**
 * Which row is open. A `?selected=` naming nothing — a stale link from an
 * earlier layout, a hand-edited URL, a row since removed — falls back to the
 * first litigant rather than rendering an empty pane beside a populated list.
 * `undefined` only if the case somehow has no participants at all, which
 * `assertCauseTitle` already makes impossible.
 */
export function resolveSelection(
  file: ParticipantsFile,
  requested: string | undefined
): string | undefined {
  const ids = participantIds(file);
  if (ids.length === 0) return undefined;
  return requested && ids.includes(requested) ? requested : ids[0];
}

/**
 * The witnesses whose evidence speaks to this litigant.
 *
 * Derived, and deliberately the *only* cross-reference on a litigant's pane
 * that is not already in its own section: it is what connects the two groups
 * of the master list, and a reader on a party can jump straight to the person
 * giving evidence about them.
 */
export function witnessesForLitigant(
  file: ParticipantsFile,
  litigantId: string
): CaseWitness[] {
  return file.witnesses.filter(
    (witness) => witness.linkedParty?.id === litigantId
  );
}

