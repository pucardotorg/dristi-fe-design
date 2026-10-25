/**
 * Which roles each seat holds, by state — `court-roles.md` §3, as data.
 *
 * The court side is still worked from a seat (`court-role.ts`): a demo account signs in
 * as the magistrate, the bench clerk, the typist and so on. What a seat is *offered*
 * comes from the roles that state's table gives it, never from the seat's name
 * (`RLE-08`: no PRD names a staff title as the holder of a permission). So "the typist
 * fills order data" is true in Kerala and Gujarat and false in Punjab & Haryana, where
 * the Ahlmad does — and the code reads that from here.
 *
 * Keep this table identical to court-roles §3. The Post officer is a seat in all three
 * states: it holds Process dispatcher and Process reporter for e-Post only, and Evidence
 * marker (court-roles §3, v10.3). Which channel a dispatcher or reporter role covers is
 * not carried here — `sign-process.ts` scopes the Post officer to e-Post.
 *
 * **Still a view rule, not a permission.** Nothing here authenticates anybody; it decides
 * what a screen offers. A real build reads roles from the court directory and enforces
 * them server-side (`RLE-04`).
 */

import type { CourtId } from "@/lib/court/profiles";

import type { CourtRole } from "./content";

/** The roles of court-roles §2, as the code names them. */
export type StaffRole =
  | "account-approver"
  | "scrutiny-officer"
  | "case-registerer"
  | "order-drafter"
  | "order-data-filler"
  | "next-hearing-setter"
  | "order-signer"
  | "hearing-controller"
  | "application-onboarder"
  | "process-signer"
  | "warrant-signer"
  | "process-dispatcher"
  | "process-reporter"
  | "evidence-marker"
  | "a-diary-editor"
  | "a-diary-signer";

const MAGISTRATE: readonly StaffRole[] = [
  "case-registerer",
  "order-drafter",
  "next-hearing-setter",
  "order-signer",
  "hearing-controller",
  "application-onboarder",
  "warrant-signer",
  "evidence-marker",
  "a-diary-editor",
  "a-diary-signer",
];

const BENCH_CLERK: readonly StaffRole[] = [
  "order-drafter",
  "order-data-filler",
  "next-hearing-setter",
  "hearing-controller",
  "application-onboarder",
  "process-signer",
];

const SCRUTINY: readonly StaffRole[] = ["scrutiny-officer"];

/* court-roles §3.2, §3.3: the Reader also dispatches process in Gujarat and P&H. */
const READER_DISPATCHER: readonly StaffRole[] = [...BENCH_CLERK, "process-dispatcher"];

/* court-roles §3.1–§3.3: dispatcher and reporter for e-Post, and nothing it signs. */
const POST_OFFICER: readonly StaffRole[] = [
  "process-dispatcher",
  "process-reporter",
  "evidence-marker",
];

/**
 * court-roles §3.1–§3.3. A seat missing from a state's entry does not exist there: only
 * Punjab & Haryana has a separate Steno and Ahlmad.
 */
const SEAT_ROLES: Record<CourtId, Partial<Record<CourtRole, readonly StaffRole[]>>> = {
  kerala: {
    magistrate: MAGISTRATE,
    "scrutiny-officer": SCRUTINY,
    "bench-clerk": BENCH_CLERK,
    typist: ["order-drafter", "order-data-filler", "next-hearing-setter"],
    "post-officer": POST_OFFICER,
  },
  gujarat: {
    magistrate: MAGISTRATE,
    /* court-roles §3.2: the Scrutiny officer also approves accounts. */
    "scrutiny-officer": ["scrutiny-officer", "account-approver"],
    "bench-clerk": READER_DISPATCHER,
    typist: ["order-drafter", "order-data-filler"],
    "post-officer": POST_OFFICER,
  },
  "punjab-haryana": {
    magistrate: MAGISTRATE,
    "scrutiny-officer": SCRUTINY,
    "bench-clerk": READER_DISPATCHER,
    typist: ["order-drafter", "next-hearing-setter"],
    steno: ["order-drafter"],
    /* court-roles §3.3: the Ahlmad also approves accounts. */
    ahlmad: ["order-data-filler", "account-approver"],
    "post-officer": POST_OFFICER,
  },
};

/** The seats a state has, in the order the bench is read. */
const SEAT_ORDER: readonly CourtRole[] = [
  "magistrate",
  "bench-clerk",
  "scrutiny-officer",
  "typist",
  "steno",
  "ahlmad",
  "post-officer",
];

export function seatsIn(court: CourtId): CourtRole[] {
  return SEAT_ORDER.filter((seat) => SEAT_ROLES[court][seat]);
}

/** The roles this seat holds in this state; none for a seat the state does not have. */
export function rolesOf(seat: CourtRole, court: CourtId): readonly StaffRole[] {
  return SEAT_ROLES[court][seat] ?? [];
}

/** Whether this seat holds this role in this state. */
export function seatHolds(seat: CourtRole, court: CourtId, role: StaffRole): boolean {
  return rolesOf(seat, court).includes(role);
}
