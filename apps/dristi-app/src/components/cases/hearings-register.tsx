"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { CaseLink as Link } from "@/components/cases/case-reader";
import { ArrowLeftIcon, CalendarOffIcon } from "lucide-react";

import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { RestingCard } from "@/components/cases/case-overview-card";
import {
  RECENT_ROW,
  RowViewButton,
} from "@/components/cases/register-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type HearingRecord } from "@/lib/cases/hearing-record";
import { formatHearingClock } from "@/lib/cases/hearings";
import { orderHref } from "@/lib/cases/sections";
import { cn } from "@/lib/utils";
import { RegisterTrayCard, useOneOpen } from "@/components/cases/register-card";
import {
  REGISTER_CARDS_ONLY,
  REGISTER_TABLE_ONLY,
} from "@/components/cases/register-layout";

/**
 * The hearings list (§5.4.1): Date, Hearing purpose, Status, Action, newest
 * first. The whole row opens the record; the button is the named way in for
 * keyboard and voice.
 */
export function HearingsList({
  hearings,
  onOpen,
  recentId = null,
  recentRowRef,
}: {
  hearings: HearingRecord[];
  onOpen: (hearing: HearingRecord) => void;
  /** The hearing the reader just stepped back from; see `useRecentRow`. */
  recentId?: string | null;
  recentRowRef?: (node: HTMLTableRowElement | null) => void;
}) {
  const tray = useOneOpen<string>();
  if (hearings.length === 0) {
    return (
      <Empty className="border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarOffIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-body font-semibold">
            No hearings yet
          </EmptyTitle>
          <EmptyDescription>
            Hearings appear here once the court lists this case.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
    {/* Under a finger held upright: a tray card per hearing, as in every
        other register of the case. */}
    <ul className={cn("flex flex-col gap-3", REGISTER_CARDS_ONLY)}>
      {hearings.map((hearing) => (
        <li key={hearing.id}>
          <RegisterTrayCard
            title={hearing.purpose}
            open={tray.isOpen(hearing.id)}
            onOpenChange={tray.toggle(hearing.id)}
            className={cn(recentId === hearing.id && RECENT_ROW)}
            actions={
              <Button type="button" onClick={() => onOpen(hearing)}>
                View hearing
              </Button>
            }
          >
            <div className="-mt-1 flex flex-wrap items-center gap-2">
              <time
                dateTime={hearing.on}
                className="text-caption tabular-nums text-muted-foreground"
              >
                {hearing.date}
              </time>
              <Badge variant={hearing.status.variant}>
                {hearing.status.label}
              </Badge>
            </div>
          </RegisterTrayCard>
        </li>
      ))}
    </ul>
    <div className={REGISTER_TABLE_ONLY}>
    <Table>
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          <TableHead className={cn(TABLE_HEAD, "w-36")}>Date</TableHead>
          <TableHead className={TABLE_HEAD}>Hearing purpose</TableHead>
          <TableHead className={cn(TABLE_HEAD, "w-32")}>Status</TableHead>
          <TableHead className={cn(TABLE_HEAD, "w-24")}>
            Action
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass()}>
        {hearings.map((hearing) => (
          <TableRow
            key={hearing.id}
            ref={recentId === hearing.id ? recentRowRef : undefined}
            className={cn(
              tableRowClass(),
              "cursor-pointer",
              recentId === hearing.id && RECENT_ROW
            )}
            onClick={() => onOpen(hearing)}
          >
            <TableCell className={cn(TABLE_CELL, "tabular-nums")}>
              <time dateTime={hearing.on}>{hearing.date}</time>
            </TableCell>
            <TableCell className={cn(TABLE_CELL, "font-medium")}>
              {hearing.purpose}
            </TableCell>
            <TableCell className={TABLE_CELL}>
              <Badge variant={hearing.status.variant}>
                {hearing.status.label}
              </Badge>
            </TableCell>
            <TableCell className={TABLE_CELL}>
              <RowViewButton
                label={`${hearing.purpose}, ${hearing.date}`}
                onClick={() => onOpen(hearing)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
    </>
  );
}

const NOT_RECORDED = (
  <span className="text-muted-foreground">Not recorded</span>
);

/**
 * One hearing (§5.4.2). Every field always shows, so a reader can tell
 * "nothing happened yet" from "the field does not exist".
 */
export function HearingDetail({
  hearing,
  orderHref,
  headingRef,
  onBack,
}: {
  hearing: HearingRecord;
  /** Where the order opens. Absent when no order was passed. */
  orderHref?: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  /** Absent inside the pop-up, where the way back is the dialog's footer. */
  onBack?: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col items-start gap-2">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-3"
            onClick={onBack}
          >
            <ArrowLeftIcon data-icon="inline-start" aria-hidden />
            All hearings
          </Button>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="text-body font-semibold text-foreground outline-none"
          >
            {hearing.purpose}
          </h3>
          <Badge variant={hearing.status.variant}>{hearing.status.label}</Badge>
        </div>
      </div>

      <DescriptionList>
        <Row term="Date">
          <time dateTime={hearing.on} className="tabular-nums">
            {hearing.date}
          </time>
        </Row>
        <Row term="Start time">
          {hearing.startTime ? (
            <span className="tabular-nums">
              {formatHearingClock(hearing.startTime)}
            </span>
          ) : (
            NOT_RECORDED
          )}
        </Row>
        <Row term="End time">
          {hearing.endTime ? (
            <span className="tabular-nums">
              {formatHearingClock(hearing.endTime)}
            </span>
          ) : (
            NOT_RECORDED
          )}
        </Row>
        <Row term="Attendance">{hearing.attendance ?? NOT_RECORDED}</Row>
        <Row term="Next hearing purpose">
          {hearing.nextPurpose ?? NOT_RECORDED}
        </Row>
        <Row term="Next hearing date">
          {hearing.nextDate ? (
            <span className="tabular-nums">{hearing.nextDate}</span>
          ) : (
            NOT_RECORDED
          )}
        </Row>
        <Row term="Hearing summary">
          {hearing.summary ? (
            <span className="font-normal">{hearing.summary}</span>
          ) : (
            <span className="text-muted-foreground">
              No order has been passed for this hearing yet.
            </span>
          )}
        </Row>
        <Row term="Order">
          {hearing.order && orderHref ? (
            <Button variant="link" asChild className="h-auto px-0 text-left">
              <Link href={orderHref}>{hearing.order.title}</Link>
            </Button>
          ) : (
            <span className="text-muted-foreground">No order yet</span>
          )}
        </Row>
      </DescriptionList>
    </div>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <DescriptionRow className="border-hairline py-2.5 max-sm:grid-cols-1 max-sm:gap-1">
      <DescriptionTerm>{term}</DescriptionTerm>
      <DescriptionDetails className="min-w-0 font-medium text-pretty">
        {children}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

/**
 * The same list and record as the pop-up, as a panel. It backs the
 * `?section=hearings` address that modified clicks and older links still reach.
 */
export function CaseHearingsSection({
  caseId,
  hearings,
}: {
  caseId: string;
  hearings: HearingRecord[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openHearing = hearings.find((item) => item.id === openId) ?? null;
  return (
    <RestingCard>
      <CardContent className="flex flex-col gap-4">
        <h2 className="text-body font-semibold text-foreground">Hearings</h2>
        {openHearing ? (
          <HearingDetail
            hearing={openHearing}
            orderHref={
              openHearing.order
                ? orderHref(caseId, openHearing.order.id)
                : undefined
            }
            onBack={() => setOpenId(null)}
          />
        ) : (
          <HearingsList
            hearings={hearings}
            onOpen={(hearing) => setOpenId(hearing.id)}
          />
        )}
      </CardContent>
    </RestingCard>
  );
}
