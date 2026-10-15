"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, InboxIcon } from "lucide-react";
import { toast } from "sonner";

import { DocumentPreview } from "@/components/cases/document-preview";
import { Identifier } from "@/components/chrome/identifier";
import {
  ApplicationQuickOrder,
  type QuickOrderEntry,
} from "@/components/employee/application-quick-order";
import { ApplicationFacsimile } from "@/components/employee/application-review-dialog";
import { ListingDateField } from "@/components/employee/listing-date-field";
import { useCourtRole } from "@/components/employee/use-court-role";
import { useOrderSigning } from "@/components/employee/use-order-signing";
import { usePendingOrders } from "@/components/employee/use-pending-orders";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { decodeDraft } from "@/lib/applications/form-codec";
import {
  applicationHref,
  applicationOrderHref,
  type ApplicationOrderDecision,
} from "@/lib/employee/application-order-decision";
import {
  canDraftOrder,
  canSignOrder,
  canTakeSystemAction,
  discardOrder,
  listForLater,
  moveDecisionDate,
  objectionDeadline,
  onboard,
  setADateUsed,
  setReviewDate,
  signOrder,
  type CourtSeat,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";
import {
  allotApplicationNumber,
  allotOrderId,
  applyStep,
  getApplication,
  today,
  useApplicationsReady,
  useLifecycleApplications,
  type Result,
} from "@/lib/applications/store";
import { formatCaseDate } from "@/lib/cases/types";
import {
  APPLICATION_VIEWS,
  applicationsIn,
  countIn,
  objectionLine,
  queueOf,
  shortDate,
  statusLine,
  type ApplicationView,
} from "@/lib/employee/application-queue";
import {
  caseOf,
  causeTitleOf,
  courtDocumentOf,
  nextHearingOf,
} from "@/lib/employee/application-tasks";
import {
  pendingOrderHref,
  pendingOrderStage,
  pendingOrderStageLabel,
} from "@/lib/employee/pending-orders";
import { cn } from "@/lib/utils";

type QueueKey = ApplicationView | "archive";

const QUEUES: { id: QueueKey; label: string; counted: boolean }[] = [
  ...APPLICATION_VIEWS.map((view) => ({
    id: view.id,
    label: view.label,
    counted: view.counted,
  })),
  { id: "archive", label: "Archive", counted: false },
];

const QUEUE_LABEL: Record<string, string> = {
  onboard: "To onboard",
  decide: "To decide",
  signing: "Order awaiting signature",
  later: "Upcoming",
  closed: "Closed",
  archive: "Archive",
};

/** Which list an application belongs to when it is opened on its own. */
export function viewFor(app: LifecycleApplication, on: string): QueueKey {
  const queue = queueOf(app, on);
  if (!queue || queue === "signing") return "all";
  return queue;
}

/**
 * Applications, worked one after another — the court's application workstation.
 *
 * The bench takes a list the way it takes a cause list: open the first, act, and the next
 * one is in front of it (owner, 2026-10-07: *"it should feel like a workstation"*). Three
 * columns from `lg`: the list being worked on the left, the application in the middle, and
 * what can be done with it on the right. Below `lg` the list folds away and the two stack.
 *
 * The rail folds to its strip on this route (`employee-area.tsx`), as it does for the
 * order composer, for the same reason: the page needs the width.
 *
 * **Every act is the lifecycle's own step** (`lib/applications/lifecycle.ts`), applied
 * through the applications store. Nothing is sent to anybody; the record in this browser
 * moves exactly as the lifecycle document says it would.
 */
export function ApplicationWorkstation({
  applicationId,
  view,
}: {
  applicationId: string;
  view: QueueKey | undefined;
}) {
  const router = useRouter();
  const ready = useApplicationsReady();
  const apps = useLifecycleApplications();
  const on = today();
  const app = apps.find((item) => item.id === applicationId);

  /* The list stays the one the bench came in on, even after the open application moves
     out of it — the list switching under you read as everything having moved (owner,
     2026-10-07). */
  const [queueKey, setQueueKey] = React.useState<QueueKey | undefined>(view);
  const activeKey = queueKey ?? (app ? viewFor(app, on) : "all");
  const queue = applicationsIn(apps, activeKey, on);

  /**
   * Open another application in this list. Moving between applications — a click in the
   * list, J and K, the list select — is pushed, so browser Back retraces the bench's own
   * steps rather than leaving the workstation. The move an act makes on its own (the next
   * application after one is dealt with) replaces instead: the one acted on has left the
   * list, and Back should not land on it as if it were still waiting.
   */
  function go(id: string | null, key: QueueKey = activeKey, replace = false) {
    const href = id ? applicationHref(id, key) : `/employee/applications?view=${key}`;
    if (replace && id) router.replace(href);
    else router.push(href);
  }

  /**
   * After an act: stay if it is still in this list, otherwise take the next one. An order
   * passed on it always moves on (`moveOn`) — the application waits on the order now,
   * and a signed order decides it a moment later, from the triggers.
   */
  function next(after: LifecycleApplication, moveOn = false) {
    const index = queue.findIndex((item) => item.id === after.id);
    const fresh = getApplication(after.id);
    /* Under All an act moves it to another band — that is moving on too. */
    const stays =
      !moveOn &&
      fresh &&
      applicationsIn([fresh], activeKey, on).length > 0 &&
      queueOf(fresh, on) === queueOf(after, on);
    if (stays) return;
    const rest = queue.filter((item) => item.id !== after.id);
    const target = rest[Math.max(0, Math.min(index, rest.length - 1))];
    go(target?.id ?? null, activeKey, true);
  }

  if (!ready) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6" aria-busy>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex flex-1 flex-col p-6">
        <Empty className="border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="text-title-s font-semibold">
              This application isn&rsquo;t here
            </EmptyTitle>
            <EmptyDescription className="text-body">
              It may have been reset with the sandbox data.
            </EmptyDescription>
          </EmptyHeader>
          <Button asChild variant="outline">
            <Link href="/employee/applications">
              <ArrowLeftIcon aria-hidden />
              Back to applications
            </Link>
          </Button>
        </Empty>
      </div>
    );
  }

  const index = queue.findIndex((item) => item.id === app.id);
  const pinned = index < 0 && Boolean(queueOf(app, on));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[16rem_minmax(0,1fr)_22rem]">
      <QueueColumn
        apps={apps}
        queue={queue}
        activeKey={activeKey}
        openId={app.id}
        pinned={pinned ? app : null}
        on={on}
        onPickQueue={(key) => {
          setQueueKey(key);
          const first = applicationsIn(apps, key, on)[0];
          if (first) go(first.id, key);
        }}
        onOpen={(id) => go(id)}
      />

      <ApplicationColumn
        app={app}
        all={apps}
        on={on}
        position={index >= 0 ? { index, total: queue.length } : null}
        onStep={(delta) => {
          const target = queue[index + delta];
          if (target) go(target.id);
        }}
      />

      {/* Keyed by application: a half-made choice never carries onto the next one. */}
      <DecisionPanel
        key={app.id}
        app={app}
        on={on}
        view={activeKey}
        onDone={(message, moveOn) => {
          toast.success(message);
          next(app, moveOn);
        }}
      />
    </div>
  );
}

/* ─────────────────────────────── the list being worked ─────────────────────────────── */

function QueueColumn({
  apps,
  queue,
  activeKey,
  openId,
  pinned,
  on,
  onPickQueue,
  onOpen,
}: {
  apps: LifecycleApplication[];
  queue: LifecycleApplication[];
  activeKey: QueueKey;
  openId: string;
  pinned: LifecycleApplication | null;
  on: string;
  onPickQueue: (key: QueueKey) => void;
  onOpen: (id: string) => void;
}) {
  const entry = QUEUES.find((item) => item.id === activeKey);
  const label = entry?.label ?? "Applications";
  const counted = entry?.counted ?? false;
  return (
    <aside
      aria-label="Applications in this list"
      className="hidden min-h-0 flex-col border-r border-hairline bg-card xl:sticky xl:top-14 xl:flex xl:h-[calc(100dvh-3.5rem)]"
    >
      {/* The list being worked, chosen the way every court list is filtered: the DS
          select. Its top sits level with the page title and the panel heading. */}
      <div className="flex flex-col border-b border-hairline px-4 pt-6 pb-4">
        <Label htmlFor="application-list" className="sr-only">
          List
        </Label>
        <Select value={activeKey} onValueChange={(value) => onPickQueue(value as QueueKey)}>
          <SelectTrigger id="application-list" className="w-full">
            {/* Rendered rather than left to the primitive, so the first paint is not an
                empty box (order-screen.tsx, the purpose select). */}
            <SelectValue>
              <QueueOption label={label} count={counted ? queue.length : null} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {QUEUES.map((item) => (
              <React.Fragment key={item.id}>
                {item.id === "archive" ? <SelectSeparator /> : null}
                <SelectItem value={item.id}>
                  <QueueOption
                    label={item.label}
                    count={item.counted ? countIn(apps, item.id, on) : null}
                  />
                </SelectItem>
              </React.Fragment>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {pinned ? (
          <QueueEntry
            app={pinned}
            on={on}
            current
            note={`In ${QUEUE_LABEL[queueOf(pinned, on) ?? "all"] ?? "another list"}`}
            onOpen={onOpen}
          />
        ) : null}
        {queue.map((item) => (
          <QueueEntry
            key={item.id}
            app={item}
            on={on}
            current={item.id === openId}
            onOpen={onOpen}
          />
        ))}
        {queue.length === 0 && !pinned ? (
          <li className="p-4 text-body-compact text-muted-foreground">
            Nothing left in this list.
          </li>
        ) : null}
      </ul>
    </aside>
  );
}

function QueueOption({ label, count }: { label: string; count: number | null }) {
  return (
    <>
      {label}
      {count !== null ? (
        <span className="tabular-nums text-muted-foreground">{count}</span>
      ) : null}
    </>
  );
}

function QueueEntry({
  app,
  on,
  current,
  note,
  onOpen,
}: {
  app: LifecycleApplication;
  on: string;
  current: boolean;
  note?: string;
  onOpen: (id: string) => void;
}) {
  const line = statusLine(app, on);
  return (
    <li className="border-b border-hairline">
      <button
        type="button"
        aria-current={current ? "page" : undefined}
        onClick={() => onOpen(app.id)}
        className={cn(
          "flex w-full flex-col gap-1 px-4 py-3 text-left outline-none transition-colors hover:bg-surface-sunken focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
          current && "bg-accent hover:bg-accent",
        )}
      >
        <span className="text-body-compact font-medium">{app.typeLabel}</span>
        <span className="text-body-compact text-muted-foreground">
          {causeTitleOf(app)}
        </span>
        <span
          className={cn(
            "text-body-compact",
            note
              ? "text-muted-foreground"
              : line.due === "overdue"
                ? "text-destructive-ink"
                : "text-muted-foreground",
          )}
        >
          {note ?? (line.due === "overdue" ? `${line.word} · Overdue` : line.word)}
        </span>
      </button>
    </li>
  );
}

/* ─────────────────────────────── the application itself ────────────────────────────── */

function ApplicationColumn({
  app,
  all,
  on,
  position,
  onStep,
}: {
  app: LifecycleApplication;
  all: LifecycleApplication[];
  on: string;
  position: { index: number; total: number } | null;
  onStep: (delta: number) => void;
}) {
  const record = caseOf(app);
  const document = React.useMemo(() => courtDocumentOf(app), [app]);
  const objection = app.objectionId
    ? all.find((item) => item.id === app.objectionId)
    : undefined;

  /* J and K step through the list, the way a cause list is worked. Not inside a field. */
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable], [role=dialog], [role=menu], [role=listbox]")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "j") onStep(1);
      if (event.key === "k") onStep(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStep]);

  return (
    <section
      aria-labelledby="application-title"
      className="flex min-w-0 flex-col gap-6 p-6"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 id="application-title" className="text-title font-semibold">
              {app.typeLabel}
            </h1>
            <StageBadge app={app} on={on} />
          </div>
          {/* The case, its number, then who filed it and when — each its own line, so a
              wrap never leaves a separator stranded at a line's end or start. */}
          <div className="flex flex-col gap-1">
            <p className="text-body">{causeTitleOf(app)}</p>
            {record ? (
              <p className="text-body-compact text-muted-foreground">
                <Identifier value={record.caseNumber} label="case number" />
              </p>
            ) : null}
            <p className="text-body-compact text-muted-foreground">
              Filed {formatCaseDate(app.submittedOn ?? app.createdOn)} by{" "}
              {app.raisedBy ?? app.createdByName}, for the {app.side}
            </p>
          </div>
        </div>
        {position ? (
          <div className="flex h-10 shrink-0 items-center gap-2">
            <span className="text-body-compact tabular-nums text-muted-foreground">
              {position.index + 1} of {position.total}
            </span>
            <TooltipProvider delayDuration={300}>
              <StepButton
                label="Previous application"
                shortcut="K"
                disabled={position.index === 0}
                onClick={() => onStep(-1)}
              >
                <ArrowUpIcon aria-hidden />
              </StepButton>
              <StepButton
                label="Next application"
                shortcut="J"
                disabled={position.index >= position.total - 1}
                onClick={() => onStep(1)}
              >
                <ArrowDownIcon aria-hidden />
              </StepButton>
            </TooltipProvider>
          </div>
        ) : null}
      </header>

      <Facts app={app} on={on} />

      {objection ? (
        <Card
          size="sm"
          role="region"
          aria-labelledby="application-objection"
          className="gap-2 border-hairline px-4 shadow-raised"
        >
          <h2 id="application-objection" className="text-body font-semibold">
            Objection from the {objection.side}
          </h2>
          <p className="text-body whitespace-pre-wrap">
            {decodeDraft(objection.form).objectionReason || "No grounds were entered."}
          </p>
          <p className="text-body-compact text-muted-foreground">
            Received {formatCaseDate(objection.submittedOn ?? objection.createdOn)}
          </p>
        </Card>
      ) : null}

      {document ? (
        /* The whole application, read top to bottom with the page: no well of its own
           to scroll inside. The list and the panel beside it stay put. */
        <DocumentPreview
          variant="quiet"
          surface="card"
          height="auto"
          title={document.title}
          source={{
            kind: "composed",
            content: <ApplicationFacsimile document={document} />,
          }}
        />
      ) : (
        <p className="text-body text-muted-foreground">
          The application&rsquo;s text could not be read from what was filed.
        </p>
      )}
    </section>
  );
}

/**
 * One step through the list. The tooltip names the act and its key; the button's own
 * name says the same in words, so neither hover nor the tooltip is needed to know it.
 */
function StepButton({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button fires no pointer events, so the trigger is a wrapper that
            still does; the tooltip then explains the key even at the list's end. */}
        <span className="inline-flex">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={label}
            aria-keyshortcuts={shortcut.toLowerCase()}
            disabled={disabled}
            onClick={onClick}
          >
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        <Kbd>{shortcut}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

function StageBadge({ app, on }: { app: LifecycleApplication; on: string }) {
  const queue = queueOf(app, on);
  if (queue === "closed" || queue === "archive") {
    return (
      <Badge
        variant={
          app.status === "accepted"
            ? "success"
            : app.status === "rejected"
              ? "destructive"
              : "secondary"
        }
      >
        {statusLine(app, on).word}
      </Badge>
    );
  }
  /* The list's own words, so the badge, the pills and the list select say one thing. */
  return <Badge variant="info">{QUEUE_LABEL[queue ?? "all"] ?? "Open"}</Badge>;
}

/**
 * Four facts, always the same four, so the row never leaves a gap (owner, 2026-10-07):
 * when it is due, the objection, the next hearing and its number. Who filed it and when
 * sit in the header line instead (`ALC-23`).
 */
function Facts({ app, on }: { app: LifecycleApplication; on: string }) {
  const queue = queueOf(app, on);
  const line = statusLine(app, on);
  const hearing = nextHearingOf(app, on);
  const number = app.applicationNumber ?? app.temporaryId;
  const due =
    queue === "closed" || queue === "archive"
      ? line.word
      : app.review
        ? `Review by ${shortDate(app.review.dueOn)}`
        : app.decide
          ? `Listed for ${shortDate(app.decide.dueOn)}`
          : "—";
  const facts: { term: string; value: React.ReactNode }[] = [
    {
      term: queue === "closed" || queue === "archive" ? "Outcome" : "Due",
      value: (
        <span className="flex flex-wrap items-center gap-2">
          {due}
          {line.due === "overdue" ? <Badge variant="destructive">Overdue</Badge> : null}
          {line.due === "today" ? <Badge variant="warning">Due today</Badge> : null}
        </span>
      ),
    },
    {
      term: "Objection",
      value: (
        <span className={app.objectionId ? "font-medium text-foreground" : undefined}>
          {objectionLine(app, on)}
        </span>
      ),
    },
    { term: "Next hearing", value: hearing ? shortDate(hearing) : "None listed" },
    {
      term: app.applicationNumber ? "Application no." : "Temporary no.",
      value: number ? (
          <Identifier
            value={number}
            label={app.applicationNumber ? "application number" : "temporary number"}
          />
        ) : (
          "—"
        ),
    },
  ];
  return (
    <Card className="gap-0 border-hairline py-0 shadow-raised">
      <DescriptionList className="grid grid-cols-2 2xl:grid-cols-4">
        {facts.map((fact) => (
          <DescriptionRow
            key={fact.term}
            className="flex flex-col gap-1 border-b-0 border-hairline px-4 py-3 even:border-l 2xl:border-l 2xl:first:border-l-0 [&:nth-child(-n+2)]:border-b 2xl:[&:nth-child(-n+2)]:border-b-0"
          >
            <DescriptionTerm className="text-body-compact">{fact.term}</DescriptionTerm>
            <DescriptionDetails className="text-body-compact">{fact.value}</DescriptionDetails>
          </DescriptionRow>
        ))}
      </DescriptionList>
    </Card>
  );
}

/* ─────────────────────────────── what can be done with it ──────────────────────────── */

/** One answer to the panel's question, from its one segmented control. */
type Choice = "onboard" | "defer" | "dismiss" | "accept" | "reject" | "move" | "list";

type Panel = {
  /** The option chosen in the panel's segmented control; none yet on a decision. */
  choice: Choice | null;
  /** Onboarding: list it for a date, or take it up now. */
  when: "date" | "now";
  /** A listing date — on onboarding, or listing one taken up today after all. */
  date: Date | undefined;
  invite: boolean;
  defer: Date | undefined;
  /** Relisting one listed ahead, or moving the date of one due. */
  relist: Date | undefined;
  /** What has been typed into each decision's order, kept across switches. */
  orders: Partial<Record<ApplicationOrderDecision, QuickOrderEntry>>;
};

const CHOICE_LABEL: Record<Choice, string> = {
  onboard: "Onboard",
  defer: "Defer review",
  dismiss: "Dismiss",
  accept: "Accept",
  reject: "Reject",
  move: "Move date",
  list: "List for a date",
};

function dayOfDate(date: Date | undefined): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateOfDay(day: string | undefined): Date | undefined {
  if (!day) return undefined;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The right-hand panel: one question for this application, answered here.
 *
 * **One pattern for every open state** (owner, 2026-10-15): the heading, one segmented
 * control of what can be done, the chosen option's fields under it, and one primary at
 * the foot naming the date or the act. Changing your mind is picking another segment —
 * there is no Back and no banner link — and what was entered under each stays.
 *
 * - **Pending review** — Onboard · Defer review · Dismiss, Onboard chosen (owner,
 *   2026-10-07). Onboarding asks when the court will take it up: listed for a later date
 *   (pre-filled with the next hearing, `ALC-10`; the other party asked to object by
 *   default, `ALC-11`, `ALC-25`) or taken up now (`ALC-08`). A deferred review reads the
 *   same, with the date it was deferred to.
 * - **Pending decision, due** — Accept · Reject · Move date, nothing chosen: a judgment
 *   is never answered in advance. Taken up today, the third is List for a date instead —
 *   onboarding stays done (product, 2026-10-08).
 * - **Listed ahead** — it waits for its date; only the date can change (`ALC-15`).
 * - **Closed** — the order that closed it, and what happened when.
 *
 * **Accept, Reject and Dismiss pass the order here** (owner, 2026-10-15), in the court's
 * standard words, in the quick order modal (`application-quick-order.tsx`) — or go on to
 * the full order screen from it. The application moves when that order is signed and its
 * workflow complete (`application-order-outcome.ts`), not here. An order drafted here
 * before the order screen took over still shows, to sign or discard.
 *
 * Who may do what follows `ALC-22`, widened for now to the bench clerk (owner,
 * 2026-10-13): onboarding and every date are the magistrate's or bench clerk's; any court
 * seat drafts an order; only the magistrate signs it. A seat without the system acts is
 * offered only the orders.
 */
function DecisionPanel({
  app,
  on,
  view,
  onDone,
}: {
  app: LifecycleApplication;
  on: string;
  /** The list being worked, carried to the order screen for the way back. */
  view: string;
  onDone: (message: string, moveOn?: boolean) => void;
}) {
  const router = useRouter();
  const seat = useCourtRole() as CourtSeat;
  const mayAct = canTakeSystemAction(seat);
  const mayDraft = canDraftOrder(seat);
  const suggestion = nextHearingOf(app, on);
  const hearing = { day: suggestion };
  const queue = queueOf(app, on);
  const record = caseOf(app);

  const [panel, setPanel] = React.useState<Panel>(() => ({
    choice: app.status === "pending-review" ? (mayAct ? "onboard" : "dismiss") : null,
    when: "date",
    date: dateOfDay(suggestion),
    invite: true,
    defer: dateOfDay(suggestion),
    relist: dateOfDay(suggestion),
    orders: {},
  }));
  const [quick, setQuick] = React.useState<ApplicationOrderDecision | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  /* The order already started on this application, in the editor's own list. */
  const orders = usePendingOrders();
  const signing = useOrderSigning();
  const orderKey = `application:${app.id}`;
  const started = orders[orderKey];
  const stage = started ? pendingOrderStage(started, signing) : null;
  const set = (patch: Partial<Panel>) => setPanel((current) => ({ ...current, ...patch }));

  function run(result: Result, message: string) {
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    onDone(message);
    return true;
  }

  function openOrder(decision?: ApplicationOrderDecision) {
    router.push(applicationOrderHref(app.id, decision, view));
  }

  /** An order on the decision: the quick order, or the order screen where there is no case to frame it. */
  function draft(decision: ApplicationOrderDecision) {
    if (record) setQuick(decision);
    else openOrder(decision);
  }

  /* `ALC-18`: the order screen, for something else entirely. The application stays as
     it is. Last in the footer, under the one primary. */
  const differentOrder = mayDraft ? (
    <Button type="button" variant="ghost" className="w-full" onClick={() => openOrder()}>
      Pass a different order instead
    </Button>
  ) : null;

  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (queue === "closed" || queue === "archive") {
    body = <ClosedRecord app={app} />;
  } else if (app.pendingOrder) {
    body = (
      <>
        <PanelHeading
          title={
            canSignOrder(seat)
              ? "Order awaiting your signature"
              : "Awaiting the Magistrate’s signature"
          }
          lead={`Drafted on ${formatCaseDate(app.pendingOrder.draftedOn)}.`}
        />
        <OrderCard text={app.pendingOrder.text} />
      </>
    );
    footer = (
      <>
        {canSignOrder(seat) ? (
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              const orderId = allotOrderId();
              const kind = app.pendingOrder?.kind;
              run(
                applyStep(app.id, (current) => signOrder(current, seat, orderId, on)),
                `Order ${orderId} signed. The application is ${
                  kind === "accept" ? "accepted" : kind === "reject" ? "rejected" : "dismissed"
                }.`,
              );
            }}
          >
            Sign order
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() =>
            run(applyStep(app.id, (current) => discardOrder(current, on)), "Draft discarded.")
          }
        >
          Discard draft
        </Button>
      </>
    );
  } else if (started && stage && stage !== "triggered") {
    /* An order is under way: coming back here shows it, rather than asking the question
       it already answers. The application moves once that order is signed and its order
       data complete (`application-order-outcome.ts`). */
    /* Nothing to fill in, so the act sits under its heading, not at the panel's foot. */
    body = (
      <div className="flex flex-col gap-4">
        <PanelHeading
          title="Order in progress"
          lead={`${pendingOrderStageLabel(stage)}. The application moves once the order is signed.`}
        />
        <Button
          type="button"
          className="w-full"
          onClick={() =>
            router.push(stage === "drafting" ? started.orderHref : pendingOrderHref(orderKey))
          }
        >
          Open the order
        </Button>
      </div>
    );
  } else if (app.status === "pending-review" && app.review) {
    const deferredBefore = setADateUsed(app);
    const later = app.review.dueOn > on;
    const choices: Choice[] = mayAct
      ? ["onboard", "defer", "dismiss"]
      : mayDraft
        ? ["dismiss"]
        : [];
    const choice = panel.choice && choices.includes(panel.choice) ? panel.choice : null;
    body = (
      <>
        <div className="flex flex-col gap-4">
          <PanelHeading
            title="Action on the application"
            lead={later ? `Review deferred to ${formatCaseDate(app.review.dueOn)}.` : undefined}
          />
          {/* A choice of one is no choice: a seat that can only dismiss is not shown a
              control with one segment, only the act. */}
          {choices.length > 1 ? (
            <Choices value={choice} choices={choices} onChange={(next) => set({ choice: next })} />
          ) : null}
        </div>

        {choice === "onboard" ? (
          <>
            <Field>
              <FieldLabel id={`${app.id}-when`}>When will it be decided?</FieldLabel>
              <SegmentedControl
                type="single"
                size="compact"
                value={panel.when}
                onValueChange={(value) => {
                  if (value) set({ when: value as Panel["when"] });
                }}
                aria-labelledby={`${app.id}-when`}
                className="w-full [&>*]:flex-1 [&>*>span]:w-full"
              >
                <SegmentedControlItem value="date" className="flex-1">
                  On a date
                </SegmentedControlItem>
                <SegmentedControlItem value="now" className="flex-1">
                  Today
                </SegmentedControlItem>
              </SegmentedControl>
              {panel.when === "now" ? (
                <FieldDescription>
                  It is numbered now, and you accept or reject it next.
                </FieldDescription>
              ) : null}
            </Field>
            {panel.when === "date" ? (
              <ListingFields
                idPrefix={`${app.id}-list`}
                date={panel.date}
                invite={panel.invite}
                hearing={hearing}
                on={on}
                onDate={(date) => set({ date })}
                onInvite={(invite) => set({ invite })}
              />
            ) : null}
          </>
        ) : null}

        {choice === "defer" ? (
          <>
            {deferredBefore ? (
              <Banner variant="warning">
                Review of this application has already been deferred once.
              </Banner>
            ) : null}
            <ListingDateField
              id={`${app.id}-defer`}
              label="Defer review to"
              value={panel.defer}
              on={on}
              hearing={hearing}
              onChange={(defer) => set({ defer })}
            />
          </>
        ) : null}
      </>
    );

    let primary: React.ReactNode = null;
    if (choice === "onboard") {
      const listedOn = dayOfDate(panel.date);
      const valid = panel.when === "now" || (listedOn && listedOn > on);
      primary = (
        <Button
          type="button"
          className="w-full"
          disabled={!valid}
          onClick={() => {
            const number = allotApplicationNumber(on);
            const result = applyStep(app.id, (current) =>
              onboard(
                current,
                seat,
                number,
                panel.when === "now"
                  ? { mode: "now" }
                  : { mode: "date", decideOn: listedOn, inviteObjections: panel.invite },
                on,
              ),
            );
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setError(null);
            if (panel.when === "now") {
              /* Stay on it: onboarding is done, and the decision is next, in this panel,
                 with nothing chosen for it. */
              set({ choice: null });
              return;
            }
            onDone(
              `Onboarded as ${number} and listed on ${formatCaseDate(listedOn)}.${
                panel.invite
                  ? ` Objections, if any, by ${formatCaseDate(objectionDeadline(listedOn))}.`
                  : ""
              }`,
            );
          }}
        >
          {panel.when === "now"
            ? "Onboard and decide now"
            : listedOn
              ? `Onboard and list on ${shortDate(listedOn)}`
              : "Onboard"}
        </Button>
      );
    } else if (choice === "defer") {
      const deferOn = dayOfDate(panel.defer);
      primary = (
        <Button
          type="button"
          className="w-full"
          disabled={!deferOn || deferOn <= on}
          onClick={() =>
            run(
              applyStep(app.id, (current) => setReviewDate(current, seat, deferOn, on)),
              `Review deferred to ${formatCaseDate(deferOn)}.`,
            )
          }
        >
          {deferOn ? `Defer review to ${shortDate(deferOn)}` : "Defer review"}
        </Button>
      );
    } else if (choice === "dismiss") {
      primary = (
        <Button type="button" className="w-full" onClick={() => draft("dismiss")}>
          Draft dismissal order
        </Button>
      );
    }
    footer = (
      <>
        {primary}
        {differentOrder}
      </>
    );
  } else if (app.status === "pending-decision" && app.decide) {
    const later = app.decide.dueOn > on;
    const takenNow = mayAct && app.decide.mode === "now" && app.onboardedOn === on;

    if (later) {
      const relistOn = dayOfDate(panel.relist);
      body = (
        <>
          <PanelHeading
            title={`Listed for ${formatCaseDate(app.decide.dueOn)}`}
            lead={`Orders may be passed on or after that date${
              app.objectionsInvited ? ", once the time for objections has expired" : ""
            }.`}
          />
          {mayAct ? (
            <ListingDateField
              id={`${app.id}-relist`}
              label="Relist on"
              value={panel.relist}
              on={on}
              hearing={hearing}
              hint={
                app.objectionsInvited
                  ? "The time for objections moves to the day before."
                  : undefined
              }
              onChange={(relist) => set({ relist })}
            />
          ) : null}
        </>
      );
      footer = mayAct ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!relistOn || relistOn <= on}
          onClick={() =>
            run(
              applyStep(app.id, (current) => moveDecisionDate(current, seat, relistOn, on)),
              `Relisted on ${formatCaseDate(relistOn)}.`,
            )
          }
        >
          {relistOn ? `Relist on ${shortDate(relistOn)}` : "Relist"}
        </Button>
      ) : null;
    } else {
      /* A judgment, so nothing is chosen in advance, and there is no primary until it is
         (owner, 2026-10-14). */
      const choices: Choice[] = [
        ...(mayDraft ? (["accept", "reject"] as const) : []),
        ...(mayAct ? [takenNow ? ("list" as const) : ("move" as const)] : []),
      ];
      const choice = panel.choice && choices.includes(panel.choice) ? panel.choice : null;
      body = (
        <>
          <div className="flex flex-col gap-4">
            <PanelHeading
              title="Action on the application"
              lead={
                takenNow ? (
                  <>
                    Onboarded today as{" "}
                    {app.applicationNumber ? (
                      <Identifier value={app.applicationNumber} label="application number" />
                    ) : null}
                  </>
                ) : undefined
              }
            />
            {choices.length > 0 ? (
              <Choices value={choice} choices={choices} onChange={(next) => set({ choice: next })} />
            ) : null}
          </div>

          {choice === "move" ? (
            <ListingDateField
              id={`${app.id}-move`}
              label="Decide it on"
              value={panel.relist}
              on={on}
              hearing={hearing}
              hint={
                app.objectionsInvited
                  ? "The time for objections moves to the day before."
                  : undefined
              }
              onChange={(relist) => set({ relist })}
            />
          ) : null}

          {choice === "list" ? (
            <ListingFields
              idPrefix={`${app.id}-later`}
              date={panel.date}
              invite={panel.invite}
              hearing={hearing}
              on={on}
              onDate={(date) => set({ date })}
              onInvite={(invite) => set({ invite })}
            />
          ) : null}
        </>
      );

      let primary: React.ReactNode = null;
      if (choice === "accept" || choice === "reject") {
        primary = (
          <Button type="button" className="w-full" onClick={() => draft(choice)}>
            {choice === "accept" ? "Draft acceptance order" : "Draft rejection order"}
          </Button>
        );
      } else if (choice === "move") {
        const moveOn = dayOfDate(panel.relist);
        primary = (
          <Button
            type="button"
            className="w-full"
            disabled={!moveOn || moveOn <= on}
            onClick={() =>
              run(
                applyStep(app.id, (current) => moveDecisionDate(current, seat, moveOn, on)),
                `It comes back to be decided on ${formatCaseDate(moveOn)}.`,
              )
            }
          >
            {moveOn ? `Move to ${shortDate(moveOn)}` : "Move the date"}
          </Button>
        );
      } else if (choice === "list") {
        const listedOn = dayOfDate(panel.date);
        primary = (
          <Button
            type="button"
            className="w-full"
            disabled={!listedOn || listedOn <= on}
            onClick={() =>
              run(
                applyStep(app.id, (current) =>
                  listForLater(current, seat, listedOn, panel.invite, on),
                ),
                `Listed on ${formatCaseDate(listedOn)}.${
                  panel.invite
                    ? ` Objections, if any, by ${formatCaseDate(objectionDeadline(listedOn))}.`
                    : ""
                }`,
              )
            }
          >
            {listedOn ? `List on ${shortDate(listedOn)}` : "List for a date"}
          </Button>
        );
      }
      footer = (
        <>
          {primary}
          {differentOrder}
        </>
      );
    }
  }

  return (
    <aside
      aria-label="Deal with the application"
      className="flex min-h-0 flex-col border-t border-hairline bg-card lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:border-t-0 lg:border-l"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        {body}
        {error ? <Banner variant="error">{error}</Banner> : null}
      </div>
      {footer ? (
        <div className="flex shrink-0 flex-col gap-2 border-t border-hairline px-6 py-4">
          {footer}
        </div>
      ) : null}
      {record ? (
        <ApplicationQuickOrder
          application={app}
          record={record}
          decision={quick}
          entry={quick ? panel.orders[quick] : undefined}
          onEntry={(decision, entry) =>
            setPanel((current) => ({
              ...current,
              orders: { ...current.orders, [decision]: entry },
            }))
          }
          canSign={canSignOrder(seat)}
          on={on}
          hearing={hearing}
          view={view}
          onOpenChange={(open) => {
            if (!open) setQuick(null);
          }}
          onDone={(message) => {
            setQuick(null);
            onDone(message, true);
          }}
        />
      ) : null}
    </aside>
  );
}

/** The panel's one choice, as the DS segmented control, the full width of the panel. */
function Choices({
  value,
  choices,
  onChange,
}: {
  value: Choice | null;
  choices: Choice[];
  onChange: (choice: Choice) => void;
}) {
  return (
    <SegmentedControl
      type="single"
      size="compact"
      value={value ?? ""}
      onValueChange={(next) => {
        if (next) onChange(next as Choice);
      }}
      aria-label="Action on the application"
      className="w-full [&>*]:flex-1 [&>*>span]:w-full"
    >
      {choices.map((choice) => (
        <SegmentedControlItem key={choice} value={choice} className="flex-1">
          {CHOICE_LABEL[choice]}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

function PanelHeading({ title, lead }: { title: string; lead?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      {/* A 40px band, so the panel's first line sits level with the title and the back
          link in the columns beside it. */}
      <h2 className="flex min-h-10 items-center text-body font-semibold">{title}</h2>
      {lead ? <p className="text-body-compact text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

/** A date for the listing, and whether the other party is asked to object. */
function ListingFields({
  idPrefix,
  date,
  invite,
  hearing,
  on,
  onDate,
  onInvite,
}: {
  idPrefix: string;
  date: Date | undefined;
  invite: boolean;
  hearing: { day: string | undefined };
  on: string;
  onDate: (date: Date | undefined) => void;
  onInvite: (invite: boolean) => void;
}) {
  const day = dayOfDate(date);
  return (
    <>
      <ListingDateField
        id={`${idPrefix}-date`}
        label="Listing date"
        value={date}
        on={on}
        hearing={hearing}
        onChange={onDate}
      />
      {/* The objection is a question of its own, not a tick-box under the date (owner,
          2026-10-08): a well, with the question, its answer and what follows from it. */}
      <div className="rounded-lg border border-hairline bg-surface-sunken p-4">
        <Field>
          <FieldLabel id={`${idPrefix}-objection`}>
            Call for objections?
          </FieldLabel>
          <SegmentedControl
            type="single"
            size="compact"
            value={invite ? "yes" : "no"}
            onValueChange={(value) => {
              if (value) onInvite(value === "yes");
            }}
            aria-labelledby={`${idPrefix}-objection`}
            aria-describedby={`${idPrefix}-objection-note`}
            className="w-full [&>*]:flex-1 [&>*>span]:w-full"
          >
            <SegmentedControlItem value="yes" className="flex-1">
              Yes
            </SegmentedControlItem>
            <SegmentedControlItem value="no" className="flex-1">
              No
            </SegmentedControlItem>
          </SegmentedControl>
          <FieldDescription id={`${idPrefix}-objection-note`}>
            {invite
              ? day
                ? `The opposite party may file objections by ${formatCaseDate(objectionDeadline(day))}.`
                : "Objections, if any, to be filed by the day before the listing."
              : "Objections are not called for. The opposite party may still view the application once onboarded."}
          </FieldDescription>
        </Field>
      </div>
    </>
  );
}

/** An order's opening words: the one awaiting signature, or the one that closed it. */
function OrderCard({ text }: { text: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-sunken p-4">
      <h3 className="text-body-compact font-medium">Order</h3>
      <p className="line-clamp-4 text-body-compact">{text}</p>
    </section>
  );
}

function ClosedRecord({ app }: { app: LifecycleApplication }) {
  return (
    <>
      <PanelHeading
        title={
          app.linkedOrder
            ? `${app.status === "accepted" ? "Accepted" : app.status === "rejected" ? "Rejected" : "Dismissed"} on ${formatCaseDate(app.linkedOrder.signedOn)}`
            : "Closed"
        }
        lead={
          app.linkedOrder
            ? `Order ${app.linkedOrder.id}${app.workflowResult ? ` · ${app.workflowResult}` : ""}`
            : undefined
        }
      />
      {app.linkedOrder ? <OrderCard text={app.linkedOrder.text} /> : null}
      <section className="flex flex-col gap-4">
        <h3 className="text-body font-semibold">History</h3>
        <ol className="flex flex-col gap-2">
          {app.history.map((event, index) => (
            <li key={index} className="grid grid-cols-[6rem_1fr] gap-3 text-body-compact">
              <span className="tabular-nums text-muted-foreground">
                {shortDate(event.on)}
              </span>
              <span>{event.text}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
