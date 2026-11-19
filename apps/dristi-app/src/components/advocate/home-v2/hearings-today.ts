/**
 * Card 1 of draft 2, "Your hearings today" (owner design, 2026-11-18).
 * One row per court: every listed item is a dot, from 1 on the left to the last on the right.
 * Long stretches with nothing of yours fold into a dotted line, so the dots stay readable.
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

/** "Thu, 19 Nov". */
export function shortDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(d);
}

/**
 * Courts in session first, courts not started after (owner, 2026-11-19). Within each group:
 * most of your hearings first; a tie goes to the court that reaches you sooner.
 */
export function orderCourts(courts: CourtHearings[]): CourtHearings[] {
  const wait = (c: CourtHearings) => Math.min(...c.mine.map((m) => m.item)) - c.now;
  const started = (c: CourtHearings) => (c.now ? 0 : 1);
  return [...courts].sort(
    (a, b) => started(a) - started(b) || b.mine.length - a.mine.length || wait(a) - wait(b),
  );
}

/* ── Folding ──────────────────────────────────────────────────────────── */

/**
 * How the row spends its room. The track is not to scale: every row has the same length,
 * whether the court lists 20 items or 70; the end number says how many.
 * Dots keep one fixed spacing; the budget is how many fit the row at that spacing.
 * Every row fills the same width: a bar stretches to take up the slack.
 * 1. Fold as little as possible, but fold at least once if that is possible, so a bar can
 *    fill the row. Only a court with nothing to fold spreads its dots out (last resort).
 * 2. Otherwise heard items fold into a bar, keeping your heard items and the one just before
 *    "now" as dots, so the live dot never touches a bar.
 * 3. Still too many: items to come fold around yours, level by level, until the row fits.
 * A folded stretch is a rounded bar with its first and last numbers at its ends. Your items
 * are never folded away, and a bar never touches your dot or the live one: one plain dot
 * always sits between, so their numbers never collide.
 */
export const FOLD_LEVELS = [
  { foldHeard: false, aroundMine: Infinity, keepQueue: true },
  { foldHeard: true, aroundMine: Infinity, keepQueue: true },
  /* Owner's rule (sleek round): beyond everything-fits, keep just one plain dot either side of
     the live dot and yours, plus the short queue between now and your next item. */
  { foldHeard: true, aroundMine: 1, keepQueue: true },
  { foldHeard: true, aroundMine: 1, keepQueue: false },
] as const;
/** Fewer hidden items than this stay as dots: a bar needs room for two different end numbers. */
export const BAR_MIN = 3;
/** Room a bar takes at its shortest, counted in dots (it needs space for a number at each end). */
export const BAR_COST = 3;

export type TrackPart =
  | { kind: "dot"; item: number; state: "heard" | "now" | "upcoming"; mine?: HearingMine; label?: "plain" | "now" | "mine" }
  | {
      kind: "bar";
      from: number;
      to: number;
      state: "heard" | "upcoming";
      /** Shows its last number (the list's end). */
      endLabel?: boolean;
      /** Shows its first number (item 1). */
      startLabel?: boolean;
      /** The stretch it stands for, counting plain end dots it joins (dotted: 33 to 43). */
      span?: { from: number; to: number };
    };

/** Room a row's parts need, in dots. */
export const cost = (parts: TrackPart[]) => parts.reduce((n, p) => n + (p.kind === "bar" ? BAR_COST : 1), 0);

/**
 * `connect` (experiment, 2026-11-18): folds are dotted lines. Each line starts and ends on a plain
 * dot (the first and last folded item, e.g. 33 ····· 43), so your items always have a plain dot
 * beside them. The live dot does not: a line runs straight up to it. 1 and the last stay as dots.
 */
export function trackParts(c: CourtHearings, budget = 18, connect = false): TrackPart[] {
  let fits: TrackPart[] | undefined;
  for (const level of FOLD_LEVELS) {
    const parts = partsAt(c, level, connect);
    if (cost(parts) > budget) continue;
    if (parts.some((p) => p.kind === "bar")) return parts;
    fits ??= parts;
  }
  /* Nothing folds into a bar: the dots spread to fill the row. Or so many of your items that
     nothing fits: show the tightest level and let plain dots shrink. */
  return fits ?? partsAt(c, FOLD_LEVELS[FOLD_LEVELS.length - 1], connect);
}

function partsAt(
  c: CourtHearings,
  { foldHeard, aroundMine, keepQueue }: (typeof FOLD_LEVELS)[number],
  connect: boolean,
): TrackPart[] {
  const keep = new Set<number>();
  const add = (from: number, to: number) => {
    for (let i = Math.max(1, from); i <= Math.min(c.last, to); i++) keep.add(i);
  };
  const buffer = 1;
  const around = aroundMine;
  if (connect) {
    keep.add(1);
    keep.add(c.last);
  }
  /* The past: all of it, or only the anchors. */
  if (c.now) {
    /* Dotted: the live dot takes no buffer (owner, 2026-11-18); bars keep one. */
    const nowBuffer = connect ? 0 : buffer;
    if (foldHeard) add(c.now - nowBuffer, c.now + nowBuffer);
    else add(1, c.now);
  }
  for (const m of c.mine) {
    add(m.item - buffer, m.item + buffer);
    if (m.item > c.now) add(Math.max(c.now + 1, m.item - around), m.item + around);
  }
  /* Everything between now and your next item stays: that is the queue ahead of you. */
  const next = c.mine.filter((m) => m.item > c.now).map((m) => m.item);
  if (keepQueue && next.length) add(c.now + 1, Math.min(...next));
  if (aroundMine === Infinity) add(c.now + 1, c.last);

  /* Hidden runs too short for a bar come back as dots (the ends included: 1 and the last). */
  const isKept = (i: number) => keep.has(i);
  let i = 1;
  while (i <= c.last) {
    if (isKept(i)) { i++; continue; }
    let j = i;
    while (j + 1 <= c.last && !isKept(j + 1)) j++;
    if (j - i + 1 < BAR_MIN) add(i, j);
    i = j + 1;
  }

  const mineAt = new Map(c.mine.map((m) => [m.item, m]));
  const stateOf = (item: number) => (!c.now || item > c.now ? "upcoming" : item === c.now ? "now" : "heard");
  const parts: TrackPart[] = [];
  i = 1;
  while (i <= c.last) {
    if (keep.has(i)) {
      const mine = mineAt.get(i);
      const state = stateOf(i);
      /* Numbers: the live one, yours, and the list's last (its size). Bar ends read on hover. */
      parts.push({ kind: "dot", item: i, state, mine, label: mine ? "mine" : state === "now" ? "now" : i === c.last || i === 1 ? "plain" : undefined });
      i++;
      continue;
    }
    let j = i;
    while (j + 1 <= c.last && !keep.has(j + 1)) j++;
    parts.push({ kind: "bar", from: i, to: j, state: c.now && j < c.now ? "heard" : "upcoming", endLabel: j === c.last, startLabel: i === 1 });
    i = j + 1;
  }
  /* A dotted line reads together with the plain dots it joins. */
  const plainDot = (p?: TrackPart) => p?.kind === "dot" && !p.mine && p.state !== "now";
  parts.forEach((p, k) => {
    if (p.kind !== "bar") return;
    const before = parts[k - 1];
    const after = parts[k + 1];
    p.span = {
      from: connect && plainDot(before) && before?.kind === "dot" ? before.item : p.from,
      to: connect && plainDot(after) && after?.kind === "dot" ? after.item : p.to,
    };
  });
  return parts;
}

/* ── Now line (experiment, owner 2026-11-18) ─────────────────────────────── */

/**
 * Every court's live dot sits on one vertical line. Left of it, everything heard is one bar from
 * 1 (yours included: done is done; a passed-over item that comes back shows on the right).
 * Right of it, items to come fold around yours, ending on the list's last item.
 */
export function nowLineParts(c: CourtHearings, rightBudget: number) {
  const heardMine = c.mine.filter((m) => c.now && m.item < c.now).map((m) => m.item);
  /* Like the dotted version: item 1 is a dot, and a dotted line joins it to the live dot.
     Hovering the line reads the whole heard stretch, 1 included. */
  const first: TrackPart = { kind: "dot", item: 1, state: "heard", label: "plain" };
  const left: TrackPart[] =
    c.now > 2
      ? [first, { kind: "bar", from: 2, to: c.now - 1, state: "heard", span: { from: 1, to: c.now - 1 } }]
      : c.now === 2
        ? [first]
        : [];
  const from = c.now ? c.now + 1 : 1;
  const mineAt = new Map(c.mine.filter((m) => m.item >= from).map((m) => [m.item, m]));
  const keepAnchors = new Set<number>([c.last]);
  if (!c.now) keepAnchors.add(1);
  for (const m of mineAt.keys()) for (const i of [m - 1, m, m + 1]) if (i >= from && i <= c.last) keepAnchors.add(i);
  const withQueue = new Set(keepAnchors);
  const next = [...mineAt.keys()];
  if (next.length) for (let i = from; i <= Math.min(...next); i++) withQueue.add(i);
  const everything = new Set<number>();
  for (let i = from; i <= c.last; i++) everything.add(i);

  let right: TrackPart[] | undefined;
  let fits: TrackPart[] | undefined;
  for (const keep of [everything, withQueue, keepAnchors]) {
    const parts = lay(c, from, new Set(keep), mineAt);
    if (cost(parts) > rightBudget) continue;
    if (parts.some((p) => p.kind === "bar")) { right = parts; break; }
    fits ??= parts;
  }
  right ??= fits ?? lay(c, from, keepAnchors, mineAt);
  return { left, right, heardMine };
}

function lay(c: CourtHearings, from: number, keep: Set<number>, mineAt: Map<number, HearingMine>): TrackPart[] {
  let i = from;
  while (i <= c.last) {
    if (keep.has(i)) { i++; continue; }
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
      parts.push({ kind: "dot", item: i, state: "upcoming", mine, label: mine ? "mine" : i === c.last || i === 1 ? "plain" : undefined });
      i++;
      continue;
    }
    let j = i;
    while (j + 1 <= c.last && !keep.has(j + 1)) j++;
    parts.push({ kind: "bar", from: i, to: j, state: "upcoming", endLabel: j === c.last, startLabel: i === 1, span: { from: i, to: j } });
    i = j + 1;
  }
  /* A dotted line reads together with the plain dots it joins (28 ····· 50 reads "28 to 50"). */
  const plainDot = (p?: TrackPart) => p?.kind === "dot" && !p.mine;
  parts.forEach((p, k) => {
    if (p.kind !== "bar") return;
    const before = parts[k - 1];
    const after = parts[k + 1];
    p.span = {
      from: plainDot(before) && before?.kind === "dot" ? before.item : p.from,
      to: plainDot(after) && after?.kind === "dot" ? after.item : p.to,
    };
  });
  return parts;
}
