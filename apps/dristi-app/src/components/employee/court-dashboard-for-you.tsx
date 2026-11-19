"use client";

import * as React from "react";
import { ConstructionIcon, PencilIcon } from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { CaseListBox, CountButton, PanelHeader, plural, useCaseList } from "@/components/employee/court-dashboard-attention";
import { CountBarChart } from "@/components/employee/count-bar-chart";
import { DashboardDatePicker } from "@/components/employee/dashboard-date-picker";
import { OverviewCard, type Opener } from "@/components/employee/court-dashboard-parts";
import { dayCount, ForYouListCard, forYouListHasCases, NothingWaiting, PANEL } from "@/components/employee/for-you-lists";
import { useReturnFocus } from "@/components/employee/return-focus";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { holdsCmoView, summonsWithoutUpdate, unpaidProcess } from "@/lib/employee/cmo-view";
import type { ForYouListId } from "@/lib/employee/for-you-lists";
import { courtRoleLabel, type CourtRole } from "@/lib/employee/content";
import {
  DAY_MS,
  UNCONTESTED,
  daysBetween,
  monthKey,
  monthShortLabel,
  monthStart,
  type CourtDocket,
  type DisposalMethod,
} from "@/lib/employee/court-docket";
import {
  closedCases,
  formatDayShort,
  formatSpan,
  formatSpanFull,
  periodReading,
  type Period,
  type PickerPreset,
} from "@/lib/employee/court-flow";
import { judgmentTarget, parseTarget, setJudgmentTarget, subscribeToJudgmentTarget } from "@/lib/employee/judgment-target";
import {
  JUDGMENT_DUE_DAYS,
  farOffCases,
  judgmentsByMonth,
  reservedForJudgment,
  silentCases,
  undatedCases,
} from "@/lib/employee/magistrate-view";
import type { CourtId } from "@/lib/court/profiles";
import { formatCount } from "@/lib/employee/register-rows";
import { cn } from "@/lib/utils";

/**
 * A seat's own view on the dashboard ("For you"), beside the court's.
 *
 * The magistrate's is built (round 18, owner, 2026-11-15), from note 1.2, Magistrate a–d,
 * as round 11 lays them out, and designed around the acts only the magistrate does here:
 * writing judgments and giving next dates.
 *
 * The CMO / FSO's is built from round 19 (owner, 2026-11-17), from note 1.2, CMO/FSO a–d,
 * on the scrutiny officer's seat (the Ahlmad's in Punjab & Haryana; `holdsCmoView`). It is
 * the magistrate's "Cases waiting on you" panel with the CMO's own cards. Every other seat
 * sees the product's "not built yet" end state until its own view is designed (round 20,
 * the bench clerk), so the two tabs are the same on every seat.
 *
 * The tab holds only the magistrate's own items (owner, 2026-11-15): judgments against
 * their target, full width, then one card per list — the count as its headline, a few
 * cases, and the whole list a click away (`for-you-lists.tsx`). The court's figures
 * (registers, pending by stage, how cases ended) are on the Court tab only.
 */


const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const monthName = (key: number) => `${MONTHS_LONG[key % 12]} ${Math.floor(key / 12)}`;

/* ------------------------------------------------------------- the view */

export function ForYouView({
  docket,
  role,
  court,
}: {
  docket: CourtDocket;
  role: CourtRole;
  court: CourtId;
}) {
  if (role === "magistrate") return <MagistrateView docket={docket} court={court} />;
  if (holdsCmoView(role)) return <WaitingSection docket={docket} lists={CMO_LISTS} />;
  return (
    <section aria-label={`For you, ${courtRoleLabel(role, court)}`} className={PANEL}>
      <Empty className="border-0 p-0 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ConstructionIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-title-s font-semibold">Not built yet</EmptyTitle>
          <EmptyDescription className="text-body text-pretty">
            The {courtRoleLabel(role, court).toLowerCase()}&rsquo;s own view hasn&rsquo;t been built yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}

/** What the "For you" count counts, said where the count is; `null` where there is no count. */
export function forYouCountNote(role: CourtRole): string | null {
  if (role === "magistrate") {
    return `Cases waiting on you: no next hearing date, next date far off, silent, and reserved for judgment more than ${JUDGMENT_DUE_DAYS} days`;
  }
  if (holdsCmoView(role)) return "Cases waiting on you: silent, payment not made, summons with no update, and no next hearing date";
  return null;
}

/**
 * The cases on the seat's own lists, each counted once. The magistrate's: no next hearing
 * date, next date far off, silent, and reserved for judgment past the limit (owner,
 * 2026-11-15). The CMO / FSO's: silent, payment not made, summons with no update and no
 * next hearing date; the cover checks have no data, so they add nothing (2026-11-17).
 */
export function forYouCount(docket: CourtDocket, role: CourtRole): number | null {
  const ids = new Set<number>();
  if (role === "magistrate") {
    for (const r of undatedCases(docket)) ids.add(r.case.id);
    for (const r of farOffCases(docket)) ids.add(r.case.id);
    for (const r of silentCases(docket)) ids.add(r.case.id);
    for (const r of reservedForJudgment(docket)) if (r.days > JUDGMENT_DUE_DAYS) ids.add(r.case.id);
    return ids.size;
  }
  if (holdsCmoView(role)) {
    for (const r of silentCases(docket)) ids.add(r.case.id);
    for (const r of unpaidProcess(docket)) ids.add(r.case.id);
    for (const r of summonsWithoutUpdate(docket)) ids.add(r.case.id);
    for (const r of undatedCases(docket)) ids.add(r.case.id);
    return ids.size;
  }
  return null;
}

function MagistrateView({ docket, court }: { docket: CourtDocket; court: CourtId }) {
  return (
    <>
      <JudgmentsPanel docket={docket} court={court} />
      <WaitingSection docket={docket} lists={MAGISTRATE_LISTS} />
    </>
  );
}

/**
 * The magistrate's lists, most pressing first: the dates only they give, what they write,
 * the dates given too far off, the cases nobody has touched.
 */
const MAGISTRATE_LISTS: ForYouListId[] = ["undated", "reserved", "far", "silent"];

/**
 * The CMO / FSO's lists (round 19, owner, 2026-11-17), in the note's order: silent (3a),
 * payment not made (3b(a)), summons with no update (3b(c)), no next hearing date (3c). The
 * cover checks (3b(b), 3d) have no data to count yet, so they have no list or card.
 */
const CMO_LISTS: ForYouListId[] = ["silent", "unpaid", "summons", "undated"];

/**
 * The cases waiting on the seat: one panel, its heading (no total: each card carries its
 * own count; owner, 2026-11-16), then a card for each list that has cases (owner,
 * 2026-11-17: an empty list shows no card, and its card returns with its first case). Two
 * to a row once the content area itself is wide enough for a card's three columns
 * (56rem), not the screen. The cards are previews; cases open from each list's own page.
 */
function WaitingSection({ docket, lists }: { docket: CourtDocket; lists: ForYouListId[] }) {
  const shown = lists.filter((id) => forYouListHasCases(id, docket));
  return (
    <section id="waiting" aria-labelledby="you-waiting" className={cn(PANEL, "scroll-mt-20")}>
      <h2 id="you-waiting" className="text-title-s font-semibold">
        Cases waiting on you
      </h2>
      {shown.length ? (
        <div className="@container min-w-0">
          <div className="grid min-w-0 gap-4 @4xl:grid-cols-2">
            {shown.map((id) => (
              <ForYouListCard key={id} id={id} docket={docket} />
            ))}
          </div>
        </div>
      ) : (
        <NothingWaiting />
      )}
    </section>
  );
}

/** Convictions and acquittals in a period: the judgments the target counts. */
function judgedIn(docket: CourtDocket, p: Period) {
  return closedCases(docket, p).filter((r) => r.outcome !== "toLongPending" && !UNCONTESTED.has(r.method as DisposalMethod));
}


/* ------------------------------------------------------------- judgments (a) */

const NO_TARGET = () => null;

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
function dayOrdinal(day: number): string {
  const tens = day % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (({ 1: "st", 2: "nd", 3: "rd" }) as Record<number, string>)[day % 10] ?? "th";
  return `${day}${suffix}`;
}

function useJudgmentTarget(court: CourtId): number | null {
  return React.useSyncExternalStore(
    (listener) => subscribeToJudgmentTarget(court, listener),
    () => judgmentTarget(court),
    NO_TARGET,
  );
}

/**
 * Judgments against the magistrate's own target (owner, 2026-11-15):
 *
 * - Two cards for the month in progress, the Overview's card shape: this month so far
 *   against the target ("27 of 55", with its bar), beside what last month had by the same
 *   day — a fact, not a verdict, as the month is not over — and where the month ends at
 *   this rate. Without a target the first card is the count alone.
 * - Each month as bars beside them, with the target across them and its own date picker,
 *   so any run of months can be read; it opens on the last twelve and this month.
 *
 * Judgments are convictions and acquittals: contested disposals.
 */
function JudgmentsPanel({ docket, court }: { docket: CourtDocket; court: CourtId }) {
  const target = useJudgmentTarget(court);
  const [editing, setEditing] = React.useState(false);
  const today = docket.today;
  const nowKey = monthKey(today);
  const thisMonth: Period = { from: monthStart(nowKey), to: today };
  const lastKey = nowKey - 1;
  const lastMonth: Period = { from: monthStart(lastKey), to: monthStart(nowKey) - DAY_MS };
  const dayOfMonth = daysBetween(thisMonth.from, today) + 1;
  const daysInMonth = daysBetween(thisMonth.from, monthStart(nowKey + 1));
  const monthEnd = monthStart(nowKey + 1) - DAY_MS;
  const left = daysInMonth - dayOfMonth;

  const nowRows = judgedIn(docket, thisMonth);
  const now = nowRows.length;
  const convicted = nowRows.filter((r) => r.method === "Convicted").length;
  const lastCount = judgedIn(docket, lastMonth).length;
  const pace = Math.round((now / dayOfMonth) * daysInMonth);
  /* Like for like, as the Overview compares: the same days of last month. */
  const base = periodReading(thisMonth, docket, "prev").baseline[0] ?? null;
  const baseCount = base ? judgedIn(docket, base).length : null;

  /* The chart's own range: whole months, opening on the last twelve and this month. */
  const presets: PickerPreset[] = (
    [
      ["Last 6 months", monthStart(nowKey - 6)],
      ["Last 12 months", monthStart(nowKey - 12)],
      ["This year", Date.UTC(new Date(today).getUTCFullYear(), 0, 1)],
      ["All records", docket.start],
    ] as [string, number][]
  ).map(([label, start]) => ({ label, period: { from: Math.max(start, docket.start), to: today } }));
  const opening = presets[1].period;
  const [picked, setPicked] = React.useState<Period | null>(null);
  const range = picked ?? opening;
  const bars = judgmentsByMonth(docket, monthKey(range.from), monthKey(range.to));

  const list = useCaseList<"now">();
  const listId = "you-judgments-cases";
  const opener: Opener = { expanded: list.open === "now", controls: listId, onOpen: (from) => list.toggle("now", from) };

  /* The Overview's one way of showing change: arrow and amount, coloured only when worse. */
  const change = (diff: number, name: string) => {
    if (!diff) return <p className="text-body-compact text-muted-foreground tabular-nums">No change {name}</p>;
    const up = diff > 0;
    return (
      <p className="text-body-compact text-muted-foreground tabular-nums">
        <span className={cn("font-semibold", !up && "text-destructive-ink")}>
          <span aria-hidden>{up ? "▲ " : "▼ "}</span>
          <span className="sr-only">{up ? "Up " : "Down "}</span>
          {formatCount(Math.abs(diff))}
          {!up ? <span className="sr-only">, worse</span> : null}
        </span>{" "}
        {name}
      </p>
    );
  };
  const figure = (n: number) => <span className="inline-flex min-h-10 items-center text-title-l font-semibold tabular-nums">{formatCount(n)}</span>;
  const lastName = MONTHS_LONG[lastKey % 12];

  return (
    <section id="judgments" aria-labelledby="you-judgments" className={cn(PANEL, "scroll-mt-20 gap-6")}>
      <div className="flex min-w-0 flex-col gap-4">
        {/* The target is set where it is read, in the month's card, not in the header
            (owner, 2026-11-16). */}
        <PanelHeader id="you-judgments" title="Your judgments" />

        {/* The month's two cards stacked beside the months' bars once the content area is
            wide enough (56rem); side by side above the bars below that (owner, 2026-11-16). */}
        <div className="@container min-w-0">
        <div className="grid min-w-0 gap-3 @4xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-3 md:grid-cols-2 @4xl:grid-cols-1">
          <OverviewCard
            label={`This month, ${formatSpan(thisMonth.from, thisMonth.to, today)}`}
            count={
              <p className="flex items-baseline gap-2">
                {now ? (
                  <CountButton name="judgments this month" className="text-title-l font-semibold" {...opener}>
                    {formatCount(now)}
                  </CountButton>
                ) : (
                  <span className="inline-flex min-h-10 items-center text-title-l font-semibold text-muted-foreground">0</span>
                )}
                {target !== null ? (
                  <>
                    <span className="text-body text-muted-foreground tabular-nums">of {formatCount(target)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-haspopup="dialog"
                      aria-label={`Change the target, ${formatCount(target)} a month`}
                      onClick={() => setEditing(true)}
                      className="self-center text-muted-foreground"
                    >
                      <PencilIcon aria-hidden />
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="link"
                    aria-haspopup="dialog"
                    onClick={() => setEditing(true)}
                    className="h-auto self-center px-0 text-body-compact"
                  >
                    Set a target
                  </Button>
                )}
              </p>
            }
            change={
              <div className="flex w-full flex-col gap-2">
                {target !== null ? (
                  <Progress
                    value={Math.min(100, (now / target) * 100)}
                    aria-label={`${formatCount(now)} of ${formatCount(target)} judgments this month`}
                    className="my-1"
                  />
                ) : null}
                {base && baseCount !== null ? (
                  <p className="text-body-compact text-muted-foreground tabular-nums">
                    {target !== null && now >= target ? (
                      <>
                        <span className="font-semibold text-foreground">Target met</span> ·{" "}
                      </>
                    ) : null}
                    {lastName} had {formatCount(baseCount)} by the {dayOrdinal(new Date(base.to).getUTCDate())}
                  </p>
                ) : null}
              </div>
            }
            fact={`${formatCount(convicted)} convicted · ${formatCount(now - convicted)} acquitted`}
          />
          <OverviewCard
            label={`By ${formatDayShort(monthEnd)}, at this rate`}
            count={figure(pace)}
            change={
              target !== null
                ? change(pace - target, pace >= target ? "over the target" : "under the target")
                : change(pace - lastCount, `vs ${lastName} (${formatCount(lastCount)})`)
            }
            fact={target !== null ? `${dayCount(left)} left · ${lastName} ended at ${formatCount(lastCount)}` : `${dayCount(left)} left`}
          />
        </div>

        <section aria-labelledby="you-each-month" className="flex min-w-0 flex-col gap-3 rounded-xl bg-surface-sunken p-4 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h3 id="you-each-month" className="text-body-compact font-medium">
              Each month
            </h3>
            <DashboardDatePicker
              docket={docket}
              value={range}
              defaultValue={opening}
              defaultLabel="Last 12 months"
              presets={presets}
              idPrefix="you-judgments-picker"
              dayNote="the month it falls in is shown"
              daysNote="of judgments"
              onChange={(next) => setPicked(next.from === opening.from && next.to === opening.to ? null : next)}
            />
          </div>
          {/* A long run of months keeps a readable bar each and scrolls inside the panel. */}
          <div className="min-w-0 overflow-x-auto">
            <div style={{ minWidth: `${bars.length * 2.5}rem` }}>
              <CountBarChart
                title={`Judgments each month, ${formatSpanFull(range.from, range.to)}`}
                unit="judgments"
                target={target}
                targetName="Your target"
                surface="var(--color-surface-sunken)"
                data={bars.map((m, i) => ({
                  /* The year on the first bar and on every January, so a run of months across
                     years is not read as one year. */
                  short: i === 0 || m.month % 12 === 0 ? `${monthShortLabel(m.month)} ’${String(Math.floor(m.month / 12)).slice(2)}` : monthShortLabel(m.month),
                  label: monthName(m.month),
                  value: m.value,
                  partial: m.partial,
                }))}
              />
            </div>
          </div>
        </section>
        </div>
        </div>
        <div id={listId} className="min-w-0 empty:hidden">
          {list.open ? (
            <CaseListBox
              key={list.open}
              id="you-judgments-now"
              title={`Judgments · ${formatSpanFull(thisMonth.from, thisMonth.to)}`}
              summary={plural(now, "case", "cases")}
              rows={nowRows}
              daysHeader="Days from filing to judgment"
              onClose={list.close}
            />
          ) : null}
        </div>
      </div>

      {editing ? (
        <TargetDialog open onOpenChange={setEditing} current={target} onSave={(value) => setJudgmentTarget(court, value)} />
      ) : null}
    </section>
  );
}

/**
 * Setting the target: one field, entered by hand, so a click outside does not discard it
 * (entry dialogs ignore outside clicks; owner, popup rule). Removing the target is offered
 * only once there is one.
 */
function TargetDialog({
  open,
  onOpenChange,
  current,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: number | null;
  onSave: (value: number | null) => void;
}) {
  /* Mounted only while open, so each opening starts from the target as it stands. */
  const [draft, setDraft] = React.useState(current === null ? "" : String(current));
  const [error, setError] = React.useState<string | null>(null);
  const inputId = React.useId();
  const returnFocus = useReturnFocus();
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const value = parseTarget(draft);
    if (value === null) {
      setError("Enter a whole number from 1 to 999.");
      return;
    }
    onSave(value);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ChromeDialogContent className="sm:max-w-md" aria-describedby={undefined} onInteractOutside={(event) => event.preventDefault()} {...returnFocus}>
        <form onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-title-s font-semibold">Monthly judgment target</DialogTitle>
          </DialogHeader>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor={inputId}>Judgments a month</FieldLabel>
            <Input
              id={inputId}
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              aria-invalid={error ? true : undefined}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError(null);
              }}
              className="sm:w-40"
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          <DialogFooter>
            {current !== null ? (
              <Button
                type="button"
                variant="ghost"
                className="sm:mr-auto"
                onClick={() => {
                  onSave(null);
                  onOpenChange(false);
                }}
              >
                Remove target
              </Button>
            ) : null}
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </ChromeDialogContent>
    </Dialog>
  );
}
