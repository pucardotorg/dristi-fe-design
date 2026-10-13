/**
 * Court-staff sign-in — the roles on offer, the demo directory behind them, and the
 * posting a staff member signs in to.
 *
 * **This is scaffolding for a directory, not an authenticator.** The real screen (the
 * owner's reference, 2026-09-14) asks for a username and a password because every court
 * user is registered in the establishment's own back end — there is no self-registration
 * on the court side and no OTP. Until that endpoint exists, this module stands in for it
 * and does the one thing the screen cannot be judged without: it makes each role a
 * sign-in that a person can actually perform in a demo. Delete it with the endpoint.
 *
 **The username decides the seat, and nothing on the screen can override it** — the
 * same contract the real back end has. A role picker was tried first and cut the same
 * day (owner, 2026-09-14): staff sign in for each other constantly, a bench clerk into
 * the magistrate's account to get a thing done, and asking every one of those sign-ins
 * to declare a role first taxes them for a fact the directory already holds.
 *
 * **Any password is accepted.** The same bargain the citizen sign-in makes: there is
 * nothing to check a password against, and a screen that rejected one would be inventing
 * a rule. The field is real, required and masked; what it is not is checked.
 */

import { COURT_DISTRICT, CURRENT_STAFF, type CourtRole } from "./content";

/**
 * The four seats a username can land in, in the order the bench is read: the magistrate
 * first, then the establishment around them.
 *
 * This is every role in `CourtRole`. `COURT_SEATS` — what the rail's settings control
 * offers — follows it for the same reason: a seat you can sign in to is a seat the rail
 * has to be able to name. The sign-in screen shows this list nowhere; it uses it only to
 * lay out the prototype's demo accounts.
 */
export const COURT_SIGN_IN_ROLES: CourtRole[] = [
  "magistrate",
  "bench-clerk",
  "scrutiny-officer",
  "typist",
];

/**
 * One court room a staff member can be posted to, named as the rail's foot and a court
 * document head it, with the district it sits in.
 */
export type Courtroom = {
  /** e.g. `JMFC Court 1`. */
  name: string;
  district: string;
};

/** One registered account, as the establishment's directory would return it. */
export type CourtAccount = {
  username: string;
  /** The staff member's name, as the rail's foot reports it. No honorific, no rank. */
  name: string;
  role: CourtRole;
  /**
   * The court rooms this account is mapped to (REG-35). A magistrate, bench clerk or
   * typist sits 1:1 with a bench, so the list is one; a scrutiny officer may cover a
   * whole establishment, so it is several (the PRD's Gujarat case: one officer across
   * five court rooms). Sign-in picks which of these the visit runs as — and a list of
   * one needs no pick (REG-36). Adding or removing a room is a back-end operation, never
   * self-service on this screen (REG-38): the list is read here, not edited.
   */
  courtrooms: Courtroom[];
};

/**
 * This deployment's establishment — the JMFC courts, numbered as the bench names
 * them. Every fixture in the build belongs to Court 1, so it leads any list it is in.
 */
function jmfcCourt(number: number): Courtroom {
  return { name: `JMFC Court ${number}`, district: COURT_DISTRICT };
}

/**
 * The demo directory — one account per seat.
 *
 * The usernames follow the reference screen's own convention (`michaelGeorgeJudge`,
 * `gCmo`): a given name run into the role, no separator. `michaelGeorgeJudge` is kept
 * verbatim from the reference so the account the owner already demos with still works.
 *
 * The names are demo given names like the court beside them, not a claim about who sits
 * on this bench. `Uddipan` is the bench clerk `CURRENT_STAFF` has always run as and
 * `Biju B` is the officer the scrutiny queue already names (`scrutiny/fixtures.ts`), so
 * signing in as either lands on the identity those screens were built around.
 */
export const COURT_ACCOUNTS: Record<CourtRole, CourtAccount> = {
  magistrate: {
    username: "michaelGeorgeJudge",
    name: "Michael George",
    role: "magistrate",
    /* 1:1 with the bench — a magistrate presides over one court room. */
    courtrooms: [jmfcCourt(1)],
  },
  "bench-clerk": {
    username: "uddipanBenchClerk",
    name: CURRENT_STAFF.name,
    role: "bench-clerk",
    courtrooms: [jmfcCourt(1)],
  },
  "scrutiny-officer": {
    username: "bijuScrutinyOfficer",
    name: "Biju B",
    role: "scrutiny-officer",
    /* The one seat that covers many: the officer scrutinises for the whole
       establishment, so the account carries every court room in it. Court 1 leads,
       because that is where this build's cases sit. */
    courtrooms: [
      jmfcCourt(1),
      jmfcCourt(2),
      jmfcCourt(3),
      jmfcCourt(4),
      jmfcCourt(5),
    ],
  },
  typist: {
    username: "sreelathaTypist",
    name: "Sreelatha R",
    role: "typist",
    courtrooms: [jmfcCourt(1)],
  },
};

/**
 * The account a username names, or `undefined` if the directory does not hold it.
 *
 * Case-insensitive: a username is an identifier the court issued, not a password, and a
 * staff member typing `MichaelGeorgeJudge` has not made a mistake worth a dead end.
 */
export function accountFor(username: string): CourtAccount | undefined {
  const typed = username.trim().toLowerCase();
  if (!typed) return undefined;
  return Object.values(COURT_ACCOUNTS).find(
    (account) => account.username.toLowerCase() === typed,
  );
}

/**
 * The court rooms an account may work in, ready for a select.
 *
 * There is no free district-then-court picker any more: a staff member does not choose a
 * posting at the door, they arrive already mapped to one (REG-35), and the district is a
 * fact of the room, not a separate question. So the screen reads the room straight off
 * the account and, where there is more than one, lets them pick which to run as.
 */
export function courtroomsFor(account: CourtAccount | undefined): Courtroom[] {
  return account?.courtrooms ?? [];
}
