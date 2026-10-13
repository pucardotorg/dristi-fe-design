/**
 * Witness applications already sent to the magistrate — authored seeds, so
 * the Parties list can demo the waiting state without adding one first
 * (owner, Sept 3): the name rides the Witnesses group greyed with an
 * "Awaiting order" tag, and joins the register proper only when the order
 * passes. Own side only by construction — an advocate never sees the other
 * side's unheard applications, so seeds are authored for the viewer's own
 * chair on that case.
 *
 * Session-local additions from the Add-witnesses flow land in the same rows
 * via `parties-live.tsx`; the real record of a pending application is the
 * applications service, which replaces both when it lands.
 */
export const PENDING_WITNESSES: Record<string, string[]> = {
  /* Complainant side (the viewer's chair on c-1001). */
  "c-1001": ["Sreejith Nair"],
  /* tw-c-hd2 seats the viewer on the accused side — a designation-only
     witness, the identity rule's other half. */
  "tw-c-hd2": ["Bank Manager, SBI"],
};

export function pendingWitnessesFor(caseId: string): string[] {
  return PENDING_WITNESSES[caseId] ?? [];
}
