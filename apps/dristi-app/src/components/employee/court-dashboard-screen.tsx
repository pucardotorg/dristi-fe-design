"use client";

import Link from "next/link";

import { useCourtToday } from "@/components/employee/use-court-today";
import { useCourt } from "@/components/court/court-provider";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PANEL_CLASS } from "@/components/shell/panel";
import { CheckIcon } from "lucide-react";
import {
  actNowCases,
  courtCaseTitle,
  courtPriorityById,
  courtPriorityCount,
  underHigherCourtCases,
  type CaseAttention,
  type CourtCase,
} from "@/lib/employee/cases";
import { formatCourtDay, TODAYS_HEARING_COUNT } from "@/lib/employee/hearings";
import { COURT_CASES_PAGE } from "@/lib/employee/navigation";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";

/**
 * `/employee` — the bench's working brief.
 *
 * ## What this is, after the fourth pass
 *
 * The owner cut the last version to the studs: the stat cards manufactured urgency with no
 * reason, the bar chart repeated the cards, and the workload panel was the navigation rail
 * printed twice. The instruction was plain — *a dashboard should be to the point and
 * actionable, not show useless things* — with the freedom to decide what actually helps a
 * bench stay on top of its court.
 *
 * So nothing here is a count for its own sake, and nothing restates the rail. Every line
 * is a specific case or a specific decision, and every line **opens**. The screen answers
 * three questions a magistrate opens it to ask, and stops:
 *
 * 1. **What must I act on first?** The cases the law and the higher courts put ahead of
 *    the queue — someone in custody, a disposal deadline running down, a summons whose
 *    service report has not come back — each with the plain reason and the number that
 *    makes it urgent, most pressing at the top. Not a category tile: the actual case,
 *    openable in the register.
 * 2. **What is waiting for my first order?** New complaints that cleared scrutiny and need
 *    cognizance — one decision, surfaced with its count and a way in.
 * 3. **What is out of my hands?** Cases a higher court has stayed or is hearing on appeal
 *    or revision — awareness, so the bench does not proceed on a matter it must not.
 *
 * The day's own sitting is one action in the header, because that is where signing in
 * already lands. There is no distribution chart and no queue mirror: the register holds
 * the whole file, the rail holds the queues, and this holds only what needs a person.
 */

/** Custody is the one reason that earns colour — a person's liberty. The rest are ink. */
function reasonToneClass(attention: CaseAttention): string {
  return attention.kind === "custody"
    ? "text-destructive-ink"
    : "text-muted-foreground";
}

export function CourtDashboardScreen() {
  const today = useCourtToday();
  const actNow = actNowCases();
  const higher = underHigherCourtCases();
  const cognizance = courtPriorityCount(courtPriorityById("pending-cognizance")!);
  /* Where a case registered at scrutiny lands: there is no Register cases queue under
     `registrationPoint: scrutiny` (`SCR-11`), so the way in is Take cognizance. */
  const { profile } = useCourt();
  const cognizanceHref =
    profile.registrationPoint === "scrutiny"
      ? "/employee/cognizance"
      : "/employee/register-cases";

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-title font-semibold">Dashboard</h1>
          <p className="text-body text-muted-foreground">{formatCourtDay(today)}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-body-compact text-muted-foreground tabular-nums">
            {TODAYS_HEARING_COUNT} matters listed for today
          </p>
          <Button asChild variant="outline">
            <Link href="/employee/hearings">Open today&rsquo;s hearings</Link>
          </Button>
        </div>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <section
          aria-labelledby="court-act-now"
          className={cn(
            PANEL_CLASS,
            "flex min-w-0 flex-col gap-4 rounded-xl bg-card p-6 lg:col-span-2",
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="court-act-now" className="text-title-s font-semibold">
              Act on these first
            </h2>
            {actNow.length > 0 ? (
              <span className="text-body-compact text-muted-foreground tabular-nums">
                {actNow.length} cases
              </span>
            ) : null}
          </div>

          {actNow.length === 0 ? (
            <Empty className="px-0 py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckIcon aria-hidden />
                </EmptyMedia>
                <EmptyTitle className="text-body font-semibold">
                  Nothing is pressing
                </EmptyTitle>
                <EmptyDescription className="text-body-compact">
                  No case is in custody, against a deadline, or waiting on service.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col">
              {actNow.map(({ record, attention }, index) => (
                <li key={record.id}>
                  <CaseRow
                    record={record}
                    reason={attention.reason}
                    reasonClassName={reasonToneClass(attention)}
                    divide={index > 0}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <section
            aria-labelledby="court-cognizance"
            className={cn(PANEL_CLASS, "flex flex-col gap-3 rounded-xl bg-card p-6")}
          >
            <h2 id="court-cognizance" className="text-title-s font-semibold">
              Awaiting cognizance
            </h2>
            <p className="text-body-compact text-muted-foreground">
              {cognizance === 1
                ? "1 new complaint has cleared scrutiny and needs your first order."
                : `${cognizance} new complaints have cleared scrutiny and need your first order.`}
            </p>
            <Button asChild variant="outline" className="self-start">
              <Link href={cognizanceHref}>Review complaints</Link>
            </Button>
          </section>

          <section
            aria-labelledby="court-higher"
            className={cn(PANEL_CLASS, "flex min-w-0 flex-col gap-3 rounded-xl bg-card p-6")}
          >
            <h2 id="court-higher" className="text-title-s font-semibold">
              Under a higher court
            </h2>
            <ul className="flex flex-col">
              {higher.map(({ record, reason }, index) => (
                <li key={record.id}>
                  <CaseRow
                    record={record}
                    reason={reason}
                    reasonClassName="text-muted-foreground"
                    divide={index > 0}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * One openable case: its number in mono, its cause title, and the plain reason it is on
 * this screen. The number and title lead because they are how a clerk finds the file; the
 * reason sits under them, in ink unless it is a matter of liberty. The whole row is the
 * link — it opens the case in the register — and the hairline between rows keeps the list
 * one surface rather than a stack of cards.
 *
 * No date column: the urgent number is already in the reason ("deadline in 3 days"), and a
 * second date beside it only asks which one matters. The cause title takes the room instead.
 */
function CaseRow({
  record,
  reason,
  reasonClassName,
  divide,
}: {
  record: CourtCase;
  reason: string;
  reasonClassName: string;
  divide: boolean;
}) {
  return (
    <Link
      href={`${COURT_CASES_PAGE.href}?q=${encodeURIComponent(record.caseNumber)}`}
      className={cn(
        "-mx-3 flex flex-col gap-0.5 rounded-lg px-3 py-3 transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none",
        divide && "mt-px border-t border-hairline",
      )}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        {/* The whole row is the link to the case — the face without a second control. */}
        <Identifier
          value={record.caseNumber}
          label="case number"
          className="shrink-0 text-body-compact text-muted-foreground"
          copyable={false}
        />
        <span className="truncate text-body font-medium">
          {courtCaseTitle(record)}
        </span>
      </div>
      <span className={cn("text-body-compact", reasonClassName)}>{reason}</span>
    </Link>
  );
}
