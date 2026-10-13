/**
 * The application lifecycle — statuses, who may do what, and the court's two gates.
 *
 * Source: `handovers/application-lifecycle.md` (v26) in the PUCAR working folder. The
 * `ALC-` references below are that document's requirement IDs. Everything here is pure:
 * it takes an application and returns the next one, so the same rules serve the
 * browser store today and a lifecycle service later.
 *
 * Deliberately not decided here, because the specification does not decide it:
 * - when Draft / Pending Signature / Pending Payment expire (the transition exists, the
 *   window does not) — nothing expires automatically;
 * - the names of the two numbers (`Q-5`) — this file follows the lifecycle document:
 *   **temporary identifier** at submission, **application number** at onboarding;
 * - availability for Warrant by Hand, Absent Application and Reopen Evidence.
 */

export type ApplicationStatus =
  | "draft"
  | "pending-signature"
  | "pending-payment"
  | "pending-review"
  | "pending-decision"
  | "accepted"
  | "rejected"
  | "dismissed"
  | "submitted"
  | "expired";

export const APPLICATION_STATUSES: { id: ApplicationStatus; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "pending-signature", label: "Pending signature" },
  { id: "pending-payment", label: "Pending payment" },
  { id: "pending-review", label: "Pending review" },
  { id: "pending-decision", label: "Pending decision" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "dismissed", label: "Dismissed" },
  { id: "submitted", label: "Submitted" },
  { id: "expired", label: "Expired" },
];

export function applicationStatusLabel(status: ApplicationStatus): string {
  return APPLICATION_STATUSES.find((item) => item.id === status)?.label ?? status;
}

export type StatusVariant =
  | "warning"
  | "info"
  | "success"
  | "destructive"
  | "secondary"
  | "outline";

/**
 * Amber where the filer still owes a step, blue while it is with the court, green for
 * allowed, red for the two disposals that refuse it, neutral for the two endings that
 * decide nothing (an objection that is in; a draft that lapsed).
 */
export function applicationStatusVariant(status: ApplicationStatus): StatusVariant {
  switch (status) {
    case "draft":
    case "pending-signature":
    case "pending-payment":
      return "warning";
    case "pending-review":
    case "pending-decision":
      return "info";
    case "accepted":
      return "success";
    case "rejected":
    case "dismissed":
      return "destructive";
    case "submitted":
      return "outline";
    case "expired":
      return "secondary";
  }
}

export function isFilerStep(status: ApplicationStatus): boolean {
  return (
    status === "draft" ||
    status === "pending-signature" ||
    status === "pending-payment"
  );
}

export function isFiled(status: ApplicationStatus): boolean {
  return !isFilerStep(status) && status !== "expired";
}

/* ------------------------------------------------------------------------------------ */
/* Seats                                                                                 */
/* ------------------------------------------------------------------------------------ */

export type Side = "complainant" | "accused";

export function otherSide(side: Side): Side {
  return side === "complainant" ? "accused" : "complainant";
}

export function sideLabel(side: Side): string {
  return side === "complainant" ? "Complainant" : "Accused";
}

/** Who is acting on the citizen side ("Users and actions"). */
export type FilerRole = "advocate" | "clerk" | "litigant" | "poa";

export const FILER_ROLES: { id: FilerRole; label: string }[] = [
  { id: "advocate", label: "Advocate" },
  { id: "clerk", label: "Clerk or junior advocate" },
  { id: "litigant", label: "Litigant" },
  { id: "poa", label: "PoA holder" },
];

export function filerRoleLabel(role: FilerRole): string {
  return FILER_ROLES.find((item) => item.id === role)?.label ?? role;
}

export type FilerSeat = { side: Side; role: FilerRole };

/** Advocate/PiP creates; a clerk or junior advocate drafts on their behalf. */
export function canCreate(seat: FilerSeat): boolean {
  return seat.role === "advocate" || seat.role === "clerk";
}

/** Only the advocate/PiP signs. A clerk can draft and pay, never sign. */
export function canSign(seat: FilerSeat): boolean {
  return seat.role === "advocate";
}

/** Advocate, clerk, litigant or PoA holder — anyone on the filing side may pay. */
export function canPay(seat: FilerSeat): boolean {
  return FILER_ROLES.some((role) => role.id === seat.role);
}

/** Court seats, as the court side already names them (`lib/employee/content.ts`). */
export type CourtSeat = "magistrate" | "bench-clerk" | "typist" | "scrutiny-officer";

/**
 * `ALC-22` gives a system action — onboarding, setting or moving a date — to the
 * magistrate alone. **For now the bench clerk (Punjab & Haryana's Reader) takes them
 * too** (owner, 2026-10-13): every step of the application flow except signing. An
 * order may be drafted by the bench clerk or typist; only the magistrate signs it.
 */
export function canTakeSystemAction(seat: CourtSeat): boolean {
  return seat === "magistrate" || seat === "bench-clerk";
}

export function canDraftOrder(seat: CourtSeat): boolean {
  return seat === "magistrate" || seat === "bench-clerk" || seat === "typist";
}

export function canSignOrder(seat: CourtSeat): boolean {
  return seat === "magistrate";
}

/* ------------------------------------------------------------------------------------ */
/* Dates                                                                                 */
/* ------------------------------------------------------------------------------------ */

/** "YYYY-MM-DD" for a local date. */
export function dayOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: string, count: number): string {
  const date = parseDay(day);
  date.setDate(date.getDate() + count);
  return dayOf(date);
}

/** Weekends only — holidays are not modelled anywhere in the build (`isSittingDay`). */
export function isWorkingDay(day: string): boolean {
  const weekday = parseDay(day).getDay();
  return weekday !== 0 && weekday !== 6;
}

/** `ALC-03`: the Review application task is due the next working day. */
export function nextWorkingDay(day: string): string {
  let next = addDays(day, 1);
  while (!isWorkingDay(next)) next = addDays(next, 1);
  return next;
}

/**
 * `ALC-13`: an objection is due by midnight the day before the decision date — a
 * decision on the 21st puts the deadline at the end of the 20th. Returns that last day.
 */
export function objectionDeadline(decisionDay: string): string {
  return addDays(decisionDay, -1);
}

/**
 * `ALC-10`: pre-fill the case's next hearing date, if it has one on record. A hearing
 * date already behind us is not a next hearing, so it pre-fills nothing either.
 */
export function suggestedDate(
  nextHearingOn: string | undefined,
  today: string,
): string | undefined {
  if (!nextHearingOn) return undefined;
  const day = nextHearingOn.slice(0, 10);
  return day > today ? day : undefined;
}

/* ------------------------------------------------------------------------------------ */
/* The record                                                                            */
/* ------------------------------------------------------------------------------------ */

export type PendingOrder = {
  kind: "dismiss" | "accept" | "reject";
  text: string;
  draftedBy: CourtSeat;
  draftedOn: string;
  /** Advance / Postpone: the new date the magistrate picks on acceptance. */
  newHearingOn?: string;
};

export type LinkedOrder = {
  id: string;
  kind: PendingOrder["kind"];
  text: string;
  signedOn: string;
};

export type LifecycleEvent = { on: string; text: string };

/**
 * One application as the lifecycle document's attribute table records it, plus the
 * court's two tasks. `form` is the filer's draft, serialised by the store.
 */
export type LifecycleApplication = {
  id: string;
  caseId: string;
  /** An `ApplicationTypeId`. */
  type: string;
  typeLabel: string;
  side: Side;
  status: ApplicationStatus;
  /** Who started the draft, as a role on that side. */
  createdBy: FilerRole;
  createdByName: string;
  /** Application Raised By — the advocate/PiP who signed. */
  raisedBy?: string;
  /** Application Raised On Behalf Of — the litigant. */
  onBehalfOf: string;
  paidBy?: FilerRole;
  createdOn: string;
  updatedOn: string;
  submittedOn?: string;
  onboardedOn?: string;
  temporaryId?: string;
  applicationNumber?: string;
  /** Review application task (`ALC-03`, `ALC-05`). Open while status is Pending review. */
  review?: { defaultDueOn: string; dueOn: string };
  /** Decide application task (`ALC-21`). Open while status is Pending decision. */
  decide?: { dueOn: string; mode: "now" | "date" };
  /** `ALC-11`. Only answered on the "on a date" branch. */
  objectionsInvited?: boolean;
  /** File objection task on the other side (`ALC-12`, `ALC-13`). */
  objectionDueBy?: string;
  /** Objection (Linked Application) — at most one (`ALC-24`). */
  objectionId?: string;
  /** Objection To (Linked Application) — set on an objection. */
  objectionToId?: string;
  pendingOrder?: PendingOrder;
  linkedOrder?: LinkedOrder;
  /** What the type's own workflow did on acceptance (`ALC-16`). */
  workflowResult?: string;
  form: unknown;
  documents: string[];
  history: LifecycleEvent[];
};

function stamp(
  app: LifecycleApplication,
  on: string,
  text: string,
  patch: Partial<LifecycleApplication>,
): LifecycleApplication {
  return {
    ...app,
    ...patch,
    updatedOn: on,
    history: [...app.history, { on, text }],
  };
}

export class LifecycleError extends Error {}

function expect(app: LifecycleApplication, ...statuses: ApplicationStatus[]) {
  if (!statuses.includes(app.status)) {
    throw new LifecycleError(
      `${applicationStatusLabel(app.status)} cannot take this step.`,
    );
  }
}

/* Filer side ------------------------------------------------------------------------- */

export function proceedToSign(
  app: LifecycleApplication,
  on: string,
): LifecycleApplication {
  expect(app, "draft");
  return stamp(app, on, "Sent for signature", { status: "pending-signature" });
}

export function sign(
  app: LifecycleApplication,
  seat: FilerSeat,
  signer: string,
  on: string,
): LifecycleApplication {
  expect(app, "pending-signature");
  if (!canSign(seat)) {
    throw new LifecycleError("Only the advocate or party-in-person signs.");
  }
  return stamp(app, on, `Signed by ${signer}`, {
    status: "pending-payment",
    raisedBy: signer,
  });
}

/**
 * `ALC-01`–`ALC-03`: paying completes the filing. The temporary identifier is allotted
 * and the Review application task raised, due the next working day — except for an
 * objection, which ends at Submitted and is never reviewed on its own (`ALC-24`).
 */
export function pay(
  app: LifecycleApplication,
  seat: FilerSeat,
  temporaryId: string,
  on: string,
): LifecycleApplication {
  expect(app, "pending-payment");
  if (!canPay(seat)) throw new LifecycleError("This seat cannot pay.");
  if (app.type === "objection") {
    return stamp(app, on, "Fee paid; objection submitted", {
      status: "submitted",
      paidBy: seat.role,
      submittedOn: on,
      temporaryId,
    });
  }
  const due = nextWorkingDay(on);
  return stamp(app, on, "Fee paid; filed with the court", {
    status: "pending-review",
    paidBy: seat.role,
    submittedOn: on,
    temporaryId,
    review: { defaultDueOn: due, dueOn: due },
  });
}

/* First gate: Review application -------------------------------------------------- */

/**
 * `ALC-05`, `ALC-20`: "set a date" is usable once. Nothing is stored for it — it is
 * read off the task's due date against its default.
 */
export function setADateUsed(app: LifecycleApplication): boolean {
  return Boolean(app.review && app.review.dueOn !== app.review.defaultDueOn);
}

export function setReviewDate(
  app: LifecycleApplication,
  seat: CourtSeat,
  dueOn: string,
  on: string,
): LifecycleApplication {
  expect(app, "pending-review");
  if (!canTakeSystemAction(seat)) {
    throw new LifecycleError("Only the magistrate or bench clerk sets a date.");
  }
  if (setADateUsed(app)) {
    throw new LifecycleError("A date has already been set once.");
  }
  if (!app.review || dueOn <= on) {
    throw new LifecycleError("Choose a date after today.");
  }
  return stamp(app, on, `Review moved to ${dueOn}`, {
    review: { ...app.review, dueOn },
  });
}

export type OnboardChoice =
  | { mode: "now" }
  | { mode: "date"; decideOn: string; inviteObjections: boolean };

/**
 * `ALC-04`, `ALC-07`–`ALC-12`, `ALC-21`: onboarding allots the application number at
 * once and, as part of the same action, says when the court will decide. Either way a
 * Decide application task backs it up.
 */
export function onboard(
  app: LifecycleApplication,
  seat: CourtSeat,
  applicationNumber: string,
  choice: OnboardChoice,
  on: string,
): LifecycleApplication {
  expect(app, "pending-review");
  if (!canTakeSystemAction(seat)) {
    throw new LifecycleError("Only the magistrate or bench clerk onboards an application.");
  }
  if (choice.mode === "date" && choice.decideOn <= on) {
    throw new LifecycleError("Choose a decision date after today.");
  }
  const decide =
    choice.mode === "now"
      ? { dueOn: on, mode: "now" as const }
      : { dueOn: choice.decideOn, mode: "date" as const };
  const invited = choice.mode === "date" ? choice.inviteObjections : undefined;
  return stamp(
    app,
    on,
    choice.mode === "now"
      ? `Onboarded as ${applicationNumber}; to be decided now`
      : `Onboarded as ${applicationNumber}; to be decided on ${choice.decideOn}${
          invited ? ", objections invited" : ""
        }`,
    {
      status: "pending-decision",
      applicationNumber,
      onboardedOn: on,
      review: undefined,
      decide,
      objectionsInvited: invited,
      objectionDueBy:
        invited && choice.mode === "date"
          ? objectionDeadline(choice.decideOn)
          : undefined,
    },
  );
}

/** `ALC-15`: the Decide task and any File objection task move together. */
export function moveDecisionDate(
  app: LifecycleApplication,
  seat: CourtSeat,
  decideOn: string,
  on: string,
): LifecycleApplication {
  expect(app, "pending-decision");
  if (!canTakeSystemAction(seat)) {
    throw new LifecycleError("Only the magistrate or bench clerk moves the decision date.");
  }
  if (decideOn <= on) throw new LifecycleError("Choose a date after today.");
  return stamp(app, on, `Decision moved to ${decideOn}`, {
    decide: { dueOn: decideOn, mode: "date" },
    objectionDueBy:
      app.objectionDueBy && !app.objectionId
        ? objectionDeadline(decideOn)
        : app.objectionDueBy,
  });
}

/* Orders ----------------------------------------------------------------------------- */

/**
 * `ALC-19` + `order-generation.md` `APL-05`: an order dismissing an application before
 * onboarding does not cite a number — it has none a court recognises. It names the kind
 * of application, who raised it and when it was filed.
 */
export function dismissalText(app: LifecycleApplication, filedOn: string): string {
  const by = app.raisedBy ?? app.createdByName;
  return `The application for ${app.typeLabel.toLowerCase()} filed by ${by} on behalf of the ${sideLabel(
    app.side,
  ).toLowerCase()} on ${filedOn} is dismissed.`;
}

/** The configured accept / reject order items (`order-templates.ts` #8, #9). */
export function decisionText(
  app: LifecycleApplication,
  kind: "accept" | "reject",
  newHearingOn?: string,
): string {
  const base = `Application ${app.applicationNumber} for ${app.typeLabel} is ${
    kind === "accept" ? "accepted" : "rejected"
  }.`;
  return kind === "accept" && newHearingOn
    ? `${base} The hearing is rescheduled to ${newHearingOn}.`
    : base;
}

/** Types whose acceptance reschedules a hearing, so the order asks for the new date. */
export function acceptanceNeedsHearingDate(type: string): boolean {
  return type === "advancement-reschedule" || type === "postpone";
}

export function draftOrder(
  app: LifecycleApplication,
  seat: CourtSeat,
  order: Omit<PendingOrder, "draftedBy" | "draftedOn">,
  on: string,
): LifecycleApplication {
  if (!canDraftOrder(seat)) throw new LifecycleError("This seat cannot draft orders.");
  if (order.kind === "dismiss") expect(app, "pending-review");
  else expect(app, "pending-decision");
  if (
    order.kind === "accept" &&
    acceptanceNeedsHearingDate(app.type) &&
    !order.newHearingOn
  ) {
    throw new LifecycleError("Choose the new hearing date.");
  }
  return stamp(app, on, `Order drafted (${order.kind})`, {
    pendingOrder: { ...order, draftedBy: seat, draftedOn: on },
  });
}

export function discardOrder(
  app: LifecycleApplication,
  on: string,
): LifecycleApplication {
  if (!app.pendingOrder) return app;
  return stamp(app, on, "Order draft discarded", { pendingOrder: undefined });
}

/**
 * `ALC-16`, `ALC-19`, `ALC-21`: an order takes effect on the magistrate's signature.
 * Dismissal ends the application before onboarding; accept / reject close the Decide
 * application task. Accepting runs the type's own workflow.
 */
export function signOrder(
  app: LifecycleApplication,
  seat: CourtSeat,
  orderId: string,
  on: string,
): LifecycleApplication {
  const order = app.pendingOrder;
  if (!order) throw new LifecycleError("There is no order to sign.");
  if (!canSignOrder(seat)) throw new LifecycleError("Only the magistrate signs.");
  const linkedOrder: LinkedOrder = {
    id: orderId,
    kind: order.kind,
    text: order.text,
    signedOn: on,
  };
  if (order.kind === "dismiss") {
    expect(app, "pending-review");
    return stamp(app, on, "Dismissal signed", {
      status: "dismissed",
      review: undefined,
      pendingOrder: undefined,
      linkedOrder,
    });
  }
  expect(app, "pending-decision");
  return stamp(app, on, order.kind === "accept" ? "Accepted" : "Rejected", {
    status: order.kind === "accept" ? "accepted" : "rejected",
    decide: undefined,
    objectionDueBy: undefined,
    pendingOrder: undefined,
    linkedOrder,
    workflowResult:
      order.kind === "accept" && order.newHearingOn
        ? `Hearing rescheduled to ${order.newHearingOn}`
        : undefined,
  });
}

/* Objections ------------------------------------------------------------------------- */

/** The other side holds an open File objection task (`ALC-12`). */
export function objectionTaskOpen(app: LifecycleApplication): boolean {
  return (
    app.status === "pending-decision" &&
    Boolean(app.objectionDueBy) &&
    !app.objectionId
  );
}

/* Visibility ------------------------------------------------------------------------- */

/**
 * `ALC-17` and "Users and actions": the filing side sees its own work — the litigant
 * and PoA holder from the point there is something to pay. The other side sees nothing
 * until onboarding, and everything after. A dismissal is never onboarded, so it never
 * reaches the other side. An objection is visible to both sides once it is in.
 */
export function visibleToSeat(app: LifecycleApplication, seat: FilerSeat): boolean {
  if (seat.side === app.side) {
    if (seat.role === "litigant" || seat.role === "poa") {
      return app.status !== "draft" && app.status !== "pending-signature";
    }
    return true;
  }
  if (app.type === "objection") return app.status === "submitted";
  return Boolean(app.onboardedOn);
}

/* Availability ----------------------------------------------------------------------- */

export type AvailabilityContext = {
  side: Side;
  hearingScheduled: boolean;
};

/**
 * "Application types → Available when". Objection is never started from the
 * chooser — only from a File objection task. Edit Litigant Details is governed by a
 * control on the workflow (who can raise it, whose details they can edit) that is not
 * built, so it stays open. Certified Copy and Warrant Recall are not types in the
 * specification and are never offered.
 */
export function typeAvailable(type: string, context: AvailabilityContext): boolean {
  switch (type) {
    case "bail":
      return context.side === "accused";
    case "condonation-of-delay":
      return context.side === "complainant";
    case "advancement-reschedule":
    case "postpone":
      return context.hearingScheduled;
    case "objection":
    case "certified-copy":
    case "warrant-recall":
      return false;
    default:
      return true;
  }
}

/* Court tasks ------------------------------------------------------------------------ */

export type CourtTaskKind = "review" | "decide";

export type CourtTask = {
  kind: CourtTaskKind;
  label: string;
  dueOn: string;
  application: LifecycleApplication;
};

export function courtTaskOf(app: LifecycleApplication): CourtTask | null {
  if (app.status === "pending-review" && app.review) {
    return {
      kind: "review",
      label: "Review application",
      dueOn: app.review.dueOn,
      application: app,
    };
  }
  if (app.status === "pending-decision" && app.decide) {
    return {
      kind: "decide",
      label: "Decide application",
      dueOn: app.decide.dueOn,
      application: app,
    };
  }
  return null;
}

export function courtTasks(apps: LifecycleApplication[]): CourtTask[] {
  return apps
    .map(courtTaskOf)
    .filter((task): task is CourtTask => task !== null)
    .sort(
      (a, b) =>
        a.dueOn.localeCompare(b.dueOn) ||
        (a.application.submittedOn ?? "").localeCompare(b.application.submittedOn ?? ""),
    );
}
