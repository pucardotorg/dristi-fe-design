"use client";

import * as React from "react";
import { CircleCheckIcon, TriangleAlertIcon } from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListingDateField } from "@/components/employee/listing-date-field";
import { Field, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  moveDecisionDate,
  onboard,
  setADateUsed,
  setReviewDate,
  type CourtSeat,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";
import { allotApplicationNumber, applyStep } from "@/lib/applications/store";
import { formatCaseDate } from "@/lib/cases/types";
import { causeTitleOf, nextHearingOf } from "@/lib/employee/application-tasks";
import { cn } from "@/lib/utils";

export type BulkAct = {
  kind: "onboard" | "defer" | "relist";
  rows: LifecycleApplication[];
  label: string;
};

function plural(count: number): string {
  return count === 1 ? "1 application" : `${count} applications`;
}

function dayOf(date: Date | undefined): string {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * One act on several applications at once — only the acts that are a date, never a
 * judgment (owner, 2026-10-07). Onboarding lists each for its own case's next hearing by
 * default, the BRD's own suggestion (`ALC-10`, `ALC-25`); a case with no hearing on record
 * is named and left out, unless one date is chosen for all.
 *
 * It asks, then settles in the same window: the product's success band, then Done.
 */
export function ApplicationBulkDialog({
  act,
  on,
  seat,
  onOpenChange,
  onDone,
}: {
  act: BulkAct | null;
  on: string;
  seat: CourtSeat;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string, ids: string[]) => void;
}) {
  return (
    <Dialog open={act !== null} onOpenChange={onOpenChange}>
      {act ? (
        <BulkBody
          key={`${act.kind}-${act.rows.map((app) => app.id).join(",")}`}
          act={act}
          on={on}
          seat={seat}
          onClose={() => onOpenChange(false)}
          onDone={onDone}
        />
      ) : null}
    </Dialog>
  );
}

function BulkBody({
  act,
  on,
  seat,
  onClose,
  onDone,
}: {
  act: BulkAct;
  on: string;
  seat: CourtSeat;
  onClose: () => void;
  onDone: (message: string, ids: string[]) => void;
}) {
  const [rows] = React.useState(act.rows);
  const hearingOf = (app: LifecycleApplication) => nextHearingOf(app, on);
  /* With no hearing on any of them, "each for its next hearing" would onboard none. */
  const [mode, setMode] = React.useState<"hearing" | "date" | "now">(() =>
    rows.some((app) => hearingOf(app)) ? "hearing" : "date",
  );
  const [date, setDate] = React.useState<Date | undefined>();
  const [invite, setInvite] = React.useState(true);
  const [result, setResult] = React.useState<{
    title: string;
    line: string;
    left: string;
  } | null>(null);
  const doneRef = React.useRef<HTMLButtonElement>(null);
  const ids = {
    mode: React.useId(),
    date: React.useId(),
    invite: React.useId(),
    radio: React.useId(),
  };

  const withHearing = rows.filter((app) => hearingOf(app));
  const day = dayOf(date);
  const badDate = Boolean(day) && day <= on;

  /* The act removed what had focus; the keyboard lands on the way out. */
  React.useEffect(() => {
    if (result) doneRef.current?.focus();
  }, [result]);

  const ready =
    act.kind === "onboard"
      ? mode === "now" || (mode === "hearing" ? withHearing.length > 0 : Boolean(day) && !badDate)
      : Boolean(day) && !badDate;

  function confirm() {
    const done: string[] = [];
    if (act.kind === "onboard") {
      const targets = mode === "hearing" ? withHearing : rows;
      for (const app of targets) {
        const decideOn = mode === "hearing" ? hearingOf(app)! : day;
        const number = allotApplicationNumber(on);
        const step = applyStep(app.id, (current) =>
          onboard(
            current,
            seat,
            number,
            mode === "now" ? { mode: "now" } : { mode: "date", decideOn, inviteObjections: invite },
            on,
          ),
        );
        if (step.ok) done.push(app.id);
      }
      const left = rows.length - done.length;
      setResult({
        title: `${plural(done.length)} onboarded`,
        line:
          mode === "now"
            ? `${plural(done.length)} onboarded and taken up today. They are in To decide.`
            : `${plural(done.length)} onboarded and listed${mode === "hearing" ? " for their next hearings" : ` for ${formatCaseDate(day)}`}. They are in Upcoming.`,
        left: left > 0 ? `${plural(left)} with no hearing listed ${left === 1 ? "is" : "are"} still in To onboard.` : "",
      });
      onDone(`${plural(done.length)} onboarded.`, done);
      return;
    }
    for (const app of rows) {
      const step = applyStep(app.id, (current) =>
        act.kind === "defer"
          ? setReviewDate(current, seat, day, on)
          : moveDecisionDate(current, seat, day, on),
      );
      if (step.ok) done.push(app.id);
    }
    setResult({
      title: `${plural(done.length)} ${act.kind === "defer" ? "deferred" : "relisted"}`,
      line:
        act.kind === "defer"
          ? `${plural(done.length)} deferred. They return to To onboard on ${formatCaseDate(day)}.`
          : `${plural(done.length)} relisted for ${formatCaseDate(day)}.`,
      left: "",
    });
    onDone(
      act.kind === "defer" ? `${plural(done.length)} deferred.` : `${plural(done.length)} relisted.`,
      done,
    );
  }

  const title =
    act.kind === "onboard"
      ? `Onboard ${plural(rows.length)}?`
      : act.kind === "defer"
        ? `Defer the review of ${plural(rows.length)}?`
        : `Relist ${plural(rows.length)}?`;
  const deferredBefore = rows.filter(setADateUsed).length;

  return (
    <ChromeDialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-title-s font-semibold">
          {result ? result.title : title}
        </DialogTitle>
        {result ? (
          <DialogDescription
            role="status"
            className={cn(
              "flex w-full items-start gap-2 rounded-lg bg-success px-4 py-3 text-body text-success-foreground",
              RESOLVE_IN_PLACE,
            )}
          >
            <CircleCheckIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span>{result.line}</span>
          </DialogDescription>
        ) : (
          <DialogDescription className="text-body-compact text-muted-foreground">
            {act.kind === "onboard"
              ? "Each will be numbered and made visible to the opposite party."
              : act.kind === "defer"
                ? "Nothing is decided. They stay unnumbered until onboarded."
                : "The deadline to object moves to the day before, where one was called for."}
          </DialogDescription>
        )}
        {result?.left ? (
          <p className="flex items-start gap-2 text-body-compact text-warning-ink">
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            {result.left}
          </p>
        ) : null}
      </DialogHeader>

      {result ? null : (
        <div className="flex flex-col gap-4">
          {act.kind === "onboard" ? (
            <Field>
              <FieldLabel id={ids.mode}>When will the court take them up?</FieldLabel>
              <RadioGroup
                aria-labelledby={ids.mode}
                value={mode}
                onValueChange={(value) => setMode(value as typeof mode)}
              >
                {[
                  { id: "hearing", label: "List on each case's next date of hearing" },
                  { id: "date", label: "List all on one date" },
                  { id: "now", label: "Take up today" },
                ].map((option) => (
                  <div key={option.id} className="flex min-h-10 items-center gap-2">
                    <RadioGroupItem value={option.id} id={`${ids.radio}-${option.id}`} />
                    <Label htmlFor={`${ids.radio}-${option.id}`}>{option.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </Field>
          ) : null}

          {act.kind === "onboard" && mode === "hearing" ? (
            <ul className="flex flex-col rounded-lg border border-hairline bg-surface-sunken">
              {rows.map((app) => {
                const hearing = hearingOf(app);
                return (
                  <li
                    key={app.id}
                    className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-2 text-body-compact last:border-b-0"
                  >
                    <span className="min-w-0">{causeTitleOf(app)}</span>
                    <span className={cn("shrink-0 tabular-nums", !hearing && "text-warning-ink")}>
                      {hearing ? formatCaseDate(hearing) : "No hearing listed"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {act.kind !== "onboard" || mode === "date" ? (
            <ListingDateField
              id={ids.date}
              label={
                act.kind === "defer"
                  ? "Bring back for review on"
                  : act.kind === "relist"
                    ? "Relist on"
                    : "List on"
              }
              value={date}
              on={on}
              onChange={setDate}
            />
          ) : null}

          {act.kind === "onboard" && mode !== "now" ? (
            <Field>
              <FieldLabel id={ids.invite}>Call for objections?</FieldLabel>
              <SegmentedControl
                type="single"
                size="compact"
                value={invite ? "yes" : "no"}
                onValueChange={(value) => {
                  if (value) setInvite(value === "yes");
                }}
                aria-labelledby={ids.invite}
                className="w-full [&>*]:flex-1 [&>*>span]:w-full"
              >
                <SegmentedControlItem value="yes" className="flex-1">
                  Yes
                </SegmentedControlItem>
                <SegmentedControlItem value="no" className="flex-1">
                  No
                </SegmentedControlItem>
              </SegmentedControl>
            </Field>
          ) : null}

          {act.kind === "defer" && deferredBefore > 0 ? (
            <Banner variant="warning">
              {deferredBefore === 1
                ? "One of these has already been deferred once."
                : `${deferredBefore} of these have already been deferred once.`}
            </Banner>
          ) : null}
        </div>
      )}

      <DialogFooter>
        {result ? (
          <Button ref={doneRef} type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              Back
            </Button>
            <Button type="button" disabled={!ready} onClick={confirm}>
              {act.kind === "onboard"
                ? mode === "hearing"
                  ? `Onboard ${withHearing.length}`
                  : `Onboard ${rows.length}`
                : act.kind === "defer"
                  ? "Defer review"
                  : "Relist"}
            </Button>
          </>
        )}
      </DialogFooter>
    </ChromeDialogContent>
  );
}
