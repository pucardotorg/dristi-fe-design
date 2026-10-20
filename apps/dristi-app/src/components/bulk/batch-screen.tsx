"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import { useCourt } from "@/components/court/court-provider";
import { Banner } from "@/components/ui/banner";

import { toLongDate } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { PANEL_CLASS } from "@/components/filing/form-card";
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_SUBTITLE,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { bulkApi, setBulkAiMode, type BatchView, type CaseView } from "./api";
import { SourceLabel } from "./batches-screen";
import { CasesTab } from "./cases-tab";
import { useGujarat } from "./court-guard";
import { DocumentsTab } from "./documents-tab";
import { FiledTab, ist } from "./filed-tab";
import { PayTab } from "./pay-tab";
import { ReviewTab } from "./review-tab";
import { ScrutinyTab } from "./scrutiny-tab";
import { SignTab } from "./sign-tab";
import { STAGE, STAGE_ORDER, StageBar, StageTip } from "./stage";

/**
 * A step's tab. A coloured count is work waiting on this step now. When there is none, the
 * tab is greyed: a grey count is cases still coming to this step once an earlier one is
 * done, and a tick means the step is complete. Counts are in words for screen readers.
 */
function StepTab({
  value,
  label,
  pending,
  upcoming = 0,
  tone,
  what,
  done,
}: {
  value: TabId;
  label: string;
  pending: number;
  upcoming?: number;
  tone: "warning" | "info" | "secondary";
  what: string;
  done: boolean;
}) {
  const idle = pending === 0;
  const spoken = pending
    ? `${label}, ${pending} ${what}`
    : upcoming
      ? `${label}, finish the earlier steps first`
      : done
        ? `${label}, completed`
        : `${label}, nothing here`;
  return (
    <TabsTrigger value={value} aria-label={spoken} disabled={idle && !done}>
      {label}
      {pending ? (
        // A count sized for the tab: the DS badge (24px) fills a 32px tab edge to edge.
        <span className={cn(COUNT, COUNT_FILL[tone])}>{pending}</span>
      ) : upcoming ? null : done ? (
        <CircleCheckIcon className="text-success-ink" aria-hidden />
      ) : null}
    </TabsTrigger>
  );
}

const COUNT_FILL = {
  warning: "bg-warning-muted text-warning-muted-foreground",
  info: "bg-info-muted text-info-muted-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-success-muted text-success-muted-foreground",
} as const;

const COUNT =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption leading-none font-medium tabular-nums";

export type BatchCtx = {
  batch: BatchView;
  /** Replace the batch with what an action returned. */
  setBatch: (b: BatchView) => void;
  /** Open a tab; for Case details, optionally with one case selected. */
  go: (tab: TabId, caseId?: string) => void;
};

const TABS = [
  "cases",
  "documents",
  "scrutiny",
  "review",
  "sign",
  "pay",
  "filed",
] as const;
export type TabId = (typeof TABS)[number];

/** One batch: its cases, their documents, the checks, then signing and payment in bulk. */
export function BatchScreen({ batchId }: { batchId: string }) {
  const ready = useGujarat();
  // The batch summary starts folded to one line.
  const [showInfo, setShowInfo] = React.useState(false);
  const { profile } = useCourt();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TabId = (TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as TabId)
    : "cases";
  const [batch, setBatch] = React.useState<BatchView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // AI review follows `?ai=on|off|unavailable`, else the court's setting (on for Gujarat),
  // the same switch as the scrutiny workbench.
  const aiParam = params.get("ai");
  const ai = aiModeFrom(aiParam, profile.aiMode);
  setBulkAiMode(ai);

  React.useEffect(() => {
    if (!ready) return;
    bulkApi.get(batchId).then(setBatch, (e: Error) => setError(e.message));
  }, [ready, batchId, ai]);

  // Slide the highlight to the active tab rather than switching it in one frame. Written
  // to the element directly, so moving it never re-renders the screen.
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const highlightRef = React.useRef<HTMLSpanElement>(null);
  React.useLayoutEffect(() => {
    const list = tabsRef.current;
    const mark = highlightRef.current;
    if (!list || !mark) return;
    const place = () => {
      const active = list.querySelector<HTMLElement>(
        '[role="tab"][data-state="active"]',
      );
      if (!active) return;
      mark.style.transform = `translateX(${active.offsetLeft}px)`;
      mark.style.width = `${active.offsetWidth}px`;
    };
    place();
    const watch = new ResizeObserver(place);
    watch.observe(list);
    return () => watch.disconnect();
  }, [tab, batch]);

  const go = React.useCallback(
    (next: TabId, caseId?: string) => {
      const q = new URLSearchParams();
      if (next !== "cases") q.set("tab", next);
      if (caseId) q.set("case", caseId);
      if (aiParam) q.set("ai", aiParam);
      const qs = q.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, aiParam],
  );

  if (error) {
    return (
      <div
        className={cn(
          "flex w-full flex-1 flex-col gap-6",
          PAGE_GROUND,
          PAGE_GUTTER,
        )}
      >
        <Alert variant="destructive">
          <AlertTitle>This batch could not be opened</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/filings/bulk">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden />
            Bulk filing
          </Link>
        </Button>
      </div>
    );
  }

  if (!batch) {
    return (
      <div
        className={cn(
          "flex w-full flex-1 flex-col gap-6",
          PAGE_GROUND,
          PAGE_GUTTER,
        )}
      >
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const ctx: BatchCtx = { batch, setBatch, go };
  // What is still to do, step by step; each tab carries its own count.
  const open = batch.cases.filter(
    (c) => c.stage === "held" || c.stage === "ready",
  );
  const workable = open.length;
  const allFiled = batch.total > 0 && batch.counts.filed === batch.total;
  const docsMissing = open.filter((c) => c.docs.have < c.docs.need).length;
  // Case details counts what it shows: flags about the details, not missing documents.
  const detail = (c: CaseView) =>
    c.flags.some(
      (f) =>
        f.section !== "documents" &&
        f.fix?.kind !== "upload" &&
        f.fix?.kind !== "documents",
    );
  const attention = open.filter(
    (c) => (c.stage === "held" || c.stage === "ready") && detail(c),
  ).length;
  const clear =
    batch.counts.ready -
    batch.cases.filter((c) => c.stage === "ready" && c.flags.length > 0).length;

  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col gap-6",
        PAGE_GROUND,
        PAGE_GUTTER,
      )}
    >
      <header className="flex flex-col gap-3">
        <Link
          href="/filings/bulk"
          className="flex w-fit items-center gap-1 text-body-compact text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          Bulk filing
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className={cn(PAGE_TITLE, "text-foreground tabular-nums")}>
            Batch {batch.number}
          </h1>
          <p className={PAGE_SUBTITLE}>
            {batch.client} · <span className="tabular-nums">{batch.total}</span>{" "}
            cases · received {toLongDate(batch.createdAt.slice(0, 10))}
          </p>
        </div>
      </header>

      {/* A standing condition, as on the scrutiny workbench → Banner. */}
      {ai === "unavailable" ? (
        <Banner variant="warning">
          <TriangleAlertIcon />
          <div className="min-w-0 flex-1 leading-snug">
            AI review unavailable. Documents are not compared with the cases;
            check them manually.
          </div>
        </Banner>
      ) : null}

      {batch.total > 0 && batch.counts.filed === batch.total ? (
        <Alert variant="success">
          <CircleCheckIcon aria-hidden />
          <AlertTitle className="tabular-nums">
            Done: all {batch.total} cases filed
          </AlertTitle>
          <AlertDescription>
            Last payment{" "}
            {batch.payments.at(-1) ? ist(batch.payments.at(-1)!.at) : ""}.
          </AlertDescription>
        </Alert>
      ) : null}

      {batch.clubbedInto ? (
        <Alert variant="info">
          <AlertTitle>Clubbed into {batch.clubbedIntoNumber}</AlertTitle>
          <AlertDescription>
            The open cases moved there. This batch is closed.{" "}
            <Link
              className="underline"
              href={`/filings/bulk/${batch.clubbedInto}`}
            >
              Open {batch.clubbedIntoNumber}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Folded to one line by default: what the batch is, at a glance; Details opens it. */}
      <Card className={cn(PANEL_CLASS, "gap-0 overflow-hidden py-0")}>
        {/* The whole line opens and closes the details, not only its Details label. */}
        <button
          type="button"
          aria-expanded={showInfo}
          onClick={() => setShowInfo((v) => !v)}
          className="flex min-h-12 w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none focus-visible:ring-inset sm:px-6"
        >
          <span className="min-w-0 truncate text-body-compact">
            <span className="text-muted-foreground">
              {batch.source.kind === "api"
                ? `${batch.source.system} API`
                : batch.source.kind === "excel"
                  ? "Excel upload"
                  : batch.source.kind === "documents"
                    ? "Case documents"
                    : "Clubbed"}
            </span>
            {" · "}
            {batch.client}
            {batch.advocates[0] ? (
              <span className="text-muted-foreground">
                {" "}
                · {batch.advocates[0].name}
              </span>
            ) : null}
          </span>
          <span className="ml-auto flex items-center gap-3">
            {/* The stage bar in brief: its colours, and how many are filed. */}
            <span className="hidden items-center gap-2 sm:flex">
              <StageTip counts={batch.counts}>
                {" "}
                <span
                  aria-hidden
                  className="flex h-1.5 w-32 divide-x-2 divide-card overflow-hidden rounded-full bg-track"
                >
                  {STAGE_ORDER.map((k) =>
                    batch.counts[k] ? (
                      <span
                        key={k}
                        className={STAGE[k].fill}
                        style={{
                          width: `${(batch.counts[k] / Math.max(1, batch.total)) * 100}%`,
                        }}
                      />
                    ) : null,
                  )}
                </span>{" "}
              </StageTip>
              <span className="text-caption text-muted-foreground tabular-nums">
                {batch.counts.filed} of {batch.total} filed
              </span>
            </span>
            <span className="flex items-center gap-1 text-body-compact font-medium">
              Details{" "}
              <ChevronDownIcon
                className={cn("transition-transform", showInfo && "rotate-180")}
                aria-hidden
              />
            </span>
          </span>
        </button>
        {showInfo ? (
          <CardContent className="grid grid-cols-1 gap-6 border-t border-hairline p-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="text-caption text-muted-foreground">
                Came in by
              </span>
              <SourceLabel source={batch.source} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-caption text-muted-foreground">
                Complainant
              </span>
              <span className="text-body-compact">{batch.client}</span>
              {batch.representative ? (
                <span className="text-caption text-muted-foreground">
                  Through {batch.representative.name},{" "}
                  {batch.representative.designation}
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-caption text-muted-foreground">
                Advocate{batch.advocates.length === 1 ? "" : "s"}
              </span>
              {batch.advocates.map((a) => (
                <span key={a.barNumber} className="text-body-compact">
                  {a.name || "Not found with the Bar Council"}{" "}
                  <span className="text-caption text-muted-foreground tabular-nums">
                    {a.barNumber}
                  </span>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-caption text-muted-foreground">
                Where the cases stand
              </span>
              <StageBar counts={batch.counts} />
            </div>
          </CardContent>
        ) : null}
      </Card>

      {/* Once every case is filed there are no steps left: only the filed cases. */}
      {allFiled ? (
        <FiledTab {...ctx} />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(v) => go(v as TabId)}
          className="gap-4"
        >
          <div className="overflow-x-auto">
            <TabsList
              ref={tabsRef}
              aria-label="Batch steps"
              className={cn(
                "relative w-max",
                // The sliding highlight below draws the active tab; the tab itself stays clear.
                "[&>[role=tab]]:z-10 [&>[role=tab][data-state=active]]:bg-transparent [&>[role=tab][data-state=active]]:text-foreground [&>[role=tab][data-state=active]]:shadow-none",
              )}
            >
              <span
                ref={highlightRef}
                aria-hidden
                className="pointer-events-none absolute top-0.5 bottom-0.5 left-0 rounded-md bg-card shadow-sm transition-[transform,width] duration-200 ease-out motion-reduce:transition-none"
              />
              <StepTab
                value="cases"
                label="Cases"
                pending={batch.total - batch.counts.filed}
                tone="secondary"
                what="not filed yet"
                done={batch.total > 0}
              />
              <StepTab
                value="documents"
                label="Documents"
                pending={docsMissing}
                tone="warning"
                what="missing documents"
                done={workable > 0}
              />
              <StepTab
                value="scrutiny"
                label="Case details"
                pending={attention}
                tone="warning"
                what="to review"
                done={workable > 0}
              />
              {/* Reading each case as the court will, before anyone signs it. A place to read,
                not a step that completes, so it carries no count and no tick. */}
              <TabsTrigger value="review" disabled={workable === 0}>
                Review
              </TabsTrigger>
              <StepTab
                value="sign"
                label="Sign"
                pending={clear}
                upcoming={workable - clear}
                tone="info"
                what="ready to sign"
                done={
                  batch.counts.signed + batch.counts.filed > 0 && workable === 0
                }
              />
              <StepTab
                value="pay"
                label="Pay"
                pending={batch.counts.signed}
                upcoming={workable}
                tone="info"
                what="waiting for payment"
                done={
                  batch.counts.filed > 0 && workable + batch.counts.signed === 0
                }
              />
              <TabsTrigger
                value="filed"
                aria-label={`Filed, ${batch.counts.filed} of ${batch.total}`}
                disabled={!batch.counts.filed}
              >
                Filed
                {batch.counts.filed ? (
                  <span className={cn(COUNT, COUNT_FILL.success)}>
                    {batch.counts.filed}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="cases">
            <CasesTab {...ctx} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab {...ctx} />
          </TabsContent>
          <TabsContent value="scrutiny">
            <ScrutinyTab {...ctx} />
          </TabsContent>
          <TabsContent value="review">
            <ReviewTab {...ctx} />
          </TabsContent>
          <TabsContent value="sign">
            <SignTab {...ctx} />
          </TabsContent>
          <TabsContent value="pay">
            <PayTab {...ctx} />
          </TabsContent>
          <TabsContent value="filed">
            <FiledTab {...ctx} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
