/**
 * Marking a document as evidence (Document Submission PRD, DSB-12 to DSB-14,
 * DSB-20), kept for this visit like every demo step (`demo-session.ts`).
 *
 * A member of the court with the Evidence marker role picks a side, P for
 * the prosecution (the complainant's side) or D for the defence (the
 * accused's), and the document takes that side's next number in the case:
 * P1, P2… and, separately, D1, D2…. The court has no series of its own. The
 * number is shown in place of the document's DOC-n, which it keeps (DSB-15).
 */

import { readSessionValue, writeSessionValue } from "./demo-session";

export type EvidenceSide = "P" | "D";

export const EVIDENCE_SIDES: { id: EvidenceSide; label: string }[] = [
  { id: "P", label: "Prosecution (P)" },
  { id: "D", label: "Defence (D)" },
];

/** Document id → evidence number, for one case. */
export type EvidenceMarks = Record<string, string>;

export function evidenceMarksKey(caseId: string): string {
  return `dristi-demo-evidence-marks:${caseId}`;
}

export function parseEvidenceMarks(raw: string | null): EvidenceMarks {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? (value as EvidenceMarks) : {};
  } catch {
    return {};
  }
}

/**
 * The side's next number, after every number already given in the case
 * (DSB-14). Counted from the highest, so a gap in the demo's numbers is not
 * filled twice.
 */
export function nextEvidenceNumber(
  taken: (string | null | undefined)[],
  side: EvidenceSide
): string {
  const highest = taken.reduce((max, number) => {
    const match = number ? new RegExp(`^${side}(\\d+)$`).exec(number) : null;
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${side}${highest + 1}`;
}

/** Mark it; a document is marked once. */
export function markEvidence(caseId: string, documentId: string, number: string): void {
  const key = evidenceMarksKey(caseId);
  const marks = parseEvidenceMarks(readSessionValue(key));
  if (marks[documentId]) return;
  writeSessionValue(key, JSON.stringify({ ...marks, [documentId]: number }));
}
