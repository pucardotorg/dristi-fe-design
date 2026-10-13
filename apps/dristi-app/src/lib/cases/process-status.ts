import { hearingRecords } from "./hearing-record";
import { ordersFile } from "./orders";
import { participantsFile } from "./parties";
import { formatCaseDate, type CaseRecord } from "./types";

/**
 * Notice/Process Status (PRD §7): every process the court has issued on the
 * case, grouped by the person it was issued to, then by round, then by the
 * channels each round went out on.
 *
 * The channel types and their status words are not specified yet (SVC-15,
 * open question Q-3). What is here is a working guess taken from the legacy
 * product, kept in one place so it is one edit to correct.
 */
export type ProcessType =
  "Notice" | "Summons" | "Warrant" | "Proclamation" | "Attachment";

export type ChannelType = "Registered post" | "Police" | "SMS" | "Email";

export type ChannelStatus =
  "pending-dispatch" | "sent" | "delivered" | "not-delivered";

const CHANNEL_STATUS: Record<
  ChannelStatus,
  { label: string; variant: "secondary" | "info" | "success" | "warning" }
> = {
  "pending-dispatch": { label: "Pending dispatch", variant: "secondary" },
  sent: { label: "Sent", variant: "info" },
  delivered: { label: "Delivered", variant: "success" },
  "not-delivered": { label: "Not delivered", variant: "warning" },
};

export function channelStatusView(status: ChannelStatus) {
  return CHANNEL_STATUS[status];
}

export type ProcessChannel = {
  type: ChannelType;
  /** Postal address, mobile number or email, by channel type (SVC-11). */
  destination: string;
  status: ChannelStatus;
  /** When the status was last updated (SVC-13). */
  statusOn: string;
  /** Why it did not reach the person; only on a channel that came back
   *  not delivered. Shown in the Remarks column, ahead of the remark
   *  (owner, Oct 6: both are often empty, so they share a column). */
  nonDeliveryReason?: string;
  /** The process fee is paid per channel, not per round (owner, Oct 6).
   *  Absent while it is still unpaid (SVC-09). */
  feePaidOn?: string;
  /** Delivery confirmation or any other note (SVC-14). */
  remarks?: string;
  /** The executing agency's report, when one has been filed (owner, Oct 6). */
  executionReport?: { href: string; fileName: string };
};

/** All the processes triggered by one order, or issued together (SVC-04). */
export type ProcessRound = {
  id: string;
  processes: ProcessType[];
  /** `id` is filled in when the hearings or orders register holds the record,
   *  so the screen can link straight to it. */
  hearing?: { id?: string; purpose: string; on: string };
  order?: { id?: string; title: string; on: string };
  channels: ProcessChannel[];
};

export type ProcessPerson = {
  id: string;
  /** Read off the case's parties register, never authored here. */
  name: string;
  /** Role on the case: "Accused 1", "PW-2", "Complainant" (SVC-03). Read
   *  off the parties register, like the name. */
  role: string;
  /** Newest round first (SVC-06). */
  rounds: ProcessRound[];
};

/**
 * What the process pack authors for a person: which participant of the case
 * it is, and the rounds. The name and the role come from the case's parties
 * register at read time, so this screen can never name someone differently
 * from the Parties section (owner, Oct 6: it must reflect the actual case).
 */
type ProcessPersonSeed = {
  /** A litigant's or a witness's id in the parties register. */
  participantId: string;
  rounds: ProcessRound[];
};

const PACK: Partial<Record<string, ProcessPersonSeed[]>> = {
  "c-1001": [
    {
      participantId: "pty-1001-a1",
      rounds: [
        {
          id: "r3",
          processes: ["Proclamation", "Attachment"],
          hearing: { purpose: "Evidence of complainant", on: "29 July 2026" },
          order: { title: "Proclamation", on: "2 July 2026" },
          channels: [
            {
              type: "Police",
              destination: "Punalur police station",
              status: "sent",
              statusOn: "3 July 2026",
              feePaidOn: "1 July 2026",
              remarks:
                "Affixture at the address is recorded. The public reading is awaited.",
            },
          ],
        },
        {
          id: "r2",
          processes: ["Warrant"],
          hearing: { purpose: "Appearance", on: "14 June 2026" },
          order: { title: "Warrant", on: "10 May 2026" },
          channels: [
            {
              type: "Police",
              destination: "Punalur police station",
              status: "not-delivered",
              statusOn: "14 June 2026",
              nonDeliveryReason:
                "The accused was not found at the address on record.",
              feePaidOn: "8 May 2026",
              remarks: "Returned unexecuted.",
              /* A placeholder file: the prototype has no real report. */
              executionReport: {
                href: "/process/execution-report-warrant.pdf",
                fileName: "Execution report - Warrant - Police.pdf",
              },
            },
          ],
        },
        {
          id: "r1",
          processes: ["Summons"],
          hearing: { purpose: "Appearance", on: "6 April 2026" },
          order: { title: "Summons", on: "2 March 2026" },
          channels: [
            {
              type: "Registered post",
              destination: "14 Market Road, Punalur 691305",
              status: "not-delivered",
              statusOn: "20 March 2026",
              nonDeliveryReason: "Addressee left.",
              feePaidOn: "1 March 2026",
              remarks: "Returned to sender.",
            },
            {
              type: "SMS",
              destination: "+91 98470 •• 214",
              status: "delivered",
              statusOn: "3 March 2026",
              feePaidOn: "1 March 2026",
            },
            {
              type: "Email",
              destination: "accounts@anandtraders.example",
              status: "delivered",
              statusOn: "3 March 2026",
              feePaidOn: "1 March 2026",
            },
          ],
        },
      ],
    },
    {
      participantId: "wit-1001-pw2",
      rounds: [
        {
          id: "r1",
          processes: ["Summons"],
          hearing: { purpose: "Evidence of complainant", on: "19 August 2026" },
          order: { title: "Summons", on: "24 July 2026" },
          channels: [
            {
              type: "Registered post",
              destination: "South Kerala Bank",
              status: "pending-dispatch",
              statusOn: "24 July 2026",
              remarks: "Waiting for the process fee.",
            },
            {
              type: "Email",
              destination: "priya.nair@southkeralabank.example",
              status: "pending-dispatch",
              statusOn: "24 July 2026",
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Everyone with process history, accused first, then witnesses, then the
 * complainant (SVC-01, SVC-02). Empty when no process has ever issued; a
 * disposed case keeps its history.
 */
export function processStatus(record: CaseRecord): ProcessPerson[] {
  const seeds = (PACK[record.id] ?? []).filter(
    (person) => person.rounds.length > 0,
  );
  if (seeds.length === 0) return [];

  const people = withParticipants(record, seeds);
  if (people.length === 0) return [];

  const hearingIdByDate = new Map(
    hearingRecords(record).map((hearing) => [hearing.date, hearing.id]),
  );
  const orderIdByDate = new Map<string, string>();
  try {
    for (const order of ordersFile(record).orders) {
      if (order.status === "published") {
        orderIdByDate.set(formatCaseDate(order.issuedOn), order.id);
      }
    }
  } catch {
    /* No orders register: rounds keep plain text. */
  }

  return people.map((person) => ({
    ...person,
    rounds: person.rounds.map((round) => ({
      ...round,
      hearing: round.hearing && {
        ...round.hearing,
        id: hearingIdByDate.get(round.hearing.on),
      },
      order: round.order && {
        ...round.order,
        id: orderIdByDate.get(round.order.on),
      },
    })),
  }));
}

/**
 * Names and roles from the parties register. A litigant reads as its side,
 * numbered when the side has more than one party ("Accused 1"); a witness by
 * its number ("PW-2"). A seed whose participant is not on the register is
 * dropped rather than shown under an invented name.
 */
function withParticipants(
  record: CaseRecord,
  seeds: ProcessPersonSeed[],
): ProcessPerson[] {
  let file: ReturnType<typeof participantsFile>;
  try {
    file = participantsFile(record);
  } catch {
    return [];
  }
  const roleOf = new Map<string, { name: string; role: string }>();
  for (const side of ["complainant", "accused"] as const) {
    const onSide = file.litigants.filter((party) => party.side === side);
    const label = side === "accused" ? "Accused" : "Complainant";
    onSide.forEach((party, index) =>
      roleOf.set(party.id, {
        name: party.name,
        role: onSide.length > 1 ? `${label} ${index + 1}` : label,
      }),
    );
  }
  for (const witness of file.witnesses) {
    roleOf.set(witness.id, { name: witness.name, role: witness.number });
  }
  return seeds.flatMap((seed) => {
    const participant = roleOf.get(seed.participantId);
    return participant
      ? [{ id: seed.participantId, ...participant, rounds: seed.rounds }]
      : [];
  });
}
