"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, CircleCheckIcon, CircleDashedIcon } from "lucide-react";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import { useCourt } from "@/components/court/court-provider";

import { cn } from "@/lib/utils";
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { BatchBreadcrumbLabel } from "@/components/filing/chrome";
import { FilingFooter } from "@/components/filing/filing-footer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { bulkApi, caseFlowHref, setBulkAiMode, type BatchView } from "./api";
import { SourceLabel } from "./batches-screen";
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
import { BatchFooter, FooterSlot } from "./batch-footer";
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
  const { workable, allFiled, docsMissing, attention, fixing, checking, clear, detailsNote } = batchTallies(batch);

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
  const TAB_OF: Record<BulkStepId, TabId> = { common: "common", cases: "cases", details: "scrutiny", documents: "documents", sign: "sign", pay: "pay" };
  const marks = batchMarks(batch, step, (id) => q(TAB_OF[id]));
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
  const shown: TabId = allFiled && tab !== "common" && tab !== "cases" ? "filed" : tab;
  const width: BulkWidth = shown === "cases" || shown === "scrutiny" || shown === "documents" || shown === "review" || shown === "filed" ? "wide" : "medium";
  const title = {
    common: "Common details",
    cases: "Cases in this batch",
    scrutiny: fixing
      ? `${plural(fixing, "case needs", "cases need")} fixing`
      : checking
        ? `${plural(checking, "case", "cases")} to check`
        : "Every case's details are done",
    // The step's name; the card under it says how many cases are missing what (v8).
    documents: "Documents",
    review: "Review",
    sign: clear ? `Sign ${plural(clear, "complete case", "complete cases")}` : "Sign",
    pay: batch.counts.signed ? `Pay and file ${plural(batch.counts.signed, "case", "cases")}` : "Pay",
    filed: `${plural(batch.counts.filed, "case", "cases")} filed`,
  }[shown];
  const body = {
    common: (
      <CommonDetails
        batch={batch}
        stand={[
          { step: "Case details", value: detailsNote ?? "Done", href: q("scrutiny"), open: attention > 0 },
          { step: "Documents", value: docsMissing ? `${docsMissing} missing` : "Done", href: q("documents"), open: docsMissing > 0 },
          { step: "Complete, ready to sign", value: String(clear), href: q("sign"), open: false },
          { step: "Signed, to pay", value: String(batch.counts.signed), href: q("pay"), open: false },
          { step: "Filed", value: String(batch.counts.filed), href: batch.counts.filed ? q("filed") : undefined, open: false },
        ]}
        onContinue={() => go("cases")}
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
    <FooterSlot.Provider value={footerSlot}>
    <div className="flex w-full flex-1 flex-col">
      <BatchBreadcrumbLabel number={batch.number} id={batch.id} />
      <BulkSteps
        marks={marks}
        second={stages ? <StageRow label={`Step ${step === "sign" ? 5 : 6} · ${step === "sign" ? "Review and sign" : "Pay"}`} stages={stages} current={tab} /> : undefined}
      />
      {/* No side panel on a batch's steps, so the page sits in the middle (v8): the narrow
          column for forms and summaries, the wide one for lists of cases. */}
      <div className={cn("flex w-full flex-1 px-6 pt-6 pb-8 lg:px-12", PAGE_GROUND)}>
        <div className={cn(BULK_COLUMN[width], "flex flex-col gap-6")}>
        {/* Each step is titled by its job, the way the prototypes were. Which batch it is
            sits in the breadcrumb, not repeated under every title (round 3). */}
        <h1 className={cn(PAGE_TITLE, "text-foreground tabular-nums")}>{title}</h1>

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

/** What the batch was made with: where it came from, every value set for all its cases, and where they stand. */
function CommonDetails({
  batch,
  stand,
  onContinue,
}: {
  batch: BatchView;
  /**
   * Where the cases stand, step by step, in the stepper's own numbers and words. One
   * definition per count: a bar of case stages here once said "Needs fixing 12" beside a
   * stepper saying "3 to fix", because it counted missing documents too (bulk audit).
   */
  stand: { step: string; value: string; href?: string; open: boolean }[];
  onContinue: () => void;
}) {
  // The documents set once for every case: each complainant's group, as the first case holds it.
  const common = (batch.cases[0]?.documents ?? []).filter((d) => d.group.startsWith("Complainant"));
  const label = "text-body-compact text-muted-foreground";
  return (
    <>
      <Card variant="raised">
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className={label}>Came in by</span>
            <SourceLabel source={batch.source} />
          </div>
          <div className="flex flex-col gap-1">
            <span className={label}>Complainant</span>
            <span className="text-body-compact">{batch.client}</span>
            {batch.representative ? (
              <span className="text-body-compact text-muted-foreground">
                Through {batch.representative.name}
                {batch.representative.designation ? `, ${batch.representative.designation}` : ""}
                {batch.representative.mobile ? (
                  <span className="tabular-nums"> · {batch.representative.mobile}</span>
                ) : null}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <span className={label}>Advocate{batch.advocates.length === 1 ? "" : "s"}</span>
            {batch.advocates.map((a) => (
              <span key={a.barNumber} className="text-body-compact">
                {a.name || "Not found with the Bar Council"}{" "}
                <span className="font-mono text-muted-foreground">{a.barNumber}</span>
              </span>
            ))}
          </div>
          {common.length ? (
            <div className="flex flex-col gap-1">
              <span className={label}>Documents for every case</span>
              <ul className="flex flex-col gap-1">
                {common.map((d) => (
                  <li key={`${d.group}-${d.name}`} className="flex items-center gap-2 text-body-compact">
                    {d.file ? (
                      <CircleCheckIcon aria-hidden className="size-4 shrink-0 text-success" />
                    ) : (
                      <CircleDashedIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span>
                      {d.name}
                      <span className="sr-only">{d.file ? ", attached" : ", not attached"}</span>
                    </span>
                    {!d.file ? (
                      <span className="text-muted-foreground">· {d.required ? "to add at Documents" : "optional"}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-body-compact text-muted-foreground md:col-span-2">
            Set once for every case when the batch was created. Each case can change them on its
            own, from Case details.
          </p>
        </CardContent>
      </Card>
      <section className="flex flex-col gap-2">
        <h2 className="text-body font-semibold">Where the cases stand</h2>
        <Card variant="raised" className="gap-0 p-2">
          <ul className="flex flex-col">
            {stand.map((r) => {
              const row = (
                <>
                  <span>{r.step}</span>
                  <span className={cn("tabular-nums", r.open ? "text-warning-ink" : "text-muted-foreground")}>{r.value}</span>
                </>
              );
              const cls = "flex min-h-10 items-center justify-between gap-4 rounded-lg px-3 text-body-compact";
              return (
                <li key={r.step}>
                  {r.href ? (
                    <Link href={r.href} className={cn(cls, "hover:bg-accent")}>
                      {row}
                    </Link>
                  ) : (
                    <span className={cls}>{row}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </section>
      <BatchFooter>
        <FilingFooter showSaveState={false} continueLabel="Cases" onContinue={onContinue} />
      </BatchFooter>
    </>
  );
}
