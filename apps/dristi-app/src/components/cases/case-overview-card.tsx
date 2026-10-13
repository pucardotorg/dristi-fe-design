"use client";

import { useState, type ReactNode } from "react";
import { CaseLink as Link } from "@/components/cases/case-reader";
import { ArchiveIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PANEL_CLASS } from "@/components/shell/panel";
import { type DueRamp, type DueStatusView } from "@/lib/cases/peek";
import { cn } from "@/lib/utils";
import { RegisterTrayCard } from "@/components/cases/register-card";
import {
  REGISTER_CARDS_ONLY,
  REGISTER_TABLE_ONLY,
} from "@/components/cases/register-layout";

/**
 * The card shell every Overview region is built from. Shared rather than
 * copied: a second way to make an Overview card is a second set of decisions
 * about heading weight, padding, and hover, and they drift.
 */
export function OverviewSection({
  id,
  title,
  count,
  description,
  action,
  children,
}: {
  id?: string;
  title: string;
  count?: number;
  /** One line under the title, for something true of the whole section
   *  rather than of any row in it. CardHeader gives a description its own
   *  row and keeps it out of the action column. */
  description?: string;
  /** Sits opposite the title. CardHeader turns itself into two columns
   *  when a CardAction is present, so the title keeps the whole width
   *  on the cards that have none. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="min-w-0 scroll-mt-6">
      <RestingCard>
        <CardHeader>
          {/* min-h-10 only when there is an action: it is the icon button's
              own height, so the title centres against it instead of the two
              sitting on different baselines. Without one, nothing should
              pad the header. */}
          <div
            className={cn(
              "flex flex-wrap items-center gap-2",
              action ? "min-h-10" : undefined,
            )}
          >
            <h2 className="text-body font-semibold">{title}</h2>
            {count === undefined ? null : (
              <span className="text-body-compact tabular-nums text-muted-foreground">
                {count}
              </span>
            )}
          </div>
          {description ? (
            <CardDescription className="text-caption">
              {description}
            </CardDescription>
          ) : null}
          {action ? <CardAction>{action}</CardAction> : null}
        </CardHeader>
        {children}
      </RestingCard>
    </section>
  );
}

/** Rows keep the primitive's compact size. The value is the emphasized half. */
export function OverviewRow({
  term,
  narrow,
  children,
}: {
  term: string;
  /**
   * Stacks the term over its value below `sm:`. The DS row holds a 10rem
   * label column, which is right at card width and wrong inside a nested
   * well: on a phone that leaves about 80px for the value, and a tracking
   * number or a police station wraps to five lines or pushes the grid past
   * its container. Same rows, same divider, one fewer column.
   */
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <DescriptionRow
      className={narrow ? "max-sm:grid-cols-1 max-sm:gap-y-1" : undefined}
    >
      <DescriptionTerm>{term}</DescriptionTerm>
      <DescriptionDetails className="font-medium">
        {children}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

/**
 * One pending task, the same row whoever supplies it (the task list, the bond
 * lifecycle, a removal request). Every task answers to the one verb, Respond
 * (OVW-14), and can be archived (OVW-15); an archived task moves to the
 * Archive tab of the Pending tasks page.
 */
export function PendingTaskRow({
  title,
  respond,
  onArchive,
  children,
}: {
  title: string;
  respond: { href: string } | { onClick: () => void };
  onArchive?: () => void;
  /** The lines under the title: deadline, owner, note. */
  children?: ReactNode;
}) {
  const [trayOpen, setTrayOpen] = useState(false);
  return (
    <>
      {/* Under a finger held upright: the register tray card, as on every other
          list of the case. Respond and Archive wait in the tray; a full-width
          button on every row made the block a column of buttons (owner,
          Sept 21). */}
      <div role="listitem" className={cn("py-1", REGISTER_CARDS_ONLY)}>
        <RegisterTrayCard
          title={title}
          open={trayOpen}
          onOpenChange={setTrayOpen}
          className="shadow-none"
          actions={
            <>
              {onArchive ? (
                <Button type="button" variant="outline" onClick={onArchive}>
                  <ArchiveIcon data-icon="inline-start" aria-hidden />
                  Archive
                </Button>
              ) : null}
              {"href" in respond ? (
                <Button asChild>
                  <Link href={respond.href}>Respond</Link>
                </Button>
              ) : (
                <Button type="button" onClick={respond.onClick}>
                  Respond
                </Button>
              )}
            </>
          }
        >
          {children ? (
            <div className="-mt-1 flex flex-col gap-1.5">{children}</div>
          ) : null}
        </RegisterTrayCard>
      </div>
    <Item
      role="listitem"
      size="sm"
      className={cn(
        "items-start px-0 py-2.5 hover:bg-transparent",
        REGISTER_TABLE_ONLY,
        "md:pointer-fine:flex md:landscape:flex"
      )}
    >
      <ItemContent className="gap-1.5">
        <ItemTitle className="line-clamp-none min-w-0">{title}</ItemTitle>
        {children}
      </ItemContent>
      <ItemActions className="shrink-0 gap-1 max-sm:basis-full">
        {"href" in respond ? (
          <Button
            variant="outline"
            size="sm"
            className="max-sm:h-10 max-sm:flex-1"
            asChild
          >
            <Link href={respond.href}>
              Respond<span className="sr-only">: {title}</span>
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-sm:h-10 max-sm:flex-1"
            onClick={respond.onClick}
          >
            Respond<span className="sr-only">: {title}</span>
          </Button>
        )}
        {onArchive ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground max-sm:size-10"
                aria-label={`Archive task: ${title}`}
                onClick={onArchive}
              >
                <ArchiveIcon aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Archive</TooltipContent>
          </Tooltip>
        ) : null}
      </ItemActions>
    </Item>
    </>
  );
}

/** The quiet line under a task title: who holds it, or what it is about. */
export function TaskNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-caption font-medium text-muted-foreground">{children}</p>
  );
}

/**
 * Card hover fill is for interactive cards; these are resting panels.
 *
 * `className` is here for the one thing a caller legitimately changes: a card
 * whose content runs edge to edge has to drop the shell's own vertical
 * padding, and a second card component would be a second set of decisions
 * about border, radius, and hover.
 */
export function RestingCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn(PANEL_CLASS, "hover:bg-card", className)}>
      {children}
    </Card>
  );
}

/**
 * The rung a deadline sits on, in badge variants. The model decides the
 * rung; this is the only place that turns one into a colour.
 */
const DUE_BADGE: Record<DueRamp, "destructive" | "warning" | "secondary"> = {
  past: "destructive",
  "before-hearing": "warning",
  later: "secondary",
};

/**
 * One deadline, ranked. Pending tasks is the only caller today; it stays a
 * component rather than inline markup because the rungs and the badge map
 * below are the case's escalation vocabulary, and a second copy of them is a
 * second set of decisions about when a deadline turns red.
 *
 * A deadline and the note saying who holds it were the same grey caption,
 * which is how a deadline goes missing on a card where nothing is late yet.
 * The badge now carries every rung rather than only the late and the
 * imminent: an escalation that fires on no row of the case in front of you
 * is one the reader never learns to read, and the row changed shape between
 * its states, so the eye had to re-find the deadline card by card. Same
 * structure throughout — interval in the badge, date plain beside it — and
 * only the fill ranks.
 *
 * `warning` for work owed before the next sitting is caution, not error, and
 * this codebase already spends it that way on the Long pending flag. `info`
 * would be wrong: a deadline is not an aside. Both status rungs use the
 * opaque `-muted` fills the Badge variants carry, never an alpha wash
 * (Laws — no alpha status fills).
 *
 * The badge holds the interval alone. The date is what the work is planned
 * against rather than part of the status, and a badge wide enough to hold
 * "Due in 6 days · 17 August 2026" has stopped reading as a status. Colour
 * is never alone either way (ACCESSIBILITY 3): the badge states the interval
 * in words, so the fill is emphasis on a fact, not the fact.
 */
export function DueStatusLine({ relative, on, ramp }: DueStatusView) {
  return (
    /* Wraps rather than truncates: the sidebar column is narrow and these
       strings run longer in Indic scripts (ACCESSIBILITY 13). */
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={DUE_BADGE[ramp]}>{relative}</Badge>
      {/* The badge holds the interval, this holds the date it falls on. */}
      <span className="text-body-compact tabular-nums text-muted-foreground">
        {on}
      </span>
    </div>
  );
}
