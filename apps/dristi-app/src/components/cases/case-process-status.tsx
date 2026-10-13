"use client";

import { useState, type ReactNode } from "react";
import { CaseLink as Link } from "@/components/cases/case-reader";
import { ChevronDownIcon, DownloadIcon, MailXIcon } from "lucide-react";

import { RestingCard } from "@/components/cases/case-overview-card";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { OverflowTabsList } from "@/components/chrome/overflow-tabs";
import {
  STRIP_LIST,
  STRIP_ROW,
  STRIP_TRIGGER,
} from "@/components/cases/case-section-tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  channelStatusView,
  processStatus,
  type ChannelStatus,
  type ProcessChannel,
  type ProcessPerson,
  type ProcessRound,
} from "@/lib/cases/process-status";
import { hearingHref, orderHref } from "@/lib/cases/sections";
import { type CaseRecord } from "@/lib/cases/types";
import { cn } from "@/lib/utils";
import { COLLAPSE_MOTION } from "@/components/cases/motion";

/**
 * Notice/Process Status (§7). A tab per person the court issued process to;
 * under each, rounds newest first, the latest open. A round says what
 * triggered it, then lists every channel it went out on with that channel's
 * own destination, status, date and remarks.
 */
export function CaseProcessStatus({ record }: { record: CaseRecord }) {
  const people = processStatus(record);

  if (people.length === 0) {
    return (
      <RestingCard>
        <CardContent>
          <Empty className="border border-dashed border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MailXIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-body font-semibold">
                No process issued yet
              </EmptyTitle>
              <EmptyDescription>
                Notices, summons and warrants appear here once the court issues
                them.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </RestingCard>
    );
  }

  /* One panel, the people on tabs (owner, Oct 6): stacked panels made the
     reader scroll past one party to find another, and ranked the parties by
     who happened to sit on top. */
  return <ProcessPeople caseId={record.id} people={people} />;
}

/**
 * The people, one tab each. The row is the case's own section strip — the
 * same `OverflowTabsList`, gutter and triggers — so it reads as tabs because
 * it is the tab row the reader already knows (owner, Oct 6).
 */
function ProcessPeople({
  caseId,
  people,
}: {
  caseId: string;
  people: ProcessPerson[];
}) {
  const [active, setActive] = useState(people[0].id);
  return (
    /* One white frame holds the people's tabs and their rounds, so the row
       reads apart from the case's own section strip above it (owner, Oct 6). */
    <RestingCard>
      <CardContent>
        <Tabs
          value={active}
          onValueChange={setActive}
          className="flex min-w-0 flex-col gap-6"
        >
          <div className={STRIP_ROW}>
            <OverflowTabsList
              aria-label="People process was issued to"
              value={active}
              onSelect={setActive}
              className={STRIP_LIST}
              triggerClassName={STRIP_TRIGGER}
              items={people.map((person) => ({
                value: person.id,
                measure: `${person.name} (${person.role})`,
                label: (
                  <>
                    {person.name}{" "}
                    <span className="font-normal">({person.role})</span>
                  </>
                ),
              }))}
            />
          </div>
          {people.map((person) => (
            <TabsContent
              key={person.id}
              value={person.id}
              className="outline-none"
            >
              <ul className="flex flex-col gap-4">
                {person.rounds.map((round, index) => (
                  <li key={round.id}>
                    <Round
                      caseId={caseId}
                      round={round}
                      /* Rounds count up from the oldest, so the newest carries
                     the highest number, sits first, and opens on arrival. */
                      number={person.rounds.length - index}
                      defaultOpen={index === 0}
                    />
                  </li>
                ))}
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </RestingCard>
  );
}

/** The shared cell, top-aligned: a reason or an address runs to two lines,
 *  and every column then starts on the row's first line (owner, Oct 6). */
const CELL = cn(TABLE_CELL, "align-top");

/** A fact that names a hearing or an order opens it (SVC-07, SVC-08). */
const FACT_LINK =
  "rounded-sm text-primary underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50";

/** The dot beside a channel's status in a closed round's one-line glance. It
 *  never carries the meaning alone: the status word sits beside it. */
const STATUS_DOT: Record<ChannelStatus, string> = {
  "pending-dispatch": "bg-input",
  sent: "bg-info",
  delivered: "bg-success",
  "not-delivered": "bg-warning",
};

/** "Summons", "Proclamation & Attachment", "Warrant, Proclamation & Attachment". */
function processTitle(processes: ProcessRound["processes"]) {
  if (processes.length < 2) return processes.join("");
  return `${processes.slice(0, -1).join(", ")} & ${processes.at(-1)}`;
}

/**
 * One round as a card under the person's tab (owner, Oct 6). Closed, it
 * names itself and says how each channel stands, so an earlier round still
 * shows what came back without opening. Open, the round's own facts (order,
 * hearing) read as a label–value list, and its channels as a table: every channel has the same
 * fields, so they are rows rather than repeated labels.
 */
function Round({
  caseId,
  round,
  number,
  defaultOpen,
}: {
  caseId: string;
  round: ProcessRound;
  number: number;
  defaultOpen: boolean;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="group/round overflow-hidden rounded-xl border border-hairline bg-card"
    >
      {/* The header is a sunken band, the product's section-heading well,
          so it separates from the white body without a rule (owner, Oct 6).
          The chevron leads; the closed round's channel tags sit at the far
          edge. */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 bg-surface-sunken px-4 py-2 md:px-6">
        <h3 className="min-w-0 flex-1">
          <CollapsibleTrigger className="flex min-h-10 w-full items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <ChevronDownIcon
              aria-hidden
              className="size-4 shrink-0 -rotate-90 text-muted-foreground transition-transform group-data-[state=open]/round:rotate-0"
            />
            <span className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-1">
              <span className="text-body-compact font-semibold text-foreground">
                Round {number}: {processTitle(round.processes)}
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-y-1 text-body-compact text-muted-foreground group-data-[state=open]/round:hidden max-sm:flex-col max-sm:items-start">
                {round.channels.map((channel) => (
                  /* Each channel its own segment, ruled from the next, so
                     three statuses never read as one long line. */
                  <span
                    key={channel.type}
                    className="inline-flex items-center gap-2 border-l border-hairline px-3 whitespace-nowrap first:border-l-0 first:pl-0 last:pr-0 max-sm:border-l-0 max-sm:px-0"
                  >
                    {/* So the trigger's name reads "Round 2: Warrant, Police ·
                        Not delivered" rather than running the words together. */}
                    <span className="sr-only">, </span>
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        STATUS_DOT[channel.status],
                      )}
                    />
                    {channel.type} · {channelStatusView(channel.status).label}
                  </span>
                ))}
              </span>
            </span>
          </CollapsibleTrigger>
        </h3>
      </div>
      <CollapsibleContent className={COLLAPSE_MOTION}>
        <div className="@container mx-4 flex flex-col gap-8 pt-6 pb-8 md:mx-6">
          {/* `px-4` puts the values on the table's cell inset, and the
              Channel column's width matches the term column, so a round has
              one left edge for its facts and its Destination column. */}
          <DescriptionList className="sm:px-4">
            <FactRow label="Order issued">
              {round.order ? (
                <>
                  <span className="tabular-nums">{round.order.on}</span>
                  {/* The order opens from its own fact (owner, Oct 6). */}
                  {round.order.id ? (
                    <Link
                      href={orderHref(caseId, round.order.id)}
                      className={FACT_LINK}
                    >
                      View order
                    </Link>
                  ) : null}
                </>
              ) : (
                <Muted>None</Muted>
              )}
            </FactRow>
            <FactRow label="Linked hearing">
              {round.hearing ? (
                <>
                  {round.hearing.id ? (
                    <Link
                      href={hearingHref(
                        caseId,
                        round.hearing.id,
                        "notice-process-status",
                      )}
                      className={FACT_LINK}
                    >
                      {round.hearing.purpose}
                    </Link>
                  ) : (
                    round.hearing.purpose
                  )}
                  <Muted>
                    <span className="tabular-nums">{round.hearing.on}</span>
                  </Muted>
                </>
              ) : (
                <Muted>None</Muted>
              )}
            </FactRow>
          </DescriptionList>

          {/* Where the round is narrow: each channel as its own short
              label–value list, ruled from the next. */}
          <ul className="flex flex-col sm:px-4 @3xl:hidden">
            {round.channels.map((channel) => {
              return (
                <li
                  key={channel.type}
                  className="border-t border-hairline py-4 first:border-t-0 first:pt-0 last:pb-0"
                >
                  <DescriptionList>
                    <FactRow label="Sent via">
                      <span className="font-medium">{channel.type}</span>
                    </FactRow>
                    <FactRow label="Destination">
                      <span className="wrap-anywhere">
                        {channel.destination}
                      </span>
                    </FactRow>
                    <FactRow label="Status">
                      <StatusMark channel={channel} />
                    </FactRow>
                    <FactRow label="Fee paid on">
                      <FeePaid on={channel.feePaidOn} />
                    </FactRow>
                    {hasRemarks(channel) ? (
                      <FactRow label="Remarks">
                        <ChannelRemarks channel={channel} />
                      </FactRow>
                    ) : null}
                  </DescriptionList>
                </li>
              );
            })}
          </ul>
          {/* The table only where the round itself is wide enough (48rem):
              the round's width, not the screen's, decides, so an open
              sidebar or a narrow window falls back to the stacked blocks
              rather than crushing five columns. */}
          <div className="hidden @3xl:block">
            {/* Fixed columns, so an unbreakable address or an empty column
                cannot take Remarks' width. Remarks keeps a quarter (its notes
                run a line or two) and Destination takes the slack; only below
                the minimum does the table scroll, inside its own frame. */}
            <Table className="min-w-2xl table-fixed">
              <TableHeader>
                <TableRow className={TABLE_HEAD_ROW}>
                  <TableHead className={cn(TABLE_HEAD, "w-36 xl:w-44")}>
                    Channel
                  </TableHead>
                  <TableHead className={TABLE_HEAD}>Destination</TableHead>
                  <TableHead className={cn(TABLE_HEAD, "w-44")}>
                    Status
                  </TableHead>
                  <TableHead className={cn(TABLE_HEAD, "w-36")}>
                    Fee paid on
                  </TableHead>
                  <TableHead className={cn(TABLE_HEAD, "w-1/5 xl:w-1/4")}>
                    Remarks
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={tableBodyClass({ hover: false })}>
                {round.channels.map((channel) => {
                  return (
                    <TableRow
                      key={channel.type}
                      className={tableRowClass({ hover: false })}
                    >
                      <TableCell className={cn(CELL, "font-medium")}>
                        {channel.type}
                      </TableCell>
                      <TableCell
                        className={cn(CELL, "whitespace-normal wrap-anywhere")}
                      >
                        {channel.destination}
                      </TableCell>
                      <TableCell className={CELL}>
                        <StatusMark channel={channel} />
                      </TableCell>
                      <TableCell className={cn(CELL, "whitespace-nowrap")}>
                        <FeePaid on={channel.feePaidOn} />
                      </TableCell>
                      <TableCell className={cn(CELL, "whitespace-normal")}>
                        <ChannelRemarks channel={channel} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** A label over its value on a phone, beside it from `sm` up. Below `xl` the
 *  label column narrows with the table's Channel column, so the values and
 *  the Destination column keep one left edge at every width. */
function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DescriptionRow className="gap-1 border-b-0 py-2 max-sm:grid-cols-1 sm:gap-4 sm:max-xl:grid-cols-[8rem_1fr]">
      <DescriptionTerm>{label}</DescriptionTerm>
      <DescriptionDetails className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {children}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

function hasRemarks(channel: ProcessChannel) {
  return Boolean(
    channel.nonDeliveryReason || channel.remarks || channel.executionReport,
  );
}

/**
 * What came back with the channel, in one place: why it was not delivered
 * (only when it was not), the clerk's remark, and the executing agency's
 * report when one was filed. Each is often absent, so they share a column
 * rather than leaving three mostly empty ones (owner, Oct 6).
 */
function ChannelRemarks({ channel }: { channel: ProcessChannel }) {
  /* Most channels carry no remark; an explicit N/A reads as "nothing
     recorded" where a blank cell read as missing (owner, Oct 6). */
  if (!hasRemarks(channel)) return <Muted>N/A</Muted>;
  return (
    <span className="flex flex-col items-start gap-2">
      {channel.nonDeliveryReason || channel.remarks ? (
        <span className="flex flex-col gap-0.5">
          {channel.nonDeliveryReason ? (
            <span>{channel.nonDeliveryReason}</span>
          ) : null}
          {channel.remarks ? (
            <span className="text-muted-foreground">{channel.remarks}</span>
          ) : null}
        </span>
      ) : null}
      {channel.executionReport ? (
        /* A plain DS outline button: one download icon and the label. The
           attachment chip it replaced was an upload tile — a boxed icon
           inside a darker frame, two icons for one act (owner, Oct 6). */
        <Button asChild variant="outline">
          <a
            href={channel.executionReport.href}
            download={channel.executionReport.fileName}
          >
            <DownloadIcon data-icon="inline-start" aria-hidden />
            Execution report
          </a>
        </Button>
      ) : null}
    </span>
  );
}

/**
 * A channel's status and the date it took it, as two lines of the same kind:
 * a status dot and word, then the date under the word. The pill read as a
 * different object from the plain date beside or under it, which is why
 * neither arrangement held together (owner, Oct 6). The dot is the closed
 * round's glance, so a status looks the same open or closed; the word
 * always carries the meaning, never the colour alone.
 */
function StatusMark({ channel }: { channel: ProcessChannel }) {
  return (
    <span className="grid grid-cols-[auto_1fr] items-center gap-x-2 whitespace-nowrap">
      <span
        aria-hidden
        className={cn("size-2 rounded-full", STATUS_DOT[channel.status])}
      />
      <span className="text-foreground">
        {channelStatusView(channel.status).label}
      </span>
      <span className="col-start-2 tabular-nums text-muted-foreground">
        {channel.statusOn}
      </span>
    </span>
  );
}

/** The channel's fee date, or that it is still owed (SVC-09). */
function FeePaid({ on }: { on?: string }) {
  return on ? (
    <span className="tabular-nums">{on}</span>
  ) : (
    <Muted>Not paid yet</Muted>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
