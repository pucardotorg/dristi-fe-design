"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  EyeIcon,
  SearchIcon,
} from "lucide-react";

import { CaseStage } from "@/components/cases/case-identity";
import {
  CasePeekPushRegion,
  PEEK_PUSH_CLASS,
} from "@/components/cases/case-peek";
import { COLLAPSE_MOTION } from "@/components/cases/motion";
import { RegisterSearch } from "@/components/cases/register-controls";
import {
  CASE_PEEK_ID,
  CasePeekProvider,
  useCasePeek,
} from "@/components/cases/use-case-peek";
import { Identifier } from "@/components/chrome/identifier";
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { partiesLabel, type CaseRecord } from "@/lib/cases/types";
import { withOrigin } from "@/lib/nav/origin";
import { cn } from "@/lib/utils";
import { useCourt, useCourtText } from "@/components/court/court-provider";
import { localizeCourtText } from "@/lib/court/localize";

/**
 * Step one when Raise application is opened from the rail: which case.
 *
 * The same header as the type chooser it leads to — heading, search at its far
 * end — so the two steps read as one flow. Rows rather than cards: a case is
 * recognised by its number and its parties, two short facts on one line, and a
 * working advocate has dozens of them. Most recently moved first, since the
 * case someone is about to file in is usually the one that just had a hearing.
 */
/** How many cases open, and how many each "Show more" adds. Twenty (owner,
 *  Sept 21): two screens on a phone, most of a desk monitor. */
const LOAD_STEP = 20;

export function RaiseApplicationCaseChooser({
  cases,
  now,
}: {
  cases: CaseRecord[];
  /** Server-stable "now" for the peek's due dates. */
  now: number;
}) {
  // Search matches the number as shown, in the selected state's terms.
  const { court } = useCourt();
  const headingId = useId();
  const [query, setQuery] = useState("");
  const typed = query.trim().length > 0;
  const [visible, setVisible] = useState(LOAD_STEP);
  /** Touch rows: the one whose actions are showing. */
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...cases].sort((a, b) => b.updatedOn.localeCompare(a.updatedOn)),
    [cases],
  );
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ordered;
    return ordered.filter((record) =>
      `${localizeCourtText(record.caseNumber, court)} ${partiesLabel(record)}`
        .toLowerCase()
        .includes(needle),
    );
  }, [ordered, query, court]);

  // One growing list, not pages (owner, Sept 21). Picking a case is a scan down
  // a list on the way somewhere: nobody returns to "page 4" of it, and a pager
  // plus a per-page menu was two controls for that. Search is the fast path;
  // this is for the person who would rather look.
  const rows = shown.slice(0, visible);
  const remaining = shown.length - rows.length;

  return (
    <TooltipProvider>
      <CasePeekProvider now={now} docked>
        {/* The Cases page's docked peek, on the same terms: the header eases aside,
        the list keeps its width and the panel slides over its far edge. */}
        <CasePeekPushRegion
      mobileDrawer
          className={cn("flex flex-1 flex-col", PAGE_GROUND, PAGE_GUTTER)}
        >
          <div className="flex w-full flex-col gap-6">
            {/* Keyed to the column, not the viewport; see FilingFrame's header. */}
            <header className={cn("@container", PEEK_PUSH_CLASS)}>
              <div className="flex flex-col gap-4 @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:gap-8">
                <h1 className={PAGE_TITLE}>Raise application</h1>
                <RegisterSearch
                  label="Search your cases"
                  value={query}
                  onChange={(value) => {
                    setQuery(value);
                    setVisible(LOAD_STEP);
                  }}
                  className="@2xl:w-80 @2xl:shrink-0 sm:w-full"
                />
              </div>
            </header>

            {/* The list eases aside with the header. The Cases table stays put
          because reflowing it is costly and its trigger is on the left; here
          the rows are cheap and Preview is on the right, where the panel
          would cover it and the next case could not be previewed. */}
            <section
              aria-labelledby={headingId}
              className={cn("flex flex-col gap-4", PEEK_PUSH_CLASS)}
            >
              <h2 id={headingId} className="text-body font-semibold">
                Choose the case
              </h2>
              <p aria-live="polite" className="sr-only">
                {typed
                  ? `${shown.length} of ${ordered.length} cases match.`
                  : ""}
              </p>

              {shown.length > 0 ? (
                <ItemGroup className="gap-2">
                  {rows.map((record) => (
                    <CaseRow
                      key={record.id}
                      record={record}
                      expanded={expandedId === record.id}
                      onExpandedChange={(open) =>
                        setExpandedId(open ? record.id : null)
                      }
                    />
                  ))}
                </ItemGroup>
              ) : null}
              {shown.length > 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <p
                    className="text-body-compact text-muted-foreground tabular-nums"
                    aria-live="polite"
                  >
                    Showing {rows.length} of {shown.length}{" "}
                    {shown.length === 1 ? "case" : "cases"}
                  </p>
                  {remaining > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setVisible((count) => count + LOAD_STEP)}
                    >
                      Show more
                      <ChevronDownIcon data-icon="inline-end" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchIcon aria-hidden />
                    </EmptyMedia>
                    <EmptyTitle>No case matches that</EmptyTitle>
                    <EmptyDescription>
                      Try the case number, or a name from either side.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </section>
          </div>
        </CasePeekPushRegion>
      </CasePeekProvider>
    </TooltipProvider>
  );
}

/**
 * One case, in two bodies chosen by the pointer, not the width: a mouse can
 * hover and hit a 24px target, a finger can do neither, and a tablet is as
 * wide as a laptop.
 */
function CaseRow({
  record,
  expanded,
  onExpandedChange,
}: {
  record: CaseRecord;
  /** Touch only: this row's two actions are showing. One row at a time. */
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
}) {
  return (
    <>
      <PointerCaseRow record={record} />
      <TouchCaseRow
        record={record}
        expanded={expanded}
        onExpandedChange={onExpandedChange}
      />
    </>
  );
}

function selectHref(record: CaseRecord) {
  // The list records itself, so the next page's back arrow returns here.
  return withOrigin(
    `/cases/${record.id}/filings/application`,
    "/raise-application",
  );
}

const ROW_SHELL = cn(PANEL_CLASS, "rounded-xl px-4 py-3");

function CaseFacts({ record }: { record: CaseRecord }) {
  const courtText = useCourtText();
  return (
    <ItemDescription className="line-clamp-none text-caption text-muted-foreground">
      {/* Under the row's own control, so the number is text, not a second one. */}
      <Identifier value={record.caseNumber} copyable={false} />
      <span aria-hidden> · </span>
      {courtText(record.court)}
    </ItemDescription>
  );
}

/**
 * Mouse and trackpad. The whole row selects, through a stretched link on the
 * parties. Two things make that legible (owner, Sept 21):
 *
 * - Preview is a small eye beside the title, so the row's only button-shaped
 *   thing is no longer the secondary action.
 * - On hover or keyboard focus the primary action, "Select this case", opens at
 *   the far end and eases the stage aside. It is a picture of the row's own
 *   click, not a second control: hidden from assistive tech and the tab order,
 *   and the stretched link sits over it, so clicking it is clicking the row.
 *
 * The opening is max-width and opacity, 200ms on the strong ease-out, the same
 * move the Cases toolbar labels make. Hover variants are already pointer-gated
 * by Tailwind; reduced motion gets the switch without the travel.
 */
function PointerCaseRow({ record }: { record: CaseRecord }) {
  const { open, record: peeked } = useCasePeek();
  const peeking = peeked?.id === record.id;
  const parties = partiesLabel(record);

  return (
    <Item
      variant="outline"
      className={cn(
        ROW_SHELL,
        "group/row relative hidden flex-nowrap pointer-fine:flex",
        "hover:border-border hover:bg-accent hover:shadow-overlay",
        "has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50",
      )}
    >
      <ItemContent className="min-w-0 gap-1">
        <div className="flex min-w-0 items-center gap-0.5">
          <ItemTitle className="line-clamp-none min-w-0 text-body-compact font-semibold break-words text-foreground">
            <Link
              href={selectHref(record)}
              className="outline-none after:absolute after:inset-0"
            >
              {parties}
            </Link>
          </ItemTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Preview case, ${parties}`}
                aria-expanded={peeking}
                aria-controls={peeking ? CASE_PEEK_ID : undefined}
                data-state={peeking ? "open" : undefined}
                // Above the stretched link, or the row would swallow the click.
                // The row under it is already on the hover fill, so the button takes
                // the next step down or its own hover would not show.
                className="relative z-10 shrink-0 text-muted-foreground hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground"
                onClick={() => open(record)}
              >
                <EyeIcon aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Preview case</TooltipContent>
          </Tooltip>
        </div>
        <CaseFacts record={record} />
      </ItemContent>
      <ItemActions className="shrink-0 gap-0">
        <CaseStage record={record} detail={false} />
        <span
          aria-hidden
          className={cn(
            "flex max-w-0 overflow-hidden opacity-0",
            "transition-[max-width,opacity,margin] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
            "group-hover/row:ms-3 group-hover/row:max-w-48 group-hover/row:opacity-100",
            "group-focus-within/row:ms-3 group-focus-within/row:max-w-48 group-focus-within/row:opacity-100",
          )}
        >
          <Button asChild size="sm" className="whitespace-nowrap">
            <span>
              Select this case
              <ArrowRightIcon data-icon="inline-end" aria-hidden />
            </span>
          </Button>
        </span>
      </ItemActions>
    </Item>
  );
}

/**
 * Touch. No hover to reveal anything and no room for a 24px "i", so the row is
 * a disclosure, the home screen's hearing rows' own move: a tap opens it onto
 * its two actions at full size, the primary first. One row open at a time, so
 * the list never becomes a wall of buttons.
 */
function TouchCaseRow({
  record,
  expanded,
  onExpandedChange,
}: {
  record: CaseRecord;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
}) {
  const courtText = useCourtText();
  const { open } = useCasePeek();

  return (
    <Collapsible
      open={expanded}
      onOpenChange={onExpandedChange}
      className="group/touch min-w-0 pointer-fine:hidden"
    >
      {/* The card is the trigger and sits above its tray; the tray is inset
          from both edges and squared at the top, so it reads as sliding out
          from under the card. The home screen's hearing cards, exactly. */}
      <CollapsibleTrigger
        className={cn(
          ROW_SHELL,
          "relative z-10 flex w-full items-center gap-3 border bg-card text-left outline-none transition-colors active:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
          expanded && "border-border"
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-body-compact font-semibold break-words text-foreground">
            {partiesLabel(record)}
          </span>
          <span className="text-caption text-muted-foreground">
            <Identifier value={record.caseNumber} copyable={false} />
            <span aria-hidden> · </span>
            {courtText(record.court)}
          </span>
          <span className="mt-1">
            <CaseStage record={record} detail={false} />
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
            expanded && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className={cn(COLLAPSE_MOTION, "mx-3")}>
        <div className="flex items-center gap-2 rounded-b-xl bg-secondary p-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => open(record)}
          >
            Preview
          </Button>
          <Button asChild className="flex-1">
            <Link href={selectHref(record)}>
              Select case
              <ArrowRightIcon data-icon="inline-end" aria-hidden />
            </Link>
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
