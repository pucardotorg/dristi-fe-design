/**
 * What an order is being passed *on* — the one thing the composer needs to know, and the
 * only thing that differs between the two places a court draws one up.
 *
 * The composer used to be a hearing screen. It opened at
 * `/employee/hearings/<id>/order`, looked the hearing up, and everything on it read off
 * that object: the attendance of the people who appeared, the applications pending on
 * the listing, the item number on the day's cause list. A complaint waiting for
 * cognizance has none of those — it has never been called — so the screen could not
 * mount for it at all. Hiding two panels would not have helped; the lookup fails first.
 *
 * So the subject is named, and the blocks read the subject rather than a hearing:
 *
 * - a **hearing** — a matter called on today's list, with people who appeared and
 *   applications waiting on it;
 * - a **complaint at cognizance** — on the register, never listed, carrying one act the
 *   bench has chosen from its file.
 *
 * Everything an order actually needs — the cause, the numbers, who is on record — both
 * of them have. What only a hearing has is asked for through the accessors below, and
 * they answer *nothing* for a complaint rather than making one up. A block that has no
 * data does not render; no mode flag decides it, so the two cannot drift apart.
 */

import {
  COGNIZANCE_ACTS,
  hasDelay,
  type CognizanceAct,
  type CognizanceCase,
} from "./cognizance";
import {
  applicationsForListing,
  type ListingApplication,
} from "./listing-applications";
import {
  causeTitle,
  courtHearingPurposeLabel,
  type CourtCounsel,
  type CourtHearing,
} from "./hearings";
import { appearancesFor, type Appearance } from "./order-draft";

export type OrderSubject =
  | { kind: "hearing"; hearing: CourtHearing }
  | { kind: "cognizance"; matter: CognizanceCase; act: CognizanceAct };

/* ──────────────────────────── what both of them have ────────────────────────── */

/** The thing the order is about, whichever it is. Both shapes carry these. */
function matterOf(subject: OrderSubject): {
  caseNumber: string;
  parties: { complainant: string; accused: string };
  counsel: CourtCounsel[];
} {
  return subject.kind === "hearing" ? subject.hearing : subject.matter;
}

export function subjectCaseNumber(subject: OrderSubject): string {
  return matterOf(subject).caseNumber;
}

export function subjectParties(subject: OrderSubject): {
  complainant: string;
  accused: string;
} {
  return matterOf(subject).parties;
}

export function subjectCounsel(subject: OrderSubject): CourtCounsel[] {
  return matterOf(subject).counsel;
}

export function subjectCauseTitle(subject: OrderSubject): string {
  return causeTitle(matterOf(subject));
}

/* ─────────────────────────── what only a hearing has ────────────────────────── */

/**
 * Who appeared, for the attendance block.
 *
 * Empty on a complaint, and that is the whole answer: nobody has appeared, because the
 * matter has never been called. An attendance block on a complaint at cognizance would
 * be four Present/Absent pairs about an event that did not happen — a question the bench
 * has to tick past before reaching the one they came to answer.
 */
export function subjectAppearances(subject: OrderSubject): Appearance[] {
  return subject.kind === "hearing" ? appearancesFor(subject.hearing) : [];
}

/**
 * The interlocutory applications waiting on this listing, for the applications strip.
 *
 * Empty on a complaint. The one application that *is* pending at cognizance — the
 * condonation of delay — is not disposed of by picking it off a strip: the PRD has its
 * acceptance auto-added to the order ahead of the cognizance item, so it arrives in the
 * composition itself (`cognizance-order.ts`). It is answered, not offered.
 */
export function subjectApplications(subject: OrderSubject): ListingApplication[] {
  return subject.kind === "hearing"
    ? applicationsForListing(subject.hearing.id)
    : [];
}

/**
 * Whether this order schedules the next hearing, and whether the bench may decline to.
 *
 * Three answers, because the same block means three different things:
 *
 * - `optional` — a hearing. The matter has been heard, and whether it needs another date
 *   is the bench's to decide; it may be reserved for judgment or finished.
 * - `required` — a positive act at cognizance. Both Take cognizance and Issue notice
 *   carry a scheduling item, and its date is a required field (PRD §6). There is no
 *   outcome where the case goes forward to nothing, so there is nothing to opt out of.
 * - `none` — a dismissal. The complaint ends here, so there is no next date and no block.
 */
export type SubjectScheduling = "optional" | "required" | "none";

export function subjectScheduling(subject: OrderSubject): SubjectScheduling {
  if (subject.kind === "hearing") return "optional";
  return subject.act === "dismiss" ? "none" : "required";
}

/* ─────────────────────────────── naming the screen ──────────────────────────── */

/** One crumb of the way back to where this order was started from. */
export type OrderCrumb = { label: string; href?: string };

/**
 * The trail, which is the route the bench actually took — not a fixed spine.
 *
 * An order on a complaint was reached from Take cognizance and the complaint's own file,
 * and saying *Hearings › Today's hearings* above it would be false twice over.
 */
export function subjectTrail(subject: OrderSubject): OrderCrumb[] {
  if (subject.kind === "hearing") {
    return [
      { label: "Hearings", href: "/employee/hearings" },
      { label: "Today's hearings", href: "/employee/hearings" },
      { label: subject.hearing.caseNumber },
    ];
  }
  return [
    { label: "Take cognizance", href: "/employee/cognizance" },
    {
      label: subject.matter.caseNumber,
      href: `/employee/cognizance/${subject.matter.id}`,
    },
  ];
}

/**
 * The facts under the title — each subject's own, never a shared spine with holes in it.
 *
 * A hearing names its serial on the day's list, the stage the case has reached and what
 * it was called for. A complaint at cognizance has no serial (it has not been listed),
 * no purpose (it has not been called) and is still numbered `CMP/…`, because cognizance
 * is the act that renumbers it. What it has instead is the act being passed, the filing
 * it came in as, and the tab it stands on — the facts that decide what this order may be.
 */
export function subjectFacts(
  subject: OrderSubject,
): { label: string; value: string; identifier?: boolean }[] {
  if (subject.kind === "hearing") {
    const { hearing } = subject;
    return [
      { label: "Item", value: String(hearing.item) },
      { label: "Case", value: hearing.caseNumber, identifier: true },
      { label: "Purpose", value: courtHearingPurposeLabel(hearing.purpose) },
    ];
  }
  const { matter, act } = subject;
  return [
    /* The act leads, because it is what this order *is* — the hearing's own facts row
       opens on the item number for the same reason. It is a fact of the order rather
       than a second title: the heading names the cause, as the sibling screen's does. */
    { label: "Act", value: COGNIZANCE_ACTS[act].label },
    { label: "Case", value: matter.caseNumber, identifier: true },
    { label: "Filing", value: matter.filingNumber, identifier: true },
    {
      label: "Filed",
      value: hasDelay(matter) ? "Beyond the month" : "In time",
    },
  ];
}

/** Where leaving this order without passing it returns to, and what that is called. */
export function subjectReturn(subject: OrderSubject): {
  label: string;
  href: string;
} {
  if (subject.kind === "hearing") {
    return { label: "Back to the hearing", href: "/employee/hearings" };
  }
  return {
    label: "Back to the complaint",
    href: `/employee/cognizance/${subject.matter.id}`,
  };
}
