import type { HistoryEvent } from "@/lib/employee/scrutiny/types"

/**
 * Case history — advocate ↔ registry, append-only.
 *
 * This lives in a right-anchored sheet rather than a tab in the index rail:
 * drawing a mark puts a count badge against that document IN the index, so a
 * tab that displaces the index would hide the officer's own feedback at the
 * moment they generate it. A sheet is a dismissible detour, not an eviction.
 */
export const HISTORY: HistoryEvent[] = [
  { status: "past", title: "Filed", meta: "4 Jul 2026 · Adv. Bijini Rejen" },
  {
    status: "past",
    title: "Routed to scrutiny",
    meta: "4 Jul 2026",
    aiNote: "Filer skipped an AI warning",
  },
  { status: "past", title: "Scrutiny started", meta: "6 Jul 2026 · Biju B" },
  {
    status: "past",
    title: "Sent back with 3 items",
    meta: "7 Jul 2026 · Biju B",
    items: [
      {
        ref: "q-amt",
        what: "Cheque amount · flag",
        was: "₹52,05,000 → ₹50,25,000",
        status: "corrected 13 Jul",
      },
      {
        ref: "c-name",
        what: "Complainant full name · flag",
        was: "Aadhaar address side uploaded",
        status: "answered 13 Jul",
      },
      {
        ref: "d-affidavit",
        what: "Affidavit · re-upload",
        was: "blurred paragraph",
        status: "re-uploaded 13 Jul, still poor",
        open: true,
      },
    ],
  },
  {
    status: "past",
    title: "Resubmitted",
    meta: "13 Jul 2026 · Adv. Bijini Rejen · 2 of 3 items answered",
  },
  { status: "past", title: "Returned to scrutiny", meta: "13 Jul 2026 · 1 item contested" },
  { status: "past", title: "Scrutiny started", meta: "14 Jul 2026 · Biju B" },
  {
    status: "past",
    title: "Sent back with 1 item · round 2",
    meta: "15 Jul 2026 · Biju B",
    items: [
      {
        ref: "d-affidavit",
        what: "Affidavit · re-upload",
        was: "re-scan at 300 dpi",
        status: "re-uploaded 30 Jul, still poor",
        open: true,
      },
    ],
  },
  { status: "past", title: "Resubmitted", meta: "30 Jul 2026 · Adv. Bijini Rejen" },
  { status: "past", title: "Returned to scrutiny", meta: "30 Jul 2026 · 1 item contested" },
  { status: "current", title: "Scrutiny started", meta: "3 Aug 2026 · Biju B" },
]

export const HISTORY_SUMMARY = "3 rounds · 1 item open since 7 Jul"
export const HISTORY_ROUND = 3

/** The one case with a bundle behind it in this prototype. */
export const CASE = {
  filingNo: "F/AHM/2026/00341",
  complainant: "Prateek Agrawal",
  accused: "Deepak Choudhary",
  submitted: "Submitted 4 Jul 2026",
  advocate: "Adv. Bijini Rejen",
}
