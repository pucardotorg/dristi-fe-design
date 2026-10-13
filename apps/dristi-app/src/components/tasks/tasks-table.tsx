"use client";

import * as React from "react";
import { ChevronDownIcon, CircleCheckIcon, SearchXIcon } from "lucide-react";

import { dueCueOf, outcomeOf, secondLineOf, waitingOnOf } from "@/lib/tasks/format";
import { canArchive, verbFor, whoCanActOn } from "@/lib/tasks/permissions";
import { BANDED_VIEWS, bandByDue, type DueBand, type DueBucket } from "@/lib/tasks/selectors";
import type { Case, Person, Task, TaskId, TaskView, Verb } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Identifier } from "@/components/chrome/identifier";
import { TABLE_QUERY } from "@/components/cases/cases-layout";
import { COLLAPSE_MOTION } from "@/components/cases/motion";
import { PANEL_CLASS } from "@/components/shell/panel";
import { AdvocateStack } from "@/components/tasks/advocate-stack";
import { useCourtText } from "@/components/court/court-provider";

/* ───────────────────────────── cells ───────────────────────────── */

function CaseCell({ kase }: { kase: Case }) {
  const courtText = useCourtText();
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-body-compact text-foreground">{kase.parties}</span>
      <span className="text-caption text-muted-foreground">
        {kase.stNumber ? (
          <Identifier value={kase.stNumber} label="case number" />
        ) : (
          "Not yet numbered"
        )}
        <span aria-hidden> · </span>
        {courtText(kase.court)}
      </span>
    </div>
  );
}

/** Relative primary ("2 days overdue", "Due in 3 days") over the absolute date. */
function DueCell({ task, now }: { task: Task; now: Date }) {
  const due = dueCueOf(task, now);
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          "text-body-compact tabular-nums",
          due.overdue
            ? "font-medium text-destructive-ink"
            : due.date
              ? "text-foreground"
              : "text-muted-foreground"
        )}
      >
        {due.primary}
      </span>
      {due.date ? <span className="text-caption tabular-nums text-muted-foreground">{due.date}</span> : null}
    </div>
  );
}

/**
 * The verb: 32px of visible button widened to one shared width (`w-24`) so a column of
 * verbs reads as one rail, expanded to the 40px DS touch floor. "View" — nothing to do
 * but look — is a quiet ghost, never a disabled finalising verb.
 */
function VerbButton({
  verb,
  disabled,
  onClick,
  size = "xs",
}: {
  verb: Verb;
  disabled: boolean;
  onClick: () => void;
  size?: "xs" | "default";
}) {
  const button = (
    <Button
      variant={verb === "View" ? "ghost" : "outline"}
      size={size}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-24 justify-center whitespace-nowrap",
        size === "xs" && "relative after:absolute after:-inset-1"
      )}
    >
      {verb}
    </Button>
  );
  if (!disabled) return button;
  return (
    <Tooltip>
      {/* A disabled button swallows pointer events; the wrapper carries the tooltip. */}
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-lg">
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent>You are offline — read only</TooltipContent>
    </Tooltip>
  );
}

/** The fifth column: nothing on Needs action, who it waits on, or how it ended. */
function fifthCellOf(view: TaskView, task: Task, kase: Case, people: Person[]): string | null {
  if (view === "needs-action") return null;
  if (view === "waiting") return waitingOnOf(task, kase, people);
  return outcomeOf(task);
}

const FIFTH_HEAD: Record<TaskView, string | null> = {
  "needs-action": null,
  waiting: "Waiting on",
  completed: "Outcome",
  archived: "Outcome",
};

/* ───────────────────────────── bands ───────────────────────────── */

/**
 * The list cut into when-it-bites bands — Overdue, Due today, This week, Later, No date
 * set — so the first screenful is the part that hurts, and a task due in three weeks
 * stops sitting flush against one that is 41 days late (2026-09-15).
 *
 * The bands are a cut of the one order, not a second order: `sortTasks` has already
 * arranged the rows and `bandByDue` keeps that arrangement inside each band. Closed and
 * archived lists are never banded — they are ordered by when they closed, and a
 * deadline means nothing once nothing binds.
 *
 * A single band is not worth a header, so a list that lands entirely in one band shows
 * none: the header would be repeating what the tab and the filters already said.
 */
function bandsOf(rows: Task[], view: TaskView, now: Date, banded: boolean): DueBand[] | null {
  if (!banded || !BANDED_VIEWS.has(view)) return null;
  const bands = bandByDue(rows, now);
  return bands.length > 1 ? bands : null;
}

/**
 * Each row's place in the walk — counted over the order the rows are *drawn* in, not the
 * order `sortTasks` returned, because banding moves rows relative to that (a hearing
 * later in the week drops below today's deadline). `focusRow` walks the DOM, so an index
 * taken from the sorted list would send ↓ past the neighbour on screen.
 */
function indexOf(drawn: Task[]): Map<TaskId, number> {
  return new Map(drawn.map((t, i) => [t.id, i]));
}

/**
 * Which bands are folded away, and the rows that are actually on screen because of it.
 *
 * The walk's indices and the DOM have to agree (a folded band renders no rows at all),
 * so `shown` is the one source for "the order the rows are drawn in" — banded, minus
 * anything folded. Kept per bucket, so folding Later and then switching tabs does not
 * carry a fold into a view where that band means something else.
 */
function useFoldedBands(bands: DueBand[] | null) {
  const [folded, setFolded] = React.useState<ReadonlySet<DueBucket>>(() => new Set());
  const toggleBand = React.useCallback((bucket: DueBucket) => {
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  }, []);
  const shown = React.useCallback(
    (rows: Task[]) =>
      bands ? bands.filter((b) => !folded.has(b.bucket)).flatMap((b) => b.tasks) : rows,
    [bands, folded]
  );
  return { folded, toggleBand, shown };
}

/**
 * A band's header: its name at caption scale, how many sit under it, and the disclosure
 * on the right, over a hairline that separates it from its own rows.
 *
 * It began as a filled sunken strip; the owner cut it back to a divider, then to this
 * (2026-09-16). Three deliberate details: the label is the 12px caption role, because a
 * group header names a set rather than stating a fact — the 14px floor the data cards
 * keep is for the facts inside them; the rule sits *below* the label, so the header
 * belongs to the rows it introduces rather than to the band above; and more air above
 * than below, which does the same work as the rule without drawing a second line.
 *
 * The whole header is the disclosure control, with a hover fill so it reads as
 * actionable, and the count stays visible when it is folded — a folded band should be
 * readable, not merely gone.
 */
function BandLabel({
  band,
  id,
  heading,
  open = true,
  loose = false,
  onToggle,
}: {
  band: DueBand;
  id: string;
  heading?: boolean;
  /** Over a run of separate cards rather than inside the table's panel: no
   *  rule or panel inset, since the cards below draw their own edges. */
  loose?: boolean;
  /** Whether the band's rows are showing. */
  open?: boolean;
  onToggle?: () => void;
}) {
  const hot = band.bucket === "overdue";
  const label = (
    <span
      id={id}
      className={cn(
        "font-semibold",
        /* Over loose cards the header is the only thing naming the group, so it
           steps up to the compact body size (owner, Sept 21). */
        loose ? "text-body-compact" : "text-caption",
        hot ? "text-destructive-ink" : "text-foreground"
      )}
    >
      {band.label}
    </span>
  );
  const body = (
    <>
      {heading ? <h3 className="contents">{label}</h3> : label}
      <span className="text-caption tabular-nums text-muted-foreground">{band.tasks.length}</span>
      {loose ? (
        /* The Home hearing cards' disclosure: the chevron in a small disc. */
        <span
          aria-hidden
          className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-accent-strong text-muted-foreground"
        >
          <ChevronDownIcon
            className={cn(
              "size-3.5 transition-transform duration-200 motion-reduce:transition-none",
              !open && "-rotate-90"
            )}
          />
        </span>
      ) : (
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90"
          )}
        />
      )}
    </>
  );
  const shell = loose
    ? "flex min-h-10 w-full items-center gap-2 rounded-lg px-1 text-left"
    : "flex w-full items-center gap-2 border-b border-hairline px-4 pt-4 pb-2 text-left";
  if (!onToggle) return <div className={shell}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        shell,
        /* A bare `button` inherits the browser's arrow cursor, which undercuts the
           hover fill's whole job of saying this is actionable. */
        "cursor-pointer outline-none transition-colors hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      )}
    >
      {body}
      <span className="sr-only">{open ? "Hide these tasks" : "Show these tasks"}</span>
    </button>
  );
}

/* ───────────────────────────── the table ───────────────────────────── */

export type TasksTableProps = {
  rows: Task[];
  cases: Case[];
  people: Person[];
  user: Person;
  now: Date;
  view: TaskView;
  query?: string;
  /** Every selectable row is ticked. */
  allSelected: boolean;
  /** Some but not all — the header box shows a dash. */
  someSelected: boolean;
  selected: Set<TaskId>;
  offline: boolean;
  /** Off for a frame too small for bands — a short list in a card needs no headings. */
  banded?: boolean;
  emptyKind: "none" | "filtered";
  onClearFilters: () => void;
  /** Tick or clear every selectable row in the list at once. */
  onToggleAll: (select: boolean) => void;
  onVerb: (task: Task, verb: Verb) => void;
  onToggleSelect: (task: Task) => void;
};

/**
 * One lifted panel: a DS `Table` from `md`, stacked labelled rows below it. Every cell
 * is one fact in one column; the verb — one shared width — carries the status a Needs-
 * action row would otherwise repeat; Waiting rows say who they wait on, Completed and
 * Archived rows how they ended. Clicking a row (not its controls) opens the detail;
 * ↑/↓ move between rows, Enter opens.
 *
 * The wide table's header, cells, rows and bodies are the product's one table treatment,
 * read from `components/chrome/table-plate.ts` like every other queue — this list had
 * kept its own tones, including the heavy `accent` hover the owner replaced on Sept 11
 * (owner, 2026-09-16). The due bands are the only thing the plate does not know about,
 * and they are built from plain rows so they stay out of its row states.
 */
export function TasksTable(props: TasksTableProps) {
  const { rows, emptyKind, query, view, onClearFilters } = props;
  // The Cases page's rule: a table with a mouse or on a tablet's side, cards
  // under a finger held upright and on any phone.
  const wide = useMediaQuery(TABLE_QUERY);
  const listRef = React.useRef<HTMLDivElement>(null);

  const focusRow = React.useCallback((index: number) => {
    const root = listRef.current;
    if (!root) return;
    const buttons = root.querySelectorAll<HTMLButtonElement>("[data-task-title]");
    const target = buttons[Math.max(0, Math.min(index, buttons.length - 1))];
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.matches("[data-task-title]")) return;
    const row = target.closest<HTMLElement>("[data-task-row]");
    const index = Number(row?.dataset.index ?? -1);
    if (index < 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRow(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRow(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusRow(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusRow(rows.length - 1);
    }
  };

  if (rows.length === 0) {
    return (
      <Card className={cn(PANEL_CLASS, "py-0")}>
        {emptyKind === "filtered" ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{query?.trim() ? `Nothing matches “${query.trim()}”` : "No tasks match"}</EmptyTitle>
              <EmptyDescription>
                {query?.trim()
                  ? "Try another spelling or a party name, or clear the search."
                  : "Clear a filter or the chosen kind to see more."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={onClearFilters}>
                Clear filters
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-success-muted text-success-ink">
                <CircleCheckIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>
                {view === "needs-action"
                  ? "Nothing needs you"
                  : view === "waiting"
                    ? "Nothing waiting on anyone"
                    : view === "completed"
                      ? "Nothing completed yet"
                      : "Nothing archived"}
              </EmptyTitle>
              <EmptyDescription>
                {view === "needs-action"
                  ? "Every case you are on is up to date."
                  : view === "waiting"
                    ? "Filings with the court, payments confirming, and items that need a vakalatnama holder will wait here."
                    : view === "completed"
                      ? "Done, expired and no-longer-needed tasks are kept here with why they closed."
                      : "Tasks put away with Archive are kept here and can be restored."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Card>
    );
  }

  return (
    // A container, not just a panel: the push panel narrows the table without narrowing
    // the viewport, so which columns fit has to answer to the table's own width. The
    // clip is for the stacked list, which runs its rows and band strips full-bleed into
    // the card's rounded corners; the wide table is inset and rounds its own well.
    wide ? (
      <Card className={cn(PANEL_CLASS, "@container gap-0 overflow-clip py-0")}>
        <div ref={listRef} onKeyDown={onKeyDown}>
          <WideTable {...props} />
        </div>
      </Card>
    ) : (
      // Cards stand on the page's ground themselves; a panel around them would
      // be a box of boxes.
      <div ref={listRef} onKeyDown={onKeyDown}>
        <TaskCards {...props} />
      </div>
    )
  );
}

/** What every row needs that the table worked out once. */
type RowCtx = TasksTableProps & {
  caseById: Map<string, Case>;
  anySelectable: boolean;
  fifthHead: string | null;
  /** Whether the "Who can act" column is drawn — see `ACTOR_VIEWS`. */
  actorsShown: boolean;
  /** Each row's place in the drawn order, so ↑/↓ walk across bands, not inside one. */
  indexById: Map<TaskId, number>;
};

/**
 * "Who can act" is only a question while someone still can. A closed or archived task
 * needs nobody, so the column stands down there rather than heading a stack of people
 * with a capability that no longer exists — the Outcome column says how it ended.
 */
const ACTOR_VIEWS: ReadonlySet<TaskView> = new Set<TaskView>(["needs-action", "waiting"]);

function WideTable(props: TasksTableProps) {
  const { rows, cases, user, now, view, banded = true, allSelected, someSelected, onToggleAll } = props;
  const caseById = React.useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  // The select column exists wherever a listed task can still be acted on outside the
  // system — marked done by hand or archived. Closed and archived rows have neither.
  const anySelectable = rows.some((t) => {
    const k = caseById.get(t.caseId);
    return k && canArchive(user, t, k);
  });
  const fifthHead = FIFTH_HEAD[view];
  const bands = bandsOf(rows, view, now, banded);
  const { folded, toggleBand, shown } = useFoldedBands(bands);
  const actorsShown = ACTOR_VIEWS.has(view);
  // One head for the table, so a band never restates the columns; a band label spans
  // every cell a row has — Task, Case, Due and the verb, plus the select box, who can
  // act and the fifth column where they are drawn.
  const columns = 4 + (anySelectable ? 1 : 0) + (actorsShown ? 1 : 0) + (fifthHead ? 1 : 0);
  const ctx: RowCtx = {
    ...props,
    caseById,
    anySelectable,
    fifthHead,
    actorsShown,
    indexById: indexOf(shown(rows)),
  };
  return (
    /* The panel insets the table, the way every sibling queue's section insets its own
       (cases, and the court-side queues at `p-6`), so the header strip reads as a
       rounded well rather than a band welded across the panel. The DS table's own
       horizontal scroller sits inside the inset. */
    <div className="p-4">
      <Table className="w-full border-separate border-spacing-0 text-body-compact">
        <TableHeader>
          {/* The strip's fill and its corners are the plate's. Under `border-separate`
              each cell paints its own fill, so the well's radius lives on the two end
              cells rather than on the row (see the plate's docstring). */}
          <TableRow className={TABLE_HEAD_ROW}>
            {anySelectable ? (
              <TableHead className={cn(TABLE_HEAD, "w-10 pr-0")}>
                {/* Select-all, where a table is expected to keep it (owner, 2026-09-16).
                    It answers for the rows the filters left, not the whole tab — the
                    list you can see is the list it ticks. */}
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={() => onToggleAll(!allSelected)}
                  aria-label={allSelected ? "Clear the whole list" : "Select the whole list"}
                />
              </TableHead>
            ) : null}
            <TableHead className={TABLE_HEAD}>Task</TableHead>
            <TableHead className={TABLE_HEAD}>Case</TableHead>
            {/* The rows are always most-urgent first (`sortTasks`); the headers no longer
                re-sort — a task queue has one order, and offering others was table
                convention, not a need (owner, 2026-08-24). */}
            <TableHead className={TABLE_HEAD}>Due</TableHead>
            {/* Who may act on this task — never an assignment ("Owners" claimed one the
                product does not have; owner, 2026-09-15). The cell answers the header
                exactly: the advocates who hold this task's acting verb, which for a
                signing or paying task is the vakalatnama holders and for a courtroom task
                is everyone on the case. The panel names all the advocates itself, so when
                the push panel narrows the table past the full width this column stands
                down rather than wrapping every other cell to three lines. */}
            {actorsShown ? (
              <TableHead className={cn(TABLE_HEAD, "hidden @4xl:table-cell")}>Who can act</TableHead>
            ) : null}
            {fifthHead ? <TableHead className={TABLE_HEAD}>{fifthHead}</TableHead> : null}
            <TableHead className={cn(TABLE_HEAD, "text-right")}>
              <span className="sr-only">Action</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        {bands ? (
          /* Each band is a `tbody`, and it takes the plate's other half — every rule
             that has to see a row's neighbours: the last row's rule, the rule above a
             lit row, the rounding of a run of selected rows. Those rules cannot look
             across a `tbody`, so a run of picked rows rounds inside its own band. */
          bands.map((band) => (
            <TableBody
              key={band.bucket}
              className={tableBodyClass({ selectable: true })}
            >
              {/* The label heads the rows below it, not a column — a plain `tr`, so the
                  DS row's own three fills never land on a strip that is not a record.
                  Its rule sits above the label, between this band and the one before, so
                  nothing runs between the label and its own rows — and nothing can cut
                  the top corners of the first row when that row is lit. */}
              <tr>
                <th scope="rowgroup" colSpan={columns} className="p-0 text-left">
                  <BandLabel
                    band={band}
                    id={`band-${band.bucket}`}
                    open={!folded.has(band.bucket)}
                    onToggle={() => toggleBand(band.bucket)}
                  />
                </th>
              </tr>
              {folded.has(band.bucket)
                ? null
                : band.tasks.map((task) => <WideRow key={task.id} ctx={ctx} task={task} />)}
            </TableBody>
          ))
        ) : (
          <TableBody className={tableBodyClass({ selectable: true })}>
            {/* The header is a well, not a band welded to the rows — it needs the panel's
                fill under it or its rounded bottom corners read as cut off (ui-craft §4),
                which is the inert row's whole job here. */}
            <tr aria-hidden="true">
              <td colSpan={columns} className="h-2 p-0" />
            </tr>
            {rows.map((task) => (
              <WideRow key={task.id} ctx={ctx} task={task} />
            ))}
          </TableBody>
        )}
      </Table>
    </div>
  );
}

function WideRow({ ctx, task }: { ctx: RowCtx; task: Task }) {
  const { caseById, anySelectable, fifthHead, actorsShown, indexById, people, user, now, view, selected, offline, onVerb, onToggleSelect } = ctx;
  const index = indexById.get(task.id) ?? 0;
  const kase = caseById.get(task.caseId);
  if (!kase) return null;
  const verb = verbFor(user, task, kase);
  const selectable = canArchive(user, task, kase);
  const isSelected = selected.has(task.id);
  const fifth = fifthCellOf(view, task, kase, people);
  const note = secondLineOf(task, user, people);
  return (
    <TableRow
      data-task-row
      data-task-id={task.id}
      data-index={index}
      data-state={isSelected ? "selected" : undefined}
      /* Every fill and every corner is the plate's, including the hover — the lighter
         warm tone design chose over the old grey `accent` (owner, 2026-09-11). Being
         open is a persistent "you are looking at this one" mark and it loses to
         selection, so the precedence is decided here rather than in CSS, where the two
         fills would race on source order. */
      className={cn(
        tableRowClass({ selectable: true }),
        "cursor-pointer"
      )}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, a, [role=checkbox], label")) return;
        onVerb(task, verb);
      }}
    >
      {anySelectable ? (
        <TableCell className={cn(TABLE_CELL, "w-10 pr-0")}>
          {selectable ? (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(task)}
              aria-label={`Select: ${task.title}`}
            />
          ) : null}
        </TableCell>
      ) : null}
      <TableCell className={cn(TABLE_CELL, "min-w-44 max-w-md whitespace-normal")}>
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            data-task-title
            onClick={() => onVerb(task, verb)}
            className="rounded-sm text-left text-body-compact font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {task.title}
          </button>
          {note ? <span className="text-caption text-muted-foreground">{note}</span> : null}
        </div>
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "min-w-32 max-w-xs whitespace-normal")}>
        <CaseCell kase={kase} />
      </TableCell>
      <TableCell className={TABLE_CELL}>
        <DueCell task={task} now={now} />
      </TableCell>
      {actorsShown ? (
        <TableCell className={cn(TABLE_CELL, "hidden @4xl:table-cell")}>
          <AdvocateStack
            kase={kase}
            people={people}
            user={user}
            advocates={whoCanActOn(task, kase, people)}
            label="Who can act"
          />
        </TableCell>
      ) : null}
      {fifthHead ? (
        <TableCell
          className={cn(TABLE_CELL, "min-w-28 max-w-56 whitespace-normal text-foreground")}
        >
          {fifth}
        </TableCell>
      ) : null}
      <TableCell className={cn(TABLE_CELL, "text-right")}>
        <VerbButton verb={verb} disabled={offline} onClick={() => onVerb(task, verb)} />
      </TableCell>
    </TableRow>
  );
}

/**
 * Touch screens, and anything under `md`: one card per task, grouped under the
 * same due bands (owner, Sept 21). The stacked rows this replaces were the
 * table stood on end: a label for every fact, and the verb always on show at
 * the foot of a tall block.
 *
 * A card carries what the person scans for, in the order they scan: what to
 * do, how late it is, then which case and who can act. No labels, because on
 * a card the value says what it is. The verb waits in a tray that slides out
 * from under the card on tap, the move the advocate Home hearing cards make, so the
 * list stays a list and only the task in hand shows its action.
 */
function TaskCards(props: TasksTableProps) {
  const { rows, cases, user, now, view, banded = true } = props;
  const caseById = React.useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const anySelectable = rows.some((t) => {
    const k = caseById.get(t.caseId);
    return k && canArchive(user, t, k);
  });
  const bands = bandsOf(rows, view, now, banded);
  const { folded, toggleBand, shown } = useFoldedBands(bands);
  // One tray at a time: a second open card would push the verb of the first
  // off the screen of a phone.
  const [openId, setOpenId] = React.useState<TaskId | null>(null);
  const ctx: RowCtx = {
    ...props,
    caseById,
    anySelectable,
    fifthHead: FIFTH_HEAD[view],
    actorsShown: ACTOR_VIEWS.has(view),
    indexById: indexOf(shown(rows)),
  };
  const list = (tasks: Task[]) => (
    <ul className="flex flex-col gap-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          ctx={ctx}
          task={task}
          open={openId === task.id}
          onOpenChange={(open) => setOpenId(open ? task.id : null)}
        />
      ))}
    </ul>
  );
  if (!bands) return list(rows);
  return (
    /* Ruled off from one another: folded, the headers are all that is left, and
       three bare labels floating 24px apart read as unfinished (owner, Sept 21).
       A hairline between groups makes the folded stack a list. */
    <div className="flex flex-col divide-y divide-hairline">
      {bands.map((band) => {
        const open = !folded.has(band.bucket);
        return (
          /* A group, not a landmark: five date bands would put five regions in the
             phone's landmark list, none of which is a section of the page. */
          <div
            key={band.bucket}
            role="group"
            aria-labelledby={`band-${band.bucket}`}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
          >
            <BandLabel
              band={band}
              id={`band-${band.bucket}`}
              heading
              loose
              open={open}
              onToggle={() => toggleBand(band.bucket)}
            />
            {open ? list(band.tasks) : null}
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({
  ctx,
  task,
  open,
  onOpenChange,
}: {
  ctx: RowCtx;
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const courtText = useCourtText();
  const { caseById, indexById, people, user, now, view, selected, offline, fifthHead, actorsShown, onVerb, onToggleSelect } = ctx;
  const kase = caseById.get(task.caseId);
  if (!kase) return null;
  const verb = verbFor(user, task, kase);
  const selectable = canArchive(user, task, kase);
  const isSelected = selected.has(task.id);
  const fifth = fifthCellOf(view, task, kase, people);
  const note = secondLineOf(task, user, people);
  const due = dueCueOf(task, now);

  return (
    <li data-task-row data-task-id={task.id} data-index={indexById.get(task.id) ?? 0}>
      <Collapsible open={open} onOpenChange={onOpenChange} className="min-w-0">
        {/* The card sits above its tray; the tray is inset and squared at the
            top, so it reads as sliding out from under the card. */}
        <div
          className={cn(
            PANEL_CLASS,
            "relative z-10 flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors has-[[data-task-title]:active]:bg-accent",
            (isSelected || open) && "border-border",
            isSelected && "bg-accent-strong"
          )}
        >
          <div className="flex items-start gap-3">
            {selectable ? (
              <span className="relative z-10 flex shrink-0 items-center">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(task)}
                  aria-label={`Select: ${task.title}`}
                  className="size-5"
                />
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {/* The title is the one control on the card: its hit area is the whole
                  card, and it opens the tray. */}
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  data-task-title
                  className="rounded-sm text-left text-body font-semibold break-words text-foreground outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {task.title}
                </button>
              </CollapsibleTrigger>
              {note ? <span className="text-caption text-muted-foreground">{note}</span> : null}
              {/* How late, then the date it is counted from, on one line. */}
              <span className="text-body-compact tabular-nums">
                <span
                  className={cn(
                    due.overdue
                      ? "font-medium text-destructive-ink"
                      : due.date
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                  )}
                >
                  {due.primary}
                </span>
                {due.date ? (
                  <span className="text-muted-foreground">
                    <span aria-hidden> · </span>
                    {due.date}
                  </span>
                ) : null}
              </span>
            </div>
            {/* Bare on the card; the disc belongs to the group headers only
                (owner, Sept 21). */}
            <ChevronDownIcon
              aria-hidden
              className={cn(
                "mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
                open && "rotate-180"
              )}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-hairline pt-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body-compact text-foreground">{kase.parties}</span>
              <span className="text-caption text-muted-foreground">
                {kase.stNumber ? (
                  <Identifier value={kase.stNumber} label="case number" copyable={false} />
                ) : (
                  "Not yet numbered"
                )}
                <span aria-hidden> · </span>
                {courtText(kase.court)}
              </span>
              {fifthHead && fifth ? (
                <span className="text-caption text-muted-foreground">
                  {fifthHead}: <span className="text-foreground">{fifth}</span>
                </span>
              ) : null}
            </div>
            {actorsShown ? (
              <div className="relative z-10 shrink-0">
                <AdvocateStack
                  kase={kase}
                  people={people}
                  user={user}
                  advocates={whoCanActOn(task, kase, people)}
                  label="Who can act"
                />
              </div>
            ) : null}
          </div>
        </div>
        <CollapsibleContent className={cn(COLLAPSE_MOTION, "mx-3")}>
          <div className="flex items-center gap-2 rounded-b-xl bg-secondary p-3">
            <Button
              type="button"
              variant={verb === "View" ? "outline" : "default"}
              disabled={offline}
              className="flex-1"
              onClick={() => onVerb(task, verb)}
            >
              {verb}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

/* ───────────────────────────── loading ───────────────────────────── */

/** Rows still arriving: chrome intact, the table as calm placeholders. */
export function TasksTableSkeleton() {
  return (
    <Card className={cn(PANEL_CLASS, "gap-0 py-0")} aria-busy="true" aria-label="Loading tasks">
      {/* Inset from `md` — the width at which the rows that arrive are the wide table,
          which its panel insets by the same 16px. Below that the stacked list runs
          full-bleed and so does this, so the rows never shift as they land. */}
      <div className="md:p-4">
        <div className="flex h-10 items-center gap-6 bg-surface-sunken px-4 md:rounded-lg">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-10" />
        </div>
        <ul className="divide-y divide-hairline">
        {Array.from({ length: 7 }).map((_, i) => (
          <li key={i} className="flex min-h-16 items-center gap-6 px-4 py-3">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3 max-w-96" />
              <Skeleton className="h-3 w-1/3 max-w-48" />
            </div>
            <Skeleton className="hidden h-3 w-20 md:block" />
            <Skeleton className="hidden size-6 rounded-full md:block" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </li>
        ))}
        </ul>
      </div>
    </Card>
  );
}
