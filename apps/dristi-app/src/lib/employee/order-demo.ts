/**
 * The order a listing the bench has finished already carries.
 *
 * End hearing says the matter was heard, so a completed listing opens on a written order:
 * the roll taken, the applications that were pending decided, the order items the sitting
 * passed, and the matter posted on.
 *
 * **It is demo text, and it is not a transcript.** Nothing in this build listens to a
 * courtroom, and no word here was said by anybody. It is the same bargain the rest of
 * `/employee` makes (`hearings.ts`, `order-drafts.ts`): the draft dies on a reload, and
 * nothing is filed, signed or notified.
 *
 * It is the listing's *opening* draft, not a lock on it: the moment the bench changes
 * anything the edit is kept over this (`order-drafts.ts` holds the real one).
 */

import { addDays } from "./bulk-reschedule";
import {
  parseIsoDay,
  type CourtHearing,
  type CourtHearingPurposeId,
  type CourtHearingStatus,
} from "./hearings";
import { applicationsForListing } from "./listing-applications";
import {
  createItemBlock,
  type ComposerBlock,
} from "./order-composer";
import { composerContextFor, decisionBlock } from "./order-context";
import {
  appearancesFor,
  EMPTY_ORDER_DRAFT,
  type AttendanceMark,
  type OrderDraft,
} from "./order-draft";
import type { OrderTemplateId } from "./order-templates";

/**
 * The item, as the bench would have dictated it on this listing.
 *
 * One paragraph per purpose, because the purpose is what the sitting was for: an order
 * on a plea listing reads nothing like an order on a judgement listing, and a single
 * generic passage repeated down the board would be the tell that none of it is real.
 *
 * None of them names the next date. The order closes with the next listing as its own
 * block (`assembleNextListing`), and an item that also said it would print the date
 * twice on the same page.
 */
const ITEM_TEXT: Record<CourtHearingPurposeId, string> = {
  admission:
    "The complaint under Section 138 of the Negotiable Instruments Act, 1881 was taken up for admission. Counsel for the complainant was heard on maintainability, and the sworn statement of the complainant was recorded.",
  appearance:
    "The accused appeared before the court and was furnished with a copy of the complaint and of the documents filed along with it. The accused shall remain present on every posting date unless exempted.",
  arguments:
    "Counsel for the complainant advanced final arguments and relied on the documents already marked. Counsel for the accused was heard in part, and the arguments in reply are to be continued.",
  bail: "The application for bail was taken up and both sides were heard. The accused, who has appeared on every posting date so far, is released on bail on executing a bond with one surety to the satisfaction of this court.",
  cognizance:
    "The complaint, the sworn statement of the complainant and the documents produced were perused. There is sufficient ground to proceed, and cognizance is taken of the offence under Section 138 of the Negotiable Instruments Act, 1881.",
  "delay-condonation":
    "The petition to condone the delay in presenting the complaint was taken up and heard. The reasons stated are sufficient, and the delay in presenting the complaint stands condoned.",
  "evidence-of-complainant":
    "The complainant was examined in chief as PW-1 and the documents produced were marked. Cross-examination was taken up and could not be completed for want of time.",
  "examination-of-accused-351":
    "The accused was examined under Section 351 of the Bharatiya Nagarik Suraksha Sanhita, 2023. The circumstances appearing in the evidence against the accused were put, and the answers were recorded separately.",
  "for-reports":
    "The report called for has not been received. The office is directed to send a reminder and to place the report on the file as soon as it is received.",
  judgement:
    "Judgement was pronounced in open court and the operative portion was read out. The judgement, signed and dated, is placed on the file.",
  plea: "The substance of the accusation was read over and explained to the accused in a language known to the accused. The accused pleaded not guilty and claimed to be tried.",
};

/**
 * The order items the sitting passed, by what it was listed for. `null` where the
 * catalogue has no order item for what happened — the day's paragraph is then a text
 * block of its own, which is what an order item with no name is (`ORD-04`).
 */
const ITEM_TYPES: Record<CourtHearingPurposeId, (OrderTemplateId | null)[]> = {
  admission: [null],
  appearance: [null],
  arguments: [null],
  bail: ["bail"],
  cognizance: ["cognizance", "issue-of-summons"],
  "delay-condonation": [null],
  "evidence-of-complainant": [null],
  "examination-of-accused-351": [null],
  "for-reports": [null],
  judgement: ["judgement"],
  plea: [null],
};

/**
 * What the matter is posted on for.
 *
 * The ordinary progression of a §138 complaint, one step at a time — cognizance brings
 * the accused in, appearance leads to the plea, the plea opens the evidence. Two of them
 * point back at themselves on purpose: cross-examination that ran out of time resumes
 * for the same purpose, and a report that has not arrived is called for again.
 *
 * `null` is a real answer and not a gap: after judgement there is no next date, which is
 * what the composer's own "no next date" choice says.
 */
const NEXT_PURPOSE: Record<
  CourtHearingPurposeId,
  CourtHearingPurposeId | null
> = {
  admission: "cognizance",
  appearance: "plea",
  arguments: "judgement",
  bail: "plea",
  cognizance: "appearance",
  "delay-condonation": "cognizance",
  "evidence-of-complainant": "evidence-of-complainant",
  "examination-of-accused-351": "arguments",
  "for-reports": "for-reports",
  judgement: null,
  plea: "evidence-of-complainant",
};

/** Three weeks on, and never on a weekend the court does not sit. */
const NEXT_LISTING_DAYS = 21;

/** The next day this court would sit — Saturday and Sunday roll forward to Monday. */
export function nextSittingDay(from: string, days = NEXT_LISTING_DAYS): string {
  let day = addDays(from, days);
  while ([0, 6].includes(parseIsoDay(day).getDay())) {
    day = addDays(day, 1);
  }
  return day;
}

/** Everyone on the roll, present. */
function attendanceOf(hearing: CourtHearing): Record<string, AttendanceMark> {
  return Object.fromEntries(
    appearancesFor(hearing).map((appearance) => [appearance.id, "present"]),
  );
}

/**
 * The draft this listing opens on.
 *
 * Empty until the sitting is over. A matter that has not been called has nothing to
 * record, and one the bench is *in* is the one case where a pre-written order would be
 * actively wrong. `status` is the live one — the sitting's own mark laid over the fixture.
 *
 * Block ids are built from the listing, so the same completed matter opens on the same
 * blocks every time.
 */
export function initialOrderDraft(
  hearing: CourtHearing,
  status: CourtHearingStatus,
  today: string,
): OrderDraft {
  if (status !== "completed") return EMPTY_ORDER_DRAFT;

  const context = composerContextFor(hearing);
  const nextPurpose = NEXT_PURPOSE[hearing.purpose];
  const applications = applicationsForListing(hearing.id);

  /* Every application that was pending, allowed: the demo item on an evidence listing
     says the cross-examination could not be finished, so the adjournment asking for the
     balance to be taken later is allowed, and an order that recorded the opposite would
     be a screen arguing with itself. Disposals first, then the directions. */
  const decisions: ComposerBlock[] = applications.map((application) =>
    decisionBlock(
      application,
      "allowed",
      context,
      `${hearing.id}-decision-${application.id}`,
    ),
  );
  const items: ComposerBlock[] = ITEM_TYPES[hearing.purpose].map((type, index) => {
    const id = `${hearing.id}-block-${index + 1}`;
    if (type === null) {
      return { id, kind: "text", text: ITEM_TEXT[hearing.purpose] };
    }
    const block = createItemBlock(type, context, { id });
    /* The first item carries the paragraph the sitting produced, typed over the
       template's words — which is what a hand-edited item is. */
    return index === 0 && ITEM_TEXT[hearing.purpose]
      ? { ...block, text: ITEM_TEXT[hearing.purpose], edited: true }
      : block;
  });

  return {
    marks: attendanceOf(hearing),
    applications: Object.fromEntries(
      applications.map((application) => [application.id, "allowed" as const]),
    ),
    next: nextPurpose ? "list" : "none",
    nextPurpose: nextPurpose ?? "",
    nextDate: nextPurpose ? nextSittingDay(today) : null,
    blocks: [...decisions, ...items],
    links: [],
  };
}
