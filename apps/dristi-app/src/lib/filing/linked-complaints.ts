/**
 * Complaints a litigant was asked to sign, remembered against their account so the
 * complaint stays on their home after the SMS link has done its job.
 *
 * A complainant who follows a signing link signs in (or registers) and lands on the
 * complaint inside File a case; their home lists it among their cases — before
 * signing, while the filing is under way, and once it is filed. The link is only the
 * way in.
 *
 * Sandbox: kept in this browser's storage, the same session-lite the demo profile uses.
 * A live deployment reads the parties a signed-in person is named as from the backend.
 */

import { writeLocalStorageValue } from "@/hooks/use-local-storage-value";

export const LINKED_COMPLAINTS_KEY = "dristi:linked-complaints";

export type LinkedComplaint = { draftId: string; signatoryId: string };

/** The stored list, from its raw value — never throws on a malformed one. */
export function parseLinkedComplaints(raw: string | null): LinkedComplaint[] {
  try {
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter(
          (x): x is LinkedComplaint =>
            !!x && typeof x.draftId === "string" && typeof x.signatoryId === "string"
        )
      : [];
  } catch {
    return [];
  }
}

export function readLinkedComplaints(): LinkedComplaint[] {
  if (typeof window === "undefined") return [];
  try {
    return parseLinkedComplaints(window.localStorage.getItem(LINKED_COMPLAINTS_KEY));
  } catch {
    return [];
  }
}

export function rememberLinkedComplaint(link: LinkedComplaint): void {
  const current = readLinkedComplaints();
  const next = [
    link,
    ...current.filter((x) => !(x.draftId === link.draftId && x.signatoryId === link.signatoryId)),
  ];
  const value = JSON.stringify(next);
  // Unchanged lists are not written again, so reopening a complaint does not reorder
  // or re-notify anything listening to the key.
  if (value !== JSON.stringify(current)) writeLocalStorageValue(LINKED_COMPLAINTS_KEY, value);
}

/** Where a linked complaint opens: inside File a case, in the signed-in shell. */
export function linkedComplaintHref({ draftId, signatoryId }: LinkedComplaint): string {
  return `/filings/sign-request?draft=${encodeURIComponent(draftId)}&as=${encodeURIComponent(signatoryId)}`;
}
