"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, CircleCheckIcon } from "lucide-react";

import { toLongDate } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { PAGE_GROUND, PAGE_GUTTER, PAGE_SUBTITLE, PAGE_TITLE } from "@/components/shell/page-frame";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { bulkApi, type BatchView } from "./api";
import { SourceLabel } from "./batches-screen";
import { CasesTab } from "./cases-tab";
import { useGujarat } from "./court-guard";
import { DocumentsTab } from "./documents-tab";
import { FiledTab, ist } from "./filed-tab";
import { PayTab } from "./pay-tab";
import { ScrutinyTab } from "./scrutiny-tab";
import { SignTab } from "./sign-tab";
import { StageBar } from "./stage";

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
      ) : upcoming ? (
        <span className={cn(COUNT, "border border-hairline text-muted-foreground")}>{upcoming}</span>
      ) : done ? (
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
  go: (tab: TabId) => void;
};

const TABS = ["cases", "documents", "scrutiny", "sign", "pay", "filed"] as const;
export type TabId = (typeof TABS)[number];

/** One batch: its cases, their documents, the checks, then signing and payment in bulk. */
export function BatchScreen({ batchId }: { batchId: string }) {
  const ready = useGujarat();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TabId = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as TabId) : "cases";
  const [batch, setBatch] = React.useState<BatchView | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!ready) return;
    bulkApi.get(batchId).then(setBatch, (e: Error) => setError(e.message));
  }, [ready, batchId]);

  // Slide the highlight to the active tab rather than switching it in one frame. Written
  // to the element directly, so moving it never re-renders the screen.
  const tabsRef = React.useRef<HTMLDivElement>(null);
  const highlightRef = React.useRef<HTMLSpanElement>(null);
  React.useLayoutEffect(() => {
    const list = tabsRef.current;
    const mark = highlightRef.current;
    if (!list || !mark) return;
    const place = () => {
      const active = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
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
    (next: TabId) => router.replace(`${pathname}${next === "cases" ? "" : `?tab=${next}`}`, { scroll: false }),
    [router, pathname]
  );

  if (error) {
    return (
      <div className={cn("flex w-full flex-1 flex-col gap-6", PAGE_GROUND, PAGE_GUTTER)}>
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
      <div className={cn("flex w-full flex-1 flex-col gap-6", PAGE_GROUND, PAGE_GUTTER)}>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const ctx: BatchCtx = { batch, setBatch, go };
  // What is still to do, step by step; each tab carries its own count.
  const open = batch.cases.filter((c) => c.stage === "held" || c.stage === "ready");
  const workable = open.length;
  const docsMissing = open.filter((c) => c.docs.have < c.docs.need).length;
  const attention = open.filter((c) => c.stage === "held" || (c.stage === "ready" && c.flags.length > 0)).length;
  const clear = batch.counts.ready - batch.cases.filter((c) => c.stage === "ready" && c.flags.length > 0).length;

  return (
    <div className={cn("flex w-full flex-1 flex-col gap-6", PAGE_GROUND, PAGE_GUTTER)}>
      <header className="flex flex-col gap-3">
        <Link href="/filings/bulk" className="flex w-fit items-center gap-1 text-body-compact text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" aria-hidden />
          Bulk filing
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className={cn(PAGE_TITLE, "text-foreground tabular-nums")}>Batch {batch.number}</h1>
          <p className={PAGE_SUBTITLE}>
            {batch.client} · <span className="tabular-nums">{batch.total}</span> cases · received{" "}
            {toLongDate(batch.createdAt.slice(0, 10))}
          </p>
        </div>
      </header>

      {batch.total > 0 && batch.counts.filed === batch.total ? (
        <Alert variant="success">
          <CircleCheckIcon aria-hidden />
          <AlertTitle className="tabular-nums">Done: all {batch.total} cases filed</AlertTitle>
          <AlertDescription>
            Last payment {batch.payments.at(-1) ? ist(batch.payments.at(-1)!.at) : ""}.{" "}
            <button type="button" className="underline" onClick={() => go("filed")}>
              See receipts and case numbers
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      {batch.clubbedInto ? (
        <Alert variant="info">
          <AlertTitle>Clubbed into {batch.clubbedIntoNumber}</AlertTitle>
          <AlertDescription>
            The open cases moved there. This batch is closed.{" "}
            <Link className="underline" href={`/filings/bulk/${batch.clubbedInto}`}>
              Open {batch.clubbedIntoNumber}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className={cn(PANEL_CLASS, "py-0")}>
        <CardContent className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-1">
            <span className="text-caption text-muted-foreground">Came in by</span>
            <SourceLabel source={batch.source} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-caption text-muted-foreground">Complainant</span>
            <span className="text-body-compact">{batch.client}</span>
            {batch.representative ? (
              <span className="text-caption text-muted-foreground">
                Through {batch.representative.name}, {batch.representative.designation}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-caption text-muted-foreground">Advocate{batch.advocates.length === 1 ? "" : "s"}</span>
            {batch.advocates.map((a) => (
              <span key={a.barNumber} className="text-body-compact">
                {a.name || "Not found with the Bar Council"}{" "}
                <span className="text-caption text-muted-foreground tabular-nums">{a.barNumber}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-caption text-muted-foreground">Where the cases stand</span>
            <StageBar counts={batch.counts} />
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => go(v as TabId)} className="gap-4">
        <div className="overflow-x-auto">
          <TabsList
            ref={tabsRef}
            aria-label="Batch steps"
            className={cn(
              "relative w-max",
              // The sliding highlight below draws the active tab; the tab itself stays clear.
              "[&>[role=tab]]:z-10 [&>[role=tab][data-state=active]]:bg-transparent [&>[role=tab][data-state=active]]:text-foreground [&>[role=tab][data-state=active]]:shadow-none"
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
            <StepTab value="documents" label="Documents" pending={docsMissing} tone="warning" what="missing documents" done={workable > 0} />
            <StepTab value="scrutiny" label="Scrutiny" pending={attention} tone="warning" what="to review" done={workable > 0} />
            <StepTab
              value="sign"
              label="Sign"
              pending={clear}
              upcoming={workable - clear}
              tone="info"
              what="ready to sign"
              done={batch.counts.signed + batch.counts.filed > 0 && workable === 0}
            />
            <StepTab
              value="pay"
              label="Pay"
              pending={batch.counts.signed}
              upcoming={workable}
              tone="info"
              what="waiting for payment"
              done={batch.counts.filed > 0 && workable + batch.counts.signed === 0}
            />
            <TabsTrigger value="filed" aria-label={`Filed, ${batch.counts.filed} of ${batch.total}`} disabled={!batch.counts.filed}>
              {batch.counts.filed === batch.total && batch.total ? <CircleCheckIcon className="text-success-ink" aria-hidden /> : null}
              Filed
              <span className={cn(COUNT, batch.counts.filed ? COUNT_FILL.success : "border border-hairline text-muted-foreground")}>
                {batch.counts.filed}
              </span>
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
    </div>
  );
}
