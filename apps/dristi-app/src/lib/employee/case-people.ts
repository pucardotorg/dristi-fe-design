/**
 * The people on a case a process can be addressed to — every accused, the complainant
 * and the witnesses — with what their records hold for delivery: postal addresses, mobile
 * numbers and email addresses, any of which may be several (owner, 2026-10-12: "even
 * phone numbers can be multiple").
 *
 * A process order item's delivery answers (`process-variables.ts`) pre-select from this (`AUT-05`–`AUT-08` of `handovers/process-handover.md`), so it
 * has to know more than the one accused name a `CourtHearing` carries: whether there is
 * more than one accused, which witnesses are still to be examined, and whether the
 * accused has joined the case yet.
 *
 * **This is the seam for the party record, and the data behind it is demo data.** The
 * employee side stays self-contained (`order-draft.ts`), so the people below are its own
 * fixtures, keyed by case number, shaped to exercise each pre-selection rule: a company
 * accused with its person in charge (`PRC-02`), an accused with two addresses, a witness
 * list with exactly one witness unexamined, and one with two. Every other case falls
 * back to the single accused named on the listing, at one synthetic address. Nothing
 * here is anyone's real address or number.
 */

import type { StructuredAddress } from "@/components/cases/structured-address";

import type { CourtId } from "@/lib/court/profiles";

import type { CourtCounsel, CourtCaseStage } from "./hearings";

export type CasePersonKind = "accused" | "complainant" | "witness";

/** Which side of the cause a person stands on — who takes steps for them (`AUT-02`). */
export type CaseSide = "complainant" | "accused";

export type CaseAddress = { id: string; address: StructuredAddress };

/** One mobile number or email address on a person's record. A person may have several. */
export type CaseContact = { id: string; value: string };

export type CasePerson = {
  id: string;
  name: string;
  kind: CasePersonKind;
  /** How the court refers to them on this case: "Accused 2", "PW-2". */
  role: string;
  side: CaseSide;
  /** Witnesses only: whether their examination has been recorded. */
  examined?: boolean;
  addresses: CaseAddress[];
  /** Every mobile number on record — SMS goes to each one selected. */
  mobiles: CaseContact[];
  /** Every email address on record — Email goes to each one selected. */
  emails: CaseContact[];
};

export type CasePeople = {
  people: CasePerson[];
  /** Whether the accused has joined the case — the switch between `AUT-05` and `AUT-06`. */
  accusedJoined: boolean;
};

/** The parts of a listing or a complaint this needs. Both `CourtHearing` and
 *  `CognizanceCase` satisfy it. */
export type CaseMatter = {
  caseNumber: string;
  parties: { complainant: string; accused: string };
  counsel: CourtCounsel[];
  stage?: CourtCaseStage;
};

const LOCAL_DISTRICT = { city: "Sample District", district: "Sample District", state: "Kerala" };

function address(
  door: string,
  building: string,
  locality: string,
  pin: string,
): StructuredAddress {
  return { door, building, locality, pin, ...LOCAL_DISTRICT };
}

/**
 * A stable synthetic address per name, for a party this fixture pack does not carry one
 * for. The same pattern `components/cases/edit-litigant-dialog.tsx`'s `demoAddress`
 * uses, kept separate because the employee side stays self-contained.
 */
export function demoAddress(name: string): StructuredAddress {
  let hash = 5;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  const surname = name.trim().split(/\s+/).at(-1) ?? "Sample";
  return address(String((hash % 48) + 1), `${surname} House`, "Chinnakada", "691001");
}

/** A stable synthetic mobile number per name. Not a real number. */
function demoMobile(name: string): string {
  let hash = 7;
  for (const char of name) hash = (hash * 37 + char.charCodeAt(0)) % 99991;
  return `+91 94470 ${String(hash).padStart(5, "0")}`;
}

function demoEmail(name: string): string {
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  return `${handle}@example.in`;
}

function person(
  fields: Omit<CasePerson, "addresses" | "mobiles" | "emails"> & {
    addresses: StructuredAddress[];
    mobiles?: string[];
    emails?: string[];
  },
): CasePerson {
  const { mobiles = [], emails = [], ...rest } = fields;
  return {
    ...rest,
    addresses: fields.addresses.map((entry, index) => ({
      id: `${fields.id}-address-${index + 1}`,
      address: entry,
    })),
    mobiles: mobiles.map((value, index) => ({
      id: `${fields.id}-mobile-${index + 1}`,
      value,
    })),
    emails: emails.map((value, index) => ({
      id: `${fields.id}-email-${index + 1}`,
      value,
    })),
  };
}

/**
 * The people the fixtures carry beyond the listing's one accused name. The complainant
 * and, where absent, the accused are filled in from the listing itself.
 */
const PACK: Partial<Record<string, CasePerson[]>> = {
  /* A company accused and its person in charge — separate recipients (`PRC-02`) — the
     company at two addresses, the person in charge with a mobile but no email. */
  "ST/249/2026": [
    person({
      id: "accused-1",
      name: "Gill Steel Fabricators",
      kind: "accused",
      role: "Accused 1",
      side: "accused",
      addresses: [
        address("14/220", "Industrial Estate", "Kundara", "691501"),
        address("3", "Gill Towers, Main Road", "Chinnakada", "691001"),
      ],
      mobiles: ["+91 94470 31206", "+91 94470 31277"],
      emails: ["accounts@gillsteel.example.in", "legal@gillsteel.example.in"],
    }),
    person({
      id: "accused-2",
      name: "Harpreet Gill",
      kind: "accused",
      role: "Accused 2 · person in charge",
      side: "accused",
      addresses: [address("7", "Gill Villa", "Kadappakada", "691008")],
      mobiles: ["+91 94470 58812"],
    }),
  ],
  /* Evidence stage, accused represented: exactly one witness still to be examined, so
     that witness is pre-selected (`AUT-06`). */
  "ST/241/2026": [
    person({
      id: "pw-1",
      name: "Sunil Varghese",
      kind: "witness",
      role: "PW-1",
      side: "complainant",
      examined: true,
      addresses: [address("22", "Varghese Bhavan", "Thevally", "691009")],
      mobiles: ["+91 94470 11873"],
    }),
    person({
      id: "pw-2",
      name: "Branch Manager, Federal Bank, Chinnakada",
      kind: "witness",
      role: "PW-2",
      side: "complainant",
      examined: false,
      addresses: [address("", "Federal Bank, Chinnakada branch", "Chinnakada", "691001")],
      emails: ["chinnakada.office@example.in"],
    }),
  ],
  /* Evidence stage, accused represented: two witnesses still to be examined, so the
     choice is left open (`AUT-06`). */
  "ST/250/2026": [
    person({
      id: "pw-1",
      name: "Fathima Beevi",
      kind: "witness",
      role: "PW-1",
      side: "complainant",
      examined: true,
      addresses: [address("5", "Beevi Manzil", "Pallimukku", "691010")],
    }),
    person({
      id: "pw-2",
      name: "Shameer K",
      kind: "witness",
      role: "PW-2",
      side: "complainant",
      examined: false,
      addresses: [address("41", "Kailas", "Mundakkal", "691001")],
      mobiles: ["+91 94470 66021"],
    }),
    person({
      id: "dw-1",
      name: "Joby Mathew",
      kind: "witness",
      role: "DW-1",
      side: "accused",
      examined: false,
      addresses: [address("9", "Mathew House", "Kottiyam", "691571")],
      mobiles: ["+91 94470 70415"],
    }),
  ],
};

const JOINED_STAGES: CourtCaseStage[] = [
  "appearance",
  "plea",
  "evidence",
  "arguments",
  "judgement",
];

/**
 * Whether the accused has joined the case.
 *
 * The employee model has no join record yet, so this reads the two signals it does
 * carry: counsel on record for the accused, or a stage at or past appearance — never at
 * cognizance. When the
 * join-a-case record exists (`join-a-case-handover.md`), it replaces both.
 */
export function accusedHasJoined(matter: CaseMatter): boolean {
  /* Before cognizance no process has issued, so there is nothing to join through. */
  if (matter.stage === "cognizance") return false;
  if (matter.counsel.some((entry) => entry.side === "accused")) return true;
  return matter.stage !== undefined && JOINED_STAGES.includes(matter.stage);
}

export function casePeopleFor(matter: CaseMatter): CasePeople {
  const extra = PACK[matter.caseNumber] ?? [];
  const accused = extra.filter((entry) => entry.kind === "accused");
  const people: CasePerson[] = [
    ...(accused.length > 0
      ? accused
      : [
          person({
            id: "accused-1",
            name: matter.parties.accused,
            kind: "accused",
            role: "Accused",
            side: "accused",
            addresses: [demoAddress(matter.parties.accused)],
            mobiles: [demoMobile(matter.parties.accused)],
            emails: [demoEmail(matter.parties.accused)],
          }),
        ]),
    person({
      id: "complainant",
      name: matter.parties.complainant,
      kind: "complainant",
      role: "Complainant",
      side: "complainant",
      addresses: [demoAddress(matter.parties.complainant)],
      mobiles: [demoMobile(matter.parties.complainant)],
      emails: [demoEmail(matter.parties.complainant)],
    }),
    ...extra.filter((entry) => entry.kind === "witness"),
  ];
  return { people, accusedJoined: accusedHasJoined(matter) };
}

/**
 * The police-station master (`PRC-08`), as far as these fixtures need it: a locality
 * maps to the station with jurisdiction over it. Demo stations, not a real master.
 * A locality not in it resolves to nothing, and the station is left to the judge
 * (`AUT-04`).
 */
export const POLICE_STATIONS = [
  "Town East",
  "Town West",
  "Kilikollur",
  "Kundara",
  "Shakthikulangara",
  "Panchkula",
] as const;

/**
 * The stations a court's dropdowns offer: Panchkula only for Punjab and Haryana, which
 * share one High Court (owner, 2026-10-12).
 */
export function policeStationsFor(court: CourtId): readonly string[] {
  return court === "punjab" || court === "haryana"
    ? POLICE_STATIONS
    : POLICE_STATIONS.filter((station) => station !== "Panchkula");
}

const STATION_BY_LOCALITY: Partial<Record<string, (typeof POLICE_STATIONS)[number]>> = {
  Chinnakada: "Town East",
  Thevally: "Town West",
  Pallimukku: "Town East",
  Mundakkal: "Town West",
  Kadappakada: "Kilikollur",
  Kundara: "Kundara",
};

export function policeStationFor(entry: StructuredAddress): string | undefined {
  return STATION_BY_LOCALITY[entry.locality];
}
