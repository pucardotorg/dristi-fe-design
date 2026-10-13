/**
 * The order of one listing — what the cause-list icon opens, as data.
 *
 * Employee stays self-contained (`content.ts`): nothing here reaches into the
 * advocate-side register. What the bench fills in on a hearing's order is who is present
 * and who is absent, the order's blocks (`order-composer.ts`), and where the case is
 * posted to next. Deciding an application standing on the listing adds an order item
 * block like any other (`ITM-04`), so the applications have no region of their own in
 * the document.
 *
 * **Nothing here is issued.** Assembling the text is a screen derivation. Saving a
 * draft and previewing it do not file, notify, or sign — the same honesty bargain
 * Start / End hearing and bulk reschedule already make.
 */

/* Type-only: a value import would drag a client component into a module node tests read. */
import type { RichTextValue } from "@/components/cases/rich-text-field";

import { CURRENT_STAFF } from "./content";
import type { ListingApplicationDecision } from "./listing-applications";
import { orderParagraphs, type ComposerBlock } from "./order-composer";
import {
  CAUSE_LIST,
  causeTitle,
  counselFor,
  courtHearingPurposeLabel,
  formatCourtDay,
  formatOrderDate,
  withHearingSession,
  type CounselSide,
  type CourtHearing,
  type CourtHearingPurposeId,
} from "./hearings";

export type AttendanceMark = "present" | "absent";

/** One person who can be marked present or absent on this listing. */
export type Appearance = {
  id: string;
  name: string;
  role: string;
  /**
   * Which side of the cause they appear on. Carried rather than read back off `role`,
   * because the label is copy and will be translated.
   */
  side: CounselSide;
  /** The party themselves, or counsel appearing for them. */
  kind: "party" | "counsel";
};

/**
 * Who appears, in the order a day-order names them: complainant, then counsel for that
 * side, then the accused, then counsel for that side. A side with no vakalat has no
 * advocate row.
 */
export function appearancesFor(hearing: CourtHearing): Appearance[] {
  const rows: Appearance[] = [
    {
      id: "complainant",
      name: hearing.parties.complainant,
      role: "Complainant",
      side: "complainant",
      kind: "party",
    },
  ];
  counselFor(hearing, "complainant").forEach((counsel, index) => {
    rows.push({
      id: `complainant-counsel-${index}`,
      name: counsel.name,
      role: "Advocate for the complainant",
      side: "complainant",
      kind: "counsel",
    });
  });
  rows.push({
    id: "accused",
    name: hearing.parties.accused,
    role: "Accused",
    side: "accused",
    kind: "party",
  });
  counselFor(hearing, "accused").forEach((counsel, index) => {
    rows.push({
      id: `accused-counsel-${index}`,
      name: counsel.name,
      role: "Advocate for the accused",
      side: "accused",
      kind: "counsel",
    });
  });
  return rows;
}

export type NextListingChoice = "list" | "none";

export type OrderDraft = {
  marks: Readonly<Record<string, AttendanceMark | undefined>>;
  /**
   * How each application standing on this listing was decided, keyed by application id.
   * The decision itself is an order item block in `blocks`; this is the record the
   * Applications region and the signing list read, kept in step with it.
   */
  applications: Readonly<
    Record<string, ListingApplicationDecision | undefined>
  >;
  next: NextListingChoice;
  nextPurpose: CourtHearingPurposeId | "";
  nextDate: string | null;
  /** The order itself, block by block (`order-composer.ts`). */
  blocks: readonly ComposerBlock[];
  /** Case-file documents the drafter linked to the order (the case file panel). */
  links: readonly string[];
  /**
   * Version B only (`order-text-composer.tsx`): the order as one body of rich text. There the
   * item blocks hold each item's answers, and this holds the words.
   */
  body?: RichTextValue;
};

export const EMPTY_ORDER_DRAFT: OrderDraft = {
  marks: {},
  applications: {},
  next: "list",
  nextPurpose: "",
  nextDate: null,
  blocks: [],
  links: [],
};

export type AttendanceEntry = {
  id: string;
  name: string;
  /** "the complainant" / "advocate for the accused" — the office in the sentence. */
  office: string;
  /** "Complainant" / "Advocate for the accused" — the office as a list entry. */
  role: string;
  mark: AttendanceMark;
};

function attendanceOffice(appearance: Appearance): string {
  if (appearance.id === "complainant" || appearance.id === "accused") {
    return `the ${appearance.role.toLowerCase()}`;
  }
  return appearance.role.toLowerCase();
}

/** Everyone who has been marked, in roll order. */
export function markedAppearances(
  appearances: Appearance[],
  marks: OrderDraft["marks"],
): AttendanceEntry[] {
  return appearances.flatMap((appearance) => {
    const mark = marks[appearance.id];
    if (mark !== "present" && mark !== "absent") return [];
    return [
      {
        id: appearance.id,
        name: appearance.name,
        office: attendanceOffice(appearance),
        role: appearance.role,
        mark,
      },
    ];
  });
}

/** One labelled line of the order — "Present: …", "Next hearing: …". */
export type OrderRecitalLine = { label: string; value: string };

export function recitalText(line: OrderRecitalLine): string {
  return `${line.label}: ${line.value}`;
}

/**
 * Attendance as the order opens on it: a **Present** line and an **Absent** line, naming
 * each person and the office they appear in (`ATT-03`). A side with nobody marked prints
 * no line, and a part-marked roll writes in whoever has been marked so far (`ATT-04`).
 */
export function attendanceRecital(
  appearances: Appearance[],
  marks: OrderDraft["marks"],
): OrderRecitalLine[] {
  const marked = markedAppearances(appearances, marks);
  return (
    [
      ["Present", "present"],
      ["Absent", "absent"],
    ] as const
  ).flatMap(([label, mark]) => {
    const roll = marked.filter((entry) => entry.mark === mark);
    if (roll.length === 0) return [];
    /* Semicolons between people, commas inside each of them: the comma joins a name to
       the office they appear in, so it cannot also separate one person from the next. */
    return [
      {
        label,
        value: `${roll
          .map((entry) => `${entry.name}, ${entry.office}`)
          .join("; ")}.`,
      },
    ];
  });
}

/**
 * Has the matter been posted on? A date with its purpose, or a decision not to list it
 * again. A date on its own is half an answer (`NXT-02`).
 */
export function postingSettled(
  draft: Pick<OrderDraft, "next" | "nextPurpose" | "nextDate">,
): boolean {
  if (draft.next === "none") return true;
  return Boolean(draft.nextPurpose && draft.nextDate);
}

/**
 * The posting as the order closes on it: the date, then what it is for. Nothing while
 * the posting is half given (`NXT-02`); a matter not listed again says so.
 */
export function nextListingRecital(
  draft: Pick<OrderDraft, "next" | "nextPurpose" | "nextDate">,
): OrderRecitalLine[] {
  if (draft.next === "none") {
    return [{ label: "Next hearing", value: "Not listed again." }];
  }
  if (!draft.nextDate || !draft.nextPurpose) return [];
  return [
    { label: "Next hearing", value: formatOrderDate(draft.nextDate) },
    {
      label: "Purpose",
      value: courtHearingPurposeLabel(draft.nextPurpose),
    },
  ];
}

/**
 * The next matter the bench has not yet taken up — what Next case calls. Reads today's
 * cause list with the sitting's own marks applied; only a `scheduled` listing further down
 * the board counts.
 */
export function nextUnhandledListing(
  hearing: CourtHearing,
  session: {
    ongoingId: string | null;
    endedIds: ReadonlySet<string>;
    passedOverIds: ReadonlySet<string>;
  },
): CourtHearing | undefined {
  return withHearingSession(CAUSE_LIST, session)
    .filter((row) => row.status === "scheduled" && row.item > hearing.item)
    .sort((a, b) => a.item - b.item)[0];
}

/**
 * The order as paper — what Preview shows and what the signing list prints.
 *
 * Shaped as the facsimile the signing queue already prints (`sign-order-dialog.tsx`):
 * court and cause at the head, the order's paragraphs, the date, then the signature
 * block. **Nothing here is issued**, and the signature block says the order is unsigned.
 */
export type OrderDocument = {
  court: string;
  caseNumber: string;
  matter: string;
  title: string;
  paragraphs: string[];
  dated: string;
  signature: string;
};

export function buildOrderDocument(input: {
  caseNumber: string;
  matter: string;
  day: string;
  opening?: readonly string[];
  blocks: readonly ComposerBlock[];
  closing?: readonly string[];
}): OrderDocument {
  return {
    court: `Before the ${CURRENT_STAFF.court}`,
    caseNumber: input.caseNumber,
    matter: input.matter,
    title: "Order",
    paragraphs: orderParagraphs(input),
    dated: formatCourtDay(input.day),
    signature: "Pending the signature of the magistrate.",
  };
}

/** A hearing's order as paper: the roll, the blocks, the posting. */
export function hearingOrderDocument(
  hearing: CourtHearing,
  draft: OrderDraft,
  day: string,
): OrderDocument {
  return buildOrderDocument({
    caseNumber: hearing.caseNumber,
    matter: causeTitle(hearing),
    day,
    opening: attendanceRecital(appearancesFor(hearing), draft.marks).map(
      recitalText,
    ),
    blocks: draft.blocks,
    closing: nextListingRecital(draft).map(recitalText),
  });
}
