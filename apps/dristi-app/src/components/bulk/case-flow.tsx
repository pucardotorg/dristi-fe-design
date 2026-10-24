"use client";

/**
 * One case of a batch, open in the single filing's own sections.
 *
 * The single filing is the one complete view of a case, so a bulk case is not given a
 * view of its own: the same sections, the same fields and the same rules, reading and
 * writing the case's draft on the server (`BulkCaseRepository`). What bulk adds sits
 * around them, never inside:
 *
 *   · Sign and Pay fees are left out: the batch signs and pays once. The intake upload is
 *     left out too: the batch's documents step did it.
 *   · The batch's complainants and advocates were copied onto every case when it was
 *     created; here they are the case's own, changed in this case alone (PRD `BLK-06`).
 *   · The batch's checks sit on the fields they are about and on the rail's rows, and the
 *     bar above the section lists what is open in it, with Skip where a check allows it.
 *   · The bar names the case in the batch and moves to the previous, next, or next case
 *     with something to fix.
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileQuestionIcon,
  WandSparklesIcon,
} from "lucide-react";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import { BULK_CASE_SAVED, BulkCaseRepository } from "@/lib/bulk/case-repository";
import { BULK_CASE_STEPS, firstFlaggedStep, flagPlace } from "@/lib/bulk/flag-place";
import type { Flag, FlagFix } from "@/lib/bulk/scrutiny";
import { draftTitle } from "@/lib/filing/selectors";
import { getStep, stepFromPathname } from "@/lib/filing/steps";
import { FilingProvider, useFiling } from "@/lib/filing/store";
import type { StepId } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import { useCourt, useCourtText } from "@/components/court/court-provider";
import { DraftBreadcrumbLabel } from "@/components/filing/chrome";
import { FieldPolicyProvider, type FieldPolicy } from "@/components/filing/field-policy";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { FilingShell } from "@/components/filing/filing-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

import { bulkApi, caseFlowHref, setBulkAiMode, type BatchView, type CaseView } from "./api";
import { useGujarat } from "./court-guard";
import { demoFill } from "./demo-fill";
import { OriginalDoc } from "./original-doc";
import { FlagLine } from "./scrutiny-tab";
import { CaseBadge } from "./stage";

/** Where the batch is, on one of its tabs. */
function batchHref(batchId: string, tab: string, ai: string | null, caseId?: string): string {
  const q = new URLSearchParams({ tab });
  if (caseId) q.set("case", caseId);
  if (ai) q.set("ai", ai);
  return `/filings/bulk/${encodeURIComponent(batchId)}?${q}`;
}

const editable = (c: CaseView) => c.stage === "held" || c.stage === "ready";

/** The next case, after this one and round to the start, that still has something to fix. */
function nextToFix(cases: CaseView[], at: number): CaseView | null {
  return (
    [...cases.slice(at + 1), ...cases.slice(0, at)].find((x) => editable(x) && x.flags.length > 0) ??
    null
  );
}

/** Why nothing in a case can be changed here, or `null` when it can. */
function closedBecause(batch: BatchView | null, c: CaseView | null): string | null {
  if (batch?.clubbedInto)
    return `This batch was clubbed into ${batch.clubbedIntoNumber ?? "another batch"} and is closed, so its cases cannot be changed here.`;
  if (c?.stage === "filed") return "This case is filed, so it cannot be changed.";
  if (c?.stage === "signed")
    return "This case is signed, so it cannot be changed here. A change would void the signatures.";
  return null;
}

export function BulkCaseFlow({
  batchId,
  caseId,
  children,
}: {
  batchId: string;
  caseId: string;
  children: React.ReactNode;
}) {
  const ready = useGujarat();
  const { profile } = useCourt();
  const aiParam = useSearchParams().get("ai");
  const ai = aiModeFrom(aiParam, profile.aiMode);
  setBulkAiMode(ai);
  const step = stepFromPathname(usePathname());

  const [batch, setBatch] = React.useState<BatchView | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // Bumped after a batch-wide fix, so the case is read again with it.
  const [generation, setGeneration] = React.useState(0);

  const load = React.useCallback(
    () =>
      bulkApi
        .get(batchId)
        .then((b) => {
          setBatch(b);
          setError(null);
        })
        .catch((e) => setError((e as Error).message)),
    [batchId],
  );
  React.useEffect(() => {
    if (ready) void load();
  }, [ready, load, ai]);

  // Every save re-runs the batch's checks, once the typing settles.
  React.useEffect(() => {
    let timer: number | undefined;
    const onSaved = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 400);
    };
    window.addEventListener(BULK_CASE_SAVED, onSaved);
    return () => {
      window.removeEventListener(BULK_CASE_SAVED, onSaved);
      window.clearTimeout(timer);
    };
  }, [load]);

  const repository = React.useMemo(
    () => new BulkCaseRepository(batchId, caseId),
    [batchId, caseId],
  );

  const hrefFor = React.useCallback(
    (s: StepId) => {
      if (s === "upload") return batchHref(batchId, "documents", aiParam);
      if (!BULK_CASE_STEPS.includes(s)) return batchHref(batchId, "scrutiny", aiParam);
      return caseFlowHref(batchId, { id: caseId, flags: [] }, s, aiParam);
    },
    [batchId, caseId, aiParam],
  );

  const courtText = useCourtText();
  const c = batch?.cases.find((x) => x.id === caseId) ?? null;
  const closed = closedBecause(batch, c);

  /*
   * Where the footer's primary action goes. A case is not walked section by section: once
   * nothing is open where you are, it goes to the next section with something open, and
   * once nothing is open in the case, to the next case that needs fixing.
   */
  const next = React.useMemo<FieldPolicy["next"]>(() => {
    if (!batch || !c) return null;
    const flags = editable(c) ? c.flags : [];
    if (flags.some((f) => f.section === step)) return null;
    const elsewhere = flags.filter((f) => f.section !== step);
    if (elsewhere.length) {
      const s = firstFlaggedStep(elsewhere);
      return {
        label: `Next to ${elsewhere.some((f) => f.level === "hold") ? "fix" : "check"}: ${courtText(getStep(s).title)}`,
        href: caseFlowHref(batchId, c, s, aiParam),
      };
    }
    const cases = batch.cases;
    const toFix = nextToFix(cases, cases.findIndex((x) => x.id === c.id));
    const left = cases.filter((x) => x.id !== c.id && editable(x) && x.flags.length > 0).length;
    const status = (
      <span className="inline-flex items-center gap-2 text-body-compact text-success-ink">
        <CheckIcon className="size-4" aria-hidden />
        {editable(c) ? "This case is ready" : "Nothing to change here"}
        {left ? (
          <span className="text-muted-foreground tabular-nums">
            · {left} more {left === 1 ? "case needs" : "cases need"} you
          </span>
        ) : null}
      </span>
    );
    return toFix
      ? {
          label: "Next case to fix",
          href: caseFlowHref(batchId, toFix, firstFlaggedStep(toFix.flags), aiParam),
          status,
        }
      : { label: "Back to all cases", href: batchHref(batchId, "scrutiny", aiParam, c.id), status };
  }, [batch, c, step, batchId, aiParam, courtText]);

  const policy = React.useMemo<FieldPolicy>(() => {
    const flags = c?.flags ?? [];
    const here = flags
      .map((f) => ({ f, at: flagPlace(f) }))
      .filter(({ at }) => at.step === step);
    return {
      step,
      issueAt: (instance, name) => {
        const hits = here.filter(({ at }) => at.instance === instance && at.name === name);
        return (hits.find(({ f }) => f.level === "hold") ?? hits[0])?.f.message ?? null;
      },
      lockedAt: (instance) => {
        if (closed) return instance === null ? closed : null;
        return null;
      },
      countFor: (s) => flags.filter((f) => f.section === s).length,
      next,
    };
  }, [c, step, closed, next]);

  if (!ready) return null;

  return (
    <FilingProvider
      key={`${caseId}:${generation}`}
      draftId={caseId}
      repository={repository}
      hrefFor={hrefFor}
      steps={BULK_CASE_STEPS}
      fallback={
        <div
          role="status"
          aria-live="polite"
          className="flex flex-1 items-center justify-center py-16 text-body-compact text-muted-foreground"
        >
          <Spinner className="mr-2 size-4" />
          Opening the case…
        </div>
      }
      notFound={
        <div className="flex flex-1 items-center justify-center px-4 py-16">
          <Empty className="max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileQuestionIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-body font-semibold">This case isn&apos;t in the batch</EmptyTitle>
              <EmptyDescription className="text-body">
                It may have been clubbed into another batch, or the link is old.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href={batchHref(batchId, "scrutiny", aiParam)}>
                  <ArrowLeftIcon data-icon="inline-start" aria-hidden />
                  Back to the batch
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      }
    >
      <CaseTitle />
      <FieldPolicyProvider value={policy}>
        <FilingShell
          banner={
            <CaseBar
              batchId={batchId}
              batch={batch}
              c={c}
              step={step}
              aiParam={aiParam}
              error={error}
              setBatch={setBatch}
              onBatchFixed={() => setGeneration((g) => g + 1)}
            />
          }
        >
          {children}
        </FilingShell>
      </FieldPolicyProvider>
    </FilingProvider>
  );
}

/** Names the case for the top bar's breadcrumb. */
function CaseTitle() {
  const { draft } = useFiling();
  return <DraftBreadcrumbLabel label={draftTitle(draft)} />;
}

/* ───────────────────────────── The bar ───────────────────────────── */

function CaseBar({
  batchId,
  batch,
  c,
  step,
  aiParam,
  error,
  setBatch,
  onBatchFixed,
}: {
  batchId: string;
  batch: BatchView | null;
  c: CaseView | null;
  step: StepId | null;
  aiParam: string | null;
  error: string | null;
  setBatch: (b: BatchView) => void;
  onBatchFixed: () => void;
}) {
  const courtText = useCourtText();
  const { flush, update } = useFiling();
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  const act = async (body: Record<string, unknown>, batchWide = false) => {
    setBusy(true);
    setProblem(null);
    try {
      // What is typed goes first, so the check runs on it.
      await flush();
      setBatch(await bulkApi.act(batchId, body));
      if (batchWide) onBatchFixed();
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const frame = (body: React.ReactNode) => (
    <div className="bg-muted px-6 pt-6 lg:px-12 dark:bg-background">
      <div className="flex w-full max-w-4xl flex-col gap-3">{body}</div>
    </div>
  );

  if (error && !batch)
    return frame(
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>,
    );
  if (!batch || !c) return frame(<Skeleton className="h-16 w-full rounded-xl" />);

  const cases = batch.cases;
  const at = cases.findIndex((x) => x.id === c.id);
  const prev = cases[at - 1] ?? null;
  const next = cases[at + 1] ?? null;
  const toFix = nextToFix(cases, at);
  const sameStep = (x: CaseView) =>
    caseFlowHref(batchId, x, step && BULK_CASE_STEPS.includes(step) ? step : undefined, aiParam);

  const here = c.flags.filter((f) => f.section === step);
  const elsewhere = BULK_CASE_STEPS.filter((s) => s !== step)
    .map((s) => ({ s, n: c.flags.filter((f) => f.section === s).length }))
    .filter(({ n }) => n > 0);
  // A hold has to be fixed; a check can be looked at and skipped. The words say which.
  const verb = (flags: Flag[]) => (flags.some((f) => f.level === "hold") ? "fix" : "check");
  const later = c.flags.filter((f) => f.section !== step);

  return frame(
    <Card className={cn(PANEL_CLASS, "gap-0 py-0")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        <Button asChild variant="ghost" className="-ml-2">
          <Link href={batchHref(batchId, "scrutiny", aiParam, c.id)}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden />
            All cases
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-body-compact font-semibold">{c.title}</span>
            <CaseBadge c={c} />
          </span>
          <span className="flex flex-wrap gap-x-2 text-caption text-muted-foreground tabular-nums">
            <span>
              Case {at + 1} of {cases.length} in {batch.number}
            </span>
            <span>· {c.reference}</span>
            {c.cheque ? <span>· Cheque {c.cheque}</span> : null}
          </span>
          {c.original ? (
            <span className="mt-1">
              <OriginalDoc original={c.original} />
            </span>
          ) : null}
        </div>
        <nav aria-label="Cases in this batch" className="flex flex-wrap items-center gap-2">
          {prev ? (
            <Button asChild variant="outline">
              <Link href={sameStep(prev)}>
                <ChevronLeftIcon data-icon="inline-start" aria-hidden />
                Previous
              </Link>
            </Button>
          ) : null}
          {next ? (
            <Button asChild variant="outline">
              <Link href={sameStep(next)}>
                Next
                <ChevronRightIcon data-icon="inline-end" aria-hidden />
              </Link>
            </Button>
          ) : null}
          {toFix ? (
            <Button asChild variant="outline">
              <Link href={caseFlowHref(batchId, toFix, firstFlaggedStep(toFix.flags), aiParam)}>
                Next case to fix
                <ChevronRightIcon data-icon="inline-end" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </nav>
      </div>

      {editable(c) ? (
        <div className="flex flex-col gap-3 border-t border-hairline px-4 py-3">
          {here.length ? (
            <>
              <h2 className="text-body-compact font-semibold">
                To {verb(here)} in {courtText(step ? getStep(step).title : "this section")}
              </h2>
              <ul className="flex flex-col gap-3">
                {here.map((f) => (
                  <FlagRow key={f.id} f={f} caseId={c.id} busy={busy} act={act} />
                ))}
              </ul>
            </>
          ) : c.flags.length ? (
            <p className="flex items-center gap-2 text-body-compact text-muted-foreground">
              <CheckIcon aria-hidden className="size-4 text-success-ink" />
              Nothing to fix or check in this section.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-body-compact text-muted-foreground">
              <CheckIcon aria-hidden className="size-4 text-success-ink" />
              Nothing to fix or check in this case.
            </p>
          )}
          {elsewhere.length ? (
            <p className="flex flex-wrap items-center gap-x-1 text-body-compact text-muted-foreground">
              <span>
                {here.length ? "Also" : "Still"} to {verb(later)}:
              </span>
              {elsewhere.map(({ s, n }, i) => (
                <span key={s} className="tabular-nums">
                  <Link href={caseFlowHref(batchId, c, s, aiParam)} className="font-medium text-foreground underline">
                    {courtText(getStep(s).title)}
                  </Link>{" "}
                  ({n}){i < elsewhere.length - 1 ? "," : ""}
                </span>
              ))}
            </p>
          ) : null}
          {problem ? (
            <Alert variant="destructive">
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
          ) : null}
          {/* Demo: fills every date (consistent, filable today) and every empty required field. */}
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={busy}
            onClick={() => update(demoFill)}
          >
            <WandSparklesIcon data-icon="inline-start" aria-hidden />
            Fill with demo values
          </Button>
        </div>
      ) : null}
    </Card>,
  );
}

/** One open check: what is wrong, and what can be done about it from here. */
function FlagRow({
  f,
  caseId,
  busy,
  act,
}: {
  f: Flag;
  caseId: string;
  busy: boolean;
  act: (body: Record<string, unknown>, batchWide?: boolean) => Promise<void>;
}) {
  const fix = f.fix;
  const valueFix = fix && (fix.kind === "text" || fix.kind === "date" || fix.kind === "select") ? fix : null;
  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <div className="min-w-0 flex-1">
          <FlagLine flag={f} />
        </div>
        {fix?.kind === "declare-no-contact" ? (
          <Button
            variant="outline"
            className="ml-8 w-fit shrink-0 sm:ml-0"
            disabled={busy}
            onClick={() => void act({ action: "declare-no-contact", caseId, accusedId: fix.accusedId })}
          >
            Declare neither is known
          </Button>
        ) : null}
        {f.level === "soft" ? (
          <Button
            variant="ghost"
            className="ml-8 w-fit shrink-0 sm:ml-0"
            disabled={busy}
            onClick={() => void act({ action: "skip", caseId, flagId: f.id })}
          >
            Skip
          </Button>
        ) : null}
      </div>
      {/* What the batch owns is locked in the case, so it is fixed here, once, for every case. */}
      {f.batchWide && valueFix ? (
        <BatchFix
          key={f.id}
          fix={valueFix}
          busy={busy}
          onApply={(value) =>
            act({ action: "fix", caseId, path: valueFix.path, value, everyCase: true }, true)
          }
        />
      ) : null}
    </li>
  );
}

type ValueFix = Extract<FlagFix, { kind: "text" | "date" | "select" }>;

function BatchFix({
  fix,
  busy,
  onApply,
}: {
  fix: ValueFix;
  busy: boolean;
  onApply: (value: string) => Promise<void>;
}) {
  const id = React.useId();
  const [value, setValue] = React.useState(fix.value ?? "");
  return (
    <div className="ml-8 flex max-w-md flex-col gap-2">
      <Field className="gap-1.5">
        <FieldLabel htmlFor={id} className="text-body-compact">
          {fix.label}
        </FieldLabel>
        {fix.kind === "select" ? (
          <NativeSelect id={id} value={value} onChange={(e) => setValue(e.target.value)} className="w-full">
            <NativeSelectOption value="">Select</NativeSelectOption>
            {fix.options.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          <Input
            id={id}
            type={fix.kind === "date" ? "date" : "text"}
            inputMode={fix.kind === "text" ? fix.inputMode : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        <FieldDescription>Applies to every case in the batch that is not signed yet.</FieldDescription>
      </Field>
      <Button
        variant="outline"
        className="w-fit"
        disabled={busy || !value.trim()}
        onClick={() => void onApply(value)}
      >
        Apply to every case
      </Button>
    </div>
  );
}
