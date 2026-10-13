/**
 * Who sees which application, and who may take its next step.
 *
 * The Application Lifecycle PRD (v20) "Users and actions", filer side only:
 *
 * - Advocate / party in person: drafts, signs their own drafts and their
 *   clerk's, pays, sees their office's drafts, sees everything submitted on
 *   the case, files an objection when invited.
 * - Clerk or junior advocate: drafts, pays, sees their office's drafts, sees
 *   everything submitted. Never signs.
 * - Litigant: pays for what is filed on their behalf, sees everything
 *   submitted.
 * - PoA holder: the same, for the litigant whose power of attorney they hold.
 *
 * On top of that, ALC-17: the other side cannot see an application until the
 * court onboards it. A dismissed application is never onboarded, so the other
 * side never sees it. Court staff see everything, but the court side is not
 * built here.
 *
 * Pure functions over `ApplicationsFile`, so the rules are testable without
 * a screen.
 */

import {
  isOnboardedStatus,
  isSubmittedToCourt,
  type ApplicationsFile,
  type Submission,
  type SubmissionPerson,
} from "./applications";

export type ApplicationRole =
  | "advocate"
  | "pip"
  | "clerk"
  | "litigant"
  | "poa-holder";

export type CaseSide = "complainant" | "accused";

export type ApplicationViewer = {
  role: ApplicationRole;
  side: CaseSide;
  /**
   * The viewer's own id in the case's people. Absent when the viewer reaches
   * the case through office access and is on nobody's vakalatnama: they see
   * what the side sees, and have no step to take.
   */
  personId?: string;
  /** Litigant: themselves. PoA holder: the party whose PoA they hold. */
  partyId?: string;
};

/** The next step the viewer can take on this application, if any. */
export type ApplicationStep = "continue" | "sign" | "pay";

const ROLE_LABEL: Record<ApplicationRole, string> = {
  advocate: "Advocate",
  pip: "Party in person",
  clerk: "Clerk",
  litigant: "Litigant",
  "poa-holder": "PoA holder",
};

export function applicationRoleLabel(role: ApplicationRole): string {
  return ROLE_LABEL[role];
}

function peopleById(file: ApplicationsFile): Map<string, SubmissionPerson> {
  return new Map(file.people.map((person) => [person.id, person]));
}

/** The side an application belongs to: the side of the person who raises it. */
export function submissionSide(
  submission: Submission,
  people: Map<string, SubmissionPerson>
): CaseSide {
  return (
    people.get(submission.submittedById)?.side ??
    people.get(submission.onBehalfOfId)?.side ??
    "complainant"
  );
}

/**
 * The viewer's office: the people whose drafts they share. An advocate and
 * the clerks who work for them; a clerk, their advocate and that advocate's
 * other clerks. A party in person is an office of one.
 */
export function officeOf(
  viewer: ApplicationViewer,
  people: Map<string, SubmissionPerson>
): Set<string> {
  const office = new Set<string>();
  if (!viewer.personId) return office;
  const self = people.get(viewer.personId);
  const lead =
    viewer.role === "clerk" ? (self?.officeOf ?? viewer.personId) : viewer.personId;
  office.add(lead);
  office.add(viewer.personId);
  for (const person of people.values()) {
    if (person.officeOf === lead) office.add(person.id);
  }
  return office;
}

function fromOffice(submission: Submission, office: Set<string>): boolean {
  return office.has(submission.submittedById) || office.has(submission.createdById);
}

function forViewersParty(
  submission: Submission,
  viewer: ApplicationViewer
): boolean {
  return Boolean(viewer.partyId) && submission.onBehalfOfId === viewer.partyId;
}

/**
 * ALC-17 plus "Users and actions". The other side sees an application once
 * it is onboarded, and anything nobody decides once it is filed (an
 * objection, an affidavit, a memo). The viewer's own side sees everything
 * the court has; before that, only the office that is preparing it (and a
 * litigant, only what waits on their payment).
 */
export function canSeeApplication(
  viewer: ApplicationViewer,
  submission: Submission,
  file: ApplicationsFile
): boolean {
  const people = peopleById(file);
  const side = submissionSide(submission, people);
  if (side !== viewer.side) {
    return isOnboardedStatus(submission.status) || submission.status === "submitted";
  }
  if (isSubmittedToCourt(submission.status)) return true;

  switch (viewer.role) {
    case "advocate":
    case "pip":
    case "clerk":
      return fromOffice(submission, officeOf(viewer, people));
    case "litigant":
    case "poa-holder":
      return (
        submission.status === "pending-payment" &&
        forViewersParty(submission, viewer)
      );
  }
}

/**
 * The step this viewer can take, or null.
 *
 * - Continue a draft: anyone in the office preparing it who may draft.
 * - Sign: only the advocate or party in person it is raised by. A clerk's
 *   draft is raised by their advocate, so it reaches the advocate to sign.
 * - Pay: the preparing office, or the litigant it is filed for, or their
 *   PoA holder.
 */
export function applicationStepFor(
  viewer: ApplicationViewer,
  submission: Submission,
  file: ApplicationsFile
): ApplicationStep | null {
  if (!canSeeApplication(viewer, submission, file)) return null;
  const people = peopleById(file);
  const office = officeOf(viewer, people);
  const drafter =
    viewer.role === "advocate" || viewer.role === "pip" || viewer.role === "clerk";

  switch (submission.status) {
    case "draft":
      return drafter && fromOffice(submission, office) ? "continue" : null;
    case "pending-signature":
      return (viewer.role === "advocate" || viewer.role === "pip") &&
        submission.submittedById === viewer.personId
        ? "sign"
        : null;
    case "pending-payment":
      if (drafter) return fromOffice(submission, office) ? "pay" : null;
      return forViewersParty(submission, viewer) ? "pay" : null;
    default:
      return null;
  }
}

/**
 * Who the viewer is waiting on, when a filing of theirs is stuck on someone
 * else's step. A clerk sees their draft waiting on the advocate's signature;
 * that is information, not a task, so it is said once on the row.
 */
export function waitingOn(
  viewer: ApplicationViewer,
  submission: Submission,
  file: ApplicationsFile
): SubmissionPerson | null {
  if (submission.status !== "pending-signature") return null;
  if (applicationStepFor(viewer, submission, file) === "sign") return null;
  return peopleById(file).get(submission.submittedById) ?? null;
}

/* ─────────────────────────── objections ─────────────────────────── */

/**
 * ALC-13: an objection is due by midnight the day before the decision date.
 * A decision on the 21st puts the deadline at the end of the 20th. Returns
 * that last day, as an ISO day.
 */
export function objectionDeadline(decisionOn: string): string {
  const day = new Date(`${decisionOn}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

/** The objection raised against this application, if any (at most one, ALC-24). */
export function objectionAgainst(
  submission: Submission,
  file: ApplicationsFile
): Submission | null {
  return (
    file.submissions.find(
      (item) =>
        item.type === "objection" &&
        item.objectionToId === submission.id &&
        item.status !== "expired"
    ) ?? null
  );
}

export type ObjectionInvitation = {
  /** The other side's application the viewer's side is invited to object to. */
  application: Submission;
  /** Last day to file: the day before the decision date. */
  dueOn: string;
  /**
   * Whether this viewer files it. A litigant or PoA holder is told the side
   * may object (the task goes to "all users on the side") but their advocate
   * files it (filing is Advocate/PiP only, "Users and actions").
   */
  canFile: boolean;
};

/**
 * The File objection task, as the filer side sees it (PRD "Pending tasks,
 * citizen side"): raised when the court onboards the other side's
 * application, sets a decision date and leaves "invite objections" ticked.
 * It closes when the objection is filed, or when the date passes, with no
 * consequence either way.
 *
 * Only one objection per side (ALC-24), so once the viewer's side has
 * started one, the task gives way to that objection's own step (continue,
 * sign or pay).
 *
 * Everyone on the side is told (the PRD raises the task on "all users on
 * the side"), but only an advocate, a party in person, or a clerk who drafts
 * for them can file. A litigant or PoA holder gets it as a reminder that
 * their advocate can object (owner, Sept 24).
 */
export function objectionInvitations(
  viewer: ApplicationViewer,
  file: ApplicationsFile,
  today: string
): ObjectionInvitation[] {
  if (!viewer.personId) return [];
  const canFile = viewer.role !== "litigant" && viewer.role !== "poa-holder";
  const people = peopleById(file);
  return file.submissions
    .filter(
      (item) =>
        item.type !== "objection" &&
        item.status === "pending-decision" &&
        item.objectionsInvited === true &&
        item.decisionOn !== null &&
        submissionSide(item, people) !== viewer.side &&
        objectionDeadline(item.decisionOn) >= today &&
        objectionAgainst(item, file) === null
    )
    .map((application) => ({
      application,
      dueOn: objectionDeadline(application.decisionOn!),
      canFile,
    }))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

/* ─────────────────────────── the viewer ─────────────────────────── */

/** The profile the person is acting as (see `components/shell/profile.tsx`). */
export type ViewerProfile = "advocate" | "clerk" | "litigant";

/**
 * Which person on this case the signed-in profile is.
 *
 * - Advocate profile: the signed-in advocate's counsel entry. Reaching a case
 *   through office access only (on no vakalatnama) leaves `personId` empty.
 * - Clerk profile: the clerk who works in the signed-in advocate's office.
 * - Litigant profile: the party named as the account holder (a party with
 *   counsel on their side is a litigant; without, a party in person), or the
 *   PoA holder the account is. Null when the account is nobody on the case.
 */
export function resolveApplicationViewer(options: {
  file: ApplicationsFile;
  profile: ViewerProfile;
  accountName: string;
  isSignedInAdvocate: (name: string) => boolean;
  /** The side office access gives, when the advocate is on no vakalatnama. */
  fallbackSide: CaseSide;
}): ApplicationViewer | null {
  const { file, profile, accountName, isSignedInAdvocate, fallbackSide } =
    options;
  const advocate = file.people.find(
    (person) => person.kind === "advocate" && isSignedInAdvocate(person.name)
  );

  if (profile === "advocate") {
    return advocate
      ? { role: "advocate", side: advocate.side, personId: advocate.id }
      : { role: "advocate", side: fallbackSide };
  }

  if (profile === "clerk") {
    const clerk = advocate
      ? file.people.find(
          (person) => person.kind === "clerk" && person.officeOf === advocate.id
        )
      : undefined;
    return clerk
      ? { role: "clerk", side: clerk.side, personId: clerk.id }
      : { role: "clerk", side: advocate?.side ?? fallbackSide };
  }

  const needle = accountName.trim().toLowerCase();
  if (!needle) return null;
  const self = file.people.find(
    (person) =>
      (person.kind === "party" || person.kind === "poa-holder") &&
      person.name.toLowerCase().includes(needle)
  );
  if (!self) return null;
  if (self.kind === "poa-holder") {
    return {
      role: "poa-holder",
      side: self.side,
      personId: self.id,
      partyId: self.holdsPoaFor,
    };
  }
  const represented = file.people.some(
    (person) => person.kind === "advocate" && person.side === self.side
  );
  return {
    role: represented ? "litigant" : "pip",
    side: self.side,
    personId: self.id,
    partyId: self.id,
  };
}
