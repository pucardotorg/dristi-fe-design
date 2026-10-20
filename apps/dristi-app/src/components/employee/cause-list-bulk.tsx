"use client";

import * as React from "react";
import { CalendarDaysIcon } from "lucide-react";

import {
  DayBreakdown,
  LoadCalendar,
} from "@/components/employee/next-hearing-fields";
import { PurposeField } from "@/components/employee/purpose-field";
import { useCourtToday } from "@/components/employee/use-court-today";
import { useHearingSession } from "@/components/employee/use-hearing-session";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  markHearingsEnded,
  markHearingsPassedOver,
  setHearingsNext,
} from "@/lib/employee/hearing-session";
import {
  canPassOver,
  causeTitle,
  courtHearingPurposeLabel,
  formatListingDate,
  parseIsoDay,
  type CourtHearing,
  type CourtHearingPurposeId,
} from "@/lib/employee/hearings";
import { listingLoad } from "@/lib/employee/listing-load";
import { NO_CAUSE_POSTING } from "@/lib/employee/order-draft";
import { initialOrderDraft } from "@/lib/employee/order-demo";
import { orderInitialDraft } from "@/lib/employee/order-door";
import {
  editorDraftKey,
  updateOrderDraft,
} from "@/lib/employee/order-drafts";
import type { OrderSigning } from "@/lib/employee/order-signing";
import {
  noteOrderDraft,
  noteOrderTextEdited,
  type PendingOrders,
} from "@/lib/employee/pending-orders";

/**
 * Bulk work on the cause list (owner, 2026-10-15).
 *
 * **The reader** — when the court setting has the reader enter the next hearing — picks
 * several listings and, in one pop-up, ends them or passes them over and sets their
 * next date and next purpose, all applied together. The case stage is not theirs to
 * change (owner, 2026-10-15).
 *
 * **The steno** picks several listings and types one piece of text that is added to the
 * end of each listing's order (order screen E). Orders already sent for signing are left
 * alone: their words are the magistrate's to sign.
 *
 * Like the row's own controls, none of it is a court record: the marks live in this
 * browser's sitting (`hearing-session.ts`) and the text in its order drafts.
 */

export type BulkSeat = "reader" | "steno";

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/* ─────────────────────────────── the bulk bar ─────────────────────────────── */


/**
 * What is selected, and the acts — sticky at the foot of the page, as the Orders view's
 * Sign bar is. The line beside the button is live, so the selection and each outcome are
 * heard without going looking.
 */
export function CauseListBulkBar({
  seat,
  selected,
  notice,
  onNotice,
  onDone,
  pending,
  signing,
}: {
  seat: BulkSeat;
  /** The selected listings still in view — what an act applies to. */
  selected: CourtHearing[];
  notice: string;
  onNotice: (notice: string) => void;
  /** Clear the selection after an act. */
  onDone: () => void;
  pending: PendingOrders;
  signing: OrderSigning;
}) {
  const [open, setOpenState] = React.useState(false);
  /* A count of openings, so the pop-up opens fresh each time. */
  const [opening, setOpening] = React.useState(0);
  function setOpen(next: boolean) {
    if (next) setOpening((count) => count + 1);
    setOpenState(next);
  }
  const count = selected.length;
  const summary =
    notice ||
    (count === 0
      ? "Select the hearings to act on."
      : `${count} ${plural(count, "hearing", "hearings")} selected.`);

  function finish(message: string) {
    setOpen(false);
    onDone();
    onNotice(message);
  }

  return (
    <div className="sticky bottom-0 z-30 -mx-6 -mb-6 border-t border-hairline bg-card px-6 py-3 md:-mx-8 md:-mb-8 md:px-8 md:py-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <p
          className="mr-auto text-body-compact text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {summary}
        </p>
        <Button
          type="button"
          disabled={count === 0}
          className="w-full sm:w-fit"
          onClick={() => setOpen(true)}
        >
          {seat === "reader"
            ? "Bulk actions"
            : count > 0
              ? `Add text to ${count} ${plural(count, "order", "orders")}`
              : "Add text to orders"}
        </Button>
      </div>

      {seat === "reader" ? (
        <BulkActionsDialog
          key={`reader-${opening}`}
          open={open}
          selected={selected}
          onOpenChange={setOpen}
          onConfirm={finish}
        />
      ) : (
        <OrderTextDialog
          key={`text-${opening}`}
          open={open}
          selected={selected}
          pending={pending}
          signing={signing}
          onOpenChange={setOpen}
          onConfirm={finish}
        />
      )}
    </div>
  );
}

/* ───────────────────────────── the reader's one pop-up ───────────────────────────── */

type Outcome = "keep" | "complete" | "pass-over";

/**
 * Which of the selection an outcome can take. Ending takes everything not already
 * completed — a passed-over matter heard later in the day included. Passing over takes
 * only what is still to be heard, as the row's own Pass over does.
 */
function takes(outcome: Outcome, hearing: CourtHearing): boolean {
  if (outcome === "complete") return hearing.status !== "completed";
  if (outcome === "pass-over") return canPassOver(hearing.status);
  return true;
}

/**
 * Everything the reader does to a batch, in one pop-up (owner, 2026-10-15): end the
 * hearings or pass them over, and set their next date and next purpose — all applied
 * together by one press.
 *
 * Every part opens on *Leave as it is*, so only what is changed is written: setting a
 * date across fifteen matters must not wipe the fifteen purposes already chosen. The
 * pop-up is itself the pause before an outcome that cannot be undone from the cause list,
 * so there is no second confirmation; the press names what it will do.
 */
function BulkActionsDialog({
  open,
  selected,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  selected: CourtHearing[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (message: string) => void;
}) {
  const [outcome, setOutcome] = React.useState<Outcome>("keep");
  const [date, setDate] = React.useState<string | null>(null);
  const [notListed, setNotListed] = React.useState(false);
  const [purpose, setPurpose] = React.useState<CourtHearingPurposeId | null>(null);

  const leaving = selected.filter((hearing) => !takes(outcome, hearing));
  const marking = selected.filter((hearing) => takes(outcome, hearing));
  const posting = notListed || date !== null || purpose !== null;
  const changes = outcome !== "keep" || posting;
  const outcomeWord = outcome === "complete" ? "ended" : "passed over";

  function confirm() {
    const ids = selected.map((hearing) => hearing.id);
    const marked = marking.map((hearing) => hearing.id);
    if (outcome === "complete") markHearingsEnded(marked);
    if (outcome === "pass-over") markHearingsPassedOver(marked);
    if (posting) {
      setHearingsNext(
        ids,
        notListed
          ? { next: "none", nextDate: null, nextPurpose: "" }
          : {
              next: "list",
              ...(date ? { nextDate: date } : {}),
              ...(purpose ? { nextPurpose: purpose } : {}),
            },
        NO_CAUSE_POSTING,
      );
    }
    const parts = [
      outcome !== "keep"
        ? `${marked.length} ${plural(marked.length, "hearing", "hearings")} ${outcomeWord}`
        : null,
      notListed ? "not listed again" : date ? "next date" : null,
      !notListed && purpose ? "next purpose" : null,
    ].filter(Boolean) as string[];
    const said =
      parts.length > 1
        ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
        : (parts[0] ?? "");
    onConfirm(
      outcome !== "keep" && parts.length === 1
        ? `${said.replace(/^./, (c) => c.toUpperCase())}.`
        : `${said.replace(/^./, (c) => c.toUpperCase())} set on ${ids.length} ${plural(ids.length, "hearing", "hearings")}.`,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-title-s font-semibold">
            Bulk actions
          </DialogTitle>
          <DialogDescription className="text-body-compact">
            For {selected.length} selected{" "}
            {plural(selected.length, "hearing", "hearings")}. What you leave as it is
            stays as each hearing has it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span id="bulk-outcome-label" className="text-body-compact font-medium">
              Hearing
            </span>
            <RadioGroup
              aria-labelledby="bulk-outcome-label"
              value={outcome}
              onValueChange={(value) => setOutcome(value as Outcome)}
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              {(
                [
                  ["keep", "Leave as it is"],
                  ["complete", "End hearing"],
                  ["pass-over", "Pass over"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-10 cursor-pointer items-center gap-2 text-body-compact"
                >
                  <RadioGroupItem value={value} />
                  {label}
                </label>
              ))}
            </RadioGroup>
            {outcome !== "keep" && leaving.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-lg bg-surface-sunken p-4">
                <p className="text-body-compact font-medium">
                  {leaving.length} selected{" "}
                  {plural(leaving.length, "hearing is", "hearings are")} not{" "}
                  {outcomeWord} — already{" "}
                  {outcome === "complete" ? "ended" : "ended or passed over"}
                </p>
                <ul className="flex flex-col gap-1 text-body-compact text-muted-foreground">
                  {leaving.map((hearing) => (
                    <li key={hearing.id}>
                      <span className="tabular-nums">{hearing.item}.</span>{" "}
                      {causeTitle(hearing)}
                    </li>
                  ))}
                </ul>
                <p className="text-caption text-muted-foreground">
                  The next date and purpose still apply to them.
                </p>
              </div>
            ) : null}
          </div>
          <BulkDateField
            date={date}
            notListed={notListed}
            onDate={setDate}
            onNotListed={setNotListed}
            count={selected.length}
          />
          <div className="flex flex-col gap-2">
            <Label id="bulk-set-purpose-label">Next hearing purpose</Label>
            <PurposeField
              value={notListed ? null : purpose}
              disabled={notListed}
              onChange={setPurpose}
              placeholder={notListed ? "Not listed" : "Leave as it is"}
              labelledBy="bulk-set-purpose-label"
            />
            {purpose && !notListed ? (
              <Button
                type="button"
                variant="link"
                className="h-auto w-fit p-0"
                onClick={() => setPurpose(null)}
              >
                Leave each purpose as it is
              </Button>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" disabled={!changes} onClick={confirm}>
            Apply to {selected.length}{" "}
            {plural(selected.length, "hearing", "hearings")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The next date, on the same large calendar the row's field opens — the count under each
 * day matters more here, where one pick lists the whole selection on it.
 */
function BulkDateField({
  date,
  notListed,
  onDate,
  onNotListed,
  count,
}: {
  date: string | null;
  notListed: boolean;
  onDate: (date: string | null) => void;
  onNotListed: (notListed: boolean) => void;
  count: number;
}) {
  const today = useCourtToday();
  const session = useHearingSession();
  const [open, setOpen] = React.useState(false);
  const load = React.useMemo(
    () => (open ? listingLoad(today, session.postings) : null),
    [open, today, session.postings],
  );
  const shown = notListed
    ? "Not listed again"
    : date
      ? formatListingDate(date)
      : "Leave as it is";

  return (
    <div className="flex flex-col gap-2">
      <Label id="bulk-set-date-label">Next hearing date</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-labelledby="bulk-set-date-label bulk-set-date-value"
            className="w-full justify-start gap-2 text-left font-normal tabular-nums"
          >
            <CalendarDaysIcon data-icon="inline-start" aria-hidden />
            <span
              id="bulk-set-date-value"
              className={notListed || date ? "truncate" : "truncate text-muted-foreground"}
            >
              {shown}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={16}
          className="pointer-events-auto w-auto max-w-(--radix-popover-content-available-width) gap-0 p-0"
        >
          {load ? (
            <div className="flex flex-col">
              <div className="grid gap-4 p-4 md:grid-cols-[auto_minmax(0,16rem)]">
                <LoadCalendar
                  today={today}
                  chosen={!notListed && date ? parseIsoDay(date) : undefined}
                  disabled={notListed}
                  load={load}
                  onSelect={onDate}
                />
                <DayBreakdown
                  day={notListed ? null : date}
                  load={!notListed && date ? load.get(date) : undefined}
                />
              </div>
              <div className="flex min-h-14 items-center gap-2 border-t border-hairline px-4">
                <Checkbox
                  id="bulk-set-not-listed"
                  checked={notListed}
                  onCheckedChange={(checked) => onNotListed(checked === true)}
                />
                <Label
                  htmlFor="bulk-set-not-listed"
                  className="cursor-pointer text-body-compact font-normal"
                >
                  Not listed again
                </Label>
                <Button
                  type="button"
                  className="ml-auto"
                  onClick={() => setOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      {date && !notListed ? (
        <p className="text-caption text-muted-foreground tabular-nums">
          Adds {count} {plural(count, "hearing", "hearings")} to that day.
        </p>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── the steno's shared text ───────────────────────────── */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain text as the editor's paragraphs: one `<p>` per line, an empty line kept. */
function paragraphs(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${line ? escapeHtml(line) : "<br>"}</p>`)
    .join("");
}

/** Whether the steno may still add words to this listing's order. */
function stillDrafting(
  hearing: CourtHearing,
  pending: PendingOrders,
  signing: OrderSigning,
): boolean {
  const entry = pending[hearing.id];
  return !entry?.sent && signing[hearing.id] !== "signed";
}

/**
 * One piece of text, typed once and added at the end of each selected listing's order —
 * the words that are the same across a run of matters ("Accused absent. Issue
 * warrant."). Each order then opens on screen E with it, to be read and finished one by
 * one; nothing is sent for signing from here.
 */
function OrderTextDialog({
  open,
  selected,
  pending,
  signing,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  selected: CourtHearing[];
  pending: PendingOrders;
  signing: OrderSigning;
  onOpenChange: (open: boolean) => void;
  onConfirm: (message: string) => void;
}) {
  const today = useCourtToday();
  const [text, setText] = React.useState("");

  const taking = selected.filter((hearing) =>
    stillDrafting(hearing, pending, signing),
  );
  const leaving = selected.filter(
    (hearing) => !stillDrafting(hearing, pending, signing),
  );
  const empty = text.trim().length === 0;

  function confirm() {
    const html = paragraphs(text.trim());
    const plain = text.trim();
    for (const hearing of taking) {
      const initial = orderInitialDraft(initialOrderDraft(hearing, hearing.status, today));
      updateOrderDraft(
        editorDraftKey(hearing.id),
        (current) => {
          const body = current.body ?? { html: "", text: "" };
          const had = body.text.trim().length > 0;
          return {
            ...current,
            body: {
              html: had ? `${body.html}${html}` : html,
              text: had ? `${body.text}\n${plain}` : plain,
            },
          };
        },
        initial,
      );
      noteOrderDraft({
        key: hearing.id,
        heading: causeTitle(hearing),
        caseNumber: hearing.caseNumber,
        origin: `Hearing · ${courtHearingPurposeLabel(hearing.purpose)}`,
        orderHref: `/employee/hearings/${hearing.id}/order`,
      });
      noteOrderTextEdited(hearing.id);
    }
    onConfirm(
      `Text added to ${taking.length} ${plural(taking.length, "order", "orders")}. Nothing was sent for signing.`,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-title-s font-semibold">
            Add the same text to {taking.length}{" "}
            {plural(taking.length, "order", "orders")}
          </DialogTitle>
          <DialogDescription className="text-body-compact">
            It goes at the end of each order&rsquo;s text. Each order can still be
            edited on its own.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-order-text">Text</Label>
          <Textarea
            id="bulk-order-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            placeholder="For example: Accused absent. Issue bailable warrant."
          />
        </div>
        {leaving.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg bg-surface-sunken p-4">
            <p className="text-body-compact font-medium">
              {leaving.length} selected{" "}
              {plural(leaving.length, "order is", "orders are")} left out
            </p>
            <ul className="flex flex-col gap-1 text-body-compact text-muted-foreground">
              {leaving.map((hearing) => (
                <li key={hearing.id}>
                  <span className="tabular-nums">{hearing.item}.</span>{" "}
                  {causeTitle(hearing)} —{" "}
                  {signing[hearing.id] === "signed"
                    ? "already signed"
                    : "sent for signing"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={empty || taking.length === 0}
            onClick={confirm}
          >
            Add to {taking.length} {plural(taking.length, "order", "orders")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
