"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import { useCourt } from "@/components/court/court-provider";

import { cn } from "@/lib/utils";
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { BatchBreadcrumbLabel } from "@/components/filing/chrome";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { bulkApi, caseFlowHref, setBulkAiMode, type BatchView } from "./api";
import { CasesTab } from "./cases-tab";
import { useGujarat } from "./court-guard";
import { DocumentsTab } from "./documents-tab";
import { FiledTab, ist } from "./filed-tab";
import { PayTab } from "./pay-tab";
import { ReviewTab } from "./review-tab";
import { ScrutinyTab } from "./scrutiny-tab";
import { SignTab } from "./sign-tab";
import { BULK_COLUMN, BulkSteps, StageRow, type BulkStepId, type BulkWidth } from "./bulk-steps";
import { StatusLine } from "@/components/feedback";
import { FooterSlot } from "./batch-footer";
import { commonHref } from "./setup-flow";
import { batchMarks, batchTallies } from "./batch-marks";

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
  const [footerSlot, setFooterSlot] = React.useState<HTMLElement | null>(null);
  // AI review follows `?ai=on|off|unavailable`, else the court's setting (on for Gujarat),
  // the same switch as the scrutiny workbench.
  const aiParam = params.get("ai");
  const ai = aiModeFrom(aiParam, profile.aiMode);
  setBulkAiMode(ai);

  React.useEffect(() => {
    if (!ready) return;
    bulkApi.get(batchId).then(setBatch, (e: Error) => setError(e.message));
  }, [ready, batchId, ai]);

  // Common details reopen on the pages they were filled on, never as a summary.
  React.useEffect(() => {
    if (tab === "common") router.replace(commonHref(batchId));
  }, [tab, router, batchId]);

  const go = React.useCallback(
    (next: TabId, caseId?: string) => {
      if (next === "common") {
        router.push(commonHref(batchId));
        return;
      }
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
  const { workable, allFiled, fixing, checking, clear, docsMissing } = batchTallies(batch);

  // The six steps, from what the batch already is to what is left. Common details and
  // Cases were settled when the batch was created; both stay open to read.
  const step = STEP_OF[tab];
  const fromFile = batch.source.kind === "excel" || batch.source.kind === "documents";
  const q = (t: TabId) => {
    const p = new URLSearchParams();
    if (t !== "scrutiny") p.set("tab", t);
    if (aiParam) p.set("ai", aiParam);
    const qs = p.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  };
  const TAB_OF: Record<BulkStepId, TabId> = { common: "common", cases: "cases", details: "scrutiny", documents: "documents", sign: "sign", pay: "pay" };
  const marks = batchMarks(batch, step, (id) => (id === "common" ? commonHref(batch.id) : q(TAB_OF[id])));
  // The Cases step reopens on its Check, its earlier sub-steps ticked: the file was read
  // and its facts chosen when the batch was made (owner, 2026-11-11).
  const stages =
    step === "cases" && fromFile
      ? [
          ...(batch.source.kind === "excel" ? [{ id: "format", title: "Choose a format", done: true }] : []),
          { id: "file", title: batch.source.kind === "documents" ? "Case documents" : "Excel file", done: true },
          { id: "facts", title: "Facts of the case", done: true },
          { id: "cases", title: "Check", href: q("cases") },
        ]
      : step === "sign"
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
  const shown: TabId = allFiled && tab !== "common" && tab !== "cases" ? "filed" : tab;
  const width: BulkWidth = shown === "cases" || shown === "scrutiny" || shown === "documents" || shown === "review" || shown === "filed" ? "wide" : "medium";
  // The title is the step's (or sub-step's) name, so it never changes between visits; the
  // counts are the subtitle's (audit rule 2, owner 2026-11-11).
  const title = {
    common: "Common details",
    cases: fromFile ? "Check" : "Cases",
    scrutiny: "Case details",
    documents: "Documents",
    review: "Review",
    sign: "Sign",
    pay: "Pay",
    filed: "Filed",
  }[shown];
  const subtitle: string | null = {
    common: null,
    // The file, as on Check before Create; the card counts the cases.
    cases: fromFile ? (batch.source.reference ?? null) : casesLine(batch),
    scrutiny: fixing || checking
      ? // The rule, not the counts the pills already give (BLK-08, BLK-12).
        "Cases to fix wait until they're fixed. Cases to check can go ahead without changes."
      : "Every case's details are done.",
    documents: docsMissing
      ? `${plural(docsMissing, "case is", "cases are")} missing documents. The complainant's are already on every case.`
      : "Every case here has its documents.",
    review: null,
    sign: clear ? `${plural(clear, "case is", "cases are")} ready to sign.` : null,
    pay: batch.counts.signed ? `${plural(batch.counts.signed, "signed case", "signed cases")} to pay and file.` : null,
    filed: `${plural(batch.counts.filed, "case", "cases")} filed.`,
  }[shown];
  const body = {
    common: null,
    cases: <CasesTab {...ctx} />,
    scrutiny: <ScrutinyTab {...ctx} />,
    documents: <DocumentsTab {...ctx} />,
    review: <ReviewTab {...ctx} />,
    sign: <SignTab {...ctx} />,
    pay: <PayTab {...ctx} />,
    filed: <FiledTab {...ctx} />,
  }[shown];

  return (
    <FooterSlot.Provider value={footerSlot}>
    <div className="flex w-full flex-1 flex-col">
      <BatchBreadcrumbLabel number={batch.number} id={batch.id} />
      <BulkSteps
        marks={marks}
        secondColumn={BULK_COLUMN[width]}
        second={
          stages ? (
            <StageRow
              label={step === "cases" ? "Step 2 · Cases" : `Step ${step === "sign" ? 5 : 6} · ${step === "sign" ? "Review and sign" : "Pay"}`}
              stages={stages}
              current={tab}
            />
          ) : undefined
        }
      />
      {/* No side panel on a batch's steps, so the page sits in the middle (v8): the narrow
          column for forms and summaries, the wide one for lists of cases. */}
      <div className={cn("flex w-full flex-1 px-6 pt-6 pb-8 lg:px-12", PAGE_GROUND)}>
        <div className={cn(BULK_COLUMN[width], "flex flex-col gap-6")}>
        {/* Each step is titled by its job, the way the prototypes were. Which batch it is
            sits in the breadcrumb, not repeated under every title (round 3). */}
        <div className="flex flex-col gap-1">
          <h1 className={cn(PAGE_TITLE, "text-foreground")}>{title}</h1>
          {subtitle ? <p className="text-body text-muted-foreground tabular-nums">{subtitle}</p> : null}
        </div>

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
      <div ref={setFooterSlot} className="sticky bottom-0 z-30" />
    </div>
    </FooterSlot.Provider>
  );
}

/** The Cases step's subtitle: how many cases, and from where. The filters carry the counts. */
function casesLine(batch: BatchView): string {
  const from = batch.source.kind === "api" ? `, sent by ${batch.source.system}` : ` from ${batch.source.reference}`;
  return `${batch.total} case${batch.total === 1 ? "" : "s"}${from}.`;
}
