"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, InboxIcon } from "lucide-react";
import { toast } from "sonner";

import { DocumentPreview } from "@/components/cases/document-preview";
import { useCourtText } from "@/components/court/court-provider";
import { Identifier } from "@/components/chrome/identifier";
import { ApplicationFacsimile } from "@/components/employee/application-review-dialog";
import {
  ApplicationOrderDialog,
  type OrderKind,
} from "@/components/employee/application-order-dialog";
import { ListingDateField } from "@/components/employee/listing-date-field";
import { useCourtRole } from "@/components/employee/use-court-role";
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
  acceptanceNeedsHearingDate,
  canDraftOrder,
  canSignOrder,
  canTakeSystemAction,
  decisionText,
  discardOrder,
  dismissalText,
  draftOrder,
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

/* ───────────────────────────── the order being edited ───────────────────────────── */

type OrderDraft = { kind: OrderKind; text: string };

const DRAFT_KEY = "dristi.application-order-drafts";
let drafts: Map<string, OrderDraft> | null = null;

/**
 * Edited order text, kept per application outside the panel, so "Saved as draft" is
 * true: the panel is keyed by application and unmounts on J/K or any navigation, and the
 * words come back when the application is opened again. Mirrored to session storage so a
 * reload keeps them too. Cleared once the order is saved or signed, or when the choice
 * the words were written for changes.
 */
function draftStore(): Map<string, OrderDraft> {
  if (drafts) return drafts;
  drafts = new Map();
  if (typeof window !== "undefined") {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        for (const [id, draft] of Object.entries(JSON.parse(raw) as Record<string, OrderDraft>)) {
          drafts.set(id, draft);
        }
      }
    } catch {
      /* Storage unavailable or unreadable: the drafts live for this page only. */
    }
  }
  return drafts;
}

function readOrderDraft(id: string): OrderDraft | undefined {
  return draftStore().get(id);
}

function writeOrderDraft(id: string, draft: OrderDraft | null) {
  const store = draftStore();
  if (draft) store.set(id, draft);
  else if (!store.delete(id)) return;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(Object.fromEntries(store)));
  } catch {
    /* Kept in memory; nothing more to do. */
  }
}

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

  function go(id: string | null, key: QueueKey = activeKey) {
    if (!id) {
      router.push(`/employee/applications?view=${key}`);
      return;
    }
    router.replace(`/employee/applications/${id}?view=${key}`);
  }

  /** After an act: stay if it is still in this list, otherwise take the next one. */
  function next(after: LifecycleApplication) {
    const index = queue.findIndex((item) => item.id === after.id);
    const fresh = getApplication(after.id);
    /* Under All an act moves it to another band — that is moving on too. */
    const stays =
      fresh &&
      applicationsIn([fresh], activeKey, on).length > 0 &&
      queueOf(fresh, on) === queueOf(after, on);
    if (stays) return;
    const rest = queue.filter((item) => item.id !== after.id);
    const target = rest[Math.max(0, Math.min(index, rest.length - 1))];
    go(target?.id ?? null);
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
        onDone={(message) => {
          toast.success(message);
          next(app);
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
          {note ?? (line.due === "overdue" ? `Overdue · ${line.detail ?? line.word}` : line.word)}
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
          <p className="text-body">{causeTitleOf(app)}</p>
          {/* Each dot rides with the item after it, so a wrap never strands one at a line
              end and no record means no leading dot. */}
          <p className="flex flex-wrap gap-x-2 text-body-compact text-muted-foreground">
            {[
              record ? (
                <Identifier key="case" value={record.caseNumber} label="case number" />
              ) : null,
              <span key="filed" className="whitespace-nowrap">
                Filed {formatCaseDate(app.submittedOn ?? app.createdOn)}
              </span>,
              <span key="by">
                {app.raisedBy ?? app.createdByName}, for the {app.side}
              </span>,
            ]
              .filter(Boolean)
              .map((item, index) =>
                index === 0 ? (
                  item
                ) : (
                  <span key={index}>
                    <span aria-hidden>·&nbsp;</span>
                    {item}
                  </span>
                ),
              )}
          </p>
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
        <DocumentPreview
          variant="quiet"
          surface="card"
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
  return (
    <Badge variant="info">
      {app.status === "pending-review" ? "Pending review" : "Pending decision"}
    </Badge>
  );
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

type Panel = {
  /** Onboarding: which of the three. */
  action: "onboard" | "defer" | "dismiss";
  /** Onboarding: list it for a date, or take it up now. */
  when: "date" | "now";
  date: Date | undefined;
  invite: boolean;
  defer: Date | undefined;
  /** Deciding: accept or reject. */
  order: "accept" | "reject";
  newHearing: Date | undefined;
  /** Taken up now, but listing it after all. */
  relisting: boolean;
  relist: Date | undefined;
  text: string;
  edited: boolean;
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
 * The right-hand panel: one question at a time for this application, answered here.
 *
 * - **Pending review** — Onboard · Review later · Dismiss, all three up front (owner,
 *   2026-10-07). Onboarding asks when the court will take it up: listed for a later date
 *   (pre-filled with the next hearing, `ALC-10`; the other party asked to object by
 *   default, `ALC-11`, `ALC-25`) or taken up now (`ALC-08`).
 * - **Pending decision, due** — the order on it: Accept or Reject, the standard text
 *   ready, previewed and signed in a window. Taken up now today, it can still be listed
 *   for a later date instead — onboarding stays done (product, 2026-10-08).
 * - **Listed ahead** — it waits for its date; only the date can change (`ALC-15`).
 * - **Order awaiting signature** — the drafted order, to sign or discard.
 * - **Closed** — the order that closed it, and what happened when.
 *
 * Who may do what follows `ALC-22`: onboarding and every date are the magistrate's; any
 * court seat drafts an order; only the magistrate signs it.
 */
function DecisionPanel({
  app,
  on,
  onDone,
}: {
  app: LifecycleApplication;
  on: string;
  onDone: (message: string) => void;
}) {
  const seat = useCourtRole() as CourtSeat;
  const magistrate = canTakeSystemAction(seat);
  const suggestion = nextHearingOf(app, on);
  const hearing = { day: suggestion };
  const queue = queueOf(app, on);
  const filedOn = formatCaseDate(app.submittedOn ?? app.createdOn);
  const courtText = useCourtText();

  const [panel, setPanel] = React.useState<Panel>(() => {
    /* Words edited earlier and not yet saved come back with the choice they were for. */
    const draft = readOrderDraft(app.id);
    const ownKind = app.pendingOrder?.kind;
    const usable =
      draft &&
      (ownKind
        ? draft.kind === ownKind
        : app.status === "pending-review"
          ? draft.kind === "dismiss"
          : draft.kind !== "dismiss");
    return {
      action:
        !magistrate || (usable && draft.kind === "dismiss") ? "dismiss" : "onboard",
      when: "date",
      date: dateOfDay(suggestion),
      invite: true,
      defer: dateOfDay(suggestion),
      order: usable && draft.kind === "reject" ? "reject" : "accept",
      newHearing: dateOfDay(app.pendingOrder?.newHearingOn),
      relisting: false,
      relist: dateOfDay(suggestion),
      text: usable ? draft.text : (app.pendingOrder?.text ?? ""),
      edited: Boolean(app.pendingOrder) || Boolean(usable),
    };
  });
  const [error, setError] = React.useState<string | null>(null);
  const [orderOpen, setOrderOpen] = React.useState(false);
  const set = (patch: Partial<Panel>) => setPanel((current) => ({ ...current, ...patch }));

  function run(result: Result, message: string) {
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    writeOrderDraft(app.id, null);
    onDone(message);
    return true;
  }

  /** The order this panel would draw up, in the configured standard words — written in
      the selected court's numbers (`CourtSwitch`), since the order is drafted from it as
      it reads here. */
  const kind: OrderKind =
    app.pendingOrder?.kind ??
    (app.status === "pending-review" ? "dismiss" : panel.order);
  const standardText = courtText(
    kind === "dismiss"
      ? dismissalText(app, filedOn)
      : decisionText(
          app,
          kind,
          panel.newHearing ? formatCaseDate(dayOfDate(panel.newHearing)) : undefined,
        ),
  );
  const orderText = panel.edited ? panel.text : standardText;
  const needsHearing = kind === "accept" && acceptanceNeedsHearingDate(app.type);

  function saveOrder(sign: boolean) {
    const newHearingOn = needsHearing ? dayOfDate(panel.newHearing) : undefined;
    const drafted = app.pendingOrder
      ? applyStep(app.id, (current) => ({
          ...current,
          pendingOrder: current.pendingOrder && {
            ...current.pendingOrder,
            text: orderText,
            newHearingOn: newHearingOn ?? current.pendingOrder.newHearingOn,
          },
        }))
      : applyStep(app.id, (current) =>
          draftOrder(current, seat, { kind, text: orderText, newHearingOn }, on),
        );
    if (!drafted.ok) {
      setError(drafted.error);
      return;
    }
    /* The words are on the record now; the session copy has done its job. */
    writeOrderDraft(app.id, null);
    setOrderOpen(false);
    if (!sign) {
      run(
        drafted,
        canSignOrder(seat)
          ? "Order saved for signing in Sign orders."
          : "Order sent to the Magistrate for signing.",
      );
      return;
    }
    const orderId = allotOrderId();
    run(
      applyStep(app.id, (current) => signOrder(current, seat, orderId, on)),
      `Order ${orderId} signed. The application is ${
        kind === "accept" ? "accepted" : kind === "reject" ? "rejected" : "dismissed"
      }.`,
    );
  }

  const orderControls = (
    <ApplicationOrderDialog
      application={app}
      kind={kind}
      text={orderText}
      onTextChange={(text) => {
        set({ text, edited: true });
        writeOrderDraft(app.id, { kind, text });
      }}
      canSign={canSignOrder(seat)}
      open={orderOpen}
      onOpenChange={setOrderOpen}
      onSave={() => saveOrder(false)}
      onSign={() => saveOrder(true)}
    />
  );

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
        <OrderCard text={orderText} edited />
      </>
    );
    footer = (
      <>
        <Button type="button" className="w-full" onClick={() => setOrderOpen(true)}>
          {canSignOrder(seat) ? "Preview and sign" : "Preview order"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() =>
            run(
              applyStep(app.id, (current) => discardOrder(current, on)),
              app.status === "pending-review"
                ? "Draft order discarded."
                : "Draft discarded.",
            )
          }
        >
          Discard draft
        </Button>
      </>
    );
  } else if (app.status === "pending-review" && app.review) {
    const deferredBefore = setADateUsed(app);
    const later = app.review.dueOn > on;
    body = (
      <>
        <div className="flex flex-col gap-4">
          <PanelHeading
            title="Action on the application"
            lead={
              later
                ? `Review deferred to ${formatCaseDate(app.review.dueOn)}. It may be taken up earlier.`
                : undefined
            }
          />
          {magistrate ? (
            <SegmentedControl
              type="single"
              size="compact"
              value={panel.action}
              onValueChange={(value) => {
                if (value) set({ action: value as Panel["action"] });
              }}
              aria-label="What to do with the application"
              className="w-full [&>*]:flex-1 [&>*>span]:w-full"
            >
              <SegmentedControlItem value="onboard" className="flex-1">
                Onboard
              </SegmentedControlItem>
              <SegmentedControlItem value="defer" className="flex-1">
                Defer review
              </SegmentedControlItem>
              <SegmentedControlItem value="dismiss" className="flex-1">
                Dismiss
              </SegmentedControlItem>
            </SegmentedControl>
          ) : (
            <p className="text-body-compact text-muted-foreground">
              Onboarding and deferral are reserved for the Magistrate. A dismissal order
              may be drafted for signature.
            </p>
          )}
        </div>

        {magistrate && panel.action === "onboard" ? (
          <>
            <Field>
              <FieldLabel id={`${app.id}-when`}>Hearing of the application</FieldLabel>
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
                  List for a date
                </SegmentedControlItem>
                <SegmentedControlItem value="now" className="flex-1">
                  Take up today
                </SegmentedControlItem>
              </SegmentedControl>
              {panel.when === "now" ? (
                <FieldDescription>
                  The application is numbered and taken up immediately for orders.
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

        {magistrate && panel.action === "defer" ? (
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

        {panel.action === "dismiss" ? <OrderCard text={orderText} edited={panel.edited} /> : null}
      </>
    );

    if (magistrate && panel.action === "onboard") {
      const listedOn = dayOfDate(panel.date);
      const valid = panel.when === "now" || (listedOn && listedOn > on);
      footer = (
        <>
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
              writeOrderDraft(app.id, null);
              if (panel.when === "now") {
                /* Stay on it: onboarding is done, the order is next, in this panel. */
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
              ? "Onboard and take up"
              : listedOn
                ? `Onboard and list on ${shortDate(listedOn)}`
                : "Onboard"}
          </Button>
          {/* `ALC-18`: the order screen, for something else entirely. The application
              stays as it is. */}
          <Button asChild variant="ghost" className="w-full">
            <Link href="/employee/hearings">Pass a different order</Link>
          </Button>
        </>
      );
    } else if (magistrate && panel.action === "defer") {
      const deferOn = dayOfDate(panel.defer);
      footer = (
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
    } else if (panel.action === "dismiss" && canDraftOrder(seat)) {
      footer = (
        <Button type="button" className="w-full" onClick={() => setOrderOpen(true)}>
          Preview order
        </Button>
      );
    }
  } else if (app.status === "pending-decision" && app.decide) {
    const later = app.decide.dueOn > on;
    const takenNow =
      magistrate && app.decide.mode === "now" && app.onboardedOn === on;

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
          {magistrate ? (
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
      footer = magistrate ? (
        <Button
          type="button"
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
    } else if (takenNow && panel.relisting) {
      const listedOn = dayOfDate(panel.date);
      body = (
        <>
          <TakenUpLine app={app} relisting onToggle={() => set({ relisting: false })} />
          <ListingFields
            idPrefix={`${app.id}-later`}
            date={panel.date}
            invite={panel.invite}
            hearing={hearing}
            on={on}
            onDate={(date) => set({ date })}
            onInvite={(invite) => set({ invite })}
          />
        </>
      );
      footer = (
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
    } else {
      body = (
        <>
          {takenNow ? (
            <TakenUpLine app={app} relisting={false} onToggle={() => set({ relisting: true })} />
          ) : null}
          <div className="flex flex-col gap-4">
            <PanelHeading title="Order on the application" />
            <SegmentedControl
              type="single"
              size="compact"
              value={panel.order}
              onValueChange={(value) => {
                if (!value) return;
                set({ order: value as Panel["order"], edited: false });
                writeOrderDraft(app.id, null);
              }}
              aria-label="Accept or reject"
              className="w-full [&>*]:flex-1 [&>*>span]:w-full"
            >
              <SegmentedControlItem value="accept" className="flex-1">
                Accept
              </SegmentedControlItem>
              <SegmentedControlItem value="reject" className="flex-1">
                Reject
              </SegmentedControlItem>
            </SegmentedControl>
          </div>
          {needsHearing ? (
            <ListingDateField
              id={`${app.id}-hearing`}
              label="New hearing date"
              value={panel.newHearing}
              on={on}
              hearing={hearing}
              onChange={(newHearing) => set({ newHearing })}
            />
          ) : null}
          <OrderCard text={orderText} edited={panel.edited} />
        </>
      );
      footer = (
        <Button
          type="button"
          className="w-full"
          disabled={needsHearing && !panel.newHearing}
          onClick={() => setOrderOpen(true)}
        >
          Preview order
        </Button>
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
      {orderControls}
    </aside>
  );
}

function PanelHeading({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {/* A 40px band, so the panel's first line sits level with the title and the back
          link in the columns beside it. */}
      <h2 className="flex min-h-10 items-center text-body font-semibold">{title}</h2>
      {lead ? <p className="text-body-compact text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

/** Onboarding is done and stays done; this line says so, and offers the way back. */
function TakenUpLine({
  app,
  relisting,
  onToggle,
}: {
  app: LifecycleApplication;
  relisting: boolean;
  onToggle: () => void;
}) {
  return (
    <Banner variant="success" className="items-start">
      <div className="flex flex-col items-start">
        <p>
          Onboarded as{" "}
          {app.applicationNumber ? (
            <Identifier value={app.applicationNumber} label="application number" />
          ) : null}{" "}
          {relisting ? "· to be listed for a date" : "and taken up today"}
        </p>
        <Button
          type="button"
          variant="link"
          className="h-auto min-h-10 p-0 text-body-compact text-success-muted-foreground"
          onClick={onToggle}
        >
          {relisting ? "Take up today instead" : "List for a date instead"}
        </Button>
      </div>
    </Banner>
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

/** Which order will go out — its opening words, so the bench sees the order it will sign. */
function OrderCard({ text, edited }: { text: string; edited: boolean }) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-sunken p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-body-compact font-medium">Order</h3>
        <span className="text-body-compact text-muted-foreground">
          {edited ? "Edited" : "Standard text"}
        </span>
      </div>
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
      {app.linkedOrder ? <OrderCard text={app.linkedOrder.text} edited /> : null}
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
