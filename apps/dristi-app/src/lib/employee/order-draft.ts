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
import type { ApplicationOutcome } from "@/lib/employee/application-outcome";
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
  type HearingMarks,
  type CounselSide,
  type CourtHearing,
  type CourtHearingPurposeId,
} from "./hearings";

/**
 * Present, absent, or skipped — `not-required`, Data flags' word for it. Skip is asked of
 * each person, not of the whole roll (owner, 2026-10-29): a skipped person, like one left
 * unmarked, is not printed on the order.
 */
export type AttendanceMark = "present" | "absent" | "not-required";

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
  /** The party themselves, counsel appearing for them, or their PoA holder. */
  kind: "party" | "counsel" | "poa";
  /** The litigant the row belongs to: the party, or whom the advocate or PoA holder is for. */
  party: string;
  /**
   * Counsel only: the advocates on record for the side. The roll asks once whether the
   * side is represented — any one of them appearing is enough — so they are named here
   * for the bench's reference, never one row each.
   */
  advocates?: readonly string[];
};

/**
 * Who appears (`ATT-01`), side by side: **every complainant**, each followed by **one
 * advocate line** named for them and then their **PoA holders**; then the same for every
 * accused. One advocate line per litigant, not per advocate (design sync, 2026-10-28):
 * with several on record, one of them appearing is enough, and naming the litigant lets
 * the roll say accused 1 was represented and accused 2 was not. A party appearing in
 * person — no advocate on record for them — has no advocate line.
 *
 * Ids are unchanged (`complainant`, `complainant-counsel`, `complainant-poa-1`), so marks
 * saved on an existing draft still apply.
 */
export function appearancesFor(hearing: CourtHearing): Appearance[] {
  return (["complainant", "accused"] as const).flatMap((side): Appearance[] => {
    const role = side === "complainant" ? "Complainant" : "Accused";
    const parties = [
      hearing.parties[side],
      ...(hearing.otherParties ?? [])
        .filter((party) => party.side === side)
        .map((party) => party.name),
    ];
    const counsel = counselFor(hearing, side);
    const poa = (hearing.poaHolders ?? [])
      .filter((holder) => holder.side === side)
      .map(
        (holder, index): Appearance => ({
          id: `${side}-poa-${index + 1}`,
          name: holder.name,
          role: `PoA holder for ${holder.for}`,
          side,
          kind: "poa",
          party: holder.for,
        }),
      );
    const rows = parties.flatMap((name, index): Appearance[] => {
      const id = index === 0 ? side : `${side}-${index + 1}`;
      const party: Appearance = { id, name, role, side, kind: "party", party: name };
      const advocates = counsel
        .filter((entry) => !entry.party || entry.party === name)
        .map((entry) => entry.name);
      const office = `Advocate for ${name}`;
      return [
        party,
        ...(advocates.length > 0
          ? [
              {
                id: `${id}-counsel`,
                name: office,
                role: office,
                side,
                kind: "counsel" as const,
                party: name,
                advocates,
              },
            ]
          : []),
        ...poa.filter((holder) => holder.party === name),
      ];
    });
    /* A PoA holder for someone not on the side's list still appears, at its end. */
    const unplaced = poa.filter((holder) => !parties.includes(holder.party));
    return [...rows, ...unplaced];
  });
}

export type OrderType = "regular" | "alternative";

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
  /**
   * The order's title as typed (`TIT-02`). Left out, the title is worked out from its
   * order items (`order-title.ts`).
   */
  title?: string;
  /**
   * *The A-Diary text and order text are the same* (`PUB-04`). Checked unless set to
   * `false`; unchecked, `aDiaryText` is the entry.
   */
  aDiarySame?: boolean;
  aDiaryText?: string;
  /**
   * The order's type (`order-type.ts`). Left out, it follows how the order was opened:
   * a hearing's or an application's is the state's alternative type, any other regular.
   */
  orderType?: OrderType;
  /**
   * An order on an application: its Application item's answers
   * (`application-outcome.ts`). Absent on every other order.
   */
  applicationOutcome?: ApplicationOutcome;
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
  /** A side's counsel is recited by office alone: which advocate appeared is not asked. */
  kind: Appearance["kind"];
  /** "Complainant" / "Advocate for the accused" — the office as a list entry. */
  role: string;
  mark: AttendanceMark;
};

function attendanceOffice(appearance: Appearance): string {
  if (appearance.kind === "party") {
    return `the ${appearance.role.toLowerCase()}`;
  }
  if (appearance.kind === "poa") return `PoA holder for ${appearance.role.replace(/^PoA holder for /, "")}`;
  return appearance.role.replace(/^Advocate/, "advocate");
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
        kind: appearance.kind,
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
       the office they appear in, so it cannot also separate one person from the next.
       A side's counsel is its office alone — "advocate for the accused". */
    const value = roll
      .map((entry) =>
        entry.kind === "counsel" ? entry.office : `${entry.name}, ${entry.office}`,
      )
      .join("; ");
    return [
      {
        label,
        value: `${value.charAt(0).toUpperCase()}${value.slice(1)}.`,
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
 * Where a heard matter is posted to next, as the cause list sets it when the hearing is
 * ended (owner, 2026-10-15). The order's Next hearing used to be filled in the order; it
 * is now filled on the cause list and only shown in the order, disabled.
 */
export type CausePosting = Pick<OrderDraft, "next" | "nextPurpose" | "nextDate">;

/** Nothing set yet: listed again, no date, no purpose. */
export const NO_CAUSE_POSTING: CausePosting = {
  next: "list",
  nextPurpose: "",
  nextDate: null,
};

/**
 * A hearing's order with the cause list's posting laid over it. The cause list is the one
 * place the posting is set, so whatever the order's own draft holds is ignored — and a
 * posting not set yet reads as not set, never as a date the order guessed.
 */
export function withCausePosting(
  draft: OrderDraft,
  posting: CausePosting | undefined,
): OrderDraft {
  const given = posting ?? NO_CAUSE_POSTING;
  if (
    draft.next === given.next &&
    draft.nextPurpose === given.nextPurpose &&
    draft.nextDate === given.nextDate
  ) {
    return draft;
  }
  return {
    ...draft,
    next: given.next,
    nextPurpose: given.nextPurpose,
    nextDate: given.nextDate,
  };
}

/**
 * The order screen's **Next case** (`HRG-10`): the next Ongoing hearing on the day's
 * board after this one, in the cause list's sequence, coming round to the top when none
 * is further down. `undefined` while no other hearing is ongoing. It is not a hearing
 * control: it opens that hearing's order and marks nothing.
 */
export function nextOngoingListing(
  hearing: CourtHearing,
  session: HearingMarks,
): CourtHearing | undefined {
  const ongoing = withHearingSession(CAUSE_LIST, session)
    .filter((row) => row.status === "ongoing" && row.id !== hearing.id)
    .sort((a, b) => a.item - b.item);
  return ongoing.find((row) => row.item > hearing.item) ?? ongoing[0];
}

/**
 * The order as paper — what Preview shows and what the signing list prints.
 *
 * Shaped as the facsimile the signing queue already prints (`sign-order-flow.tsx`):
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
    opening: attendanceRecital(appearancesFor(hearing), draft.marks).map(recitalText),
    blocks: draft.blocks,
    closing: nextListingRecital(draft).map(recitalText),
  });
}
