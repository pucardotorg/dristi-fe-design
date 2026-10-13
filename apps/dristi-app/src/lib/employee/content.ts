/**
 * Who is on the court side, and which bench they sit on.
 *
 * The employee area is deliberately self-contained: nothing under `/employee` reads from
 * the citizen side and nothing there reads from here, so the two halves of the app can be
 * built in parallel without colliding.
 *
 * The roles are the judicial and ministerial roles the domain model names for a §138 trial
 * court (`docs/product/domain/actors.md`) — the magistrate takes cognizance and delivers
 * judgment, the bench clerk keeps the daily record and exhibits, the scrutiny officer
 * checks a filed complaint for defects before cognizance. No persona is invented here; who
 * actually logs in is still an open product question (`docs/product/open-questions.md`).
 */

export type CourtRole =
  | "magistrate"
  | "bench-clerk"
  | "scrutiny-officer"
  | "typist";

/**
 * How a role is written where it is shown to the person holding it.
 *
 * These are shortenings, not the model's names. `docs/product/domain/actors.md` calls the
 * first one *Judicial Magistrate of the First Class* — "Magistrate" drops the class, and
 * it can, because in this rail the label sits directly above "JMFC Court 1" and
 * the court supplies what the role leaves out. A label that repeated it would read
 * "Judicial Magistrate of the First Class / JMFC Court 1".
 *
 * Shortened downwards only. Nothing here adds an honorific, a designation or a rank the
 * model does not carry: what a particular establishment calls the person on this bench
 * arrives with the directory that replaces `CURRENT_STAFF`, and inventing it would put a
 * title on a screen that no document, order or record backs up.
 */
export const COURT_ROLE_LABEL: Record<CourtRole, string> = {
  magistrate: "Magistrate",
  "bench-clerk": "Bench clerk",
  "scrutiny-officer": "Scrutiny officer",
  typist: "Typist",
};

/**
 * The seats the court side can be worked from — what the rail's settings control
 * switches between.
 *
 * All four, and it is `COURT_SIGN_IN_ROLES` that decides so: a seat a person can sign in
 * to at `/employee/login` is a seat the rail has to be able to name, and a switcher that
 * offered two of the four would leave a signed-in magistrate looking at a radio group
 * with nothing selected. It used to be two — `magistrate` and `scrutiny-officer` were
 * roles the domain model named that nobody had asked to sit in — and the sign-in is the
 * ask that changed it (owner, 2026-09-14).
 *
 * **`typist` is the owner's word, not the domain model's.** `docs/product/domain/
 * actors.md` names *Stenographer / Interpreter* for the person who records dictation and
 * has no separate typist; the owner asked for that seat by name on 2026-09-07, and an
 * owner naming a role is the one sanctioned source for one. Whether it is the same actor
 * under a court's own vocabulary is an open question for `actors.md`, not something this
 * constant gets to settle.
 *
 * Choosing a seat changes who the rail says you are and **what a row offers** — same
 * rail, same queues, same screens, and nothing granted or hidden: the cause list gives
 * the bench's three session controls to the seat that would use them and the typist a
 * row that ends at its order (`court-role.ts`, `hearings-table.tsx`). That is a view
 * rule and not a permission. What each seat's work actually is beyond the sitting is the
 * feature split that comes next, from product; until then the switch must not pretend to
 * be a different product.
 */
export const COURT_SEATS: CourtRole[] = [
  "magistrate",
  "bench-clerk",
  "scrutiny-officer",
  "typist",
];

/**
 * The identity the court side runs as.
 *
 * The signed-out default, and nothing more. `/employee/login` establishes who the area
 * actually runs as (`session.ts`); this is where it stands before anybody has been
 * through it, and what the server renders and the browser hydrates against. Real
 * authentication replaces both with what the court establishment's directory returns.
 *
 * `role` is where a seat *starts*, not where it stays: the sign-in sets it and the
 * rail's settings control switches between `COURT_SEATS` (`court-role.ts`), and the
 * footer reads the live one. The bench clerk is the default because that is the seat the
 * court side is built for today — the owner's call on 2026-09-07, which moved it off
 * `magistrate`.
 *
 * `name` is a demo given name like the court and the role beside it, not a claim about
 * who sits on this bench; the directory supplies the real one. Nothing keys off it, so
 * it is safe to be wrong.
 */
export const CURRENT_STAFF: { name: string; court: string; role: CourtRole } = {
  name: "Uddipan",
  court: "JMFC Court 1",
  role: "bench-clerk",
};

/** The district this court sits in. A placeholder, like `CURRENT_STAFF`; the court
 * directory supplies the real one. */
export const COURT_DISTRICT = "Sample District";

/**
 * Who signs the order this court passes.
 *
 * Not the person at the keyboard. `CURRENT_STAFF` is the seat working the screen — a
 * bench clerk or a typist — and the order is the magistrate's; the page has to say whose
 * signature it is waiting for, and it is never theirs.
 *
 * **The name is the owner's own reference screen's** (2026-09-14), carried here so the
 * signature block has something to print. The designation is written against
 * `CURRENT_STAFF.court` rather than copied from that reference, which names a differently
 * worded court — one page must not give itself two court names. Fixture, like
 * `CURRENT_STAFF`: the directory that replaces one replaces both, and nothing keys off
 * it.
 */
export const PRESIDING_MAGISTRATE: { name: string; designation: string } = {
  name: "Sri. Anand Krishnan",
  designation: "Judicial Magistrate of the First Class",
};
