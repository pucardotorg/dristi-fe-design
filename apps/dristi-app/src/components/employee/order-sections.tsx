"use client";

import {
  CheckIcon,
  EyeIcon,
  XIcon,
} from "lucide-react";

import {
  CausePostingNote,
  useFromCauseList,
} from "@/components/employee/cause-posting";
import { OrderDatePicker } from "@/components/employee/order-item-fields";
import { PurposeField } from "@/components/employee/purpose-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
} from "@/components/ui/select";
import {
  courtHearingPurposeLabel,
  formatListingDate,
  type CourtHearingPurposeId,
} from "@/lib/employee/hearings";
import type { ListingApplicationDecision } from "@/lib/employee/listing-applications";
import type {
  Appearance,
  AttendanceMark,
  NextListingChoice,
} from "@/lib/employee/order-draft";
import { cn } from "@/lib/utils";

/*
 * The order screen's hearing sections — Attendance, Applications and Next hearing — and
 * the shapes they and the screen's header share. Drawn on the order's page and in its
 * order data (`order-editor.tsx`).
 */

export type ComposerFact = {
  label: string;
  value: string;
  identifier?: boolean;
};

/** The hearing's roll, when the order belongs to a hearing (`ATT-01`–`ATT-05`). */
export type ComposerAttendance = {
  appearances: Appearance[];
  marks: Readonly<Record<string, AttendanceMark | undefined>>;
  /** Not taken at this hearing: the roll folds away and the order prints none. */
  skipped: boolean;
  onSkippedChange: (skipped: boolean) => void;
  onMark: (id: string, mark: AttendanceMark | undefined) => void;
  onMarkAllPresent: () => void;
};

/** An application standing on the matter, with how it was decided (`APL-01`). */
export type ComposerApplication = {
  id: string;
  number: string;
  type: string;
  filed: string;
  decision: ListingApplicationDecision | undefined;
};

export type ComposerApplications = {
  list: ComposerApplication[];
  onDecide: (id: string, decision: ListingApplicationDecision | null) => void;
  onOpen: (id: string) => void;
};

/** Where the matter is posted to, when the order belongs to a hearing (`NXT-01`–`NXT-03`). */
export type ComposerNextHearing = {
  next: NextListingChoice;
  purpose: CourtHearingPurposeId | "";
  date: string | null;
  onChange: (change: {
    next?: NextListingChoice;
    purpose?: CourtHearingPurposeId | "";
    date?: string | null;
  }) => void;
};

/* ───────────────────────────────── the sections ────────────────────────────── */

/**
 * A section standing as its own card: its heading sits in a 56px band over a hairline,
 * so the heading and its action read as the card's head, not as content floating in it.
 */
export const FRAMED_HEAD =
  "flex min-h-14 items-center justify-between gap-4 border-b border-hairline px-4 py-1 md:px-6";
export const FRAMED_BODY = "p-4 md:p-6";

/**
 * Under a litigant's advocate row, who is on record. One name sits as a line; several
 * names sit as a list — not "Any one of A, B".
 */
function AdvocatesOnRecord({ advocates }: { advocates: readonly string[] }) {
  if (advocates.length === 1) {
    return <span className="text-muted-foreground">{advocates[0]}</span>;
  }
  return (
    <ul className="list-disc pl-4 text-muted-foreground">
      {advocates.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}

export function AttendanceSection({
  attendance,
  disabled,
}: {
  attendance: ComposerAttendance;
  disabled: boolean;
}) {
  return (
    <section
      id="order-attendance"
      tabIndex={-1}
      aria-labelledby="order-attendance-heading"
      className="flex min-w-0 scroll-mt-40 flex-col gap-3 outline-none"
    >
      <div className="flex min-h-10 items-center justify-between gap-4">
        <h2
          id="order-attendance-heading"
          className="text-body-compact font-semibold"
        >
          Attendance
        </h2>
        {/* Skip sits before Mark all present: the roll's one-press answers, the
            rarer one first so Mark all present keeps its place at the edge. */}
        {disabled ? null : attendance.skipped ? (
          <Button
            type="button"
            variant="ghost"
            className="-mr-3 text-body-compact"
            onClick={() => attendance.onSkippedChange(false)}
          >
            Take attendance
          </Button>
        ) : (
          <div className="-mr-3 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              className="text-body-compact"
              onClick={() => attendance.onSkippedChange(true)}
            >
              Skip attendance
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-body-compact"
              onClick={attendance.onMarkAllPresent}
            >
              Mark all present
            </Button>
          </div>
        )}
      </div>
      {attendance.skipped ? (
        <p className="text-body-compact text-muted-foreground">
          Attendance skipped for this hearing. It is not printed on the order.
        </p>
      ) : (
        <>
          {/* A container, so every row changes shape together at the list's width — never
              one row wrapping because its name happens to be long. */}
          <div className="min-w-0">
            <ul className="@container flex min-w-0 flex-col divide-y divide-hairline rounded-xl border border-hairline">
              {attendance.appearances.map((appearance) => {
                const mark = attendance.marks[appearance.id];
                return (
                  <li
                    key={appearance.id}
                    className="flex min-w-0 flex-col gap-2 py-2 pr-2 pl-4 @min-[24rem]:flex-row @min-[24rem]:items-center @min-[24rem]:justify-between @min-[24rem]:gap-3"
                  >
                    <div className="flex min-w-0 flex-col text-body-compact">
                      <span className="font-medium">{appearance.name}</span>
                      {appearance.advocates ? (
                        <AdvocatesOnRecord advocates={appearance.advocates} />
                      ) : (
                        <span className="text-muted-foreground">{appearance.role}</span>
                      )}
                    </div>
                    <div
                      role="radiogroup"
                      aria-label={appearance.name}
                      className="grid shrink-0 grid-cols-2 gap-1 @min-[24rem]:w-48"
                    >
                      <MarkButton
                        label="Present"
                        checked={mark === "present"}
                        tone="present"
                        disabled={disabled}
                        onClick={() =>
                          attendance.onMark(
                            appearance.id,
                            mark === "present" ? undefined : "present",
                          )
                        }
                      />
                      <MarkButton
                        label="Absent"
                        checked={mark === "absent"}
                        tone="absent"
                        disabled={disabled}
                        onClick={() =>
                          attendance.onMark(
                            appearance.id,
                            mark === "absent" ? undefined : "absent",
                          )
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          {/* `ATT-02`: the screen leaves *not required* out as a button and lets it follow
              from leaving a person unmarked — so the roll is never incomplete, and attendance
              never holds up sending for signing (`ATT-04`). */}
          <p className="text-caption text-muted-foreground">
            Anyone left unmarked is recorded as not required, and is not printed on the order.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Present or Absent — a mark pressed again is cleared, because no answer for a person is
 * a real state and an uncorrectable one is not (`ATT-02`).
 */
function MarkButton({
  label,
  checked,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  checked: boolean;
  tone: "present" | "absent";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = tone === "present" ? CheckIcon : XIcon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-body-compact font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        checked
          ? tone === "present"
            ? "bg-success-muted text-success-muted-foreground hover:bg-success-muted-hover"
            : "bg-destructive-muted text-destructive-muted-foreground hover:bg-destructive-muted-hover"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

export function ApplicationsSection({
  applications,
  disabled,
  framed = false,
}: {
  applications: ComposerApplications;
  disabled: boolean;
  /** Standing as its own card, with a head band (the order data). */
  framed?: boolean;
}) {
  return (
    <section
      id="order-applications"
      tabIndex={-1}
      aria-labelledby="order-applications-heading"
      className={cn(
        "flex min-w-0 scroll-mt-40 flex-col outline-none",
        !framed && "gap-3",
      )}
    >
      <div className={framed ? FRAMED_HEAD : "flex min-h-10 items-center"}>
        <h2
          id="order-applications-heading"
          className="text-body-compact font-semibold"
        >
          Applications
        </h2>
      </div>
      <div className="min-w-0">
        <ul className="@container flex min-w-0 flex-col divide-y divide-hairline rounded-xl border border-hairline">
          {applications.list.map((application) => (
            <li
              key={application.id}
              id={`order-application-${application.id}`}
              tabIndex={-1}
              className="flex min-w-0 scroll-mt-40 flex-col gap-4 p-4 outline-none @min-[36rem]:flex-row @min-[36rem]:items-center @min-[36rem]:gap-6"
            >
              {/* What the application is, then where it comes from; View opens it. In a
                  narrow column the decision sits under it at its natural width — never a
                  full-width bar; where the list is wide (the block composer's page) it
                  runs on the same line, at the row's end. */}
              <div className="flex min-w-0 flex-1 items-start justify-between gap-3 @min-[36rem]:items-center">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-body-compact font-medium">
                    {application.type}
                  </p>
                  <p className="flex min-w-0 flex-col text-body-compact text-muted-foreground">
                    <span className="font-mono">{application.number}</span>
                    <span>{application.filed}</span>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="-my-2 -mr-2 shrink-0 text-body-compact @min-[36rem]:my-0 @min-[36rem]:mr-0"
                  aria-label={`View ${application.type} ${application.number}`}
                  onClick={() => applications.onOpen(application.id)}
                >
                  <EyeIcon data-icon="inline-start" aria-hidden />
                  View
                </Button>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {application.decision ? (
                  <>
                    <Badge
                      variant={
                        application.decision === "allowed"
                          ? "success"
                          : "destructive"
                      }
                    >
                      {application.decision === "allowed"
                        ? "Accepted"
                        : "Rejected"}
                    </Badge>
                    {disabled ? null : (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-body-compact"
                        onClick={() =>
                          applications.onDecide(application.id, null)
                        }
                      >
                        Undo
                      </Button>
                    )}
                  </>
                ) : disabled ? null : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive-ink"
                      onClick={() =>
                        applications.onDecide(application.id, "dismissed")
                      }
                    >
                      Reject
                    </Button>
                    <Button
                      type="button"
                      variant="success"
                      onClick={() =>
                        applications.onDecide(application.id, "allowed")
                      }
                    >
                      Accept
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function NextHearingSection({
  nextHearing,
  today,
  disabled,
}: {
  nextHearing: ComposerNextHearing;
  today: string;
  disabled: boolean;
}) {
  const id = "order-next";
  const listed = nextHearing.next !== "none";
  /* A hearing's order shows the posting the cause list set and does not take one
     (owner, 2026-10-15). The fields stay where they were, read-only rather than
     disabled: the DS read-only fill is a light grey under full-strength text, so the
     value still reads (owner: "a more subtle gray-out"), and a disabled control inside
     the order's paper greys the whole paper — the input group around it dims itself
     whenever anything in it is disabled. */
  const fromCauseList = useFromCauseList();
  const off = disabled;
  const set = !listed || Boolean(nextHearing.date && nextHearing.purpose);
  const hasBody = listed || fromCauseList;
  return (
    <section
      id="order-next-hearing"
      tabIndex={-1}
      aria-labelledby={`${id}-heading`}
      className="flex min-w-0 scroll-mt-40 flex-col gap-3 outline-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-heading`} className="text-body-compact font-semibold">
          Next hearing
        </h2>
        {fromCauseList ? null : (
        <div className="flex min-h-10 items-center gap-2">
          <Checkbox
            id={`${id}-none`}
            checked={nextHearing.next === "none"}
            disabled={off}
            onCheckedChange={(checked) =>
              nextHearing.onChange({ next: checked === true ? "none" : "list" })
            }
          />
          <Label
            htmlFor={`${id}-none`}
            className="cursor-pointer text-body-compact font-normal"
          >
            Not listed again
          </Label>
        </div>
        )}
      </div>
      {hasBody ? (
        <div className="flex min-w-0 flex-col gap-4">
          {fromCauseList ? <CausePostingNote set={set} /> : null}
          {fromCauseList ? (
            <CausePostingValues
              id={id}
              next={nextHearing.next}
              date={nextHearing.date}
              purpose={nextHearing.purpose}
            />
          ) : listed ? (
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <OrderDatePicker
            id={`${id}-date`}
            label={
              <span
                id={`${id}-date-label`}
                className="text-body-compact font-medium"
              >
                Date
              </span>
            }
            value={nextHearing.date ?? ""}
            today={today}
            disabled={off}
            onChange={(date) => nextHearing.onChange({ date: date || null })}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <span
              id={`${id}-purpose-label`}
              className="text-body-compact font-medium"
            >
              Purpose
            </span>
            <PurposeField
              value={nextHearing.purpose}
              disabled={off}
              onChange={(purpose) => nextHearing.onChange({ purpose })}
              labelledBy={`${id}-purpose-label`}
            />
          </div>
        </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The cause list's posting, shown in the order as read-only fields — the same two
 * labelled boxes the steno would fill, in the DS read-only dress (`bg-muted` under
 * `text-foreground`), so the value is legible and plainly not for typing into.
 */
function CausePostingValues({
  id,
  next,
  date,
  purpose,
}: {
  id: string;
  next: ComposerNextHearing["next"];
  date: string | null;
  purpose: CourtHearingPurposeId | "";
}) {
  const listed = next !== "none";
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={`${id}-date`} className="text-body-compact font-medium">
          Date
        </Label>
        <Input
          id={`${id}-date`}
          readOnly
          value={
            !listed ? "Not listed again" : date ? formatListingDate(date) : ""
          }
          placeholder="Not set"
          className="tabular-nums"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <Label
          htmlFor={`${id}-purpose`}
          className="text-body-compact font-medium"
        >
          Purpose
        </Label>
        <Input
          id={`${id}-purpose`}
          readOnly
          value={listed && purpose ? courtHearingPurposeLabel(purpose) : ""}
          placeholder={listed ? "Not set" : "Not listed"}
        />
      </div>
    </div>
  );
}
