import type { BulkSignMethod } from "@/lib/bulk/types";

/**
 * A round of bulk signing that is out but not finished: who has signed so far. Kept in
 * this browser (not the tab), so it survives a reload and the batch list can show a batch
 * waiting on another party. Keeping it on the server, for a second device, is the
 * backend's (round-3 audit, UX-24).
 */
export type Round = {
  caseIds: string[];
  method: BulkSignMethod;
  /** Other parties sent their link. */
  sent: boolean;
  /** Signer ids that have signed (you, by OTP or DSC, or by uploading the signed copies). */
  signed: string[];
};

const KEY = (batchId: string) => `dristi.bulk.signing.${batchId}`;

export function readRound(batchId: string): Round | null {
  try {
    const raw = window.localStorage.getItem(KEY(batchId));
    return raw ? (JSON.parse(raw) as Round) : null;
  } catch {
    return null;
  }
}

export function writeRound(batchId: string, round: Round | null) {
  try {
    if (round) window.localStorage.setItem(KEY(batchId), JSON.stringify(round));
    else window.localStorage.removeItem(KEY(batchId));
  } catch {
    /* Blocked storage only means the round lasts as long as the page. */
  }
}

/** A round still waiting on someone other than you, for the batch list. */
export function waitingOnOthers(batchId: string): boolean {
  const r = readRound(batchId);
  return !!r && r.sent && r.signed.length > 0;
}
