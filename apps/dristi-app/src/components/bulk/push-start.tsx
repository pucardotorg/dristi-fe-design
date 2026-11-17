"use client";

/**
 * A batch pushed from a client's system, before it is created (Bulk filing PRD §3: "A
 * batch filed through the API starts at Additional details… From Additional details
 * onward, the steps are the same as for an Excel file").
 *
 * Batch details, cases and documents came in the request, so there is no file, Match
 * columns or Match values: the Cases step opens on Facts of the case, then Check, then
 * Create, with the same cards an Excel upload uses (`check-step.tsx`). The steps row ticks
 * Common details, which the request brought.
 */

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ApiBatchRequest } from "@/lib/bulk/contract";
import {
  defaultFormat,
  formatForFiler,
  readDetailsFormats,
  serverDetailsFormats,
  subscribeToDetailsFormats,
} from "@/lib/filing/details-formats";
import { cn } from "@/lib/utils";
import { BatchBreadcrumbLabel } from "@/components/filing/chrome";
import { FilingFooter } from "@/components/filing/filing-footer";
import { useCourt } from "@/components/court/court-provider";
import { PAGE_GROUND, PAGE_TITLE } from "@/components/shell/page-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusLine } from "@/components/feedback";

import { bulkApi, type BatchSummary } from "./api";
import { BatchFooter, FooterSlot } from "./batch-footer";
import { BULK_COLUMN, BulkSteps, StageRow, type BulkStepId, type StepMark } from "./bulk-steps";
import { CheckCard, FactsCard, FactsLine, StoriesFrom, useCheckCases, withoutOwn } from "./check-step";
import { NO_PICKS } from "./facts-cases";
import type { FactsPicks } from "@/lib/bulk/types";
import { useGujarat } from "./court-guard";

type Push = { batchId: string; batchNumber: string; client: string; source: BatchSummary["source"]; request: ApiBatchRequest };

const plain = (html: string) => html.replace(/<[^>]*>|&nbsp;/g, "").trim();

export function PushStart({ batchId }: { batchId: string }) {
  const ready = useGujarat();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const step = params.get("step") === "review" ? "review" : "facts";
  const setStep = (s: "facts" | "review") => router.push(s === "review" ? `${pathname}?step=review` : pathname);
  const { court } = useCourt();

  const [push, setPush] = React.useState<Push | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [footerSlot, setFooterSlot] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!ready) return;
    bulkApi.getPush(batchId).then(setPush, (e: Error) => {
      // Created already: its own steps.
      if (/already created/.test(e.message)) router.replace(`/filings/bulk/${batchId}`);
      else setError(e.message);
    });
  }, [ready, batchId, router]);

  // The facts every case without its own starts with: what the sender gave, else the
  // default template, until the filer changes it, as for an upload.
  const formats = React.useSyncExternalStore(subscribeToDetailsFormats, readDetailsFormats, serverDetailsFormats);
  const first = defaultFormat(formats) ?? formats[0];
  const [choice, setChoice] = React.useState<{ id: string | undefined; html: string } | null>(null);
  const sent = push?.request.detailsFormat;
  const factsId = choice ? choice.id : (sent?.id ?? first?.id);
  const factsHtml = choice?.html ?? sent?.html ?? (first ? formatForFiler(first) : "");
  // Each case's facts as chosen on Facts of the case, case by case (owner, 2026-11-17).
  const [picks, setPicks] = React.useState<FactsPicks>(NO_PICKS);

  const format: ApiBatchRequest["detailsFormat"] = plain(factsHtml)
    ? { id: factsId ?? "batch", html: factsHtml, court, ...(picks.batchFor.length ? { batchFor: picks.batchFor } : {}) }
    : undefined;
  const factsFor = Object.keys(picks.written).length ? picks.written : undefined;
  const request = React.useMemo<ApiBatchRequest | null>(
    () => (push ? { ...push.request, detailsFormat: format, factsFor } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `format` is rebuilt from these each render
    [push, factsHtml, factsId, court, picks],
  );
  const cases = useCheckCases(request, null);
  const total = push?.request.cases.length ?? 0;
  const own = push?.request.cases.filter((c) => c.otherDetails?.trim()).length ?? 0;

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await bulkApi.createPush(batchId, format, factsFor);
      router.push(`/filings/bulk/${batchId}?tab=scrutiny`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!ready) return null;

  const marks: Record<BulkStepId, StepMark> = {
    common: { status: "complete" },
    cases: { status: "current" },
    details: { status: "upcoming" },
    documents: { status: "upcoming" },
    sign: { status: "upcoming" },
    pay: { status: "upcoming" },
  };
  const width = step === "review" ? "wide" : "medium";
  const system = push?.source.system ?? "the client's system";

  return (
    <FooterSlot.Provider value={footerSlot}>
      <StoriesFrom.Provider value={`${system}'s request`}>
      <div className="flex w-full flex-1 flex-col">
        {push ? <BatchBreadcrumbLabel number={push.batchNumber} id={batchId} /> : null}
        <BulkSteps
          marks={marks}
          secondColumn={BULK_COLUMN[width]}
          second={
            <StageRow
              label="Step 2 · Cases"
              stages={[
                { id: "sent", title: `Sent by ${system}`, done: true },
                { id: "facts", title: "Facts of the case", href: pathname, done: step === "review" },
                { id: "review", title: "Check", href: `${pathname}?step=review` },
              ]}
              current={step}
            />
          }
        />
        <div className={cn("flex w-full flex-1 px-6 pt-6 pb-8 lg:px-12", PAGE_GROUND)}>
          <div className={cn(BULK_COLUMN[width], "flex flex-col gap-6")}>
            <div className="flex flex-col gap-1">
              <h1 className={cn(PAGE_TITLE, "text-foreground")}>{step === "review" ? "Check" : "Facts of the case"}</h1>
              <p className="text-body text-muted-foreground tabular-nums">
                {step === "review"
                  ? push
                    ? `${total} case${total === 1 ? "" : "s"} sent by ${system} · not created yet`
                    : "Reading the batch…"
                  : "Optional. What each complaint says under Facts of the case; every case can change its own."}
              </p>
            </div>
            {error ? (
              <StatusLine tone="error" still>
                {error}
              </StatusLine>
            ) : null}
            {!push ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-64" />
              </div>
            ) : step === "facts" ? (
              <FactsCard
                formats={formats}
                templateId={factsId}
                html={factsHtml}
                onChange={(id, html) => setChoice({ id, html })}
                own={own}
                total={total}
                cases={cases}
                picks={picks}
                onPicks={setPicks}
              />
            ) : cases ? (
              <CheckCard
                cannot={0}
                total={cases.length}
                fix={cases.filter((c) => c.state === "fix").length}
                check={cases.filter((c) => c.state === "check").length}
                footer={
                  withoutOwn(cases) ? (
                    <FactsLine
                      name={plain(factsHtml) ? (formats.find((f) => f.id === factsId)?.name ?? "Your own text") : null}
                      cases={withoutOwn(cases)}
                      onEdit={() => setStep("facts")}
                    />
                  ) : undefined
                }
              />
            ) : (
              <p role="status" className="text-body-compact text-muted-foreground">
                Checking each case…
              </p>
            )}
          </div>
        </div>
        <div ref={setFooterSlot} className="sticky bottom-0 z-30" />
      </div>

      <BatchFooter>
        {step === "facts" ? (
          <FilingFooter
            showSaveState={false}
            onBack={() => router.push("/filings/bulk")}
            backLabel="Batches"
            onContinue={() => setStep("review")}
            continueLabel="Continue"
            continueDisabled={!push}
          />
        ) : (
          <FilingFooter
            showSaveState={false}
            onBack={() => setStep("facts")}
            onContinue={() => void create()}
            continueDisabled={busy || !push}
            continueLabel={busy ? "Creating batch…" : `Create ${total} case${total === 1 ? "" : "s"}`}
          />
        )}
      </BatchFooter>


      </StoriesFrom.Provider>
    </FooterSlot.Provider>
  );
}
