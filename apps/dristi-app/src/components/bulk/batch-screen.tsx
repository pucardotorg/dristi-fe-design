"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import { useCourt } from "@/components/court/court-provider";

import { toLongDate } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
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

import { bulkApi, caseFlowHref, setBulkAiMode, type BatchView, type CaseView } from "./api";
import { SourceLabel } from "./batches-screen";
import { CasesTab } from "./cases-tab";
import { useGujarat } from "./court-guard";
import { DocumentsTab } from "./documents-tab";
import { FiledTab, ist } from "./filed-tab";
import { PayTab } from "./pay-tab";
import { ReviewTab } from "./review-tab";
import { ScrutinyTab } from "./scrutiny-tab";
import { SignTab } from "./sign-tab";
import { BulkStageRow, BulkStepRow, type BulkStepId, type StepMark } from "./bulk-steps";
import { StatusLine } from "@/components/feedback";

export type BatchCtx = {
  batch: BatchView;
  /** Replace the batch with what an action returned. */
  setBatch: (b: BatchView) => void;
  /** Open a tab; Case details with a case opens that case in the filing's sections. */
  go: (tab: TabId, caseId?: string) => void;
};

const TABS = [
  "common",
  "cases",
  "scrutiny",
  "documents",
  "review",
  "sign",
  "pay",
  "filed",
] as const;

/** Which of the batch's six steps a tab belongs to (`bulk-steps.tsx`). */
const STEP_OF: Record<TabId, BulkStepId> = {
  common: "common",
  cases: "cases",
  scrutiny: "details",
  documents: "documents",
  review: "sign",
  sign: "sign",
  pay: "pay",
  filed: "pay",
};
export type TabId = (typeof TABS)[number];

/** One batch: its cases, their documents, the checks, then signing and payment in bulk. */
export function BatchScreen({ batchId }: { batchId: string }) {
  const ready = useGujarat();
  const { profile } = useCourt();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TabId = (TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as TabId)
    : "scrutiny";
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

  const go = React.useCallback(
    (next: TabId, caseId?: string) => {
      // A case is worked on in the single filing's sections, not on a tab.
      const c = next === "scrutiny" && caseId ? batch?.cases.find((x) => x.id === caseId) : null;
      if (c) {
        router.push(caseFlowHref(batchId, c, undefined, aiParam));
        return;
      }
      const q = new URLSearchParams();
      if (next !== "scrutiny") q.set("tab", next);
      if (caseId) q.set("case", caseId);
      if (aiParam) q.set("ai", aiParam);
      const qs = q.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, aiParam, batch, batchId],
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
        <StatusLine tone="error" still title="This batch could not be opened">
          {error}
        </StatusLine>
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
  // Documents counts the cases with a file missing or a scan too blurry to read.
  const docsMissing = open.filter(
    (c) =>
      c.docs.have < c.docs.need || c.flags.some((f) => f.rule === "dcm-poor"),
  ).length;
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

  // Of those with something open, the ones held until fixed (the rest are checks to look at).
  const fixing = open.filter((c) =>
    c.flags.some(
      (f) =>
        f.level === "hold" &&
        f.section !== "documents" &&
        f.fix?.kind !== "upload" &&
        f.fix?.kind !== "documents",
    ),
  ).length;
  // Case details' count, in the words its title uses: held cases are to fix, the rest
  // with something open are only to check.
  const detailsNote = fixing ? `${fixing} to fix` : attention ? `${attention} to check` : undefined;

  // The six steps, from what the batch already is to what is left. Common details and
  // Cases were settled when the batch was created; both stay open to read.
  const step = STEP_OF[tab];
  const q = (t: TabId) => {
    const p = new URLSearchParams();
    if (t !== "scrutiny") p.set("tab", t);
    if (aiParam) p.set("ai", aiParam);
    const qs = p.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  };
  const mark = (id: BulkStepId, done: boolean, href: string, note?: string, tone?: StepMark["tone"]): StepMark => ({
    status: step === id ? "current" : done ? "complete" : "upcoming",
    href,
    note: step === id ? undefined : note,
    tone,
  });
  const marks: Record<BulkStepId, StepMark> = {
    common: mark("common", true, q("common")),
    cases: mark("cases", true, q("cases")),
    details: mark("details", workable > 0 && attention === 0, q("scrutiny"), detailsNote),
    documents: mark("documents", workable > 0 && docsMissing === 0, q("documents"), docsMissing ? `${docsMissing} missing` : undefined),
    sign: mark("sign", batch.counts.signed + batch.counts.filed > 0 && workable === 0, q("sign"), clear ? `${clear} ready` : undefined, "ready"),
    pay: mark("pay", allFiled, q("pay")),
  };
  const stages =
    step === "sign"
      ? [
          { id: "review", title: "Review", href: workable ? q("review") : undefined },
          { id: "sign", title: "Sign", href: q("sign") },
        ]
      : step === "pay"
        ? [
            { id: "pay", title: "Pay", href: q("pay") },
            { id: "filed", title: "Filed", href: batch.counts.filed ? q("filed") : undefined, done: allFiled },
          ]
        : null;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  // Documents: cases with a file still to add, apart from scans that only need a look.
  const lacking = open.filter((c) => c.docs.have < c.docs.need).length;
  const shown: TabId = allFiled && tab !== "common" && tab !== "cases" ? "filed" : tab;
  const title = {
    common: "Common details",
    cases: "Cases in this batch",
    scrutiny: fixing
      ? `${plural(fixing, "case needs", "cases need")} fixing`
      : attention
        ? `${plural(attention, "case", "cases")} to check`
        : "Every case's details are complete",
    documents: lacking
      ? `${plural(lacking, "case is", "cases are")} missing documents`
      : docsMissing
        ? `${plural(docsMissing, "case has a scan", "cases have scans")} to check`
        : "Every document is in",
    review: "Review",
    sign: clear ? `Sign ${plural(clear, "case", "cases")}` : "Sign",
    pay: batch.counts.signed ? `Pay for ${plural(batch.counts.signed, "case", "cases")}` : "Pay",
    filed: `${plural(batch.counts.filed, "case", "cases")} filed`,
  }[shown];
  const body = {
    common: (
      <CommonDetails
        batch={batch}
        stand={[
          { step: "Case details", value: detailsNote ?? "Complete", href: q("scrutiny"), open: attention > 0 },
          { step: "Documents", value: docsMissing ? `${docsMissing} missing` : "Complete", href: q("documents"), open: docsMissing > 0 },
          { step: "Ready to sign", value: String(clear), href: q("sign"), open: false },
          { step: "Signed or filed", value: String(batch.counts.signed + batch.counts.filed), open: false },
        ]}
      />
    ),
    cases: <CasesTab {...ctx} />,
    scrutiny: <ScrutinyTab {...ctx} />,
    documents: <DocumentsTab {...ctx} />,
    review: <ReviewTab {...ctx} />,
    sign: <SignTab {...ctx} />,
    pay: <PayTab {...ctx} />,
    filed: <FiledTab {...ctx} />,
  }[shown];

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* The batch page's own gutter (`PAGE_GUTTER`), so the steps line up with the page. */}
      <BulkStepRow marks={marks} className={cn("md:px-8 lg:px-8", !stages && "border-b border-hairline")} />
      {stages ? <BulkStageRow step={step} stages={stages} current={tab} className="md:px-8 lg:px-8" /> : null}
      <div
        className={cn(
          "flex w-full flex-1 flex-col gap-6",
          PAGE_GROUND,
          PAGE_GUTTER,
        )}
      >
        {/* Each step is titled by its job, the way the prototypes were; the batch it belongs
            to is the line under it (and the breadcrumb). */}
        <header className="flex flex-col gap-1">
          <h1 className={cn(PAGE_TITLE, "text-foreground tabular-nums")}>{title}</h1>
          <p className={PAGE_SUBTITLE}>
            <span className="tabular-nums">Batch {batch.number}</span> · {batch.client} ·{" "}
            <span className="tabular-nums">{batch.total}</span> cases · received{" "}
            {toLongDate(batch.createdAt.slice(0, 10))}
          </p>
        </header>

        {/* A standing condition, said still (skill `feedback-states`). */}
        {ai === "unavailable" ? (
          <StatusLine tone="warning" still>
            AI review unavailable. Documents are not compared with the cases;
            check them manually.
          </StatusLine>
        ) : null}

        {allFiled ? (
          <StatusLine
            tone="success"
            still
            title={<span className="tabular-nums">Done: all {batch.total} cases filed</span>}
          >
            Last payment{" "}
            {batch.payments.at(-1) ? ist(batch.payments.at(-1)!.at) : ""}.
          </StatusLine>
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

        {body}
      </div>
    </div>
  );
}

/** What the batch was made with: where it came from, its parties, and where its cases stand. */
function CommonDetails({
  batch,
  stand,
}: {
  batch: BatchView;
  /**
   * Where the cases stand, step by step, in the stepper's own numbers and words. One
   * definition per count: a bar of case stages here once said "Needs fixing 12" beside a
   * stepper saying "3 to fix", because it counted missing documents too (bulk audit).
   */
  stand: { step: string; value: string; href?: string; open: boolean }[];
}) {
  return (
    <Card variant="raised">
      <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-1">
          <span className="text-body-compact text-muted-foreground">Came in by</span>
          <SourceLabel source={batch.source} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-body-compact text-muted-foreground">Complainant</span>
          <span className="text-body-compact">{batch.client}</span>
          {batch.representative ? (
            <span className="text-body-compact text-muted-foreground">
              Through {batch.representative.name}, {batch.representative.designation}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-body-compact text-muted-foreground">
            Advocate{batch.advocates.length === 1 ? "" : "s"}
          </span>
          {batch.advocates.map((a) => (
            <span key={a.barNumber} className="text-body-compact">
              {a.name || "Not found with the Bar Council"}{" "}
              <span className="text-muted-foreground tabular-nums">{a.barNumber}</span>
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-body-compact text-muted-foreground">Where the cases stand</span>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-body-compact">
            {stand.map((r) => (
              <React.Fragment key={r.step}>
                <dt>
                  {r.href ? (
                    <Link href={r.href} className="underline-offset-4 hover:underline">
                      {r.step}
                    </Link>
                  ) : (
                    r.step
                  )}
                </dt>
                <dd className={cn("text-right tabular-nums", r.open ? "text-warning-ink" : "text-muted-foreground")}>
                  {r.value}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
        <p className="text-body-compact text-muted-foreground md:col-span-2 xl:col-span-4">
          Set once for every case when the batch was created. Each case can change them on its
          own, from Case details.
        </p>
      </CardContent>
    </Card>
  );
}
