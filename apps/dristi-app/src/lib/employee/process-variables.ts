/**
 * Who a process order goes to, and how — the input a process order item needs beyond its
 * template (`ITM-11` of `order-generation.md`).
 *
 * **One person, then their addresses, then the channels** (owner, 2026-10-12: "first, you
 * select one person to issue that process to, and then you select some or all of the
 * addresses associated with them, and then you select the channels"). A process order
 * item goes to one person; summoning two people is two order items (`ITM-06`). The
 * addresses are the ones on that person's record, all pre-selected (`AUT-07`), and every
 * selected address with every selected address channel becomes its own process
 * (`process-handover.md` §3, `PRC-02`) — so on a police channel **each address has its own
 * police station**, pre-selected from that address (`AUT-04`) and changeable on its own.
 *
 * The people, their addresses, mobiles and emails, and the police-station master come from
 * `case-people.ts`. The rest follows `dristi-be/PRDs/process-handover.md` (v10 and the §5.1
 * pre-selection rules of 2026-10-01): channels permitted per process type and per
 * deployment (§6.3, `PRC-04`), the person, channels and party taking steps pre-selected
 * (`AUT-02`, `AUT-05`, `AUT-06`, `AUT-08`), and a channel whose destination the person's
 * record does not hold sends nothing to them, which the screen says beside it (`PRC-05`).
 */

import {
  policeStationFor,
  POLICE_STATIONS,
  type CasePerson,
} from "./case-people";
import type { OrderTemplateId } from "./order-templates";

export { POLICE_STATIONS };
export type { CasePerson };

export type ProcessChannel =
  | "sms"
  | "email"
  | "rpad"
  | "epost"
  | "police-rpad"
  | "police-nstep"
  | "police-icops";

type Destination = "mobile" | "email" | "address";

export const PROCESS_CHANNELS: {
  id: ProcessChannel;
  label: string;
  destination: Destination;
  /** A police channel goes through a police station, chosen per address (`PRC-03`). */
  police: boolean;
}[] = [
  { id: "sms", label: "SMS", destination: "mobile", police: false },
  { id: "email", label: "Email", destination: "email", police: false },
  { id: "rpad", label: "RPAD", destination: "address", police: false },
  { id: "epost", label: "e-Post", destination: "address", police: false },
  { id: "police-rpad", label: "Police (RPAD)", destination: "address", police: true },
  { id: "police-nstep", label: "Police (NSTEP)", destination: "address", police: true },
  { id: "police-icops", label: "Police (iCOPS)", destination: "address", police: true },
];

/** The channels this deployment runs (`PRC-04`). */
export const DEPLOYMENT_CHANNELS: ProcessChannel[] = [
  "sms",
  "email",
  "rpad",
  "epost",
  "police-rpad",
  "police-nstep",
];

const ALL: ProcessChannel[] = PROCESS_CHANNELS.map((channel) => channel.id);
const POLICE: ProcessChannel[] = PROCESS_CHANNELS.filter((channel) => channel.police).map(
  (channel) => channel.id,
);
const DIGITAL_POLICE: ProcessChannel = DEPLOYMENT_CHANNELS.includes("police-icops")
  ? "police-icops"
  : "police-nstep";

function permitted(type: OrderTemplateId): ProcessChannel[] {
  switch (type) {
    case "issue-of-notice":
      return ["sms", "email", "rpad", "epost"];
    case "issue-of-warrants":
    case "issue-of-proclamation":
    case "issue-of-attachment":
      return POLICE;
    default:
      return ALL;
  }
}

/** §6.3 and `PRC-04` — the channels a process type may use in this deployment. */
export function channelsFor(type: OrderTemplateId): ProcessChannel[] {
  return permitted(type).filter((channel) => DEPLOYMENT_CHANNELS.includes(channel));
}

/** `AUT-08` — the channels pre-selected for a process type. */
export function defaultChannelsFor(type: OrderTemplateId): ProcessChannel[] {
  switch (type) {
    case "issue-of-summons":
    case "issue-of-notice":
      return ["sms", "email", "rpad"];
    case "issue-of-warrants":
    case "issue-of-proclamation":
    case "issue-of-attachment":
      return [DIGITAL_POLICE];
    /* `AUT-08` names no default for a miscellaneous process. */
    default:
      return [];
  }
}

export function channelLabel(id: ProcessChannel): string {
  return PROCESS_CHANNELS.find((channel) => channel.id === id)?.label ?? id;
}

/** What a process order item carries about delivery. */
export type ProcessRecipients = {
  /** The one person it is addressed to, or `""` until chosen. */
  person: string;
  /** Which of that person's addresses it goes to. */
  addresses: string[];
  channels: ProcessChannel[];
  /** On a police channel, the station for each selected address, keyed by address id. */
  policeStations: Readonly<Record<string, string>>;
};

/**
 * `AUT-05`/`AUT-06` — the person pre-selected: the accused until the accused has joined
 * the case; after that the one witness not yet examined, if there is exactly one;
 * otherwise nobody, and the choice is left open. Where the case has more than one accused,
 * each is a separate order item, so the first is pre-selected here.
 */
export function defaultPerson(
  people: readonly CasePerson[],
  accusedJoined: boolean,
): string {
  if (!accusedJoined) {
    return people.find((person) => person.kind === "accused")?.id ?? "";
  }
  const pending = people.filter(
    (person) => person.kind === "witness" && person.examined === false,
  );
  return pending.length === 1 ? pending[0].id : "";
}

/** `AUT-07` — every address on the person's record. */
export function addressesOf(
  people: readonly CasePerson[],
  person: string,
): string[] {
  return (
    people.find((entry) => entry.id === person)?.addresses.map((entry) => entry.id) ??
    []
  );
}

/**
 * `AUT-04` — the station with jurisdiction over each selected address, by address id, or
 * `""` where an address does not resolve to one and the drafter chooses.
 */
export function stationsFor(
  people: readonly CasePerson[],
  person: string,
  addresses: readonly string[],
): Record<string, string> {
  const record = people.find((entry) => entry.id === person);
  return Object.fromEntries(
    (record?.addresses ?? [])
      .filter((entry) => addresses.includes(entry.id))
      .map((entry) => [entry.id, policeStationFor(entry.address) ?? ""]),
  );
}

/**
 * `AUT-02`/`AUT-03` — the party directed to take steps, worked out from the person: for
 * the accused, the complainant; for the complainant, the accused; for a witness, the side
 * that called them. `""` when nobody is chosen, and the drafter chooses.
 */
export function stepsFor(
  people: readonly CasePerson[],
  person: string,
): "" | "complainant" | "accused" {
  const record = people.find((entry) => entry.id === person);
  if (!record) return "";
  if (record.kind === "accused") return "complainant";
  if (record.kind === "complainant") return "accused";
  return record.side;
}

export function defaultProcessRecipients(
  type: OrderTemplateId,
  people: readonly CasePerson[],
  accusedJoined: boolean,
): ProcessRecipients {
  const person = defaultPerson(people, accusedJoined);
  const addresses = addressesOf(people, person);
  return {
    person,
    addresses,
    channels: defaultChannelsFor(type),
    policeStations: stationsFor(people, person, addresses),
  };
}

export function needsPoliceStation(recipients: ProcessRecipients): boolean {
  return recipients.channels.some((channel) => POLICE.includes(channel));
}

/**
 * The selected channels that will send nothing to this person, because their record holds
 * no destination of that kind (`PRC-05`, `AUT-08`) — said beside the channels, and not a
 * gap: the process simply does not go on that channel.
 */
export function unreachableChannels(
  person: CasePerson | undefined,
  recipients: ProcessRecipients,
): ProcessChannel[] {
  if (!person) return [];
  return recipients.channels.filter((id) => {
    const channel = PROCESS_CHANNELS.find((entry) => entry.id === id);
    if (!channel) return false;
    if (channel.destination === "mobile") return !person.mobile;
    if (channel.destination === "email") return !person.email;
    return false;
  });
}

/**
 * What is still missing before the process can run: the person, at least one of their
 * addresses, at least one channel, and on a police channel a station for every selected
 * address (`PRC-03`).
 */
export function recipientGaps(recipients: ProcessRecipients): string[] {
  const gaps: string[] = [];
  if (!recipients.person) gaps.push("Addressed to");
  else if (recipients.addresses.length === 0) gaps.push("Addresses");
  if (recipients.channels.length === 0) gaps.push("Channels");
  if (
    needsPoliceStation(recipients) &&
    recipients.addresses.some((id) => !recipients.policeStations[id])
  ) {
    gaps.push("Police station");
  }
  return gaps;
}

/** Names joined the way a sentence names more than one person: "A" · "A and B" · "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The channels chosen, in the catalogue's order, as one line. */
export function channelSummary(channels: readonly ProcessChannel[]): string {
  const chosen = PROCESS_CHANNELS.filter((channel) =>
    channels.includes(channel.id),
  ).map((channel) => channel.label);
  return chosen.length > 0 ? chosen.join(", ") : "No channel selected";
}
