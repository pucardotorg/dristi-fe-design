import type {
  FlatField,
  ReturnAnswer,
  ReturnedItem,
  ReturnRound,
} from "@/lib/employee/scrutiny/types";

/**
 * The send-back each resubmitted filing came back from.
 *
 * Fixture data, standing in for the registry service — the same thing the advocate's
 * `Defect` list records on their side (`lib/tasks/types.ts`), seen from the desk that
 * raised it. Keyed by filing no.; a filing with no entry is on its first scrutiny.
 *
 * 00338 carries one item of each answer so every card state can be seen. 00341 is the
 * hand-authored case on round 3: its round-2 send-back named only the affidavit
 * (`history.ts`), and that is what came back.
 */
export const RETURNS: Record<string, ReturnRound> = {
  "F/AHM/2026/00338": {
    round: 2,
    sentBack: "3 Jun 2026",
    sentBackBy: "Biju B",
    resubmitted: "9 Jun 2026",
    resubmittedBy: "Adv. R. Mehta",
    items: [
      {
        fieldId: "q1-amt",
        note: "The cheque reads ₹6,50,000. The amount was filed as ₹6,05,000.",
        was: "₹6,05,000",
        answer: "edited",
        answered: "9 Jun 2026",
      },
      {
        fieldId: "c1-name",
        note: "The name on the Aadhaar card reads “Meenaben Shah”. Correct the name or file proof that both are the same person.",
        was: "Meena Shah",
        answer: "kept",
        reason: "“Ben” is a Gujarati suffix of respect, not part of her legal name. The cheque, the bank account and the vakalatnama all read Meena Shah.",
        answered: "9 Jun 2026",
      },
      {
        fieldId: "d-c1ad",
        note: "The AD card is cut off at the fold, so the date of delivery can’t be read. Upload a clear scan of the whole card.",
        was: "ad-card.jpg · uploaded 1 Jun 2026",
        answer: "replaced",
        answered: "9 Jun 2026",
      },
      /* A long prose correction, so the marked-in-place value can be seen on a
         paragraph and not only on a short amount (Anshumanth, 2026-10-29). */
      {
        fieldId: "p-interim",
        note: "Interim compensation must be prayed for under Section 143A, as a share of the cheque amount not exceeding 20%. The filing asks for a fixed sum.",
        was: "It is, therefore, most respectfully prayed that this Hon'ble Court may be pleased to:\n\nDirect the Accused to pay interim compensation of ₹1,30,000 to the Complainant during the pendency of the trial, within 60 days of the order.",
        answer: "edited",
        answered: "9 Jun 2026",
      },
    ],
  },
  "F/AHM/2026/00341": {
    round: 3,
    sentBack: "15 Jul 2026",
    sentBackBy: "Biju B",
    resubmitted: "30 Jul 2026",
    resubmittedBy: "Adv. Bijini Rejen",
    items: [
      {
        fieldId: "d-affidavit",
        note: "Paragraph 4 of the signed affidavit is still blurred. Re-scan the signed copy at 300 dpi.",
        was: "signed-complaint.pdf · re-uploaded 13 Jul 2026",
        answer: "replaced",
        answered: "30 Jul 2026",
      },
    ],
  },
};

export function returnRoundFor(filingNo: string): ReturnRound | null {
  return RETURNS[filingNo] ?? null;
}

/** How the advocate's answer reads on the officer's side, in the advocate side's terms. */
export const ANSWER_LABEL: Record<ReturnAnswer, string> = {
  edited: "Corrected",
  kept: "Kept as filed",
  replaced: "Re-uploaded",
};

/**
 * Bundle doc id → the returned item that replaced it this round — the documents that get
 * their previous upload beside them in the bundle and a mark in the index.
 */
export function replacedDocs(
  round: ReturnRound | null,
  fieldById: Record<string, FlatField>,
): Record<string, ReturnedItem> {
  const byDoc: Record<string, ReturnedItem> = {};
  for (const item of round?.items ?? []) {
    const docId = fieldById[item.fieldId]?.docrow;
    if (item.answer === "replaced" && docId) byDoc[docId] = item;
  }
  return byDoc;
}

/**
 * The bundle documents behind the returned items — what the Changes tab shows in the
 * bundle and the index, instead of the whole bundle again (owner, 2026-10-28). A value
 * row brings the document it was read from; a document row brings itself.
 */
export function returnedDocIds(
  round: ReturnRound | null,
  fieldById: Record<string, FlatField>,
): string[] {
  const ids: string[] = [];
  for (const item of round?.items ?? []) {
    const field = fieldById[item.fieldId];
    const docId = field?.docrow ?? field?.doc ?? field?.thumb;
    if (docId && !ids.includes(docId)) ids.push(docId);
  }
  return ids;
}
