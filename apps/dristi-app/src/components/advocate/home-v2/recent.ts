/**
 * Card 6 of draft 2, "Recent cases" (lead designer via owner, 2026-11-19): what you most recently
 * filed or joined, newest first. Pure logic; the card is recent-card.tsx.
 *
 * Filed means it reached scrutiny: signed, paid and sent to the court (owner, 2026-11-19). Drafts
 * and filings still waiting on a signature or a payment are not filed and never appear. So the
 * filed rows are exactly three of the Filings page's own stages, built by its own row builders
 * (lib/filing/queue), so this card and that page always agree:
 *   Pending with scrutiny · Returned from scrutiny · Registered.
 * Joined means you joined it through Join a case.
 */

import type { QueueRow } from "@/lib/filing/queue";

export type RecentKind = "scrutiny" | "returned" | "registered" | "joined";

export type RecentItem = {
  id: string;
  kind: RecentKind;
  /** The case number; empty while the registry hasn't numbered it (a returned filing). */
  ref: string;
  parties: string;
  /** When it happened (YYYY-MM-DD): sent to scrutiny, returned, or joined. */
  on: string;
  href: string;
  bookmarked: boolean;
};

/** How many rows the card shows; the rest are on Cases and Filings. */
export const RECENT_ROWS = 5;

/** The tag on each row, in the Filings page's own stage words. */
export const RECENT_TAG: Record<RecentKind, string> = {
  scrutiny: "Filed · Pending scrutiny",
  returned: "Filed · Returned",
  registered: "Filed · Registered",
  joined: "Joined",
};

/**
 * DEMO DATA. Cases you joined rather than filed, with the day you joined. The case records have no
 * such fact today; in production the backend must say, per advocate and case, whether they filed
 * it or joined it and when they joined (owner, 2026-11-19). Every other running case counts as
 * filed by you, as the Filings page's Registered tab already treats them.
 */
export const DEMO_JOINED: Record<string, string> = {
  "c-1004": "2026-11-17",
  "c-1009": "2026-11-12",
  "c-1012": "2026-11-05",
};

type Source = {
  scrutiny: QueueRow[];
  returned: QueueRow[];
  registered: QueueRow[];
  joined: Record<string, string>;
  /** Case id → bookmarked, from the case records. */
  bookmarked: Record<string, boolean>;
  /** Case id → the day it was sent to scrutiny (its filing date). */
  filedOn: Record<string, string>;
};

/**
 * Every filed or joined item, newest first; ties by id so the order never wobbles. A joined case is
 * only ever "Joined", never also "Filed · Registered".
 */
export function recentItems(src: Source): RecentItem[] {
  const item = (row: QueueRow, kind: RecentKind, on: string): RecentItem => ({
    id: row.id,
    kind,
    /* The Filings page falls back to the task's own id for an unnumbered filing; that is not a
       number anyone would recognise, so it's left empty here. */
    ref: !row.ref || row.ref === row.id.toUpperCase() ? "" : row.ref,
    parties: row.parties,
    on,
    href: row.action.href,
    bookmarked: Boolean(src.bookmarked[row.id]),
  });
  const filed = (rows: QueueRow[], kind: RecentKind) =>
    rows.filter((r) => !(r.id in src.joined)).map((r) => item(r, kind, src.filedOn[r.id] ?? r.recencyAt));
  const joined = [...src.scrutiny, ...src.registered]
    .filter((r) => r.id in src.joined)
    .map((r) => item(r, "joined", src.joined[r.id]));
  return [
    ...filed(src.scrutiny, "scrutiny"),
    /* A returned filing is dated by its return: that is when it came back to you. */
    ...src.returned.map((r) => item(r, "returned", r.recencyAt)),
    ...filed(src.registered, "registered"),
    ...joined,
  ].sort((a, b) => b.on.localeCompare(a.on) || a.id.localeCompare(b.id));
}

/** "Today" · "Yesterday" · "18 Nov" · "4 Aug 2025" (the year only when it isn't this year's). */
export function recentWhen(on: string, today: string): string {
  if (on === today) return "Today";
  const d = new Date(`${on}T00:00:00Z`);
  const t = new Date(`${today}T00:00:00Z`);
  if (t.getTime() - d.getTime() === 86_400_000) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    ...(d.getUTCFullYear() === t.getUTCFullYear() ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(d);
}
