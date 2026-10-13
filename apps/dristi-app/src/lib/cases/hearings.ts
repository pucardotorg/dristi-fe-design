/**
 * Hearings — the chronological record of court events listed or held
 * in a case. Types are listing purposes, not case stages; the same type
 * can appear more than once.
 *
 * Featured dummy content comes from `hearings-dummy.json`. Labels follow
 * Laws sentence case; statutory short forms (BNSS, ADR, S. 351) stay as
 * written.
 */
import pack from "./hearings-dummy.json";
import { formatCaseDate, counselFor, type CaseRecord } from "./types";

export type HearingStatus =
  | "scheduled"
  | "ongoing"
  | "completed"
  | "rescheduled"
  | "abandoned";

export const HEARING_STATUSES: { id: HearingStatus; label: string }[] = [
  { id: "scheduled", label: "Scheduled" },
  { id: "ongoing", label: "Ongoing" },
  { id: "completed", label: "Completed" },
  { id: "rescheduled", label: "Rescheduled" },
  { id: "abandoned", label: "Abandoned" },
];

export type TranscriptAvailability =
  | "available"
  | "not_available"
  | "temporarily_unavailable"
  | "restricted";

export type TranscriptRecordStatus =
  | "available"
  | "temporarily_unavailable"
  | "restricted";

export type HearingsView = "timeline" | "table";

export type HearingTypeId =
  | "admission"
  | "appearance"
  | "application-review"
  | "arguments"
  | "bail"
  | "cognizance"
  | "delay-condonation"
  | "delay-condonation-and-admission"
  | "evidence-of-accused"
  | "evidence-of-complainant"
  | "examination-of-accused-351"
  | "execution"
  | "for-reports"
  | "judgement"
  | "plea"
  | "referral-to-adr"
  | "to-issue-order"
  | "warrant";

export const HEARING_TYPES: { id: HearingTypeId; label: string }[] = [
  { id: "admission", label: "Admission" },
  { id: "appearance", label: "Appearance" },
  { id: "application-review", label: "Application review" },
  { id: "arguments", label: "Arguments" },
  { id: "bail", label: "Bail" },
  { id: "cognizance", label: "Cognizance" },
  { id: "delay-condonation", label: "Delay condonation" },
  {
    id: "delay-condonation-and-admission",
    label: "Delay condonation and admission",
  },
  { id: "evidence-of-accused", label: "Evidence of accused" },
  { id: "evidence-of-complainant", label: "Evidence of complainant" },
  {
    id: "examination-of-accused-351",
    label: "Examination of accused under S. 351 BNSS",
  },
  { id: "execution", label: "Execution" },
  {
    id: "for-reports",
    label: "For reports (to be received from forensics, ADR, etc)",
  },
  { id: "judgement", label: "Judgement" },
  { id: "plea", label: "Plea" },
  { id: "referral-to-adr", label: "Referral to ADR" },
  { id: "to-issue-order", label: "To issue order" },
  { id: "warrant", label: "Warrant" },
];

export function hearingTypeLabel(id: HearingTypeId): string {
  return HEARING_TYPES.find((item) => item.id === id)?.label ?? id;
}

export function isHearingTypeId(value: string): value is HearingTypeId {
  return HEARING_TYPES.some((item) => item.id === value);
}

export type HearingPerson = {
  id: string;
  name: string;
  role: string;
  /** Filter option copy — includes the role. */
  filterLabel: string;
};

export type HearingTranscriptEntry = {
  time: string;
  speaker: string;
  text: string;
};

export type HearingTranscript = {
  id: string;
  hearingId: string;
  title: string;
  recordType: string;
  isVerbatim: boolean;
  recordStatus: TranscriptRecordStatus;
  startTime: string;
  endTime: string;
  summary: string;
  entries: HearingTranscriptEntry[];
  /** Set only when a downloadable transcript file exists. */
  downloadHref?: string;
};

export type WitnessDeposition = {
  id: string;
  hearingIds: string[];
  witnessNumber: string;
  witnessName: string;
  witnessType: string;
  examinationStage: string;
  status: string;
  summary: string;
  exhibits: string[];
  continuationDate: string | null;
};

export type Hearing = {
  id: string;
  type: HearingTypeId;
  on: string;
  /**
   * A hearing not yet held carries status "scheduled". Absent only for
   * legacy/incomplete data — do not invent a status the source data
   * does not give.
   */
  status?: HearingStatus;
  statusReason?: string;
  summary?: string;
  /** Result or next court direction for that listing, when known. */
  result?: string;
  /** Subsequent listing date after an abandoned hearing, when known. */
  nextOn?: string;
  /** Legacy import with incomplete fields — do not invent the missing facts. */
  migrated?: boolean;
  participantIds: string[];
  partiesDisplay: string;
  transcriptAvailability: TranscriptAvailability;
  transcriptId?: string;
  depositionIds: string[];
};

export type HearingsFile = {
  court: string;
  people: HearingPerson[];
  hearings: Hearing[];
  transcripts: HearingTranscript[];
  depositions: WitnessDeposition[];
};

export function personLabel(person: HearingPerson): string {
  return person.filterLabel;
}

export function isHearingStatus(value: string): value is HearingStatus {
  return HEARING_STATUSES.some((item) => item.id === value);
}

export function hearingStatusLabel(status: HearingStatus): string {
  return HEARING_STATUSES.find((item) => item.id === status)?.label ?? status;
}

/**
 * Chips follow where the hearing sits in the calendar: info before it is
 * held and while underway, success once done, secondary once moved to a new
 * date, warning when a listing did not proceed.
 *
 * Scheduled and ongoing share info deliberately. They are the two rungs with
 * nothing yet decided, and an outline chip on the commonest listing status
 * read as the absence of a status rather than a status — a date the court
 * has fixed is a fact about the case, not a blank. The chip always carries
 * the word, so the two stay apart without the fill (ACCESSIBILITY 3 — never
 * colour alone).
 */
export function hearingStatusVariant(
  status: HearingStatus
): "info" | "success" | "secondary" | "warning" {
  switch (status) {
    case "scheduled":
      return "info";
    case "ongoing":
      return "info";
    case "completed":
      return "success";
    case "rescheduled":
      return "secondary";
    case "abandoned":
      return "warning";
  }
}

/** True once a hearing has been listed and held (or attempted) — false while only scheduled. */
export function isHearingHeld(hearing: Hearing): boolean {
  return Boolean(hearing.status) && hearing.status !== "scheduled";
}

export function hearingPartyNames(
  hearing: Hearing,
  peopleById: Map<string, HearingPerson>
): string {
  return hearing.participantIds
    .map((id) => peopleById.get(id)?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ");
}

const VISIBLE_PARTIES = 2;

export function hearingPartiesDisplay(
  hearing: Hearing,
  peopleById: Map<string, HearingPerson>
): string {
  if (hearing.partiesDisplay) return hearing.partiesDisplay;
  const names = hearing.participantIds
    .map((id) => peopleById.get(id)?.name)
    .filter((name): name is string => Boolean(name));
  if (names.length <= VISIBLE_PARTIES) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - VISIBLE_PARTIES}`;
}

export function canOpenTranscript(
  file: HearingsFile,
  hearing: Hearing
): boolean {
  if (!hearing.transcriptId) return false;
  const transcript = findTranscript(file, hearing.transcriptId);
  return transcript?.recordStatus === "available";
}

export function transcriptListState(
  file: HearingsFile,
  hearing: Hearing
): TranscriptRecordStatus | "unavailable" | null {
  if (canOpenTranscript(file, hearing)) return null;
  if (hearing.transcriptId) {
    const transcript = findTranscript(file, hearing.transcriptId);
    if (transcript?.recordStatus === "temporarily_unavailable") {
      return "temporarily_unavailable";
    }
    if (transcript?.recordStatus === "restricted") return "restricted";
  }
  if (
    hearing.transcriptAvailability === "not_available" ||
    Boolean(hearing.transcriptId)
  ) {
    return "unavailable";
  }
  return null;
}

export function canOpenDepositions(
  file: HearingsFile,
  hearing: Hearing
): boolean {
  return depositionsFor(file, hearing.depositionIds).length > 0;
}

export function hearingHasArtifacts(
  file: HearingsFile,
  hearing: Hearing
): boolean {
  return canOpenTranscript(file, hearing) || canOpenDepositions(file, hearing);
}

export function hearingTimelineStatus(
  hearing: Hearing,
  index: number,
  currentIndex: number
): "past" | "current" | "future" {
  if (!isHearingHeld(hearing)) return "future";
  return index === currentIndex ? "current" : "past";
}

export function hearingPeopleGroups(
  hearing: Hearing,
  peopleById: Map<string, HearingPerson>
): {
  parties: HearingPerson[];
  advocates: HearingPerson[];
  witnesses: HearingPerson[];
} {
  const people = hearing.participantIds
    .map((id) => peopleById.get(id))
    .filter((person): person is HearingPerson => Boolean(person));

  const advocates = people.filter((person) => /counsel/i.test(person.role));
  const parties = people.filter((person) =>
    /^(Complainant|Accused)$/.test(person.role)
  );
  const witnesses = people.filter(
    (person) => !advocates.includes(person) && !parties.includes(person)
  );

  return { parties, advocates, witnesses };
}

/** Last court direction, or an explicit result on the hearing. */
export function hearingDirection(
  hearing: Hearing,
  file: HearingsFile
): string | undefined {
  if (hearing.result) return hearing.result;
  if (hearing.status === "abandoned") return undefined;
  if (!hearing.transcriptId) return undefined;
  const transcript = findTranscript(file, hearing.transcriptId);
  if (!transcript || transcript.recordStatus !== "available") return undefined;
  const lastCourt = [...transcript.entries]
    .reverse()
    .find((entry) => entry.speaker === "Court");
  return lastCourt?.text;
}

/** Result callout on the timeline card — includes why an abandoned listing stopped. */
export function hearingResultCopy(
  hearing: Hearing,
  file: HearingsFile
): string | undefined {
  if (hearing.status === "abandoned") {
    const reason = hearing.statusReason ?? "This hearing did not proceed.";
    if (hearing.nextOn && !hearing.statusReason) {
      return `${reason} Subsequent hearing: ${formatCaseDate(hearing.nextOn)}.`;
    }
    return reason;
  }
  return hearingDirection(hearing, file);
}

/** Day number and short month-year for the timeline date rail. */
export function hearingDateParts(iso: string): { day: string; monthYear: string } {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString("en-IN", { day: "2-digit" }),
    monthYear: date.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    }),
  };
}

export function findTranscript(
  file: HearingsFile,
  id: string
): HearingTranscript | undefined {
  return file.transcripts.find((item) => item.id === id);
}

export function findDeposition(
  file: HearingsFile,
  id: string
): WitnessDeposition | undefined {
  return file.depositions.find((item) => item.id === id);
}

export function depositionsFor(
  file: HearingsFile,
  ids: string[]
): WitnessDeposition[] {
  return ids
    .map((id) => findDeposition(file, id))
    .filter((item): item is WitnessDeposition => Boolean(item));
}

/** Exhibit codes from the dummy pack, with the descriptions in the fixture. */
export function exhibitLabel(code: string): string {
  return EXHIBIT_LABELS[code] ?? code;
}

const EXHIBIT_LABELS: Record<string, string> = {
  P1: "Invoice dated 10 February 2025",
  P2: "Delivery acknowledgement dated 14 February 2025",
  P3: "Cheque number 000184",
  P4: "Cheque-return memo dated 17 April 2025",
  P5: "Legal demand notice and dispatch record",
  P6: "Bank cheque-return record",
  D1: "Defence account statement",
  D2: "Copy of internal adjustment note",
};

/** "11:15" → "11:15 AM". Dummy clocks are 24-hour `HH:mm`. */
export function formatHearingClock(hhmm: string): string {
  const [hourPart, minutePart] = hhmm.split(":");
  const hour = Number.parseInt(hourPart, 10);
  if (Number.isNaN(hour)) return hhmm;
  const minute = (minutePart ?? "00").padStart(2, "0");
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:${minute} ${suffix}`;
}

export function formatHearingTimeRange(start: string, end: string): string {
  return `${formatHearingClock(start)}–${formatHearingClock(end)}`;
}

export function transcriptRecordLabel(transcript: HearingTranscript): string {
  return transcript.isVerbatim
    ? "Hearing transcript — verbatim"
    : "Hearing transcript summary — not verbatim";
}

export function transcriptUnavailableLabel(
  status: TranscriptRecordStatus
): string {
  if (status === "temporarily_unavailable") {
    return "This transcript is temporarily unavailable. Try again later.";
  }
  if (status === "restricted") {
    return "This transcript is restricted and cannot be shown here.";
  }
  return "Transcript is not available for this hearing.";
}

export function depositionStatusLabel(deposition: WitnessDeposition): string {
  if (deposition.status === "Partly recorded" && deposition.continuationDate) {
    return `Partly recorded — continuation scheduled for ${formatCaseDate(deposition.continuationDate)}`;
  }
  return deposition.status;
}

function typeIdFromPack(label: string): HearingTypeId {
  const normalized = label.trim().toLowerCase();
  const match = HEARING_TYPES.find(
    (item) => item.label.toLowerCase() === normalized
  );
  if (!match) {
    throw new Error(`Unknown hearing type in dummy pack: ${label}`);
  }
  return match.id;
}

function statusFromPack(value: string): HearingStatus {
  const normalized = value.trim().toLowerCase();
  if (isHearingStatus(normalized)) return normalized;
  throw new Error(`Unknown hearing status in dummy pack: ${value}`);
}

function featuredPeople(): HearingPerson[] {
  return pack.filters.parties.map((item) => {
    const [left, role] = item.label.split(" — ");
    const name = left.split(",")[0]?.trim() ?? left;
    return {
      id: item.id,
      name,
      role: role ?? "",
      filterLabel: item.label,
    };
  });
}

function availabilityFromPack(value: string): TranscriptAvailability {
  if (value === "not_available") return "not_available";
  if (value === "temporarily_unavailable") return "temporarily_unavailable";
  if (value === "restricted") return "restricted";
  return "available";
}

function transcriptStatusFromPack(value: string): TranscriptRecordStatus {
  if (value === "temporarily_unavailable") return "temporarily_unavailable";
  if (value === "restricted") return "restricted";
  return "available";
}

type DummyHearingRow = (typeof pack.hearings)[number] & {
  nextOn?: string | null;
  migrated?: boolean;
  result?: string | null;
};

type DummyTranscriptRow = (typeof pack.transcripts)[number] & {
  downloadHref?: string | null;
};

function featuredFile(): HearingsFile {
  return {
    court: pack.case.court,
    people: featuredPeople(),
    hearings: pack.hearings.map((item) => {
      const row = item as DummyHearingRow;
      return {
        id: row.hearingId,
        type: typeIdFromPack(row.hearingType),
        on: row.date,
        status: statusFromPack(row.status),
        statusReason: row.statusReason ?? undefined,
        summary: row.summary || undefined,
        result: row.result ?? undefined,
        nextOn: row.nextOn ?? undefined,
        migrated: Boolean(row.migrated),
        participantIds: row.participantIds,
        partiesDisplay: row.partiesDisplay,
        transcriptAvailability: availabilityFromPack(
          row.transcriptAvailability
        ),
        transcriptId: row.transcriptId ?? undefined,
        depositionIds: row.depositionIds,
      };
    }),
    transcripts: pack.transcripts.map((item) => {
      const row = item as DummyTranscriptRow;
      return {
        id: row.transcriptId,
        hearingId: row.hearingId,
        title: row.title,
        recordType: row.recordType,
        isVerbatim: row.isVerbatim,
        recordStatus: transcriptStatusFromPack(row.status),
        startTime: row.startTime,
        endTime: row.endTime,
        summary: row.summary,
        entries: row.entries,
        downloadHref: row.downloadHref ?? undefined,
      };
    }),
    depositions: pack.witnessDepositions.map((row) => ({
      id: row.depositionId,
      hearingIds: row.hearingIds,
      witnessNumber: row.witnessNumber,
      witnessName: row.witnessName,
      witnessType: row.witnessType,
      examinationStage: row.examinationStage,
      status: row.status,
      summary: row.summary,
      exhibits: row.exhibits,
      continuationDate: row.continuationDate,
    })),
  };
}

function peopleFrom(record: CaseRecord): HearingPerson[] {
  const people: HearingPerson[] = [
    {
      id: `${record.id}-complainant`,
      name: record.parties.complainant,
      role: "Complainant",
      filterLabel: `${record.parties.complainant} — Complainant`,
    },
    {
      id: `${record.id}-accused`,
      name: record.parties.accused,
      role: "Accused",
      filterLabel: `${record.parties.accused} — Accused`,
    },
  ];

  counselFor(record, "complainant").forEach((name, index) => {
    people.push({
      id: `${record.id}-counsel-c-${index}`,
      name,
      role: "Complainant counsel",
      filterLabel: `${name} — Complainant counsel`,
    });
  });
  counselFor(record, "accused").forEach((name, index) => {
    people.push({
      id: `${record.id}-counsel-a-${index}`,
      name,
      role: "Accused counsel",
      filterLabel: `${name} — Accused counsel`,
    });
  });

  return people;
}

export function hearingTypeFromCase(record: CaseRecord): HearingTypeId {
  return typeFromStage(record);
}

export function hearingOnDate(
  file: HearingsFile,
  iso: string
): Hearing | undefined {
  return file.hearings.find((hearing) => hearing.on === iso);
}

function typeFromStage(record: CaseRecord): HearingTypeId {
  switch (record.stage) {
    case "cognizance":
      return "cognizance";
    case "summons":
      return "warrant";
    case "appearance":
      return "appearance";
    case "evidence":
      return "evidence-of-complainant";
    case "arguments":
      return "arguments";
    case "judgment":
      return "judgement";
    default:
      return "appearance";
  }
}

const MS_DAY = 24 * 60 * 60 * 1000;

/** The trial's stages in order, for the sittings a synthesised case has had. */
const STAGE_LADDER: CaseRecord["stage"][] = [
  "cognizance",
  "appearance",
  "evidence",
  "arguments",
  "judgment",
];

const EARLIER_TYPE: Record<string, HearingTypeId> = {
  cognizance: "cognizance",
  appearance: "appearance",
  evidence: "evidence-of-complainant",
  arguments: "arguments",
};

/** Demo business of the day for a sitting at each stage (cheque cases). */
const STAGE_BOTD: Record<string, string> = {
  cognizance:
    "Complaint taken on file under Section 138 of the NI Act. Sworn statement of the complainant recorded and verified with the documents produced. Cognizance taken. Issue summons to the accused, returnable on the next date. Complainant to take steps for service within one week and file the process fee.",
  appearance:
    "Accused present through counsel and entered appearance. Bail bond executed with two sureties and accepted. Copies of the complaint and documents furnished to the accused. Particulars of the offence read over and explained; the accused pleaded not guilty and claimed to be tried. Posted for the complainant's evidence.",
  evidence:
    "PW-1 examined in chief through affidavit under Section 145 of the NI Act; Exts. P1 to P6 marked. Cross-examination by counsel for the accused commenced and deferred at counsel's request. Complainant to keep PW-1 present for further cross-examination on the next date.",
  arguments:
    "Evidence closed on both sides. Statement of the accused recorded. Counsel for the complainant heard in part on arguments; written submissions to be filed within two weeks. Counsel for the accused to be heard on the next date.",
};

/** What the last sitting left the parties to do, after its one-line update. */
const LAST_STEP: Record<string, string> = {
  scrutiny: "Defects to be cured before the case is placed for cognizance",
  cognizance: "Complainant to file the process fee and take steps for service of summons",
  summons: "Fresh summons to issue; complainant to take steps through the court and by registered post",
  appearance: "Accused to file the bail bond; case to be posted for plea",
  evidence: "Complainant to keep the next witness present; no further adjournment will be granted",
  arguments: "Parties to file written submissions before the next date",
  judgment: "Posted for pronouncement of judgment",
};

function defaultHearings(
  record: CaseRecord,
  people: HearingPerson[]
): Hearing[] {
  const participantIds = people.map((person) => person.id).slice(0, 4);
  const hearings: Hearing[] = [];

  if (record.previousHearingOn) {
    // The sittings that brought the case to its current stage, one per earlier
    // stage, five weeks apart, each with its business of the day. Never before
    // the complaint was filed.
    // Summons sits between cognizance and appearance on the ladder.
    const reached = record.stage === "summons" ? 1 : STAGE_LADDER.indexOf(record.stage);
    const ladder = STAGE_LADDER.slice(0, Math.max(0, reached));
    const last = new Date(`${record.previousHearingOn}T00:00:00`).getTime();
    const filed = new Date(`${record.filedOn}T00:00:00`).getTime();
    ladder.forEach((stage, i) => {
      const on = last - (ladder.length - i) * 35 * MS_DAY;
      if (on <= filed) return;
      hearings.push({
        id: `${record.id}-earlier-${stage}`,
        type: EARLIER_TYPE[stage] ?? "appearance",
        on: new Date(on).toISOString().slice(0, 10),
        status: "completed",
        participantIds,
        partiesDisplay: "",
        transcriptAvailability: "not_available",
        depositionIds: [],
        summary: STAGE_BOTD[stage],
      });
    });

    const type = typeFromStage(record);
    hearings.push({
      id: `${record.id}-prev`,
      type,
      on: record.previousHearingOn,
      status: "completed",
      participantIds,
      partiesDisplay: "",
      transcriptAvailability: "not_available",
      depositionIds: [],
      summary: [record.latestUpdate, LAST_STEP[record.stage]]
        .filter(Boolean)
        .map((line) => (line as string).replace(/\.?$/, "."))
        .join(" "),
    });
  }

  if (record.nextHearing && !record.disposal) {
    hearings.push({
      id: `${record.id}-next`,
      type: typeFromStage(record),
      on: record.nextHearing.on,
      status: "scheduled",
      participantIds,
      partiesDisplay: "",
      transcriptAvailability: "not_available",
      depositionIds: [],
    });
  }

  if (record.disposal) {
    hearings.push({
      id: `${record.id}-judgement`,
      type: "judgement",
      on: record.disposal.on,
      status: "completed",
      participantIds,
      partiesDisplay: "",
      transcriptAvailability: "not_available",
      depositionIds: [],
    });
  }

  return hearings;
}

const FEATURED_CASE_ID = "c-1001";

export function hearingsFile(record: CaseRecord): HearingsFile {
  if (record.id === FEATURED_CASE_ID) return featuredFile();
  const people = peopleFrom(record);
  return {
    court: record.court,
    people,
    hearings: defaultHearings(record, people),
    transcripts: [],
    depositions: [],
  };
}

export const HEARINGS_PAGE_SIZES = [10, 20, 30, 40, 50] as const;
export type HearingsPageSize = (typeof HEARINGS_PAGE_SIZES)[number];
export const HEARINGS_PAGE_SIZE: HearingsPageSize = 10;

export function isHearingsPageSize(value: number): value is HearingsPageSize {
  return (HEARINGS_PAGE_SIZES as readonly number[]).includes(value);
}

export type HearingsSelection = {
  rows: Hearing[];
  /** Full filtered set, newest first — timeline shows this, table may page it. */
  all: Hearing[];
  total: number;
  page: number;
  pageCount: number;
  from: number;
  to: number;
};

export function selectHearings(options: {
  hearings: Hearing[];
  typeId: HearingTypeId | null;
  pageSize: HearingsPageSize;
  page: number;
}): HearingsSelection {
  const matched = options.hearings.filter((hearing) => {
    if (options.typeId && hearing.type !== options.typeId) return false;
    return true;
  });

  const sorted = [...matched].sort((a, b) => {
    const byDate = b.on.localeCompare(a.on);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });

  const pageSize = options.pageSize;
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(options.page, pageCount);
  const start = (page - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  return {
    rows,
    all: sorted,
    total: sorted.length,
    page,
    pageCount,
    from: sorted.length === 0 ? 0 : start + 1,
    to: start + rows.length,
  };
}

export function hearingPageWindow(
  page: number,
  pageCount: number
): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const pages = new Set([1, pageCount, page, page - 1, page + 1]);
  const visible = [...pages]
    .filter((entry) => entry >= 1 && entry <= pageCount)
    .sort((a, b) => a - b);

  return visible.flatMap((entry, index) =>
    index > 0 && entry - visible[index - 1] > 1
      ? ["gap" as const, entry]
      : [entry]
  );
}
