"use client";

import * as React from "react";
import { ArrowLeftIcon, HistoryIcon } from "lucide-react";

import { PdfViewer, parsePdfSrc } from "@/components/cases/pdf-viewer";
import { useCourtToday } from "@/components/employee/use-court-today";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import { CASE_FILE_TREE, caseFilePdfSrc, findNode } from "@/lib/cases/case-file";
import {
  caseTimeline,
  formatCaseWeekday,
  formatTimelineDate,
  hearingCaseExtras,
  hearingSittings,
} from "@/lib/employee/hearing-overview";
import type { CourtHearing } from "@/lib/employee/hearings";
import {
  HISTORY_TYPES,
  orderCaseHistory,
  orderExcerpt,
  type OrderHistoryEntry,
} from "@/lib/employee/order-case-history";
import { cn } from "@/lib/utils";

type TypeOption = { value: string; label: string };

/**
 * Order screen E's Case history tab (`ORD-15`): the case's history in the order it
 * happened, oldest first, with the orders passed on it. It opens scrolled to the case's
 * last order, on a well of its own, with whatever followed it below. A dropdown of event
 * types narrows the list (Orders alone, say); typing in it finds a type. An order too
 * long for the panel is cut short with a way to read it whole.
 *
 * An order opens in the panel itself, in the list's place, as a filed paper does in the
 * Case file tab (`ORD-16`): Back, or Escape, returns to the line it was opened from.
 */
export function OrderCaseHistory({ hearing }: { hearing: CourtHearing }) {
  const today = useCourtToday();
  const entries = React.useMemo(() => {
    const extras = hearingCaseExtras(hearing.id);
    return orderCaseHistory(
      caseTimeline(hearing, extras, today).inCourt,
      hearingSittings(hearing.id),
      hearing.id,
    );
  }, [hearing, today]);

  /* Only the types this case has, in the filter's own order. */
  const typeOptions = React.useMemo<TypeOption[]>(() => {
    const present = new Set(entries.map((entry) => entry.type));
    return [
      ...HISTORY_TYPES.filter((type) => present.has(type.value)),
      ...(present.has("other") ? [{ value: "other", label: "Other events" }] : []),
    ];
  }, [entries]);
  const [types, setTypes] = React.useState<string[]>([]);
  const anchor = useComboboxAnchor();
  const filterId = React.useId();
  const lastRef = React.useRef<HTMLLIElement>(null);
  const [reading, setReading] = React.useState<OrderHistoryEntry | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const headRef = React.useRef<HTMLHeadingElement>(null);
  const returnTo = React.useRef<string | null>(null);

  /* The last order brought into view in the panel's own scroll — on opening, and again
     when the filter changes what is above it. Not `scrollIntoView`, which would move the
     page too. */
  React.useLayoutEffect(() => {
    const target = lastRef.current;
    const scroller = target?.closest<HTMLElement>('[data-slot="tabs-content"]');
    if (!target || !scroller) return;
    const offset =
      target.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollTop += offset - scroller.clientHeight / 3;
  }, [types]);

  React.useEffect(() => {
    if (reading) {
      headRef.current?.focus();
    } else if (returnTo.current) {
      listRef.current
        ?.querySelector<HTMLElement>(
          `[data-opens="${CSS.escape(returnTo.current)}"]`,
        )
        ?.focus();
      returnTo.current = null;
    }
  }, [reading]);

  function open(entry: OrderHistoryEntry) {
    returnTo.current = entry.id;
    setReading(entry);
  }

  if (reading) {
    return (
      <OrderReader
        entry={reading}
        headRef={headRef}
        onBack={() => setReading(null)}
      />
    );
  }

  if (entries.length === 0) {
    return (
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-body-compact font-semibold tracking-normal">
            No case history yet
          </EmptyTitle>
          <EmptyDescription className="text-body-compact">
            Events and orders on this case will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const shown =
    types.length === 0
      ? entries
      : entries.filter((entry) => types.includes(entry.type));
  const picked = typeOptions.filter((option) => types.includes(option.value));

  return (
    <section
      ref={listRef}
      aria-labelledby="order-case-history"
      className="flex min-w-0 flex-col gap-4"
    >
      <h2 id="order-case-history" className="sr-only">
        Case history
      </h2>
      {/* The court filters' multi-select (`court-filters.tsx`): nothing picked shows
          everything; each picked type is a chip. Held at the top of the tab while the
          history scrolls under it, since the tab opens partway down. */}
      <div className="sticky -top-4 z-20 -mx-4 -mt-4 flex min-w-0 flex-col gap-2 border-b border-hairline bg-card px-4 pt-4 pb-3">

        <Label id={filterId} className="text-body-compact">
          Show
        </Label>
        <Combobox
          multiple
          items={typeOptions}
          value={picked}
          itemToStringLabel={(option: TypeOption) => option.label}
          isItemEqualToValue={(a: TypeOption, b: TypeOption) =>
            a.value === b.value
          }
          onValueChange={(next: TypeOption[]) =>
            setTypes(next.map((option) => option.value))
          }
        >
          <ComboboxChips ref={anchor}>
            <ComboboxValue>
              {(chosen: TypeOption[]) => (
                <>
                  {chosen.map((option) => (
                    <ComboboxChip key={option.value}>{option.label}</ComboboxChip>
                  ))}
                  <ComboboxChipsInput
                    aria-labelledby={filterId}
                    placeholder={chosen.length ? undefined : "All event types"}
                  />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxContent anchor={anchor}>
            <ComboboxEmpty>No event type matches.</ComboboxEmpty>
            <ComboboxList>
              {(option: TypeOption) => (
                <ComboboxItem key={option.value} value={option}>
                  {option.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {shown.length === 0 ? (
        <p className="text-body-compact text-muted-foreground">
          Nothing of these types on this case.
        </p>
      ) : (
        <Timeline
          className="text-body-compact"
          aria-label="Case history, oldest first"
        >
          {shown.map((entry) => (
            <HistoryEntry
              key={entry.id}
              ref={entry.last ? lastRef : undefined}
              entry={entry}
              onOpen={() => open(entry)}
            />
          ))}
        </Timeline>
      )}
    </section>
  );
}

/**
 * One line of the history: what happened and its day. An order carries its words under
 * it — whole when short, cut with Read the full order when long — or, when it is a paper
 * in the case file, Open the order. The last order sits on a sunken well with its badge.
 */
function HistoryEntry({
  entry,
  onOpen,
  ref,
}: {
  entry: OrderHistoryEntry;
  onOpen: () => void;
  ref?: React.Ref<HTMLLIElement>;
}) {
  const excerpt = entry.text ? orderExcerpt(entry.text) : null;
  const opens = entry.kind === "order" && (excerpt?.cut || entry.caseFileDoc);
  const textId = `${entry.id}-text`;

  return (
    <TimelineItem
      ref={ref}
      status={entry.last ? "current" : "past"}
      className="pb-0"
      aria-current={entry.last ? "true" : undefined}
    >
      {/* Spacing inside the item, so the rail runs on to the next dot. */}
      <div className="pb-4 group-last/timeline-item:pb-0">
        <div
          className={cn(
            "flex min-w-0 flex-col gap-1",
            /* The well starts right of the rail, so the dot stays on the line. */
            entry.last &&
              "-my-2 rounded-lg border border-hairline bg-surface-sunken px-3 py-2",
          )}
        >
          <div className="flex min-w-0 items-baseline justify-between gap-4">
            <span className="min-w-0">
              {entry.href ? (
                <a
                  href={entry.href}
                  target="_blank"
                  rel="noopener"
                  className="rounded-sm text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {entry.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className={cn(entry.kind === "order" && "font-medium")}>
                  {entry.label}
                </span>
              )}
            </span>
            <time
              dateTime={entry.on}
              className="shrink-0 tabular-nums text-muted-foreground"
            >
              {formatTimelineDate(entry.on)}
            </time>
          </div>
          {entry.last ? (
            <Badge variant="info" className="mb-1">
              Last order
            </Badge>
          ) : null}
          {entry.note ? (
            <p className="text-muted-foreground">{entry.note}</p>
          ) : null}
          {excerpt ? (
            <p id={textId} className="text-muted-foreground">
              {excerpt.text}
            </p>
          ) : null}
          {opens ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              data-opens={entry.id}
              aria-describedby={excerpt ? textId : undefined}
              className="h-10 w-fit px-0"
              onClick={onOpen}
            >
              {entry.caseFileDoc ? "Open the order" : "Read the full order"}
            </Button>
          ) : null}
        </div>
      </div>
    </TimelineItem>
  );
}

/**
 * An order read whole, in the list's place. An order held as text reads as a page on the
 * panel's sunken well; an order that is a paper in the case file opens on its page there.
 */
function OrderReader({
  entry,
  headRef,
  onBack,
}: {
  entry: OrderHistoryEntry;
  headRef: React.RefObject<HTMLHeadingElement | null>;
  onBack: () => void;
}) {
  const node = entry.caseFileDoc
    ? findNode(CASE_FILE_TREE, entry.caseFileDoc)
    : undefined;
  const src = node ? caseFilePdfSrc(node) : undefined;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onBack();
        }
      }}
    >
      <Button type="button" variant="ghost" className="-ml-3 w-fit" onClick={onBack}>
        <ArrowLeftIcon data-icon="inline-start" aria-hidden />
        Case history
      </Button>
      <div className="flex min-w-0 flex-col gap-1">
        <h3
          ref={headRef}
          tabIndex={-1}
          className="min-w-0 text-body font-semibold break-words focus-visible:outline-none"
        >
          {node?.label ?? entry.label}
        </h3>
        <p className="text-body-compact tabular-nums text-muted-foreground">
          <time dateTime={entry.on}>{formatCaseWeekday(entry.on)}</time>
        </p>
      </div>
      {src ? (
        <CaseFileOrder src={src} title={node?.label ?? entry.label} />
      ) : entry.text ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-hairline bg-surface-sunken p-4">
          <article className="rounded-lg border border-hairline bg-card p-6 shadow-raised">
            <p className="text-body whitespace-pre-line">{entry.text}</p>
          </article>
        </div>
      ) : (
        <p className="text-body-compact text-muted-foreground">
          This order has no copy in the case file to show.
        </p>
      )}
    </div>
  );
}

function CaseFileOrder({ src, title }: { src: string; title: string }) {
  const { url, page } = parsePdfSrc(src);
  return (
    <PdfViewer
      src={url}
      title={title}
      pages={page ? { from: page, to: page } : undefined}
      className="min-h-0 flex-1"
    />
  );
}
