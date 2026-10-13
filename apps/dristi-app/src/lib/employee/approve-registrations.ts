/**
 * Advocate registrations waiting on the scrutiny officer — the eighth court-side queue,
 * as data.
 *
 * Advocates **self-register** on the citizen side. Their account sits at Pending Approval
 * with no access to it (`REG-24`), and this queue is what stands between them and the
 * right to file. The act the officer performs is the one the Account Creation handover
 * names in §2: verify the person by their **Bar registration ID and the photo of their
 * Bar ID card**, then approve or reject (§5.3). A rejection carries a free-text reason
 * (`REG-22`); the advocate edits and resubmits, without limit (`REG-23`).
 *
 * This is **not** a form for keying an advocate's details in. Nothing on the court side
 * creates a registration; every row here arrived from the other side of the product.
 *
 * Source for every field and every state below:
 * `/Users/abhiramrajilan/Desktop/account-creation-handover.md` §5 (`REG-10`–`REG-24`) and
 * `docs/design/proposals/approve-registrations.md`. Only what the registration flow actually
 * collects is modelled — mobile (OTP-verified, the account's primary key), full name, Bar
 * registration ID, the photo of the card, and an optional email. **Address, ID type and
 * ID proof are deliberately absent**: handover §5.1 says they are not collected, and a
 * row that carried them would be inventing data the product never asks for.
 *
 * **There is no backend.** `REGISTRATIONS_QUEUE` is demo data shaped to exercise
 * what the screen has to survive: two names in Malayalam script, one name long enough to
 * wrap its column twice, Bar registration IDs from four state bars so the column is sized
 * off the longest rather than off Kerala's short form, waits spread from one day to two
 * months, an edited pre-created account (`REG-18`), a resubmission at round 2 and one at
 * round 5 with every earlier reason kept, and one card photo that will not load.
 * No row is read from a bar council, a register or a person.
 *
 * **Nothing looks the registration ID up.** The officer verifies the typed values against
 * the photograph (`REG-14`) and nothing else; there is no Bar Council check on this screen
 * (owner, 2026-10-13).
 *
 * **Approve and Reject perform no act.** Neither opens an account, grants access, refuses
 * anyone, sends a reason or writes to a record. Both do exactly one thing: drop the row
 * from this demo queue, the way the copy-application and rescheduling queues already do.
 * Nothing persists past a reload.
 *
 * The registration application number stays in the `KL-ADV-000207-2026` form the advocate
 * is shown on their own "awaiting approval" screen. It is the only string the two sides of
 * the product share about this request, so it is not re-minted here (brief D14).
 */

import { matchesQuery } from "./filter-state";
import { parseIsoDay } from "./hearings";

/**
 * Who is asking — an advocate or an advocate's clerk (handover §5, `REG-13a`/`REG-14a`).
 *
 * Both self-register and both wait for the same scrutiny officer, with the same five
 * values in the same order. What differs is words: a clerk gives a **clerk
 * registration number** and a **photo of their clerk ID card** where an advocate gives the
 * Bar ones.
 *
 * Until 2026-09-11 every row here was an advocate and this distinction lived in the model
 * with no column, because a column whose every cell reads the same is the defect D4 was
 * written against. Clerks joining the queue is what that paragraph was waiting for: the
 * constant became a real distinction, and the Role column came back as a real one.
 */
export type RegistrantKind = "advocate" | "clerk";

/**
 * How this request came to be waiting — the three genuinely different jobs behind one
 * queue (brief D7).
 *
 * - `first` — a fresh self-registration. **The norm, and it is left unmarked.**
 * - `edited` — `REG-18`: the account was auto-created from the Bar Council database and
 *   the holder changed something at first login. The officer verifies the *change*, not
 *   the whole record.
 * - `resubmission` — `REG-23`: this was rejected and the advocate has sent it back. The
 *   officer's real question is "did they fix what I said", so the last reason travels
 *   with the row.
 */
export type RequestKind = "first" | "edited" | "resubmission";

/** The four claim fields the registration flow collects — `REG-10`, `REG-12`, `REG-13`, `REG-15`. */
export type ClaimField = "fullName" | "registrationNumber" | "mobile" | "email";

/**
 * One value the holder of a pre-created account changed at first login (`REG-18`).
 *
 * Only `was` is stored. `now` is whatever the row already carries, so the two can never
 * drift apart, and `null` means the value was **added** rather than altered — the flow
 * pre-fills from the Bar Council record, which holds no email.
 */
export type RegistrationEdit = { field: ClaimField; was: string | null };

/**
 * One round of the reject–resubmit loop (`REG-22`, `REG-23`).
 *
 * `reason` is the officer's own free text, kept whole: it is what the advocate was told,
 * and a summary of it would let this screen quietly rewrite what the court said.
 */
export type RejectionRound = {
  /** 1 for the first rejection. The badge reads the round the *current* request is on. */
  round: number;
  /** How long ago the rejection went out, counted from the same day as `daysWaiting`. */
  daysAgo: number;
  reason: string;
};

export type RegistrationRequest = {
  id: string;
  /**
   * `KL-ADV-000207-2026` — the string the advocate is shown on their own waiting screen,
   * and the only identifier they can quote on the phone. The row's opener.
   */
  applicationNumber: string;
  /** `REG-12`. The emphasised cell, and what identifies a person. */
  fullName: string;
  /**
   * BCP 47 tag for `fullName`, when it is not written in English.
   *
   * A name in Malayalam script is data, not a locale — the rest of this screen stays in
   * English — so the tag rides the name itself and nothing else. Without it a screen
   * reader pronounces Malayalam letters with an English voice (ACCESSIBILITY §13).
   */
  fullNameLang?: string;
  /** `REG-13`. The claim under verification, and the second thing an officer searches by. */
  registrationNumber: string;
  /** `REG-10` — OTP-verified, and the account's primary key (`REG-07`). */
  mobile: string;
  /** `REG-15` — optional. Absent, not empty: the claim block omits the row entirely. */
  email?: string;
  /** `REG-14` — the photograph the whole approval turns on. */
  photo: { src: string; filename: string };
  /**
   * How long this request has been waiting, in days.
   *
   * Stored rather than derived from a date, the way `RegisterCase.daysSinceSubmitted` is:
   * a demo queue whose ages drift with the wall clock stops exercising the escalation it
   * was built to exercise. The submission date the overlay shows is derived from this
   * (`submissionDay`), so the two can never contradict each other.
   */
  daysWaiting: number;
  registrantKind: RegistrantKind;
  requestKind: RequestKind;
  /** `REG-18`. Present only on an `edited` request, and never empty when present. */
  edits?: RegistrationEdit[];
  /** `REG-23`. Present only on a `resubmission`, oldest round first. */
  rejections?: RejectionRound[];
};

/**
 * The day the demo queue is read as standing on.
 *
 * Every age in this file is counted back from here, so the rows keep their spread — a
 * two-month-old request stays two months old — instead of ageing with whoever opens the
 * screen. Replacing this module with a service replaces the arithmetic too.
 */
const DEMO_TODAY = "2026-09-10";

/** The ISO day a request was submitted, derived from its age. */
export function submissionDay(request: RegistrationRequest): string {
  return dayBefore(DEMO_TODAY, request.daysWaiting);
}

/** The ISO day a rejection round went out, derived the same way. */
export function rejectionDay(round: RejectionRound): string {
  return dayBefore(DEMO_TODAY, round.daysAgo);
}

function dayBefore(day: string, days: number): string {
  const date = parseIsoDay(day);
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const date_ = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${date_}`;
}

const LONG_DAY = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "31 August 2026" — a date read inside the overlay, not in a column. */
export function formatRegistrationLongDate(day: string): string {
  return LONG_DAY.format(parseIsoDay(day));
}

/* ─────────────────────────── labels, read off the row ─────────────────────── */

/** What this registrant's identifier is called (brief D13). */
export function registrationIdLabel(kind: RegistrantKind): string {
  /* "Bar registration **number**", which is what the advocate's own sign-up form calls it
     (`verificationSteps.advocate.numberLabel`), and which now reads as a pair with the
     clerk's "Clerk registration number" rather than as a different kind of thing. */
  return kind === "clerk" ? "Clerk registration number" : "Bar registration number";
}

/** What the photograph is called (`REG-14` / `REG-14a`). */
export function idPhotoLabel(kind: RegistrantKind): string {
  return kind === "clerk" ? "Photo of clerk ID card" : "Photo of Bar ID card";
}

/**
 * The section's name — the screen heading, the browser tab and the rail row read this one
 * string, so they cannot drift (owner, 2026-09-11: "Approve registrations" named half a
 * queue that now holds clerks too). See the heading in `ApproveRegistrationsScreen` for why
 * these two words.
 *
 * The route and the file names still say `approve-registrations`. Renaming them is a
 * mechanical change with links and a parallel session's navigation work in its way, so it
 * is left for a quiet moment rather than folded into a copy change (brief §11).
 */
export const APPROVE_REGISTRATIONS_TITLE = "Approve registrations";

/**
 * What the person is registering as.
 *
 * **"Clerk", not the sign-up's "Advocate clerk"** (owner, 2026-09-11: *"it should just say
 * Clerk, because it'll be easier to scan"*). The applicant needs the long form to tell the
 * role apart from a court's bench clerk while choosing; the officer, reading down a column
 * of two values, needs them to differ in their first word. "Advocate" and "Advocate clerk"
 * did not — the eye had to reach the end of the cell to tell them apart.
 */
export function roleLabel(kind: RegistrantKind): string {
  return kind === "clerk" ? "Clerk" : "Advocate";
}

/** The card itself, named in a sentence — "Bar ID card", "clerk ID card". */
export function idCardName(kind: RegistrantKind): string {
  return kind === "clerk" ? "clerk ID card" : "Bar ID card";
}

/** The noun for the person, in a sentence. */
export function registrantNoun(kind: RegistrantKind): string {
  return kind === "clerk" ? "clerk" : "advocate";
}

/**
 * The row's mark, or nothing at all.
 *
 * A first registration is the norm and carries **no badge** — marking every row would
 * spend the column's whole ration on a fact that distinguishes nothing (brief D7).
 */
export function requestKindLabel(request: RegistrationRequest): string | null {
  if (request.requestKind === "edited") return "Profile update";
  if (request.requestKind === "resubmission") {
    return `Resubmitted · round ${currentRound(request)}`;
  }
  return null;
}

/**
 * **One colour meaning per screen: colour says what kind of account, and nothing else**
 * (owner, 2026-09-11).
 *
 * *"Standardise the pill colour so that it's not too many colours going on. The status
 * updates can have just a gray or a beige, but this account type can have different
 * colours."* So every pill that reports a state — *Resubmitted · round 2*, *Profile
 * update*, *Pending approval* — is the DS's neutral `secondary`, and the only pills that
 * carry a hue are the account type's. Colour on this screen now answers exactly one
 * question, which is the only way it can be read without a legend.
 *
 * **Why these two hues.** Once the states are neutral, every other hue still has a job
 * here — `warning` is the wait escalation, `destructive` an overdue
 * wait and a rejection — so reusing either would say two things at once. `info` and
 * `success` are the two left with nothing to say on the queue or the review. Advocates,
 * the majority, take the calmer `info`; clerks take `success`. The one place green means
 * something else is the settled *Approved* state, and there it is labelled on both sides.
 *
 * The DS has no categorical tint family, so this is a borrowing, filed upstream (brief
 * §13). The words are on the pill, so the account type is never colour alone.
 */
export type AccountTypeVariant = "info" | "success";

export function accountTypeVariant(kind: RegistrantKind): AccountTypeVariant {
  return kind === "clerk" ? "success" : "info";
}

/**
 * Which round the request in front of the officer is on.
 *
 * One past the number of rejections behind it: a request that has been refused four times
 * and sent back is on round 5.
 */
export function currentRound(request: RegistrationRequest): number {
  return (request.rejections?.length ?? 0) + 1;
}

/** What the holder changed in this field at first login, if anything (`REG-18`). */
export function editFor(
  request: RegistrationRequest,
  field: ClaimField,
): RegistrationEdit | undefined {
  return request.edits?.find((edit) => edit.field === field);
}

/* ─────────────────────────────── the wait ─────────────────────────────────── */

export type WaitTone = "plain" | "warning" | "destructive";

/**
 * How loudly the days-waiting cell speaks.
 *
 * The escalating shape is the scrutiny queue's `waitTone` (`lib/employee/scrutiny/
 * queue.ts`): plain at rest, `warning-ink` past a threshold, `destructive-ink` past a
 * longer one. Marking every row instead — which `RegisterCasesTable` does — restates the
 * norm and spends a colour on it, so the exception is what gets the ink.
 *
 * **The thresholds are borrowed, not derived.** 7 and 14 days are the scrutiny registry's
 * own clock. Nobody has told us what "too long" means for a registration
 * (`approve-registrations.md` §12.5), and until they do, two court-side queues speaking with
 * one voice beats this one inventing a number. What is not borrowed is that a wait here
 * is a live harm: `REG-24` says a pending advocate cannot act at all, and §138 runs on
 * statutory clocks that do not pause while they wait
 * (`docs/product/domain/journey.md` §1–3).
 */
export function registrationWaitTone(days: number): WaitTone {
  if (days >= 14) return "destructive";
  if (days >= 7) return "warning";
  return "plain";
}

/** The number the table shows; the column header names the unit. */
export function formatDaysWaiting(days: number): string {
  return String(days);
}

/** The same fact, spoken — for the stacked phone rows, where there is no header. */
export function formatDaysWaitingSpoken(days: number): string {
  return days === 1 ? "1 day waiting" : `${days} days waiting`;
}

/** The wait as a value beside the term "Waiting", where the term is not a column header. */
export function formatWaitingDuration(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

/* ─────────────────────────── the row every fact is in ─────────────────────── */

/** How a value is set. Not decoration — a Bar ID is a code and a wait is a figure. */
export type RowFormat = "text" | "code" | "figure" | "email";

/**
 * One fact, in the one shape every fact on this overlay takes: **a term and its value**.
 *
 * Request metadata, the four submitted attributes and every rejection round all render
 * through this, and nothing else hangs off it. The version this replaces carried a
 * source, a previous value and a list of marks on the same row, so a single line could
 * arrive as a name, plus a chip saying `Differs`, plus a chip saying `Changed`, plus a
 * muted line reading "Bar Council of Kerala: Thomas Kurian", plus a struck-through "Was
 * Thomas Kurian" — five treatments stacked in a 190px column, which the owner read on
 * the render as "an abomination of just information being thrown around"
 * (2026-09-11). It was scalable in the sense that the *data* generalised; it was not
 * scalable in the sense that matters, which is that a person has to scan it.
 *
 * So a comparison is no longer a decoration on a value. It is its own table with its
 * own columns — see `ComparisonBlock`. This row holds one value and says nothing about
 * where it came from.
 */
export type FactRow = {
  id: string;
  /** The attribute's label, read off `registrantKind` wherever the kind decides it. */
  term: string;
  value: string;
  /** BCP 47 tag for `value`, when it is not written in English. */
  valueLang?: string;
  format: RowFormat;
  /** Escalating ink. The wait carries one (D6). */
  tone?: WaitTone;
  /** A dated fact belonging to the row rather than to a source — a round's own date. */
  note?: string;
  /**
   * The value is a category, and is shown as the same pill everywhere it appears — the
   * account type, which the owner wants read before anything else on the screen.
   */
  pill?: AccountTypeVariant;
};

/**
 * The request's own facts: when it arrived, how long it has been kept, which of the
 * three jobs it is (brief D16).
 *
 * They are a group of rows and not a line of header prose, because a header holds two
 * facts before it becomes a paragraph. The application number is **not** here: it is the
 * dialog's description, and carrying it twice would be one fact with two treatments.
 */
export function requestRows(request: RegistrationRequest): FactRow[] {
  return [
    /* **First, as a pill** (owner, 2026-09-11: *"what's the first thing you read and then
       you understand, okay, it's a clerk. You don't read the heading… especially when you
       become a power user, you look at the content immediately"*). The title says it too,
       for the officer who does read headings and for a screen reader; this is where the
       eye lands. It is the same pill the queue's Account type column shows, so the
       signal is learned once on the list and recognised in the record. */
    {
      id: "accountType",
      term: "Account type",
      value: roleLabel(request.registrantKind),
      format: "text",
      pill: accountTypeVariant(request.registrantKind),
    },
    {
      id: "submitted",
      term: "Submitted",
      value: formatRegistrationLongDate(submissionDay(request)),
      format: "figure",
    },
    {
      id: "waiting",
      term: "Waiting",
      value: formatWaitingDuration(request.daysWaiting),
      format: "figure",
      /* The same escalation as the queue cell the officer arrived from: one fact, one
         treatment, on both surfaces (D6). */
      tone: registrationWaitTone(request.daysWaiting),
    },
    {
      id: "requestKind",
      term: "Request type",
      value: requestTypeValue(request),
      format: "text",
    },
  ];
}

/**
 * Which of the three jobs this request is, as a value from a closed set of three.
 *
 * The provenance a paragraph used to explain — "this account was created from the Bar
 * Council record, the advocate changed the marked values at first login" — is carried by
 * this value plus the `Changed at first login` comparison. Nothing is narrated.
 */
export function requestTypeValue(request: RegistrationRequest): string {
  /* **"Profile update", not "Edited Bar Council account"** (owner, 2026-09-11: *"edited
     bar council account does not make sense to me — update profile could be a request
     type"*). Their words, turned from an instruction into the noun a value column wants:
     the three types now read "New registration", "Profile update", "Resubmitted · round
     5", which are three answers to the same question. Where the account came from is not
     the type of the request; it is provenance, and the comparison below carries it. */
  if (request.requestKind === "edited") return "Profile update";
  if (request.requestKind === "resubmission") {
    return `Resubmitted · round ${currentRound(request)}`;
  }
  return "New registration";
}

/**
 * The four submitted values — and **nothing about where they came from**.
 *
 * Exactly four, because the flow collects exactly five things and the fifth — the
 * photograph — is the evidence column, not a row (`REG-10`–`REG-15`). That mapping is how
 * a reader checks at a glance that nothing was invented: five collected values, four rows
 * and one column.
 *
 * This is the block the officer reads against the photograph, so it holds what the
 * advocate typed and stops. The comparison with the account before it was edited is a
 * table of its own (`comparisonBlocks`).
 */
export function identityRows(request: RegistrationRequest): FactRow[] {
  const rows: FactRow[] = [
    {
      id: "fullName",
      term: "Full name",
      value: request.fullName,
      valueLang: request.fullNameLang,
      format: "text",
    },
    {
      id: "registrationNumber",
      term: registrationIdLabel(request.registrantKind),
      value: request.registrationNumber,
      format: "code",
    },
    {
      id: "mobile",
      term: "Mobile number",
      value: request.mobile,
      format: "figure",
    },
  ];

  /* `REG-15`. Absent, not blank: an optional value nobody gave is not a missing one, and
     a row reading "—" would teach the officer to look for it. */
  if (request.email) {
    rows.push({
      id: "email",
      term: "Email",
      value: request.email,
      format: "email",
    });
  }

  return rows;
}

/* ─────────────────────── two values, side by side ─────────────────────────── */

/**
 * One value in a comparison — the claimant's, or the account's before an
 * edit. They are the same kind of thing, which is why they are the same type.
 */
export type ComparisonValue = {
  text: string;
  /** BCP 47 tag, when this value is not written in English. */
  lang?: string;
  format: RowFormat;
  /**
   * A value the record never held. Rendered quiet, and as words rather than a dash: an
   * em-dash in a before/after table is read as "unknown" as readily as "nothing".
   */
  absent?: boolean;
};

export type ComparisonRow = {
  id: string;
  /** The attribute being compared, in the same words the Identity block uses. */
  term: string;
  /** One per column, in the block's own column order. */
  values: ComparisonValue[];
};

/**
 * A set of attributes where two sources hold different values — the whole of what the
 * old `differs` / `changed` chips, source lines and struck-through values were trying to
 * say, in the shape the owner asked for: *"clearly show what was before and after… all in
 * a clean tabular format so it's scannable"* (2026-09-11).
 *
 * The block is **general in the axis that matters**: a third source, a fourth, or a
 * comparison over three columns is a block with more `columns` and more `values`. It is
 * not general in a way that lets a component invent a sentence — the label and the column
 * headers are the only strings, and both are named here.
 *
 * Nothing renders when there is nothing to compare, which is the ordinary request: the
 * officer of a clean submission sees the four values and the photograph, and no table at
 * all.
 */
export type ComparisonBlock = {
  id: "changed";
  /** The group's own name — what the two columns are a comparison *between*. */
  label: string;
  /** Header over each value column. Same length as every row's `values`. */
  columns: string[];
  rows: ComparisonRow[];
};

/**
 * Every comparison this request carries — today only what the holder changed at first
 * login (`REG-18`).
 */
export function comparisonBlocks(
  request: RegistrationRequest,
): ComparisonBlock[] {
  const blocks: ComparisonBlock[] = [];
  const current = identityRows(request);

  /* `REG-18`. Ordered by the Identity block rather than by the edit list, so the two
     tables are read in the same order however the data arrives. */
  const changed = current.flatMap((row) => {
    const edit = editFor(request, row.id as ClaimField);
    if (!edit) return [];
    return [
      {
        id: row.id,
        term: row.term,
        values: [
          edit.was === null
            ? { text: "Not given", format: row.format, absent: true }
            : { text: edit.was, format: row.format },
          { text: row.value, lang: row.valueLang, format: row.format },
        ],
      },
    ];
  });

  if (changed.length > 0) {
    blocks.push({
      id: "changed",
      label: "Changed at first login",
      columns: ["Before", "Now"],
      rows: changed,
    });
  }

  return blocks;
}

/**
 * Every round this request has already been refused, **newest first** (brief D7).
 *
 * Newest first because the question a resubmission asks is "did they fix what I said last
 * time", and that answer must not be at the bottom of five rounds. All of them render
 * through the same row as everything else — the build this replaces had the newest as a
 * quote block and the rest as a timeline, which is one fact with two treatments.
 *
 * The round's `decision` is not a field and not a mark: every round that can appear here
 * was a rejection, because an approved request leaves the queue, so a chip saying so
 * would mark the norm. The group's own label carries it.
 */
export function rejectionRows(request: RegistrationRequest): FactRow[] {
  return [...(request.rejections ?? [])].reverse().map((round) => ({
    id: `round-${round.round}`,
    term: `Round ${round.round}`,
    /* The officer's own words, kept whole. A summary would let this screen quietly
       rewrite what the court told the advocate. */
    value: round.reason,
    format: "text" as const,
    note: formatRegistrationLongDate(rejectionDay(round)),
  }));
}

/* ──────────────────────────────── the queue ───────────────────────────────── */

const CARD = "/demo/bar-id-card-specimen.svg";
/** A pale scan — the near-white card the sunken well has to keep an edge against. */
const PALE_CARD = "/demo/bar-id-card-specimen-pale.svg";
/** Deliberately not a file. The one row whose photograph will not open. */
const MISSING_CARD = "/demo/bar-id-card-not-uploaded.svg";

const PENDING: RegistrationRequest[] = [
  {
    id: "adv-118",
    applicationNumber: "KL-ADV-000118-2026",
    /* The long one. Four given names and a title, which is ordinary in this bar and
       wraps every column it is put in. */
    fullName: "Fathima Beevi Abdul Rahman Kunju Rawther",
    registrationNumber: "KL/1109/2009",
    mobile: "9847116620",
    email: "fathimabeevi.rawther@example.com",
    photo: { src: PALE_CARD, filename: "bar-id-kl-1109-2009.jpg" },
    daysWaiting: 61,
    registrantKind: "advocate",
    requestKind: "resubmission",
    /* Five rounds, so the block has to hold without growing without bound: the last
       reason reads in full, the four before it collapse to one line each. */
    rejections: [
      {
        round: 1,
        daysAgo: 78,
        reason:
          "The photo you have uploaded is of the back of the card. Please upload the side that carries your name, your photograph and the enrolment number.",
      },
      {
        round: 2,
        daysAgo: 73,
        reason:
          "The photograph is too dark for the enrolment number to be read. Please take it again in daylight and upload it.",
      },
      {
        round: 3,
        daysAgo: 68,
        reason:
          "The card reads Fathima Beevi Abdul Rahman Kunju Rawther. You have typed Fathima Beevi Rawther. Please type the name exactly as it appears on the card.",
      },
      {
        round: 4,
        daysAgo: 64,
        reason:
          "The enrolment number on the card is KL/1109/2009. You have entered KL/1190/2009. Please correct it and submit again.",
      },
    ],
  },
  {
    id: "adv-164",
    applicationNumber: "KL-ADV-000164-2026",
    fullName: "അനിൽകുമാർ പി. നായർ",
    fullNameLang: "ml",
    registrationNumber: "KL/0873/2004",
    mobile: "9446203318",
    photo: { src: CARD, filename: "bar-id-kl-0873-2004.jpg" },
    daysWaiting: 19,
    registrantKind: "advocate",
    requestKind: "first",
  },
  {
    id: "adv-181",
    applicationNumber: "KL-ADV-000181-2026",
    fullName: "Meera Suresh",
    registrationNumber: "KL/3312/2021",
    mobile: "9895447120",
    email: "meera.suresh@example.com",
    photo: { src: CARD, filename: "bar-id-kl-3312-2021.jpg" },
    daysWaiting: 12,
    registrantKind: "advocate",
    requestKind: "first",
  },
  {
    id: "adv-184",
    applicationNumber: "KL-ADV-000184-2026",
    fullName: "Sandeep Deshmukh",
    registrationNumber: "MAH/2201/2010",
    mobile: "9820114576",
    email: "sandeep.deshmukh@example.com",
    photo: { src: CARD, filename: "bar-id-mah-2201-2010.jpg" },
    daysWaiting: 11,
    registrantKind: "advocate",
    requestKind: "first",
  },
  {
    id: "adv-191",
    applicationNumber: "KL-ADV-000191-2026",
    /* The account was created under the short form and he corrected it to his full legal
       name at first login. */
    fullName: "Thomas Kurian Varghese",
    registrationNumber: "KL/3077/2020",
    /* REG-18: the account was auto-created from the Bar Council record and he changed
       three things at first login. The officer verifies the change, not the record. */
    mobile: "9895204471",
    email: "thomas.kurian@example.com",
    photo: { src: CARD, filename: "bar-id-kl-3077-2020.jpg" },
    daysWaiting: 8,
    registrantKind: "advocate",
    requestKind: "edited",
    edits: [
      { field: "fullName", was: "Thomas Kurian" },
      { field: "mobile", was: "9847051204" },
      /* The Bar Council record holds no email, so this is an addition rather than a
         change — and "was: —" would be a value the record never had. */
      { field: "email", was: null },
    ],
  },
  {
    id: "adv-196",
    applicationNumber: "KL-ADV-000196-2026",
    fullName: "ഷൈലജ രാമകൃഷ്ണൻ",
    fullNameLang: "ml",
    registrationNumber: "KL/2306/2016",
    mobile: "9744810352",
    photo: { src: PALE_CARD, filename: "bar-id-kl-2306-2016.jpg" },
    daysWaiting: 6,
    registrantKind: "advocate",
    requestKind: "first",
  },
  {
    id: "adv-198",
    applicationNumber: "KL-ADV-000198-2026",
    fullName: "Nazeer Muhammed",
    registrationNumber: "KL/2140/2015",
    mobile: "9961227804",
    email: "nazeer.muhammed@example.com",
    /* The photograph that will not open. The well says so in words and keeps Download
       reachable; approval is not blocked, because the officer may hold the card another
       way — but they are not shown an empty box and left to infer. */
    photo: { src: MISSING_CARD, filename: "bar-id-kl-2140-2015.jpg" },
    daysWaiting: 5,
    registrantKind: "advocate",
    requestKind: "resubmission",
    rejections: [
      {
        round: 1,
        daysAgo: 9,
        reason:
          "The photo of your Bar ID card is too blurred to read. Please upload a clearer one.",
      },
    ],
  },
  {
    id: "adv-201",
    applicationNumber: "KL-ADV-000201-2026",
    fullName: "Prakash Vaidya",
    registrationNumber: "G/60/1992",
    mobile: "9825031147",
    photo: { src: CARD, filename: "bar-id-g-60-1992.jpg" },
    daysWaiting: 4,
    registrantKind: "advocate",
    requestKind: "first",
  },
  {
    id: "adv-203",
    applicationNumber: "KL-ADV-000203-2026",
    fullName: "Aparna Krishnan",
    /* The longest identifier on the screen, and from another state's bar — the column is
       sized off this rather than off Kerala's short form. */
    registrationNumber: "KAR/12453/2018",
    mobile: "9880412206",
    email: "aparna.krishnan@example.com",
    photo: { src: CARD, filename: "bar-id-kar-12453-2018.jpg" },
    daysWaiting: 3,
    registrantKind: "advocate",
    requestKind: "first",
  },
  {
    id: "adv-204",
    applicationNumber: "KL-ADV-000204-2026",
    fullName: "Vishnu Prasad",
    registrationNumber: "KL/2588/2017",
    mobile: "9847339015",
    photo: { src: CARD, filename: "bar-id-kl-2588-2017.jpg" },
    daysWaiting: 3,
    registrantKind: "advocate",
    requestKind: "first",
  },
  {
    id: "adv-206",
    applicationNumber: "KL-ADV-000206-2026",
    fullName: "Ritu Sabharwal",
    registrationNumber: "D/1450/2013",
    mobile: "9810226741",
    email: "ritu.sabharwal@example.com",
    photo: { src: CARD, filename: "bar-id-d-1450-2013.jpg" },
    daysWaiting: 2,
    registrantKind: "advocate",
    requestKind: "first",
  },
  {
    id: "adv-207",
    applicationNumber: "KL-ADV-000207-2026",
    fullName: "Joseph Mathew",
    registrationNumber: "KL/1877/2014",
    mobile: "9605178432",
    photo: { src: CARD, filename: "bar-id-kl-1877-2014.jpg" },
    daysWaiting: 2,
    registrantKind: "advocate",
    requestKind: "first",
  },
  {
    id: "adv-209",
    applicationNumber: "KL-ADV-000209-2026",
    fullName: "Sreelakshmi Pillai",
    registrationNumber: "KL/1533/2012",
    mobile: "9497260813",
    email: "sreelakshmi.pillai@example.com",
    photo: { src: CARD, filename: "bar-id-kl-1533-2012.jpg" },
    daysWaiting: 1,
    registrantKind: "advocate",
    requestKind: "first",
  },
  {
    id: "adv-211",
    applicationNumber: "KL-ADV-000211-2026",
    fullName: "Deepak Menon",
    registrationNumber: "KL/0421/2004",
    mobile: "9846015529",
    photo: { src: CARD, filename: "bar-id-kl-0421-2004.jpg" },
    daysWaiting: 1,
    registrantKind: "advocate",
    requestKind: "first",
  },

  /* ─── Advocate clerks (`REG-13a`, `REG-14a`) ───────────────────────────────────────
     Same five values, their own identifier, their own card. Application numbers take the sign-up's own
     `KL-CLERK-` series (`registration-flow.tsx`, `applicationId`). No clerk is an
     `edited` request: `REG-17`/`REG-18` pre-create accounts from the Bar Council
     database, which holds advocates.

     **The registration-number format is a placeholder.** The sign-up's clerk field has
     no example ("Your clerk registration number") where the advocate's shows
     "K/1234/2020", so there is no source to copy. `CLK/serial/year` is shaped like the
     Bar numbers so the column sizes sensibly; it is not a claimed format (brief §12.12). */
  {
    id: "clk-187",
    applicationNumber: "KL-CLERK-000187-2026",
    fullName: "Sreejith Ramachandran",
    registrationNumber: "CLK/1522/2016",
    mobile: "9447381206",
    email: "sreejith.r@example.com",
    photo: { src: CARD, filename: "clerk-id-clk-1522-2016.jpg" },
    daysWaiting: 13,
    registrantKind: "clerk",
    requestKind: "resubmission",
    rejections: [
      {
        round: 1,
        daysAgo: 20,
        reason:
          "The registration number on your clerk ID card cannot be read. Please upload a clearer photo.",
      },
    ],
  },
  {
    id: "clk-192",
    applicationNumber: "KL-CLERK-000192-2026",
    fullName: "Rajesh Kumar Pillai",
    registrationNumber: "CLK/2143/2018",
    mobile: "9895462017",
    email: "rajesh.pillai@example.com",
    photo: { src: CARD, filename: "clerk-id-clk-2143-2018.jpg" },
    daysWaiting: 9,
    registrantKind: "clerk",
    requestKind: "first",
  },
  {
    id: "clk-210",
    applicationNumber: "KL-CLERK-000210-2026",
    /* A clerk's name in Malayalam script, so the Role column and the name column are
       exercised together on a row that is taller than its neighbours. No email: `REG-15`
       is optional for clerks as for advocates. */
    fullName: "സുമ ബാലകൃഷ്ണൻ",
    fullNameLang: "ml",
    registrationNumber: "CLK/0876/2021",
    mobile: "9072518834",
    photo: { src: PALE_CARD, filename: "clerk-id-clk-0876-2021.jpg" },
    daysWaiting: 3,
    registrantKind: "clerk",
    requestKind: "first",
  },
];

/**
 * Longest wait first, then application number.
 *
 * The queue is a work list, so the thing that has been waiting longest is the thing to
 * look at — the order `filterQueue` and `REGISTER_QUEUE` already work in. The application
 * number tie-break keeps the order stable between renders when two requests share a day
 * count, and it is the older serial that wins, because it is the older request.
 */
export function sortByLongestWait(
  rows: RegistrationRequest[],
): RegistrationRequest[] {
  return [...rows].sort(
    (a, b) =>
      b.daysWaiting - a.daysWaiting ||
      a.applicationNumber.localeCompare(b.applicationNumber),
  );
}

/** The registrations this court has not yet decided, longest wait first. */
export const REGISTRATIONS_QUEUE: RegistrationRequest[] =
  sortByLongestWait(PENDING);

/**
 * The request to look at after this one — so an officer clearing the queue can stay in
 * the overlay rather than come back to the list for every row.
 *
 * "Next" is read off the *remaining* list, in its own order, which is how the officer
 * would have reached it by hand: the first row that sits below the one just decided;
 * if that was the last row, the top of what is left. `rows` is the list as the screen
 * shows it — already filtered and already without the decided request — so a search
 * narrowed to four requests offers the next of those four, not the next of thirty-nine.
 * `null` when the list is empty, which is the queue being cleared.
 *
 * Position is the queue's own order (`sortByLongestWait`), not the array index of a row
 * that is no longer in the array — the decided request has left `rows` by the time this
 * is asked.
 */
export function nextInQueue(
  rows: RegistrationRequest[],
  decided: RegistrationRequest,
): RegistrationRequest | null {
  const after = rows.find((row) => comesAfter(row, decided));
  return after ?? rows.find((row) => row.id !== decided.id) ?? null;
}

/** `a` sits below `b` in the queue's longest-wait-first order. */
function comesAfter(a: RegistrationRequest, b: RegistrationRequest): boolean {
  return (
    a.daysWaiting < b.daysWaiting ||
    (a.daysWaiting === b.daysWaiting &&
      a.applicationNumber.localeCompare(b.applicationNumber) > 0)
  );
}

/**
 * How many registrations are waiting — the number the rail carries beside "Register
 * advocates".
 *
 * Derived from the list rather than typed in beside the label, the way
 * `APPROVE_COPY_QUEUE_COUNT` and `REGISTER_QUEUE_COUNT` are, so the rail and the screen
 * cannot disagree about the size of the queue. Every row here is pending — a decided
 * request leaves the queue (see the module header) — so the length *is* the pending count.
 */
export const REGISTRATIONS_QUEUE_COUNT = REGISTRATIONS_QUEUE.length;

export type AccountTypeFilter = "all" | RegistrantKind;
export type RequestTypeFilter = "all" | RequestKind;
/** The wait, in the same bands the days-waiting cell colours by (`registrationWaitTone`). */
export type WaitFilter = "all" | WaitTone;

export type RegistrationsFilters = {
  /**
   * Free text over the full name and the registration number — the two identifiers on
   * the row. The application number is not searched: it is not shown anywhere on the
   * court side any more (owner, 2026-10-07: "more of a backend thing"), and a box that
   * finds a row by a value the row does not show is a box nobody can predict.
   *
   * Not searched either: mobile and email. Both are contact details rather than
   * identifiers, and a queue that finds a person by their telephone number is a directory.
   */
  query: string;
  accountType: AccountTypeFilter;
  /** Pending only: a decided request is no longer read by what kind of request it was. */
  requestType: RequestTypeFilter;
  /** Pending only. */
  wait: WaitFilter;
};

export const EMPTY_REGISTRATIONS_FILTERS: RegistrationsFilters = {
  query: "",
  accountType: "all",
  requestType: "all",
  wait: "all",
};

export const ACCOUNT_TYPE_OPTIONS: { value: RegistrantKind; label: string }[] = [
  { value: "advocate", label: "Advocate" },
  { value: "clerk", label: "Clerk" },
];

export const REQUEST_TYPE_OPTIONS: { value: RequestKind; label: string }[] = [
  { value: "first", label: "New registration" },
  { value: "edited", label: "Profile update" },
  { value: "resubmission", label: "Resubmitted after rejection" },
];

export const WAIT_OPTIONS: { value: WaitTone; label: string }[] = [
  { value: "destructive", label: "14 days or more" },
  { value: "warning", label: "7 to 13 days" },
  { value: "plain", label: "Under 7 days" },
];

/** The waiting queue, narrowed by every filter the Pending tab offers. */
export function filterRegistrations(
  rows: RegistrationRequest[],
  filters: RegistrationsFilters,
): RegistrationRequest[] {
  return rows.filter(
    (request) =>
      matchesQuery(filters.query, request.fullName, request.registrationNumber) &&
      (filters.accountType === "all" ||
        request.registrantKind === filters.accountType) &&
      (filters.requestType === "all" ||
        request.requestKind === filters.requestType) &&
      (filters.wait === "all" ||
        registrationWaitTone(request.daysWaiting) === filters.wait),
  );
}

/* ─────────────────────────────── the order ────────────────────────────────── */

export type PendingSort = "longest" | "shortest" | "name";

export const PENDING_SORTS: { id: PendingSort; label: string }[] = [
  { id: "longest", label: "Longest waiting first" },
  { id: "shortest", label: "Shortest waiting first" },
  { id: "name", label: "Name, A to Z" },
];

const byName = (a: { fullName: string }, b: { fullName: string }) =>
  a.fullName.localeCompare(b.fullName, "en-IN");

/** The queue in the order asked for; the queue's own order breaks every tie. */
export function sortPending(
  rows: RegistrationRequest[],
  sort: PendingSort,
): RegistrationRequest[] {
  const queue = sortByLongestWait(rows);
  if (sort === "longest") return queue;
  if (sort === "shortest") {
    return [...queue].sort((a, b) => a.daysWaiting - b.daysWaiting);
  }
  return [...queue].sort(byName);
}

/* ────────────────────────────── the decided ───────────────────────────────── */

export type RegistrationOutcome = "approved" | "rejected";

/**
 * A request this court has already decided — what the Approved and Rejected tabs list
 * (owner, 2026-10-07). Read, not worked: nothing on either tab can be decided again.
 *
 * A rejected request stays here until the registrant resubmits; then it is a new request
 * in Pending (`REG-23`), carrying this rejection as a round.
 */
export type DecidedRegistration = {
  request: RegistrationRequest;
  outcome: RegistrationOutcome;
  /** Days before the demo's today; 0 is a decision taken on this screen. */
  daysAgo: number;
  /** `REG-22` — rejected only. */
  reason?: string;
};

/** The ISO day a decision was taken. */
export function decisionDay(decided: DecidedRegistration): string {
  return dayBefore(DEMO_TODAY, decided.daysAgo);
}

export type DecidedSort = "recent" | "oldest" | "name";

export const DECIDED_SORTS: { id: DecidedSort; label: string }[] = [
  { id: "recent", label: "Most recent first" },
  { id: "oldest", label: "Oldest first" },
  { id: "name", label: "Name, A to Z" },
];

export function filterDecided(
  rows: DecidedRegistration[],
  filters: Pick<RegistrationsFilters, "query" | "accountType">,
): DecidedRegistration[] {
  return rows.filter(
    ({ request }) =>
      matchesQuery(filters.query, request.fullName, request.registrationNumber) &&
      (filters.accountType === "all" ||
        request.registrantKind === filters.accountType),
  );
}

export function sortDecided(
  rows: DecidedRegistration[],
  sort: DecidedSort,
): DecidedRegistration[] {
  const recent = [...rows].sort(
    (a, b) => a.daysAgo - b.daysAgo || byName(a.request, b.request),
  );
  if (sort === "recent") return recent;
  if (sort === "oldest") return recent.reverse();
  return [...rows].sort((a, b) => byName(a.request, b.request));
}

function decidedAdvocate(
  serial: number,
  fullName: string,
  registrationNumber: string,
  rest: Partial<RegistrationRequest> = {},
): RegistrationRequest {
  return {
    id: `adv-${serial}`,
    applicationNumber: `KL-ADV-${String(serial).padStart(6, "0")}-2026`,
    fullName,
    registrationNumber,
    mobile: `98470${String(serial).padStart(5, "0")}`,
    photo: { src: CARD, filename: `bar-id-${registrationNumber.toLowerCase().replace(/\//g, "-")}.jpg` },
    daysWaiting: 0,
    registrantKind: "advocate",
    requestKind: "first",
    ...rest,
  };
}

function decidedClerk(
  serial: number,
  fullName: string,
  registrationNumber: string,
): RegistrationRequest {
  return {
    ...decidedAdvocate(serial, fullName, registrationNumber),
    id: `clk-${serial}`,
    applicationNumber: `KL-CLERK-${String(serial).padStart(6, "0")}-2026`,
    registrantKind: "clerk",
  };
}

/**
 * Demo decisions, so both tabs have something to read on first load. A rejected row here
 * is still waiting for its registrant to resubmit — the ones that already did are in
 * `PENDING`, with the rejection as a round.
 */
export const DECIDED_REGISTRATIONS: DecidedRegistration[] = [
  { outcome: "approved", daysAgo: 1, request: decidedAdvocate(101, "Arun Thomas Varghese", "KL/2871/2019") },
  { outcome: "approved", daysAgo: 1, request: decidedClerk(171, "Bindu Raveendran", "CLK/1307/2015") },
  { outcome: "approved", daysAgo: 3, request: decidedAdvocate(97, "Deepa Krishnan", "KL/1964/2012") },
  { outcome: "approved", daysAgo: 6, request: decidedAdvocate(92, "ജോസഫ് മാത്യു", "KL/0542/2001", { fullNameLang: "ml" }) },
  { outcome: "approved", daysAgo: 9, request: decidedAdvocate(88, "Nikhil Prakash", "KL/3907/2023") },
  { outcome: "approved", daysAgo: 15, request: decidedClerk(160, "Manoj Kumar S.", "CLK/0954/2019") },
  { outcome: "approved", daysAgo: 22, request: decidedAdvocate(79, "Shahana Basheer", "KL/2210/2016") },
  {
    outcome: "rejected",
    daysAgo: 2,
    request: decidedAdvocate(99, "Vishnu Mohan", "KL/4012/2024"),
    reason:
      "The photo of your Bar ID card is cut off at the bottom, so the enrolment number cannot be read. Please upload the whole card.",
  },
  {
    outcome: "rejected",
    daysAgo: 5,
    request: decidedClerk(166, "Latha Gopinath", "CLK/2071/2020"),
    reason:
      "The name on your clerk ID card is Latha G. Nair. Please type the name exactly as it appears on the card.",
  },
  {
    outcome: "rejected",
    daysAgo: 12,
    request: decidedAdvocate(84, "Rahul Dev Menon", "KL/3155/2020"),
    reason:
      "The Bar registration ID you typed, KL/3155/2020, is not the number on your card. Please check the number and submit again.",
  },
];
