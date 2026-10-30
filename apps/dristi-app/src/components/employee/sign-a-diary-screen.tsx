"use client";

import * as React from "react";
import {
  BookCheckIcon,
  CalendarDaysIcon,
  CalendarXIcon,
  NotebookPenIcon,
} from "lucide-react";

import { ListFooter } from "@/components/employee/list-footer";
import { QueueAnnouncer } from "@/components/employee/queue-announcer";
import { SignADiaryDayDialog } from "@/components/employee/sign-a-diary-day-dialog";
import { SignADiaryDialog } from "@/components/employee/sign-a-diary-dialog";
import { SignADiaryTable } from "@/components/employee/sign-a-diary-table";
import {
  rowOpener,
  rowOpenerClass,
} from "@/lib/employee/row-activation";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DayButton } from "react-day-picker";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  formatCourtDay,
  isoDay,
  parseIsoDay,
  PAGE_SIZE,
  type HearingsPageSize,
} from "@/lib/employee/hearings";
import {
  DEFAULT_A_DIARY_FILTERS,
  aDiaryEntries,
  canSignADiaryDay,
  filterADiary,
  formatADiaryDate,
  resolveADiaryDay,
  saveBusinessOfTheDay,
  signADiaryDay,
  signableADiaryDays,
  unsignedADiaryDays,
  type ADiaryEntry,
  type ADiaryFilters,
} from "@/lib/employee/sign-a-diary";
import { Identifier } from "@/components/chrome/identifier";
import { QueueItemRow } from "@/components/employee/queue-item-row";
import { useCourtText } from "@/components/court/court-provider";

/**
 * The day the bench is sitting on is the reader's, not the server's — a court in Kerala
 * should not be shown yesterday's register because the process serving it woke up
 * somewhere else. The server renders its own guess and the browser replaces it on
 * hydration, so there is no mismatch to suppress and no blank first paint. Lifted from
 * `HearingsScreen`, which needs the same day for the same reason.
 */
const NEVER_CHANGES = () => () => {};
const readToday = () => isoDay(new Date());

/**
 * Sign A-Diary — the court's own register of its day, waiting for the signature that
 * makes it a record.
 *
 * The same screen as its siblings in the rail: the page title stands on the page, and
 * **one** lifted panel holds the filter, the table and the pagination footer together.
 * Same panel recipe, same `gap-6` / `p-6`, same table treatment, literally the same
 * footer component. A bench moving between the rail's rows is looking at one court's
 * work through several windows and should not have to re-learn the furniture in between.
 *
 * Four things make this one different, and all four come from what an A-Diary is:
 *
 * - **It is read a day at a time.** The one filter is a date, and it opens on the day the
 *   court is sitting, as the reference draws it. There is no "every day": the register is
 *   dated paper, and clearing the picker returns to today rather than pouring three days
 *   into a table whose columns cannot tell them apart.
 * - **The day is what gets signed** (`a-diary.md` `ADY-12`), as one document, so there is
 *   no selection and no per-entry signature. The one strong action is Sign the A-Diary,
 *   for the day on view, beside the date that names it.
 * - **Only a day that is over can be signed** (`ADY-12b`). On today the action's place
 *   says when it can be, rather than offering a button that cannot work.
 * - **The record is editable until its day is signed** (`ADY-07`). That lives in the entry
 *   dialog, beside the order the words are checked against.
 *
 * **Nothing on this screen signs, records or files anything.** Saving replaces a string
 * in the demo register and signing drops the day from it — see
 * `lib/employee/sign-a-diary.ts`.
 */
export function SignADiaryScreen() {
  const today = React.useSyncExternalStore(
    NEVER_CHANGES,
    readToday,
    readToday,
  );

  /* The register is state because both acts change it: Save rewrites an entry's business,
     Sign drops the day. One list, so the table, the count on the page and the dialog
     can never disagree about what is still unsigned. */
  const [register, setRegister] = React.useState<ADiaryEntry[]>(() =>
    aDiaryEntries(today),
  );
  /* One state, not a draft and an applied one: picking a day shows that day's register.
     A calendar hands over a whole date or nothing — there is no half-typed day whose
     intermediate state would be meaningless — so there was never anything for a Search
     button to wait for. Every change resets to page one. */
  const [filters, setFilters] = React.useState<ADiaryFilters>(
    DEFAULT_A_DIARY_FILTERS,
  );
  const [pageSize, setPageSize] = React.useState<HearingsPageSize>(PAGE_SIZE);
  const [page, setPage] = React.useState(1);
  /* The open entry is held by id, not by value: Save changes the entry under the dialog,
     and a dialog holding a copy would keep showing the words the bench has just
     corrected. */
  const [openId, setOpenId] = React.useState<string | null>(null);
  /* The day whose A-Diary is being signed, while that dialog is open. */
  const [signingDay, setSigningDay] = React.useState<string | null>(null);
  /* Days signed in this visit, so the empty day says it is signed rather than empty. */
  const [signedDays, setSignedDays] = React.useState<string[]>([]);
  const [announcement, setAnnouncement] = React.useState("");
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  const shownDay = resolveADiaryDay(filters, today);
  const rows = filterADiary(register, filters, today);
  const open = register.find((entry) => entry.id === openId) ?? null;
  const waitingDays = signableADiaryDays(register, today);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  function changeFilters(next: ADiaryFilters) {
    setFilters(next);
    setPage(1);
  }

  function showToday() {
    changeFilters(DEFAULT_A_DIARY_FILTERS);
  }

  /** Record the corrected words. The entry stays unsigned and stays in the register. */
  function save(entry: ADiaryEntry, business: string) {
    setRegister((current) => saveBusinessOfTheDay(current, entry.id, business));
  }

  /**
   * Sign one day: all its entries leave the register together, and nothing else happens.
   * Nothing is filed — see the module header.
   */
  function signDay(day: string) {
    setRegister((current) => signADiaryDay(current, day));
    setSignedDays((current) => [...current, day]);
    /* The window stays open on its outcome; Done or close leaves it. */
    setAnnouncement(`The A-Diary for ${formatCourtDay(day)} is signed.`);
  }

  /**
   * Where focus lands when a dialog closes.
   *
   * What opened it is often gone by then — signing takes the day out of the register —
   * so the DS's own restore-to-trigger would drop focus on nothing. The page title is the
   * one thing on this screen that is always there, and it names where the bench is.
   */
  function returnFocus() {
    headingRef.current?.focus();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-title text-balance font-semibold outline-none"
        >
          Sign A-Diary
        </h1>
        {/* The count is the whole point of the queue, so the supporting line carries it
            rather than restating the title. It counts days, because a day is what gets
            signed, and only days that are over, because only those can be — the same
            number the rail carries. Singular is spelled out because "1 days" is the kind
            of thing a court notices. */}
        <p className="text-body text-muted-foreground">
          {register.length === 0
            ? "This court's A-Diary is signed up to date."
            : waitingDays.length === 0
              ? "Nothing is waiting for your signature. Today's A-Diary can be signed once the day is over."
              : waitingDays.length === 1
                ? "1 day of this court's A-Diary is waiting for your signature."
                : `${waitingDays.length} days of this court's A-Diary are waiting for your signature.`}
        </p>
      </header>

      {/* One panel: the filter, the list and the footer are one unit of work, so they
          share one lifted sheet — the same recipe every other court-side list uses.
          Nothing inside draws a second frame. */}
      <section className="flex min-w-0 flex-col gap-6 rounded-xl border border-hairline bg-card shadow-raised p-6">
        {/* The day and the act on it share one row: the date names the paper the button
            signs. Stacked below `sm`. */}
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SignADiaryFilters
            filters={filters}
            today={today}
            unsignedDays={unsignedADiaryDays(register)}
            onChange={changeFilters}
          />
          {rows.length === 0 ? null : canSignADiaryDay(shownDay, today) ? (
            <Button onClick={() => setSigningDay(shownDay)}>
              Sign the A-Diary for {formatADiaryDate(shownDay)}
            </Button>
          ) : (
            /* Today, said in words rather than as a disabled button: what the bench
               needs to know is when, not that it cannot. */
            <p className="text-body-compact text-muted-foreground sm:max-w-xs sm:text-right">
              This day&apos;s A-Diary can be signed once the day is over.
            </p>
          )}
        </div>

        {/* Mounted whatever the list is doing, including empty — see `QueueAnnouncer`. */}
        <QueueAnnouncer
          from={start + 1}
          to={start + pageRows.length}
          total={rows.length}
        />

        {pageRows.length === 0 ? (
          <SignADiaryEmpty
            day={shownDay}
            today={today}
            hasUnsigned={register.length > 0}
            signed={signedDays.includes(shownDay)}
            onShowToday={showToday}
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            {/* min-w-0 lets this flex item shrink below the table's content width, so a
                wide table scrolls inside the panel instead of pushing the page
                sideways. */}
            <div className="min-w-0 overflow-x-auto">
              {/* A paragraph of proceedings in a table cell does not survive a phone.
                  Below `md` the same entries stack as items — the answer the rest of the
                  court side already gives. */}
              <div className="hidden md:block">
                <SignADiaryTable rows={pageRows} onOpen={(entry) => setOpenId(entry.id)} />
              </div>
              <div className="md:hidden">
                <SignADiaryItemList
                  rows={pageRows}
                  onOpen={(entry) => setOpenId(entry.id)}
                />
              </div>
            </div>

            <ListFooter
              id="sign-a-diary-page-size"
              from={start + 1}
              to={start + pageRows.length}
              total={rows.length}
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        )}
      </section>

      {/* What actually changed, for anyone not watching the table. The footer's own count
          line is polite too, but it reports a total rather than an act. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <SignADiaryDialog
        entry={open}
        onOpenChange={(entry) => setOpenId(entry?.id ?? null)}
        onSave={save}
        onReturnFocus={returnFocus}
      />

      <SignADiaryDayDialog
        day={signingDay}
        register={register}
        onOpenChange={(next) => {
          if (!next) setSigningDay(null);
        }}
        onSign={signDay}
        onReturnFocus={returnFocus}
      />
    </div>
  );
}

/**
 * Which day's register is on screen — the reference's one control — and which days are
 * still unsigned (`a-diary.md` `ADY-03`).
 *
 * Picking a day shows it; there is no Search. Clearing is not offered: the register
 * always shows one day.
 *
 * Built from `Popover` + `Calendar` rather than the DS `DatePicker`, because the picker
 * has no way to mark days and marking the unsigned ones is the point. The mark is the one
 * `DashboardDatePicker` already uses — a dot under the day — never colour alone: the day's
 * spoken name says "unsigned", and a legend under the calendar names the dot.
 */
function SignADiaryFilters({
  filters,
  today,
  unsignedDays,
  onChange,
}: {
  filters: ADiaryFilters;
  today: string;
  /** Days with unsigned entries, `YYYY-MM-DD`. */
  unsignedDays: string[];
  onChange: (filters: ADiaryFilters) => void;
}) {
  const day = resolveADiaryDay(filters, today);
  const [open, setOpen] = React.useState(false);
  const unsigned = React.useMemo(() => unsignedDays.map(parseIsoDay), [unsignedDays]);

  return (
    <form
      className="flex min-w-0 flex-col gap-2"
      onSubmit={(event) => event.preventDefault()}
    >
      <Label htmlFor="sign-a-diary-date" className="w-fit text-body-compact font-medium">
        A-Diary dated
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="sign-a-diary-date"
            type="button"
            variant="outline"
            className="w-full justify-start gap-2 text-left font-normal sm:w-60"
          >
            <CalendarDaysIcon data-icon="inline-start" aria-hidden />
            <span className="truncate tabular-nums">{formatCourtDay(day)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="flex w-auto flex-col gap-3 p-3" align="start">
          <Calendar
            mode="single"
            required
            autoFocus
            selected={parseIsoDay(day)}
            defaultMonth={parseIsoDay(day)}
            onSelect={(next) => {
              onChange({ dated: next ? isoDay(next) : null });
              setOpen(false);
            }}
            modifiers={{ unsigned }}
            labels={{
              labelDayButton: (date, modifiers) =>
                `${formatCourtDay(isoDay(date))}${modifiers.unsigned ? ", unsigned" : ""}${
                  modifiers.selected ? ", selected" : ""
                }`,
            }}
            components={{ DayButton: UnsignedDayButton }}
            className="p-0"
          />
          <p className="flex items-center gap-2 text-caption text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            Unsigned
          </p>
        </PopoverContent>
      </Popover>
    </form>
  );
}

/**
 * A day of the month, with a dot under it when that day's A-Diary is unsigned. Kept at
 * module level so the focused day is not remounted on every render — the same reason
 * `DashboardDatePicker` gives for its own.
 */
function UnsignedDayButton({
  children,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  return (
    <CalendarDayButton {...props}>
      {children}
      {props.modifiers.unsigned ? (
        <span
          aria-hidden
          className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current"
        />
      ) : null}
    </CalendarDayButton>
  );
}

/**
 * Why there is nothing to sign, which is three different facts on this screen.
 *
 * A register that is signed up to date is the bench being finished; a day the court did
 * not sit on is a dead end worth offering a way out of; and today with nothing in it yet
 * is neither — the entries arrive as the day's matters are dealt with. Borderless and
 * unpadded; the panel is already the frame.
 */
function SignADiaryEmpty({
  day,
  today,
  hasUnsigned,
  signed,
  onShowToday,
}: {
  day: string;
  today: string;
  /** Whether anything at all is unsigned, on any day. */
  hasUnsigned: boolean;
  /** Whether this day was signed in this visit. */
  signed: boolean;
  onShowToday: () => void;
}) {
  const isToday = day === today;

  if (signed) {
    return (
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookCheckIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-title-s font-semibold">
            The A-Diary for {formatADiaryDate(day)} is signed
          </EmptyTitle>
          <EmptyDescription className="text-body">
            Its entries can no longer be changed.
          </EmptyDescription>
        </EmptyHeader>
        {hasUnsigned ? (
          <EmptyContent>
            <Button variant="outline" onClick={onShowToday}>
              Show today&apos;s diary
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    );
  }

  if (!hasUnsigned) {
    return (
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookCheckIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-title-s font-semibold">
            The A-Diary is signed
          </EmptyTitle>
          <EmptyDescription className="text-body">
            Every day of this court&apos;s A-Diary carries your signature.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Empty className="border-0 p-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {isToday ? (
            <NotebookPenIcon aria-hidden />
          ) : (
            <CalendarXIcon aria-hidden />
          )}
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {isToday
            ? "Nothing in today's diary yet"
            : `No entry for ${formatADiaryDate(day)}`}
        </EmptyTitle>
        <EmptyDescription className="text-body">
          {isToday
            ? "Entries appear here as this court deals with the matters on today's list."
            : `This court's register holds no unsigned entry for ${formatCourtDay(day)}.`}
        </EmptyDescription>
      </EmptyHeader>
      {isToday ? null : (
        <EmptyContent>
          <Button variant="outline" onClick={onShowToday}>
            Show today&apos;s diary
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

/**
 * The same entries below `md`, stacked.
 *
 * The business of the day is the item, not a field inside it: it takes the whole width,
 * carries the emphasis and is the button that opens the entry, with the number and the
 * next date under it. Four lines rather than the table's two — a phone has the height to
 * spare and no column header to lean on.
 */
function SignADiaryItemList({
  rows,
  onOpen,
}: {
  rows: ADiaryEntry[];
  onOpen: (entry: ADiaryEntry) => void;
}) {
  const courtText = useCourtText();
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((entry) => (
        <QueueItemRow key={entry.id} className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onOpen(entry)}
            {...rowOpener}
                className={rowOpenerClass}
          >
            <span className="sr-only">
              Read and correct the entry in {courtText(entry.caseNumber)}.{" "}
            </span>
            <span className="line-clamp-4">{entry.business}</span>
          </button>
          <p className="text-caption text-muted-foreground">
            <Identifier value={entry.caseNumber} label="case number" />
            {" · Next hearing "}
            <span className="tabular-nums">
              {formatADiaryDate(entry.nextHearing)}
            </span>
          </p>
        </QueueItemRow>
      ))}
    </ul>
  );
}
