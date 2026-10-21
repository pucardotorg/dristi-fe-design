"use client";

import * as React from "react";
import { FlagIcon } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  attendanceHistory,
  type AttendanceRow,
  type AttendanceSitting,
  type SittingMark,
} from "@/lib/employee/attendance-history";
import { formatCaseDate } from "@/lib/employee/hearing-overview";
import { parseIsoDay, type CourtHearing } from "@/lib/employee/hearings";
import { cn } from "@/lib/utils";

/**
 * Data flags (`ORD-15`). One tab for the order screen and the case overview (`CLS-11`),
 * so the two say the same thing.
 *
 * It shows **attendance history**: for each person on the listing's roll, the share of
 * past hearings they were required at and attended, and how they were marked at the last five — a row of
 * lettered tiles, oldest to latest, the way a form guide reads. The hearings' dates head
 * the tile columns once, so the dates are on screen rather than behind a hover.
 *
 * With no listing (an order outside a hearing) or no past hearing, it says so.
 */
export function OrderDataFlags({ hearing }: { hearing?: CourtHearing }) {
  const history = React.useMemo(
    () => (hearing ? attendanceHistory(hearing) : undefined),
    [hearing],
  );
  const headingId = React.useId();

  if (!history || history.total === 0 || history.rows.length === 0) {
    return (
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FlagIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-body-compact font-semibold tracking-normal">
            No attendance history yet
          </EmptyTitle>
          <EmptyDescription className="text-body-compact">
            Attendance at this case&rsquo;s past hearings will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 id={headingId} className="text-body-compact font-semibold">
          Attendance history
        </h3>
        <p className="text-caption text-muted-foreground">
          {history.total === 1
            ? "1 past hearing."
            : `${history.total} past hearings.`}{" "}
          The last {history.recent.length === 1 ? "one" : history.recent.length}{" "}
          shown, latest on the right.
        </p>
      </div>

      <div className="flex min-w-0 flex-col">
        {/* The tile columns' dates, once for every row. Each tile names its own date to a
            screen reader, so this strip is for the eye only. */}
        <div
          aria-hidden
          className="flex items-end gap-3 border-b border-hairline pb-2 text-caption text-muted-foreground"
        >
          <span className="min-w-0 flex-1">Person</span>
          <span className="flex shrink-0 gap-1">
            {history.recent.map((sitting) => (
              <span
                key={sitting.on}
                className="flex w-7 flex-col items-center leading-tight tabular-nums"
              >
                <span>{dayOf(sitting.on)}</span>
                <span>{monthOf(sitting.on)}</span>
              </span>
            ))}
          </span>
          <span className="w-14 shrink-0 text-right">Attended</span>
        </div>
        <ul className="flex flex-col">
          {history.rows.map((row) => (
            <AttendanceLine
              key={row.appearance.id}
              row={row}
              sittings={history.recent}
            />
          ))}
        </ul>
      </div>

      {/* The key, for the eye: each tile already reads out its mark. */}
      <div
        aria-hidden
        className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground"
      >
        {(["present", "absent", "not-required"] as const).map((mark) => (
          <span key={mark} className="flex items-center gap-1.5">
            <MarkTile mark={mark} />
            {MARK_LABEL[mark]}
          </span>
        ))}
      </div>
    </section>
  );
}

function AttendanceLine({
  row,
  sittings,
}: {
  row: AttendanceRow;
  sittings: readonly AttendanceSitting[];
}) {
  const { appearance } = row;
  /* A side's counsel is one line for the side; the advocates on record name it. */
  const name =
    appearance.kind === "counsel" ? appearance.role : appearance.name;
  const detail =
    appearance.kind === "counsel"
      ? (appearance.advocates ?? []).join(", ")
      : appearance.role;

  return (
    <li className="flex min-h-14 items-center gap-3 border-b border-hairline py-2 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-compact font-medium">{name}</span>
        {detail ? (
          <span className="truncate text-caption text-muted-foreground">
            {detail}
          </span>
        ) : null}
      </div>
      <ol
        aria-label={`Last ${sittings.length === 1 ? "hearing" : `${sittings.length} hearings`}, oldest first`}
        className="flex shrink-0 gap-1"
      >
        {row.recent.map((mark, index) => (
          <li key={sittings[index].on}>
            <MarkTile mark={mark} />
            <span className="sr-only">
              {`${formatCaseDate(sittings[index].on)}, ${sittings[index].purpose}: ${MARK_LABEL[mark].toLowerCase()}`}
            </span>
          </li>
        ))}
      </ol>
      <div className="flex w-14 shrink-0 flex-col items-end">
        <span className="text-body-compact font-semibold tabular-nums">
          {row.percent === undefined ? "—" : `${row.percent}%`}
        </span>
        <span className="text-caption text-muted-foreground tabular-nums">
          {row.present} of {row.required}
        </span>
      </div>
    </li>
  );
}

const MARK_LABEL: Record<SittingMark, string> = {
  present: "Present",
  absent: "Absent",
  "not-required": "Not required",
};

/** The mark as a letter on its status fill, so it never rests on colour alone. */
const MARK_TILE: Record<SittingMark, { letter: string; className: string }> = {
  present: { letter: "P", className: "bg-success text-success-foreground" },
  absent: { letter: "A", className: "bg-destructive text-destructive-foreground" },
  "not-required": { letter: "–", className: "bg-muted text-muted-foreground" },
};

function MarkTile({ mark }: { mark: SittingMark }) {
  const tile = MARK_TILE[mark];
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-caption font-semibold",
        tile.className,
      )}
    >
      {tile.letter}
    </span>
  );
}

const DAY = new Intl.DateTimeFormat("en-IN", { day: "numeric" });
const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short" });

function dayOf(on: string): string {
  return DAY.format(parseIsoDay(on));
}

function monthOf(on: string): string {
  return MONTH.format(parseIsoDay(on));
}
