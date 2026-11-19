/**
 * Card 1 of draft 2, "Your hearings" (owner design, 2026-11-18; lead designer review 2026-11-19).
 * One line per court, read left to right: item 1, everything heard folded into one dotted line,
 * the live item (on one column across every court), then the items to come folded around yours,
 * ending on the list's last item. Pure logic: no React, tested in hearings-today.test.ts.
 */

export type HearingMine = {
  item: number;
  bookmarked?: boolean;
  /** Tasks still open for this hearing. Shown red: do them before the item is called. */
  pending?: number;
};

export type CourtHearings = {
  court: string;
  /** The item being heard now; 0 when the court has not sat yet. */
  now: number;
  /** The list's size (its last item number). */
  last: number;
  mine: HearingMine[];
};

/** Demo day: 7 courts, so the card shows 3 and keeps 4 behind "Show all". */
export const DEMO_COURTS: CourtHearings[] = [
  /* A crowded list with your items spread out: folding has to tighten to fit. */
  { court: "Sessions Court", now: 30, last: 70, mine: [{ item: 32 }, { item: 44, pending: 2 }, { item: 57, bookmarked: true }] },
  { court: "24×7 ON Court", now: 20, last: 50, mine: [{ item: 23, bookmarked: true }, { item: 24 }, { item: 25, bookmarked: true }, { item: 31 }] },
  { court: "CJM Court", now: 20, last: 50, mine: [{ item: 22, bookmarked: true, pending: 1 }, { item: 27, bookmarked: true }] },
  { court: "ACJM Court", now: 17, last: 50, mine: [{ item: 19, bookmarked: true, pending: 2 }, { item: 20 }] },
  { court: "Additional Chief Judicial Magistrate Court No. 2", now: 0, last: 25, mine: [{ item: 7, bookmarked: true }] },
  { court: "Family Court", now: 4, last: 22, mine: [{ item: 16, pending: 1 }] },
  /* Lead designer (2026-11-19): a 9-item list is unrealistic; 20 is a normal day. */
  { court: "Motor Accidents Tribunal", now: 3, last: 20, mine: [{ item: 6 }] },
];

/**
 * Demo next working day: nothing has sat yet, so every court is "not started" (now 0).
 * Different lists from today's, as a real next day would be.
 */
export const DEMO_NEXT_COURTS: CourtHearings[] = [
  { court: "Sessions Court", now: 0, last: 64, mine: [{ item: 12 }, { item: 40, pending: 1 }] },
  { court: "24×7 ON Court", now: 0, last: 45, mine: [{ item: 5, bookmarked: true }, { item: 6 }, { item: 21 }] },
  { court: "CJM Court", now: 0, last: 48, mine: [{ item: 8, pending: 2 }, { item: 33, bookmarked: true }] },
  { court: "ACJM Court", now: 0, last: 40, mine: [{ item: 14, bookmarked: true, pending: 1 }] },
  { court: "Family Court", now: 0, last: 24, mine: [{ item: 3 }] },
];

/**
 * Makes a court safe to draw, whatever the feed sends: your items sorted, deduplicated, and never
 * dropped (an item past the list's end stretches the list to it); `now` kept between 0 and the end.
 */
export function normalizeCourt(c: CourtHearings): CourtHearings {
  const seen = new Set<number>();
  const mine = [...c.mine]
    .filter((m) => Number.isInteger(m.item) && m.item >= 1 && !seen.has(m.item) && (seen.add(m.item), true))
    .sort((a, b) => a.item - b.item);
  const last = Math.max(1, Math.floor(c.last) || 0, ...mine.map((m) => m.item));
  const now = Math.min(Math.max(0, Math.floor(c.now) || 0), last);
  return { ...c, now, last, mine };
}

/** Your hearings across the day's courts (each of your items is one hearing). */
export function hearingCount(courts: CourtHearings[]) {
  return courts.reduce((n, c) => n + c.mine.length, 0);
}

/**
 * The next working day after `from`. Main has no court holiday calendar yet, so the demo skips
 * Saturdays and Sundays only; a holiday list would plug in here.
 */
export function nextWorkingDay(from: Date) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

/** Whether `next` is the calendar day after `from` (then the menu says "Tomorrow"). */
export function isTomorrow(from: Date, next: Date) {
  const t = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  return next.getFullYear() === t.getFullYear() && next.getMonth() === t.getMonth() && next.getDate() === t.getDate();
}

/** "Thu, 19 Nov". */
export function shortDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(d);
}

/**
 * Courts in session first, courts not started after (owner, 2026-11-19). Within each group:
 * most of your hearings first; a tie goes to the court that reaches your next item sooner.
 * A court where all your items are already heard has nothing coming: it goes last in its group.
 */
export function orderCourts(courts: CourtHearings[]): CourtHearings[] {
  /* Your next item still to be heard (the live one counts: wait 0). Mine is sorted by normalizeCourt. */
  const wait = (c: CourtHearings) => {
    const next = c.mine.find((m) => m.item >= c.now);
    return next ? next.item - c.now : Infinity;
  };
  const started = (c: CourtHearings) => (c.now ? 0 : 1);
  /* Two courts with nothing left for you both wait Infinity: equal, not NaN. */
  const byNumber = (x: number, y: number) => (x === y ? 0 : x - y);
  return courts
    .map(normalizeCourt)
    .sort((a, b) => started(a) - started(b) || b.mine.length - a.mine.length || byNumber(wait(a), wait(b)));
}

/* ── The line ─────────────────────────────────────────────────────────────── */

/** Fewer hidden items than this stay as dots: a fold must stand for at least 3 items. */
export const BAR_MIN = 3;
/** Room a folded stretch takes at its shortest, counted in dots. */
export const BAR_COST = 3;

export type TrackPart =
  | {
      kind: "dot";
      item: number;
      state: "heard" | "upcoming";
      mine?: HearingMine;
      /** Shows its number under it: item 1, the list's last, and yours. */
      label?: boolean;
    }
  | {
      kind: "bar";
      from: number;
      to: number;
      state: "heard" | "upcoming";
      /** The stretch its hover names, counting the plain dots it joins ("Items 28 to 50"). */
      span: { from: number; to: number };
    };

/** Room a stretch of parts needs, in dots. */
export const cost = (parts: TrackPart[]) => parts.reduce((n, p) => n + (p.kind === "bar" ? BAR_COST : 1), 0);

export type CourtLine = {
  /** Left of the live column: dot 1, then one dotted line through everything heard. */
  heard: TrackPart[];
  /** The live item (0 = not in session), and yours if it is the one being heard. */
  live: { item: number; mine?: HearingMine };
  /** Right of the live column (or the whole line before the court sits): items to come. */
  ahead: TrackPart[];
  /** Your items already heard, folded into the heard line (named in its hover). */
  heardMine: number[];
};

/**
 * A court's line for a given room (`budget` = how many dots fit the "ahead" side).
 * Heard: everything before the live item folds into one line from item 1 (yours included: done is
 * done; an item passed over and called again shows on the right when the feed says so).
 * Ahead: shown in full if it fits; else folded, keeping the queue up to your next item; else
 * keeping only your items with one plain dot either side, and the list's last item.
 * A row with nothing worth folding spreads its dots instead (the card picks that).
 */
export function courtLine(raw: CourtHearings, budget: number): CourtLine {
  const c = normalizeCourt(raw);
  const mineAt = new Map(c.mine.map((m) => [m.item, m]));
  const heardMine = c.mine.filter((m) => c.now && m.item < c.now).map((m) => m.item);
  const heard: TrackPart[] =
    c.now > 2
      ? [
          { kind: "dot", item: 1, state: "heard", label: true },
          { kind: "bar", from: 2, to: c.now - 1, state: "heard", span: { from: 1, to: c.now - 1 } },
        ]
      : c.now === 2
        ? [{ kind: "dot", item: 1, state: "heard", label: true }]
        : [];

  const from = c.now ? c.now + 1 : 1;
  const anchors = new Set<number>([c.last]);
  if (!c.now) anchors.add(1);
  const upcomingMine = c.mine.filter((m) => m.item >= from).map((m) => m.item);
  for (const m of upcomingMine) for (const i of [m - 1, m, m + 1]) if (i >= from && i <= c.last) anchors.add(i);
  const withQueue = new Set(anchors);
  if (upcomingMine.length) for (let i = from; i <= upcomingMine[0]; i++) withQueue.add(i);
  const everything = new Set<number>();
  for (let i = from; i <= c.last; i++) everything.add(i);

  let ahead: TrackPart[] | undefined;
  let fits: TrackPart[] | undefined;
  if (from <= c.last) {
    for (const keep of [everything, withQueue, anchors]) {
      const parts = lay(c, from, keep, mineAt);
      if (cost(parts) > budget) continue;
      if (parts.some((p) => p.kind === "bar")) {
        ahead = parts;
        break;
      }
      fits ??= parts;
    }
  }
  return {
    heard,
    live: { item: c.now, mine: c.now ? mineAt.get(c.now) : undefined },
    ahead: ahead ?? fits ?? (from <= c.last ? lay(c, from, anchors, mineAt) : []),
    heardMine,
  };
}

/** Lays items `from`..last: kept items as dots, hidden runs as dotted lines (runs under BAR_MIN stay dots). */
function lay(c: CourtHearings, from: number, kept: Set<number>, mineAt: Map<number, HearingMine>): TrackPart[] {
  const keep = new Set(kept);
  let i = from;
  while (i <= c.last) {
    if (keep.has(i)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 <= c.last && !keep.has(j + 1)) j++;
    if (j - i + 1 < BAR_MIN) for (let k = i; k <= j; k++) keep.add(k);
    i = j + 1;
  }
  const parts: TrackPart[] = [];
  i = from;
  while (i <= c.last) {
    if (keep.has(i)) {
      const mine = mineAt.get(i);
      parts.push({ kind: "dot", item: i, state: "upcoming", mine, label: Boolean(mine) || i === c.last || i === 1 });
      i++;
      continue;
    }
    let j = i;
    while (j + 1 <= c.last && !keep.has(j + 1)) j++;
    parts.push({ kind: "bar", from: i, to: j, state: "upcoming", span: { from: i, to: j } });
    i = j + 1;
  }
  /* A dotted line reads together with the plain dots it joins (28 ····· 50 reads "28 to 50"). */
  parts.forEach((p, k) => {
    if (p.kind !== "bar") return;
    const before = parts[k - 1];
    const after = parts[k + 1];
    p.span = {
      from: before?.kind === "dot" && !before.mine ? before.item : p.from,
      to: after?.kind === "dot" && !after.mine ? after.item : p.to,
    };
  });
  return parts;
}
