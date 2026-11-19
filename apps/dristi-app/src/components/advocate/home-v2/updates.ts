/**
 * Card 4 of draft 2, "Updates on your cases" (owner, 2026-11-19): what changed on your cases since
 * yesterday, one update at a time in a carousel, with the full list a tap or click away.
 * Pure logic and demo data; the card is updates-card.tsx. Draft 1's data is left untouched.
 */

import { caseSectionHref } from "@/lib/cases/sections";
import { CASES } from "@/lib/cases/fixtures";
import type { OverviewUpdateCategory } from "@/lib/cases/overview";

export type CaseUpdate = {
  id: string;
  caseId: string;
  /** The registered number, from the case's own record. */
  caseNumber: string;
  /** The same categories, and the same grey badge, as each case's own updates (case overview). */
  category: OverviewUpdateCategory;
  /** "Sunil Varghese v. Anand Traders", from the case's own record. */
  caseTitle: string;
  /**
   * What happened, in one line.
   *
   * DEMO TEXT. In production this is the case event's own heading from the case history, word
   * for word, so Home and the case page always say the same thing. Home must read these from the
   * case event feed and never keep its own copy (owner, 2026-11-19).
   */
  what: string;
  /** When it happened (ISO). */
  at: string;
  /** From the case's own record: a bookmarked case's updates come first. */
  bookmarked: boolean;
};

/** The carousel shows at most this many; the rest are in the full list (owner, 2026-11-19). */
export const SLIDE_CAP = 10;
/** Each slide stays this long before the next (owner, 2026-11-19). */
export const SLIDE_MS = 4500;

/** Bookmarked first, then newest; ties by id so the order never wobbles. */
export function orderUpdates(updates: CaseUpdate[]): CaseUpdate[] {
  return [...updates].sort(
    (a, b) => Number(b.bookmarked) - Number(a.bookmarked) || b.at.localeCompare(a.at) || a.id.localeCompare(b.id),
  );
}

/** The carousel's slides: the first SLIDE_CAP of the ordered list. */
export function slidesOf(updates: CaseUpdate[]): CaseUpdate[] {
  return orderUpdates(updates).slice(0, SLIDE_CAP);
}

/**
 * The full list. Opened from a slide, that update stands apart on top and the rest follow in the
 * usual order (bookmarked first, then newest), so the order the list states stays true (owner,
 * 2026-11-19). Opened from the count, everything is in the usual order.
 */
export function splitFrom(updates: CaseUpdate[], openedId?: string): { opened?: CaseUpdate; rest: CaseUpdate[] } {
  const ordered = orderUpdates(updates);
  const opened = ordered.find((u) => u.id === openedId);
  return { opened, rest: opened ? ordered.filter((u) => u.id !== openedId) : ordered };
}

/** Where an update opens: its case's history. */
export function updateHref(u: CaseUpdate): string {
  return caseSectionHref(u.caseId, "case-history");
}

/** "Today, 9:20 am" · "Yesterday, 4:05 pm" · "Tue, 17 Nov". */
export function whenLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dayStart(now) - dayStart(d)) / 86_400_000);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(d).toLowerCase();
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(d);
}

/* ── Demo ─────────────────────────────────────────────────────────────────── */

/** Demo updates since yesterday, on real demo cases (titles and bookmarks from their records). */
const DEMO: { id: string; caseId: string; category: OverviewUpdateCategory; what: string; hoursAgo: number }[] = [
  { id: "u01", caseId: "c-1005", category: "Orders", what: "Objection invited on the discharge application, due Mon, 23 Nov", hoursAgo: 1 },
  { id: "u02", caseId: "c-1001", category: "Process", what: "Summons served on the accused", hoursAgo: 3 },
  { id: "u03", caseId: "c-1010", category: "Orders", what: "Adjournment application rejected", hoursAgo: 20 },
  { id: "u04", caseId: "c-1002", category: "Hearing", what: "Next hearing set for Thu, 3 Dec", hoursAgo: 2 },
  { id: "u05", caseId: "c-1007", category: "Orders", what: "Bail bond accepted", hoursAgo: 4 },
  { id: "u06", caseId: "c-1003", category: "Orders", what: "Order uploaded: cognizance taken", hoursAgo: 5 },
  { id: "u07", caseId: "c-1012", category: "Hearing", what: "Accused entered appearance", hoursAgo: 6 },
  { id: "u08", caseId: "c-1004", category: "Parties", what: "Vakalatnama accepted for the accused", hoursAgo: 18 },
  { id: "u09", caseId: "c-1009", category: "Hearing", what: "Plea recorded", hoursAgo: 22 },
  { id: "u10", caseId: "c-1006", category: "Process", what: "Process fee paid for summons", hoursAgo: 24 },
  { id: "u11", caseId: "c-1011", category: "Submissions", what: "Application for production of documents submitted", hoursAgo: 26 },
  { id: "u12", caseId: "c-1013", category: "Filing", what: "Case registered as CMP/1690/2026", hoursAgo: 28 },
  { id: "u13", caseId: "c-1008", category: "Process", what: "Witness summons issued to PW-2", hoursAgo: 30 },
  { id: "u14", caseId: "c-1014", category: "Hearing", what: "Hearing held; evidence of complainant part-heard", hoursAgo: 32 },
];

export function demoUpdates(now: Date): CaseUpdate[] {
  return DEMO.map((d) => {
    const c = CASES.find((x) => x.id === d.caseId);
    return {
      id: d.id,
      caseId: d.caseId,
      caseNumber: c?.caseNumber ?? d.caseId,
      category: d.category,
      caseTitle: c ? `${c.parties.complainant} v. ${c.parties.accused}` : d.caseId,
      what: d.what,
      at: new Date(now.getTime() - d.hoursAgo * 3_600_000).toISOString(),
      bookmarked: Boolean(c?.bookmarked),
    };
  });
}
