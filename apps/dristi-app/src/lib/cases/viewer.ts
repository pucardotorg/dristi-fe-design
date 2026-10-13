/**
 * The signed-in advocate, as the case screens need them.
 *
 * A demo identity, matched by name against each case's counsel — the same
 * convention the access surfaces use (their SELF is "Adv. Anjali Nair").
 * The real seam is the session: engineering swaps this for the signed-in
 * user's id and a membership lookup, and the screens do not change.
 */

import { counselFor, type CaseRecord, type CounselSide } from "./types";

const VIEWER_NAME = "Anjali Nair";

/**
 * The clerk in the signed-in advocate's office: who the clerk profile acts
 * as (Application Lifecycle PRD, "Clerk and Junior Advocate"). A demo
 * identity like the advocate's.
 */
export const VIEWER_CLERK_NAME = "Vinod Kumar";

/**
 * Is this counsel name the signed-in advocate? The party screens use it to
 * render the viewer's own row as a fact ("you") rather than a target of the
 * removal actions — you do not remove yourself from a case you are reading.
 */
export function isViewer(name: string): boolean {
  return name.includes(VIEWER_NAME);
}

/** The sides this case's record lists the viewer as counsel for. */
export function viewerSides(record: CaseRecord): CounselSide[] {
  return (["complainant", "accused"] as const).filter((side) =>
    counselFor(record, side).some((name) => name.includes(VIEWER_NAME))
  );
}

/**
 * How the viewer reaches this case: on a vakalatnama, or through office
 * access a colleague shared. Office access always belongs to one side's
 * team (owner, Sept 2), so both shapes carry a side.
 */
export type ViewerAccess =
  | { kind: "vakalatnama"; sides: CounselSide[] }
  | { kind: "office"; side: CounselSide; via: string };

export function viewerAccess(record: CaseRecord): ViewerAccess {
  const sides = viewerSides(record);
  if (sides.length > 0) return { kind: "vakalatnama", sides };
  /* Not on the record's nama, so the case reaches the viewer through a
     share. The sharer is the side's lead advocate on record — the person
     who holds the vakalatnama and can share (access model, Aug 20). The
     fixtures carry no accused-side shares yet; author `via`/`side` per
     case here when one is wanted. */
  const via = counselFor(record, "complainant")[0];
  return { kind: "office", side: "complainant", via: via ?? "a colleague" };
}

/** The side the viewer works for — never empty; see `ViewerAccess`. */
export function viewerRepresentation(record: CaseRecord): CounselSide[] {
  const access = viewerAccess(record);
  return access.kind === "vakalatnama" ? access.sides : [access.side];
}
