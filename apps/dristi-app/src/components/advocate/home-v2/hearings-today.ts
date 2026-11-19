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
  /** The court has finished its list for the day (risen). Needs a feed signal; demo only for now. */
  finished?: boolean;
};

/**
 * Where a court is in its day.
 * - live: sitting, and an item of yours is still to come (or being heard)
 * - done: sitting, but all your items there are already heard ("Done" tag)
 * - notStarted: has not sat yet ("Not started" tag, today only)
 * - finished: finished its list for the day ("Finished" tag)
 */
export type CourtStatus = "live" | "done" | "notStarted" | "finished";

export function courtStatus(c: CourtHearings): CourtStatus {
  if (c.finished) return "finished";
  if (!c.now) return "notStarted";
  return c.mine.length && c.mine.every((m) => m.item < c.now) ? "done" : "live";
}

/** Demo day: 9 courts, so the card shows 3 and keeps 6 behind "Show more courts". */
export const DEMO_COURTS: CourtHearings[] = [
  /* A crowded list with your items spread out: folding has to tighten to fit. */
  /* Owner, 2026-11-19: courts where your item is the one being heard: Sessions ready, ACJM with tasks pending. */
  { court: "Sessions Court", now: 30, last: 70, mine: [{ item: 30 }, { item: 32 }, { item: 44, pending: 2 }, { item: 57, bookmarked: true }] },
  { court: "24×7 ON Court", now: 20, last: 50, mine: [{ item: 23, bookmarked: true }, { item: 24 }, { item: 25, bookmarked: true }, { item: 31 }] },
  { court: "CJM Court", now: 20, last: 50, mine: [{ item: 22, bookmarked: true, pending: 1 }, { item: 27, bookmarked: true }] },
  { court: "ACJM Court", now: 17, last: 50, mine: [{ item: 17, pending: 2 }, { item: 19, bookmarked: true, pending: 2 }, { item: 20 }] },
  { court: "Additional Chief Judicial Magistrate Court No. 2", now: 0, last: 25, mine: [{ item: 7, bookmarked: true }] },
  { court: "Family Court", now: 4, last: 22, mine: [{ item: 16, pending: 1 }] },
  /* Lead designer (2026-11-19): a 9-item list is unrealistic; 20 is a normal day. */
  { court: "Motor Accidents Tribunal", now: 3, last: 20, mine: [{ item: 6 }] },
  /* Owner, 2026-11-19: all your items heard while the court sits → "Done" tag. */
  { court: "JFCM Court", now: 35, last: 40, mine: [{ item: 12 }] },
  /* Owner, 2026-11-19: a court that has finished → full line, "Finished" tag, sorted last. */
  { court: "Additional Sessions Court", now: 28, last: 28, mine: [{ item: 3 }, { item: 9 }, { item: 14 }, { item: 20 }, { item: 25 }], finished: true },
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
  /* A finished court has heard its whole list. */
  const now = c.finished ? last : Math.min(Math.max(0, Math.floor(c.now) || 0), last);
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
 * Courts in session first, then courts not started, then finished courts (owner, 2026-11-19).
 * Within each group: most of your hearings first; a tie goes to the court that reaches your next
 * item sooner. A sitting court where all your items are heard ("Done") goes last among the sitting.
 */
export function orderCourts(courts: CourtHearings[]): CourtHearings[] {
  /* Your next item still to be heard (the live one counts: wait 0). Mine is sorted by normalizeCourt. */
  const wait = (c: CourtHearings) => {
    const next = c.mine.find((m) => m.item >= c.now);
    return next ? next.item - c.now : Infinity;
  };
  const started = (c: CourtHearings) => (c.finished ? 2 : c.now ? 0 : 1);
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
      /** B1 fix 1: a short 8px dotted gap between two of your rings on a crowded row. */
      tight?: boolean;
    }
  | {
      /** B1 fix 2: "+N", your items that don't fit, and everything from there to before the last. */
      kind: "more";
      from: number;
      to: number;
      mine: HearingMine[];
    };

/** Room a stretch of parts needs, in dots, counting folds generously (picks how much to fold). */
export const cost = (parts: TrackPart[]) =>
  parts.reduce((n, p) => n + (p.kind === "more" ? 3 : p.kind === "bar" ? (p.tight ? 0.5 : BAR_COST) : 1), 0);

/**
 * The least room a stretch can take once the card squeezes it, in dots (24px each), at the card's
 * real minimum sizes: gaps close to 0; a plain dot shrinks to 8px; a numbered dot or ring stays
 * 16px; a fold 24px; a tight gap 8px; "+N" about 28px chip + 2px + 24px line. B1's fixes step in
 * only when even this doesn't fit, so a normal day keeps every ring.
 */
export const squeezedCost = (parts: TrackPart[]) =>
  parts.reduce(
    (n, p) =>
      n +
      (p.kind === "more" ? 54 : p.kind === "bar" ? (p.tight ? 8 : 24) : p.mine || p.label ? 16 : 8) / 24,
    0,
  );

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
export function courtLine(raw: CourtHearings, room: number): CourtLine {
  /* `room` may be fractional (the measured width in dots). Folding works in whole dots, as it
     always has; only B1's exact check uses the fraction. */
  const budget = Math.floor(room);
  const c = normalizeCourt(raw);
  const mineAt = new Map(c.mine.map((m) => [m.item, m]));
  /* Finished: the whole list is heard. One line across the row, 1 to last, with YOUR items on it
     as grey rings, as many as fit (owner, 2026-11-19: your items, not arbitrary ones). Any that
     don't fit stay inside a dotted stretch whose hover names them ("includes your 20, 25"). */
  if (c.finished) {
    let k = c.mine.length;
    let heard = finishedLine(c, k, mineAt);
    while (k > 0 && cost(heard) > budget) heard = finishedLine(c, --k, mineAt);
    const shown = new Set(heard.filter((p) => p.kind === "dot" && p.mine).map((p) => (p.kind === "dot" ? p.item : 0)));
    return { heard, live: { item: 0 }, ahead: [], heardMine: c.mine.map((m) => m.item).filter((i) => !shown.has(i)) };
  }
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
  let line = ahead ?? fits ?? (from <= c.last ? lay(c, from, anchors, mineAt) : []);
  /* Many of your items in one court, and even the tightest fold won't fit (owner, 2026-11-19):
     fix 1, your rings close up with only a short dotted gap between them; fix 2, if that still
     doesn't fit (phones), the rings that fit and then "+N" for the rest. */
  if (squeezedCost(line) > room && upcomingMine.length > 1) {
    line = tight(c, from, upcomingMine, mineAt);
    for (let k = upcomingMine.length - 1; squeezedCost(line) > room && k >= 1; k--) {
      line = withMore(c, from, upcomingMine, mineAt, k);
    }
  }
  return {
    heard,
    live: { item: c.now, mine: c.now ? mineAt.get(c.now) : undefined },
    ahead: line,
    heardMine,
  };
}

/**
 * A finished court's heard line: 1, `k` of your items spread across the ones you have, the last;
 * dotted stretches between. Runs shorter than BAR_MIN stay as dots.
 */
function finishedLine(c: CourtHearings, k: number, mineAt: Map<number, HearingMine>): TrackPart[] {
  const yours = c.mine.map((m) => m.item);
  const pick =
    k >= yours.length ? yours : k <= 0 ? [] : k === 1 ? [yours[Math.floor((yours.length - 1) / 2)]] : Array.from({ length: k }, (_, i) => yours[Math.round((i * (yours.length - 1)) / (k - 1))]);
  const points = [...new Set<number>([1, c.last, ...pick])].sort((a, b) => a - b);
  const parts: TrackPart[] = [];
  points.forEach((item, i) => {
    const mine = pick.includes(item) ? mineAt.get(item) : undefined;
    parts.push({ kind: "dot", item, state: "heard", mine, label: Boolean(mine) || item === 1 || item === c.last });
    const next = points[i + 1];
    if (next === undefined || next - item < 2) return;
    if (next - item - 1 < BAR_MIN) {
      for (let j = item + 1; j < next; j++) parts.push({ kind: "dot", item: j, state: "heard" });
    } else {
      /* The hover counts the plain end dots it joins, not your rings. */
      const nextMine = pick.includes(next);
      parts.push({ kind: "bar", from: item + 1, to: next - 1, state: "heard", span: { from: mine ? item + 1 : item, to: nextMine ? next - 1 : next } });
    }
  });
  return parts;
}

/** Fix 1: keep your items, one plain dot before the first and after the last, and the list's last. */
function tight(c: CourtHearings, from: number, upcoming: number[], mineAt: Map<number, HearingMine>): TrackPart[] {
  const keep = new Set<number>([c.last, ...upcoming]);
  if (!c.now) keep.add(1);
  const first = upcoming[0];
  const lastMine = upcoming[upcoming.length - 1];
  if (first - 1 >= from) keep.add(first - 1);
  if (lastMine + 1 <= c.last) keep.add(lastMine + 1);
  return lay(c, from, keep, mineAt, { tightBetween: [first, lastMine] });
}

/** Fix 2: your first `k` items as in fix 1, then "+N" holding the rest up to before the last. */
function withMore(c: CourtHearings, from: number, upcoming: number[], mineAt: Map<number, HearingMine>, k: number): TrackPart[] {
  const shown = upcoming.slice(0, k);
  const hidden = upcoming.slice(k);
  const lastShown = shown[shown.length - 1];
  const head = tight(c, from, shown, mineAt).filter((p) => (p.kind === "dot" ? p.item <= lastShown : p.to < lastShown));
  const moreFrom = lastShown + 1;
  const moreTo = c.last - 1;
  /* The last item is one of yours: it is hidden in "+N" too, so the line ends on the chip. */
  if (hidden[hidden.length - 1] === c.last) {
    return [...head, { kind: "more", from: moreFrom, to: c.last, mine: hidden.map((i) => mineAt.get(i)!) }];
  }
  return [
    ...head,
    { kind: "more", from: moreFrom, to: moreTo, mine: hidden.map((i) => mineAt.get(i)!) },
    { kind: "dot", item: c.last, state: "upcoming", label: true },
  ];
}

/** Lays items `from`..last: kept items as dots, hidden runs as dotted lines (runs under BAR_MIN stay dots). */
function lay(
  c: CourtHearings,
  from: number,
  kept: Set<number>,
  mineAt: Map<number, HearingMine>,
  { tightBetween }: { tightBetween?: [number, number] } = {},
): TrackPart[] {
  const keep = new Set(kept);
  /* Fix 1: a run between two of your rings folds into a tight gap, however short. */
  const isTight = (i: number, j: number) =>
    Boolean(tightBetween) && i > tightBetween![0] && j < tightBetween![1] && mineAt.has(i - 1) && mineAt.has(j + 1);
  let i = from;
  while (i <= c.last) {
    if (keep.has(i)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 <= c.last && !keep.has(j + 1)) j++;
    if (j - i + 1 < BAR_MIN && !isTight(i, j)) for (let k = i; k <= j; k++) keep.add(k);
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
    parts.push({ kind: "bar", from: i, to: j, state: "upcoming", span: { from: i, to: j }, ...(isTight(i, j) ? { tight: true } : {}) });
    i = j + 1;
  }
  /* Your item right before the list's last: the two numbers would touch ("149150"), so the last
     drops its number; its dot stays and its hover still names it (owner, 2026-11-19). */
  const end = parts[parts.length - 1];
  const beforeEnd = parts[parts.length - 2];
  if (end?.kind === "dot" && !end.mine && beforeEnd?.kind === "dot" && beforeEnd.mine) end.label = false;
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
