"use client";

import { CaseLink as Link } from "@/components/cases/case-reader";
import * as React from "react";
import { ChevronRightIcon, HistoryIcon } from "lucide-react";

import {
  HistoryTypeFilter,
  type TypeOption,
} from "@/components/employee/order-case-history";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import {
  caseTimelineModel,
  type CaseTimelineEvent,
  type CaseTimelineEventType,
} from "@/lib/cases/timeline";
import { HISTORY_TYPES } from "@/lib/employee/order-case-history";
import {
  CASE_SECTIONS,
  caseSectionHref,
  type CaseSection,
} from "@/lib/cases/sections";
import { FIXTURE_TODAY } from "@/lib/cases/fixtures";
import { type CaseRecord } from "@/lib/cases/types";
import { BotdText } from "@/components/cases/botd-text";

/**
 * What each event is, for the filter: the event catalogue's categories, as the case
 * history beside an order has them (`HistoryTypeFilter`; owner, 2026-10-23), with the
 * cheque's chain before filing as one more.
 */
const EVENT_CATEGORY: Record<CaseTimelineEventType, string> = {
  "application.submitted": "submissions",
  "case.disposed": "orders",
  "case.registered": "filing",
  "cheque.dishonoured": "before-filing",
  "document.filed": "submissions",
  "hearing.appearance": "hearing",
  "hearing.held": "hearing",
  "hearing.part-heard": "hearing",
  "hearing.plea-recorded": "hearing",
  "memo.received": "before-filing",
  "notice.dispatch-proof": "before-filing",
  "notice.issued": "before-filing",
  "order.cognizance": "orders",
  "order.hearing-scheduled": "orders",
  "summons.issued": "process",
};
const TYPE_OPTIONS: TypeOption[] = [
  { value: "before-filing", label: "Before filing" },
  ...HISTORY_TYPES,
];

export function CaseTimeline({ record }: { record: CaseRecord }) {
  const model = caseTimelineModel(
    record,
    new Date(`${FIXTURE_TODAY}T23:59:59`).getTime()
  );
  const [types, setTypes] = React.useState<string[]>([]);
  /* Only the types this case has, in the filter's own order. */
  const present = new Set(
    model.days.flatMap((day) =>
      day.events.map((event) => EVENT_CATEGORY[event.type])
    )
  );
  const options = TYPE_OPTIONS.filter((option) => present.has(option.value));
  /* A day keeps the events that match; a day left with none drops out. */
  const days =
    types.length === 0
      ? model.days
      : model.days
          .map((day) => ({
            ...day,
            events: day.events.filter((event) =>
              types.includes(EVENT_CATEGORY[event.type])
            ),
          }))
          .filter((day) => day.events.length > 0);

  return (
    <section
      aria-labelledby={
        model.days.length === 0
          ? "case-history-empty-heading"
          : "all-case-events-heading"
      }
      className="flex min-w-0 flex-col gap-6"
    >
      {model.days.length === 0 ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle
              id="case-history-empty-heading"
              className="text-body font-semibold"
            >
              No case history yet
            </EmptyTitle>
            <EmptyDescription>
              Events that have already taken place on this case will appear
              here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card variant="raised" className="gap-4 hover:bg-card">
          <CardHeader>
            <div className="flex min-w-0 flex-col gap-1">
              <h3
                id="all-case-events-heading"
                className="text-body font-semibold"
              >
                All case events
              </h3>
              <p className="text-caption font-medium tabular-nums text-muted-foreground">
                {model.firstDateLabel} to {model.latestDateLabel}
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-4">
            <HistoryTypeFilter
              options={options}
              value={types}
              onValueChange={setTypes}
              pinned={false}
            />
            {days.length === 0 ? (
              <p className="text-body-compact text-muted-foreground">
                Nothing of these types on this case.
              </p>
            ) : (
              <Timeline aria-label="Case History, newest first">
                {days.map((day) => (
                  <TimelineItem
                    key={day.on}
                    status={day.status}
                    aria-current={day.status === "current" ? "true" : undefined}
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <time
                        dateTime={day.on}
                        className="text-body-compact font-semibold tabular-nums text-foreground"
                      >
                        {day.dateLabel}
                      </time>

                      <ItemGroup>
                        {day.events.map((event) => (
                          <TimelineEvent
                            key={event.id}
                            caseId={record.id}
                            event={event}
                          />
                        ))}
                      </ItemGroup>
                    </div>
                  </TimelineItem>
                ))}
              </Timeline>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function TimelineEvent({
  caseId,
  event,
}: {
  caseId: string;
  event: CaseTimelineEvent;
}) {
  /* line-clamp-none: the label is the whole event, and a Malayalam or Gujarati
     translation of it will wrap rather than fit the DS one-line default. */
  const title = (
    <ItemContent className="min-w-0">
      <ItemTitle className="line-clamp-none font-normal">
        {event.label}
      </ItemTitle>
    </ItemContent>
  );
  /* A hearing's business of the day sits under it, as in the case peek
     (owner, Oct 8). Outside the link, so Read more opens in place. */
  const botd = event.botd ? (
    <div className="pb-1">
      <BotdText text={event.botd} />
    </div>
  ) : null;

  if (!event.ref) {
    return (
      <>
        <Item
          size="sm"
          role="listitem"
          className="-mx-2 w-auto px-2 py-1.5 hover:bg-transparent"
        >
          {title}
        </Item>
        {botd}
      </>
    );
  }

  return (
    <>
      <Item
        asChild
        size="sm"
        className="-mx-2 w-auto px-2 py-1.5 hover:bg-surface-sunken"
      >
        <Link
          href={caseSectionHref(caseId, event.ref)}
          role="listitem"
          aria-label={`${event.label}, open ${sectionLabel(event.ref)}`}
        >
          {title}
          <ItemActions aria-hidden>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </ItemActions>
        </Link>
      </Item>
      {botd}
    </>
  );
}

function sectionLabel(section: CaseSection): string {
  return (
    CASE_SECTIONS.find((entry) => entry.value === section)?.label ?? section
  );
}
