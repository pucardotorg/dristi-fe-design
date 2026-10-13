import { CaseLink as Link } from "@/components/cases/case-reader";
import { ChevronRightIcon, HistoryIcon } from "lucide-react";

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
} from "@/lib/cases/timeline";
import {
  CASE_SECTIONS,
  caseSectionHref,
  type CaseSection,
} from "@/lib/cases/sections";
import { FIXTURE_TODAY } from "@/lib/cases/fixtures";
import { type CaseRecord } from "@/lib/cases/types";
import { PANEL_CLASS } from "@/components/shell/panel";
import { cn } from "@/lib/utils";
import { BotdText } from "@/components/cases/botd-text";

export function CaseTimeline({ record }: { record: CaseRecord }) {
  const model = caseTimelineModel(
    record,
    new Date(`${FIXTURE_TODAY}T23:59:59`).getTime()
  );

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
        <Card className={cn(PANEL_CLASS, "gap-4 hover:bg-card")}>
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
          <CardContent>
            <Timeline aria-label="Case History, newest first">
              {model.days.map((day) => (
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
