"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";
import { toast } from "sonner";

import { ReviewRow } from "@/components/cases/filing-form-shared";
import { Identifier } from "@/components/chrome/identifier";
import { applicationOrderHref } from "@/components/employee/application-order-screen";
import type { ApplicationOrderDecision } from "@/lib/employee/application-order-decision";
import { ApplicationReviewOverlay } from "@/components/employee/application-review-dialog";
import { useCourtRole } from "@/components/employee/use-court-role";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { decodeDraft } from "@/lib/applications/form-codec";
import {
  acceptanceNeedsHearingDate,
  applicationStatusLabel,
  applicationStatusVariant,
  canDraftOrder,
  canSignOrder,
  canTakeSystemAction,
  courtTaskOf,
  decisionText,
  discardOrder,
  dismissalText,
  draftOrder,
  moveDecisionDate,
  objectionDeadline,
  onboard,
  setADateUsed,
  setReviewDate,
  sideLabel,
  signOrder,
  suggestedDate,
  type CourtSeat,
  type CourtTaskKind,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";
import {
  allotApplicationNumber,
  allotOrderId,
  applyStep,
  today,
  type Result,
} from "@/lib/applications/store";
import { formatCaseDate } from "@/lib/cases/types";
import {
  caseOf,
  causeTitleOf,
  courtDocumentOf,
} from "@/lib/employee/application-tasks";
import { useCourtText } from "@/components/court/court-provider";

/**
 * One application task, answered (`handovers/application-lifecycle.md`, "The decision
 * points").
 *
 * The Review application task is the first gate — onboard it (the usual path), set a
 * date once, or dismiss it. Onboarding carries the second question with it: decide now,
 * decide on a date (inviting objections by default), or open the order screen for
 * something else. The Decide application task is the second gate — accept or reject,
 * or move the date.
 *
 * Who may do what follows `ALC-22`: onboarding and every date are system actions —
 * the magistrate's, and for now the bench clerk's too (`canTakeSystemAction`); an order — dismissal, acceptance, rejection — may be drafted from any
 * court seat but takes effect only on the magistrate's signature. Signing here is the
 * same labelled sandbox the Sign orders queue is: it records the signature, nothing is
 * sent anywhere.
 */
export function ApplicationTaskDialog({
  application,
  all,
  queue,
  onOpenChange,
  onReturnFocus,
}: {
  application: LifecycleApplication | null;
  all: LifecycleApplication[];
  /** The queue the dialog is open on — where its orders open and lead back to. */
  queue: CourtTaskKind;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
}) {
  return (
    <Dialog open={application !== null} onOpenChange={onOpenChange}>
      {application ? (
        <TaskBody
          key={application.id}
          application={application}
          all={all}
          queue={queue}
          onClose={() => onOpenChange(false)}
          onReturnFocus={onReturnFocus}
        />
      ) : null}
    </Dialog>
  );
}

type Mode =
  | "choose"
  | "set-date"
  | "onboard"
  | "dismiss"
  | "accept"
  | "reject"
  | "move-date";

function TaskBody({
  application,
  all,
  queue,
  onClose,
  onReturnFocus,
}: {
  application: LifecycleApplication;
  all: LifecycleApplication[];
  queue: CourtTaskKind;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const courtText = useCourtText();
  const router = useRouter();
  const seat = useCourtRole() as CourtSeat;
  const on = today();
  const record = caseOf(application);
  const suggestion = suggestedDate(record?.nextHearing?.on, on);
  const [mode, setMode] = useState<Mode>("choose");
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(suggestion ?? "");
  const [onboardMode, setOnboardMode] = useState<"now" | "date">("date");
  /* `ALC-25`: until types carry their own setting, every one defaults to "on a date"
     with objections invited. */
  const [invite, setInvite] = useState(true);
  const [newHearingOn, setNewHearingOn] = useState("");
  const ids = { date: useId(), invite: useId(), hearing: useId(), group: useId() };

  /* A step's panel sits under the facts, often below the column's fold: bring it
     into view when it opens, so the order or the date being set is on screen. */
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mode !== "choose") panelRef.current?.scrollIntoView({ block: "nearest" });
  }, [mode]);

  const task = courtTaskOf(application);
  const document = useMemo(() => courtDocumentOf(application), [application]);
  const objection = application.objectionId
    ? all.find((item) => item.id === application.objectionId)
    : undefined;
  const filedOn = formatCaseDate(application.submittedOn ?? application.createdOn);
  const mayAct = canTakeSystemAction(seat);

  function run(step: () => Result, next: Mode = "choose") {
    const result = step();
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    setMode(next);
    return true;
  }

  const id = application.id;

  /* A date set is the court's answer for now: the application leaves this queue or
     waits for that day, so the dialog closes and says when it comes back — rather than
     showing the next decision's buttons as if it were due now (owner, 2026-10-14). */
  function settle(step: () => Result, message: string) {
    if (!run(step)) return;
    toast(message);
    onClose();
  }

  /* The order steps open the real order screen rather than drafting a one-line order
     here (owner, 2026-10-13), with the decision made here pre-added as its item
     (owner, 2026-10-14). It opens under the queue this dialog is on, so its way back
     is the way the person came. */
  function openOrder(decision?: ApplicationOrderDecision) {
    router.push(applicationOrderHref(queue, id, decision));
  }

  function confirmOnboard() {
    const number = allotApplicationNumber(on);
    /* `ALC-08`: "now" is decided at once. The dialog stays open, on the Decide step —
       Accept or Reject — so the order opens with that decision already in its workflow
       (it used to open an empty order, with nothing to say what was being decided). */
    const step = () =>
      applyStep(id, (app) =>
        onboard(
          app,
          seat,
          number,
          onboardMode === "now"
            ? { mode: "now" }
            : { mode: "date", decideOn: date, inviteObjections: invite },
          on,
        ),
      );
    /* "On a date" is settled for now: it comes back on that date. */
    if (onboardMode === "now") run(step);
    else settle(step, `Onboarded. It comes back to be decided on ${formatCaseDate(date)}.`);
  }

  /* Written in the selected court's numbers (`CourtSwitch`), since the order is
     drafted from it as it reads here. */
  function orderText(kind: "dismiss" | "accept" | "reject"): string {
    if (kind === "dismiss") return courtText(dismissalText(application, filedOn));
    return courtText(
      decisionText(
        application,
        kind,
        newHearingOn ? formatCaseDate(newHearingOn) : undefined,
      ),
    );
  }

  function saveOrder(kind: "dismiss" | "accept" | "reject", andSign: boolean) {
    const drafted = applyStep(id, (app) =>
      draftOrder(
        app,
        seat,
        {
          kind,
          text: orderText(kind),
          newHearingOn: kind === "accept" && newHearingOn ? newHearingOn : undefined,
        },
        on,
      ),
    );
    if (!drafted.ok) {
      setError(drafted.error);
      return;
    }
    if (andSign) {
      run(() => applyStep(id, (app) => signOrder(app, seat, allotOrderId(), on)));
    } else {
      setError(null);
      setMode("choose");
    }
  }

  const pending = application.pendingOrder;
  const closed = !task;

  const aside = (
    <div ref={panelRef} className="flex flex-col gap-4">
      {objection ? (
        <section className="flex flex-col gap-2 rounded-lg border border-hairline p-4">
          <h3 className="text-body-compact font-semibold">
            Objection filed by the {sideLabel(objection.side).toLowerCase()}
          </h3>
          <p className="text-body-compact whitespace-pre-wrap">
            {decodeDraft(objection.form).applicationDetails.text.trim() || "No grounds were entered."}
          </p>
          <p className="text-caption text-muted-foreground tabular-nums">
            Filed {formatCaseDate(objection.submittedOn ?? objection.createdOn)}
            {objection.temporaryId ? ` · ${objection.temporaryId}` : ""}
          </p>
        </section>
      ) : null}

      {error ? <Banner variant="error">{error}</Banner> : null}

      {closed ? (
        <Banner variant="info">
          {application.linkedOrder
            ? `Decided by the order signed ${formatCaseDate(application.linkedOrder.signedOn)}.`
            : "There is nothing open on this application."}
        </Banner>
      ) : pending && mode === "choose" ? (
        <OrderPreview
          title="Order awaiting the magistrate's signature"
          text={pending.text}
          note={`Drafted from the ${seatLabel(pending.draftedBy)} seat.`}
        />
      ) : mode === "choose" ? (
        !mayAct ? (
          <p className="text-body-compact text-muted-foreground">
            {`You are working as the ${seatLabel(seat)}. `}
            {task?.kind === "review"
              ? "Onboarding and setting a date are for the magistrate and bench clerk only. You can draft a dismissal for their signature."
              : "Moving the date is for the magistrate and bench clerk only. You can draft the order accepting or rejecting it, for their signature."}
          </p>
        ) : null
      ) : mode === "set-date" || mode === "move-date" ? (
        <DateField
          id={ids.date}
          label={mode === "set-date" ? "Review it again on" : "Decide it on"}
          value={date}
          onChange={setDate}
          min={on}
          hint={dateHint(suggestion)}
        />
      ) : mode === "onboard" ? (
        <div className="flex flex-col gap-4">
          <p className="text-body-compact">
            Onboarding allots the application number now. Say when the court will
            decide it.
          </p>
          <RadioGroup
            aria-labelledby={ids.group}
            value={onboardMode}
            onValueChange={(value) => setOnboardMode(value as "now" | "date")}
            className="flex flex-col gap-3"
          >
            <span id={ids.group} className="sr-only">
              When the court decides it
            </span>
            <label className="flex min-h-10 items-start gap-3 text-body-compact">
              <RadioGroupItem value="now" className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Decide now</span>
                <span className="text-muted-foreground">
                  Accept or reject it next, here. Nobody is asked to object.
                </span>
              </span>
            </label>
            <label className="flex min-h-10 items-start gap-3 text-body-compact">
              <RadioGroupItem value="date" className="mt-0.5" />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Decide on a date</span>
                <span className="text-muted-foreground">
                  A Decide application task comes back on that date.
                </span>
              </span>
            </label>
          </RadioGroup>
          {onboardMode === "date" ? (
            <div className="flex flex-col gap-4 border-l border-hairline pl-4">
              <DateField
                id={ids.date}
                label="Decide it on"
                value={date}
                onChange={setDate}
                min={on}
                hint={dateHint(suggestion)}
              />
              <Field orientation="horizontal" className="items-start">
                <Checkbox
                  id={ids.invite}
                  checked={invite}
                  onCheckedChange={(value) => setInvite(value === true)}
                />
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor={ids.invite}>
                    Ask the {sideLabel(otherSideOf(application)).toLowerCase()} to
                    file an objection
                  </FieldLabel>
                  <FieldDescription>
                    {date
                      ? `Due by the end of ${formatCaseDate(objectionDeadline(date))}, the day before the decision.`
                      : "Due by the end of the day before the decision."}{" "}
                    The other side can see the application either way.
                  </FieldDescription>
                </div>
              </Field>
            </div>
          ) : null}
          <p className="text-caption text-muted-foreground">
            Or{" "}
            <Link
              href={applicationOrderHref(queue, id)}
              className="underline underline-offset-4"
            >
              open the order screen
            </Link>{" "}
            for something else — this application stays as it is.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {mode === "accept" && acceptanceNeedsHearingDate(application.type) ? (
            <DateField
              id={ids.hearing}
              label="New hearing date"
              value={newHearingOn}
              onChange={setNewHearingOn}
              min={on}
              hint="Accepting this application reschedules the hearing to this date."
            />
          ) : null}
          <OrderPreview
            title={
              mode === "dismiss"
                ? "Order dismissing the application"
                : mode === "accept"
                  ? "Order accepting the application"
                  : "Order rejecting the application"
            }
            text={orderText(mode as "dismiss" | "accept" | "reject")}
            note={
              mode === "dismiss"
                ? "The application has no number yet, so the order names it by its kind, who raised it and when."
                : "Takes effect when the magistrate signs it."
            }
          />
        </div>
      )}
    </div>
  );

  const footer = closed ? (
    <DialogFooter className="mx-0 mb-0 shrink-0">
      <DialogClose asChild>
        <Button type="button" variant="outline">
          Close
        </Button>
      </DialogClose>
    </DialogFooter>
  ) : (
    <DialogFooter className="mx-0 mb-0 shrink-0 sm:justify-between">
      {pending && mode === "choose" ? (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => run(() => applyStep(id, (app) => discardOrder(app, on)))}
          >
            Discard draft
          </Button>
          {canSignOrder(seat) ? (
            <Button
              type="button"
              onClick={() =>
                run(() =>
                  applyStep(id, (app) => signOrder(app, seat, allotOrderId(), on)),
                )
              }
            >
              Sign order
            </Button>
          ) : null}
        </>
      ) : mode === "choose" && task?.kind === "review" ? (
        <ReviewChoices
          magistrate={mayAct}
          dateUsed={setADateUsed(application)}
          canDraft={canDraftOrder(seat)}
          onDismiss={() => openOrder("dismiss")}
          onSetDate={() => {
            setDate(suggestion ?? "");
            setMode("set-date");
          }}
          onOnboard={() => {
            setDate(suggestion ?? "");
            setMode("onboard");
          }}
        />
      ) : mode === "choose" && task?.kind === "decide" ? (
        <>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {mayAct ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDate("");
                  setMode("move-date");
                }}
              >
                Move the date
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => openOrder("reject")}
            >
              Reject
            </Button>
            <Button type="button" onClick={() => openOrder("accept")}>
              Accept
            </Button>
          </div>
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError(null);
              setMode("choose");
            }}
          >
            Back
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {mode === "set-date" ? (
              <Button
                type="button"
                onClick={() =>
                  settle(
                    () => applyStep(id, (app) => setReviewDate(app, seat, date, on)),
                    `It comes back to be reviewed on ${formatCaseDate(date)}.`,
                  )
                }
              >
                Set the date
              </Button>
            ) : mode === "move-date" ? (
              <Button
                type="button"
                onClick={() =>
                  settle(
                    () => applyStep(id, (app) => moveDecisionDate(app, seat, date, on)),
                    `It comes back to be decided on ${formatCaseDate(date)}.`,
                  )
                }
              >
                Move the date
              </Button>
            ) : mode === "onboard" ? (
              <Button type="button" onClick={confirmOnboard}>
                Onboard application
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant={canSignOrder(seat) ? "outline" : "default"}
                  onClick={() =>
                    saveOrder(mode as "dismiss" | "accept" | "reject", false)
                  }
                >
                  Save for signature
                </Button>
                {canSignOrder(seat) ? (
                  <Button
                    type="button"
                    onClick={() =>
                      saveOrder(mode as "dismiss" | "accept" | "reject", true)
                    }
                  >
                    Sign order
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </DialogFooter>
  );

  return (
    <ApplicationReviewOverlay
      title={application.typeLabel}
      badge={
        <Badge variant={applicationStatusVariant(application.status)}>
          {applicationStatusLabel(application.status)}
        </Badge>
      }
      description={
        <>
          {record ? (
            <Identifier
              value={record.caseNumber}
              label="case number"
              copyable={false}
            />
          ) : null}
          {" · "}
          {causeTitleOf(application)}
        </>
      }
      facts={
        <>
          {task ? (
            <ReviewRow term="Task">
              {task.label}, due{" "}
              <span className="tabular-nums">{formatCaseDate(task.dueOn)}</span>
            </ReviewRow>
          ) : null}
          <ReviewRow term="Filed on">
            <span className="tabular-nums">{filedOn}</span>
          </ReviewRow>
          <ReviewRow term="Application number">
            {application.applicationNumber ? (
              <Identifier
                value={application.applicationNumber}
                label="application number"
              />
            ) : (
              "Allotted on onboarding"
            )}
          </ReviewRow>
          {application.temporaryId ? (
            <ReviewRow term="Temporary identifier">
              <Identifier
                value={application.temporaryId}
                label="temporary identifier"
              />
            </ReviewRow>
          ) : null}
          <ReviewRow term="Raised by">
            {application.raisedBy ?? application.createdByName} for the{" "}
            {sideLabel(application.side).toLowerCase()}, on behalf of{" "}
            {application.onBehalfOf}
          </ReviewRow>
          <ReviewRow term="Objection">
            {objection
              ? "Filed — shown below"
              : application.objectionsInvited
                ? `Invited, due by the end of ${formatCaseDate(application.objectionDueBy ?? on)}; none filed yet`
                : application.objectionsInvited === false
                  ? "Not invited"
                  : "None"}
          </ReviewRow>
        </>
      }
      aside={aside}
      footer={footer}
      document={
        document ?? {
          court: record?.court ?? "",
          caseNumber: record?.caseNumber ?? "",
          matter: causeTitleOf(application),
          title: application.typeLabel,
          filedFor: application.onBehalfOf,
          facts: [],
          paragraphs: [],
          prayer: "",
          dated: filedOn,
        }
      }
      onReturnFocus={onReturnFocus}
    />
  );
}

/**
 * The first gate's three answers. Onboard is the usual path, so it is the one teal
 * action. Set a date is offered once (`ALC-05`). Dismiss is always available but stays
 * tucked away until a date has been set once — then it is shown plainly, as the
 * natural next step (`ALC-19`, `ALC-20`).
 */
function ReviewChoices({
  magistrate,
  dateUsed,
  canDraft,
  onDismiss,
  onSetDate,
  onOnboard,
}: {
  magistrate: boolean;
  dateUsed: boolean;
  canDraft: boolean;
  onDismiss: () => void;
  onSetDate: () => void;
  onOnboard: () => void;
}) {
  const dismissShown = dateUsed || !magistrate;
  return (
    <>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        {canDraft && dismissShown ? (
          <Button type="button" variant="outline" onClick={onDismiss}>
            Dismiss application
          </Button>
        ) : null}
        {canDraft && !dismissShown ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost">
                More
                <ChevronDownIcon data-icon="inline-end" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={onDismiss}>
                Dismiss application
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {magistrate ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {!dateUsed ? (
            <Button type="button" variant="outline" onClick={onSetDate}>
              Set a date
            </Button>
          ) : null}
          <Button type="button" onClick={onOnboard}>
            Onboard
          </Button>
        </div>
      ) : null}
    </>
  );
}

function OrderPreview({
  title,
  text,
  note,
}: {
  title: string;
  text: string;
  note: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body-compact font-semibold">{title}</h3>
      <p className="rounded-md bg-paper p-4 text-body text-paper-foreground">
        {text}
      </p>
      <p className="text-caption text-muted-foreground">{note}</p>
    </section>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
  min,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min: string;
  hint: string;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="date"
        value={value}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        className="w-full sm:w-56 tabular-nums"
      />
      <FieldDescription>{hint}</FieldDescription>
    </Field>
  );
}

/** `ALC-10`: say where the pre-filled date came from, or that there was none. */
function dateHint(suggestion: string | undefined): string {
  return suggestion
    ? "Pre-filled with the case's next hearing date."
    : "The case has no upcoming hearing on record, so choose the date.";
}

function otherSideOf(app: LifecycleApplication) {
  return app.side === "complainant" ? "accused" : "complainant";
}

function seatLabel(seat: CourtSeat): string {
  switch (seat) {
    case "magistrate":
      return "magistrate";
    case "bench-clerk":
      return "bench clerk";
    case "typist":
      return "typist";
    case "scrutiny-officer":
      return "scrutiny officer";
  }
}
