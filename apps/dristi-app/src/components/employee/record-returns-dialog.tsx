"use client";

import * as React from "react";

import {
  StagedOverlay,
  useStagedFlow,
} from "@/components/chrome/staged-overlay";
import { Identifier } from "@/components/chrome/identifier";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogDescription } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UploadedDocField } from "@/components/cases/uploaded-doc-field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { causeTitle, isoDay } from "@/lib/employee/hearings";
import {
  courtProcessTypeInline,
  courtProcessTypeLabel,
  nonServiceReasonsFor,
  processAct,
  processOutcomeWord,
  type CourtProcess,
  type NonServiceReason,
  type ProcessOutcome,
} from "@/lib/employee/sign-process";
import { cn } from "@/lib/utils";
import { useCourt, useCourtText } from "@/components/court/court-provider";
import { OutcomeHeader } from "@/components/feedback";

/** The covers being marked, then what was recorded — one scene, settling in place. */
type Stage = "record" | "done";
const ORDER = ["record", "done"] as const;
const SCENE: Record<Stage, string> = { record: "act", done: "act" };

const ACT = processAct("record");

/** What the clerk has marked for one cover so far. */
export type ReturnMark = {
  served?: boolean;
  reason?: NonServiceReason;
  comment?: string;
  file?: File | null;
};

/**
 * The outcome a finished mark records (`DSP-08`): the status, the reason where it was not
 * served (`DSP-09`), the comment and the file, each only where given.
 */
export function outcomeOf(mark: ReturnMark | undefined): ProcessOutcome {
  const comment = mark?.comment?.trim();
  const extra = {
    ...(comment ? { comment } : {}),
    ...(mark?.file ? { file: mark.file } : {}),
  };
  return mark?.served
    ? { served: true, ...extra }
    : { served: false, reason: mark?.reason ?? "Other", ...extra };
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Recording what came back on a stack of registered-post covers — in one window.
 *
 * The reference records a return one process at a time: open a row, pick a status, pick
 * a reason, pick a date, save, and again for the next cover. Returns arrive as a stack,
 * so this takes the pile the clerk built on Service (type the number on each cover, press
 * Enter) and marks all of it at once: **one date for the batch**, because a stack is
 * opened on one day, and **one outcome per cover**, because each cover says its own.
 *
 * - Each row is a two-way choice in the cover's own words — Delivered / Not delivered,
 *   or Executed / Not executed for a warrant — on the DS radio, as the app asks
 *   every yes/no (`YesNoField`).
 * - A cover that came back unserved asks why, from the state's reason master (`DSP-09`).
 *   The question appears only then.
 * - Once a cover has an answer, it takes a comment and a supporting file (`DSP-08`) —
 *   the acknowledgement card, or the station's report. Neither holds Record back.
 * - The common case is one press: everything served.
 *
 * Record waits until every cover has an answer. The line beside it says how many are
 * left, and says it aloud as it changes — a disabled button with no reason given is a
 * dead end (ACCESSIBILITY §3).
 *
 * Then the same window settles: the title says what was recorded and the product's
 * success band says how many were served and where the covers are now. **It writes nothing** — the screen's `recordProcessReturns`
 * moves the rows in the demo line.
 */
export function RecordReturnsDialog({
  rows,
  open,
  onOpenChange,
  onRecord,
  triggerRef,
  onReturnFocus,
}: {
  /** The covers in hand. Read once per opening. */
  rows: CourtProcess[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Commit. Must not close the dialog — the settled stage is what comes next. */
  onRecord: (outcomes: Map<string, ProcessOutcome>, on: string) => void;
  /** The bar button this was opened from, to hand focus back to on Back. */
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  /** Where focus goes once recording has emptied the selection. */
  onReturnFocus: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <RecordReturnsBody
          rows={rows}
          onClose={() => onOpenChange(false)}
          onRecord={onRecord}
          triggerRef={triggerRef}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

function RecordReturnsBody({
  rows: given,
  onClose,
  onRecord,
  triggerRef,
  onReturnFocus,
}: {
  rows: CourtProcess[];
  onClose: () => void;
  onRecord: (outcomes: Map<string, ProcessOutcome>, on: string) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onReturnFocus: () => void;
}) {
  const flow = useStagedFlow({ order: ORDER, scene: SCENE });
  const done = flow.stage === "done";
  const [tally, setTally] = React.useState({ served: 0, total: 0 });
  /* Whether Record was pressed — focus goes to the search, not the emptied bar. */
  const recorded = React.useRef(false);
  /* Captured on the first render: recording moves these rows off the list while the
     window is closing. */
  const [rows] = React.useState(given);
  const [returnedOn, setReturnedOn] = React.useState<Date | undefined>(
    () => new Date(),
  );
  const [marks, setMarks] = React.useState<Record<string, ReturnMark>>({});

  const answered = rows.filter((process) => {
    const mark = marks[process.id];
    return mark?.served === true || (mark?.served === false && !!mark.reason);
  }).length;
  const left = rows.length - answered;
  const ready = left === 0 && returnedOn !== undefined;
  const cases = new Set(rows.map((process) => process.caseNumber)).size;
  const subject =
    rows.length === 1 ? "1 return" : `${rows.length} returns`;

  function mark(id: string, next: ReturnMark) {
    setMarks((current) => ({ ...current, [id]: { ...current[id], ...next } }));
  }

  function markAllServed() {
    /* Every cover served, keeping any comment or file already given. */
    setMarks((current) =>
      Object.fromEntries(
        rows.map((process) => [
          process.id,
          { ...current[process.id], served: true, reason: undefined },
        ]),
      ),
    );
  }

  function record() {
    if (!ready || !returnedOn) return;
    const outcomes = new Map<string, ProcessOutcome>();
    for (const process of rows) {
      outcomes.set(process.id, outcomeOf(marks[process.id]));
    }
    recorded.current = true;
    setTally({
      served: [...outcomes.values()].filter((outcome) => outcome.served).length,
      total: outcomes.size,
    });
    onRecord(outcomes, isoDay(returnedOn));
    flow.go("done");
  }

  /* "Mark all delivered", in the covers' own word where they share one. */
  const executed = rows.map(
    (process) => processOutcomeWord(process, true) === "Executed",
  );
  const allWord = executed.every(Boolean)
    ? "executed"
    : executed.some(Boolean)
      ? "served"
      : "delivered";

  return (
    <StagedOverlay
      className="sm:max-w-2xl"
      title={done ? ACT.done(subject) : ACT.question(subject)}
      titleRef={flow.titleRef}
      description={`Across ${cases} ${plural(cases, "case", "cases")}`}
      sceneKey={flow.sceneKey}
      motion={flow.motion}
      floor
      /* The settled stage takes the window over: mark, then title (owner, Oct 29). */
      outcome={done}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        const trigger = triggerRef.current;
        if (!recorded.current && trigger?.isConnected && !trigger.disabled) {
          trigger.focus();
          return;
        }
        onReturnFocus();
      }}
      footer={
        done ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            {/* Why Record is not ready yet, said where the button is and read out as it
                changes. */}
            <p
              className="mr-auto self-center text-body-compact text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {left > 0 ? `${left} still to mark` : ""}
            </p>
            <Button type="button" variant="outline" onClick={onClose}>
              Back
            </Button>
            <Button type="button" disabled={!ready} onClick={record}>
              {ACT.confirm}
            </Button>
          </>
        )
      }
    >
      {done ? (
        /* What was recorded and where the covers are now, as the window's outcome
           (skill `feedback-states`). */
        <OutcomeHeader
          titleFrom="dialog"
          focusTitle
          surface="card"
          title={ACT.done(subject)}
          body={
            <>
              {tally.served} served, {tally.total - tally.served} not served.{" "}
              {tally.total === 1 ? "It is" : "They are"} now in Completed in Service.
            </>
          }
        >
          <span className="text-caption text-muted-foreground tabular-nums">
            Across {cases} {plural(cases, "case", "cases")}
          </span>
        </OutcomeHeader>
      ) : (
        <div className="flex w-full flex-col gap-6">
          <DialogDescription className="text-body text-muted-foreground">
            Mark what each cover came back as. The date applies to all of them.
          </DialogDescription>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <ReturnedOnField value={returnedOn} onChange={setReturnedOn} />
            <Button type="button" variant="ghost" onClick={markAllServed}>
              Mark all {allWord}
            </Button>
          </div>

          {/* The covers are one grouped thing on the canvas, so they sit on one lifted
              panel — the card the bulk confirmation uses — with hairlines between them. */}
          <Card size="sm" className={cn(PANEL_CLASS, "gap-0 py-0")}>
            <ul className="flex flex-col px-4">
              {rows.map((process) => (
                <ReturnRow
                  key={process.id}
                  process={process}
                  mark={marks[process.id]}
                  onMark={(next) => mark(process.id, next)}
                />
              ))}
            </ul>
          </Card>
        </div>
      )}
    </StagedOverlay>
  );
}

/** The batch's date. The DS date picker has no id to point a label at, so the label
 *  names a group around it — the treatment the application forms give theirs. */
export function ReturnedOnField({
  value,
  onChange,
}: {
  value: Date | undefined;
  onChange: (value: Date | undefined) => void;
}) {
  const labelId = React.useId();
  return (
    <Field className="w-full sm:w-fit">
      <FieldLabel id={labelId}>Returned on</FieldLabel>
      <div role="group" aria-labelledby={labelId}>
        <DatePicker
          value={value}
          onValueChange={onChange}
          className="w-full sm:w-60"
        />
      </div>
    </Field>
  );
}

/**
 * One cover: which process it is, what it says, and — only if it was not served — why;
 * then, once answered, a comment and a supporting file (`DSP-08`).
 *
 * The instrument leads, because a case can have three covers in the pile and the number
 * alone does not say which this is. The rows are separated by a hairline, not boxed: the
 * dialog is already the frame (ui-craft §4).
 */
export function ReturnRow({
  process,
  mark,
  onMark,
}: {
  process: CourtProcess;
  mark: ReturnMark | undefined;
  onMark: (next: ReturnMark) => void;
}) {
  const courtText = useCourtText();
  const { court } = useCourt();
  const inline = courtProcessTypeInline(process.type);
  const reasonId = React.useId();
  const commentId = React.useId();
  const radioId = React.useId();
  const value =
    mark?.served === true ? "served" : mark?.served === false ? "unserved" : "";

  return (
    <li className="flex flex-col gap-3 border-b border-hairline py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-body-compact font-medium">
            {courtProcessTypeLabel(process.type)}
            <span className="text-muted-foreground" aria-hidden>
              {" · "}
            </span>
            <Identifier
              value={process.caseNumber}
              label="case number"
              copyable={false}
            />
          </p>
          <p className="text-body-compact text-muted-foreground">
            {causeTitle(process)}
          </p>
        </div>
        {/* Two answers, both visible, on the DS radio — the app's own yes/no
            (`YesNoField`, the bail dialog's), laid side by side. */}
        <RadioGroup
          value={value}
          onValueChange={(next) => {
            if (next === "served") onMark({ served: true, reason: undefined });
            if (next === "unserved") onMark({ served: false });
          }}
          aria-label={`What the ${inline} in ${courtText(process.caseNumber)} came back as`}
          className="flex flex-wrap gap-x-6 gap-y-1"
        >
          {(["served", "unserved"] as const).map((option) => (
            <div key={option} className="flex min-h-10 items-center gap-2">
              <RadioGroupItem value={option} id={`${radioId}-${option}`} />
              <Label htmlFor={`${radioId}-${option}`}>
                {processOutcomeWord(process, option === "served")}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {mark?.served === false ? (
        <Field>
          <FieldLabel htmlFor={reasonId}>Reason</FieldLabel>
          <Select
            value={mark.reason ?? ""}
            onValueChange={(reason) =>
              onMark({ reason: reason as NonServiceReason })
            }
          >
            <SelectTrigger id={reasonId} className="w-full sm:w-72">
              <SelectValue placeholder="Choose a reason" />
            </SelectTrigger>
            <SelectContent>
              {nonServiceReasonsFor(court).map((reason) => (
                <SelectItem key={reason} value={reason}>
                  {reason}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {mark?.served !== undefined ? (
        <>
          <Field>
            <FieldLabel htmlFor={commentId}>
              Comment
              <span className="font-normal text-muted-foreground"> (optional)</span>
            </FieldLabel>
            <Textarea
              id={commentId}
              value={mark.comment ?? ""}
              rows={2}
              onChange={(event) => onMark({ comment: event.target.value })}
            />
          </Field>
          <UploadedDocField
            label="Supporting file"
            file={mark.file ?? null}
            onFileChange={(file) => onMark({ file })}
          />
        </>
      ) : null}
    </li>
  );
}
