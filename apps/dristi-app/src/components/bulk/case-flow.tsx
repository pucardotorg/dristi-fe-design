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
 *   · The batch's checks sit on the fields they are about and on the rail's rows; a short
 *     card under the section's title lists what is open in it, with Skip where a check
 *     allows it, and offers a shared gap filled here to every other case that has it.
 *   · The way out is the breadcrumb (… › Case details › the case), as everywhere else in
 *     the product: no "All cases" link, no footer Back, and the batch's step row stands
 *     down while a case is open (owner, 2026-11-12). A slim strip says where the case
 *     sits in its queue and moves to the cases either side; the footer goes on to the
 *     next section or case with something open.
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
import { cn } from "@/lib/utils";
import { BULK_CASE_SAVED, BulkCaseRepository } from "@/lib/bulk/case-repository";
import { BULK_CASE_STEPS, firstFlaggedStep, flagPlace } from "@/lib/bulk/flag-place";
import type { Flag, FlagFix } from "@/lib/bulk/scrutiny";
import { draftTitle } from "@/lib/filing/selectors";
import { getStep, stepFromPathname } from "@/lib/filing/steps";
import { FilingProvider, useFiling } from "@/lib/filing/store";
import type { StepId } from "@/lib/filing/types";
import { useCourt, useCourtText } from "@/components/court/court-provider";
import { BatchBreadcrumbLabel, DraftBreadcrumbLabel, TOP_BAR_HEIGHT } from "@/components/filing/chrome";
import { FieldPolicyProvider, type FieldPolicy } from "@/components/filing/field-policy";
import { FilingShell } from "@/components/filing/filing-shell";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

import { bulkApi, caseFlowHref, setBulkAiMode, type BatchView, type CaseView } from "./api";
import { useGujarat } from "./court-guard";
import { demoFill } from "./demo-fill";
import { useDemoTools } from "./demo-tools";
import { caseState, detailFlags } from "./batch-marks";
import { OriginalDoc } from "./original-doc";
import { StatusLine } from "@/components/feedback";

/** Where the batch is, on one of its tabs. */
function batchHref(batchId: string, tab: string, ai: string | null, caseId?: string): string {
  const q = new URLSearchParams({ tab });
  if (caseId) q.set("case", caseId);
  if (ai) q.set("ai", ai);
  return `/filings/bulk/${encodeURIComponent(batchId)}?${q}`;
}


const editable = (c: CaseView) => c.stage === "held" || c.stage === "ready";

/**
 * The next case, after this one and round to the start, in Case details' own queues: one
 * to fix, else one to check. Missing documents are the Documents step's, not a fix here.
 */
function nextToFix(cases: CaseView[], at: number): { c: CaseView; verb: "fix" | "check" } | null {
  const around = [...cases.slice(at + 1), ...cases.slice(0, at)];
  const fix = around.find((x) => caseState(x) === "fix");
  if (fix) return { c: fix, verb: "fix" };
  const check = around.find((x) => caseState(x) === "check");
  return check ? { c: check, verb: "check" } : null;
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
    // The case's details only: its files are added at the batch's Documents step (round 3:
    // a missing file blocked Continue here, though Documents comes after Case details).
    const flags = editable(c) ? detailFlags(c) : [];
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
    const left = cases.filter((x) => x.id !== c.id && (caseState(x) === "fix" || caseState(x) === "check")).length;
    const status = (
      <span className="inline-flex items-center gap-2 text-body-compact text-success-ink">
        <CheckIcon className="size-4" aria-hidden />
        {editable(c) ? "Details done" : "Nothing to change here"}
        {left ? (
          <span className="text-muted-foreground tabular-nums max-sm:hidden">
            · {left} more {left === 1 ? "case needs" : "cases need"} you
          </span>
        ) : null}
      </span>
    );
    return toFix
      ? {
          label: `Next case to ${toFix.verb}`,
          href: caseFlowHref(batchId, toFix.c, firstFlaggedStep(detailFlags(toFix.c)), aiParam),
          status,
        }
      : { label: "Back to all cases", href: batchHref(batchId, "scrutiny", aiParam, c.id), status };
  }, [batch, c, step, batchId, aiParam, courtText]);

  const policy = React.useMemo<FieldPolicy>(() => {
    const flags = c ? detailFlags(c) : [];
    const here = flags
      .map((f) => ({ f, at: flagPlace(f) }))
      .filter(({ at }) => at.step === step);
    return {
      step,
      // One frame for every section of the case: the source opens when asked for (round 3).
      sourcesOnDemand: true,
      partyInPerson: false,
      guideMissing: true,
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
      noBack: true,
      // What is open in this section sits under its title, above the form it is about.
      underTitle:
        batch && c ? (
          <FixList
            batchId={batchId}
            batch={batch}
            c={c}
            step={step}
            setBatch={setBatch}
            onBatchFixed={() => setGeneration((g) => g + 1)}
          />
        ) : null,
    };
  }, [c, step, closed, next, batch, batchId]);

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
      {batch ? <BatchBreadcrumbLabel number={batch.number} id={batch.id} /> : null}
      <FieldPolicyProvider value={policy}>
        <FilingShell
          banner={
            <CaseBar batchId={batchId} batch={batch} c={c} step={step} aiParam={aiParam} error={error} />
          }
        >
          {/* A case arriving fades in, so moving to the next one reads as a change of case
              rather than a reload. Opacity only: a transform would unpin the footer. */}
          <div key={caseId} className="flex min-w-0 flex-1 flex-col animate-in fade-in-0 duration-300 motion-reduce:animate-none">
            {children}
          </div>
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

/* ───────────────────────────── The strip ───────────────────────────── */

/**
 * Where this case sits in its queue, pinned under the top bar: "Case 1 of 2 to fix", the
 * filer's reference, and the cases either side. The case itself is named in the
 * breadcrumb and the way back is the breadcrumb's "Case details", so neither is repeated
 * here. A bar across the page, not a card in it, so the section's title stays first.
 */
function CaseBar({
  batchId,
  batch,
  c,
  step,
  aiParam,
  error,
}: {
  batchId: string;
  batch: BatchView | null;
  c: CaseView | null;
  step: StepId | null;
  aiParam: string | null;
  error: string | null;
}) {
  const demo = useDemoTools();
  const { update } = useFiling();

  // The page's gutter, which narrows when the source rail docks beside the form.
  const gutter = "px-6 lg:px-12 lg:[main:has([data-source-open])_&]:px-6";
  const strip = (body: React.ReactNode) => (
    <div
      className={cn("sticky z-20 flex min-h-14 items-center border-b border-hairline bg-card py-2", gutter)}
      style={{ top: TOP_BAR_HEIGHT }}
    >
      {body}
    </div>
  );

  if (error && !batch)
    return strip(
      /* Already true when the page opened: it stands still. */
      <StatusLine tone="error" still className="w-full">
        {error}
      </StatusLine>,
    );
  if (!batch || !c) return strip(<Skeleton className="h-6 w-full max-w-xs rounded-md" />);

  // Counted and walked in the queue the list calls "To fix" (v8: "Case 1 of 19 to fix"); a
  // case outside it is counted in the batch, and the arrows walk the batch.
  const cases = batch.cases;
  const queue = cases.filter((x) => caseState(x) === "fix");
  const queueAt = queue.findIndex((x) => x.id === c.id);
  const walk = queueAt >= 0 ? queue : cases;
  const at = walk.findIndex((x) => x.id === c.id);
  const prev = walk[at - 1] ?? null;
  const next = walk[at + 1] ?? null;
  const inQueue = queueAt >= 0;
  // A case with something open opens where it is (as from the list); one without, at the
  // section on screen, so walking the batch keeps your place.
  const sameStep = (x: CaseView) => {
    const open = editable(x) ? detailFlags(x) : [];
    return caseFlowHref(
      batchId,
      x,
      open.length ? firstFlaggedStep(open) : step && BULK_CASE_STEPS.includes(step) ? step : undefined,
      aiParam,
    );
  };

  const move = (x: CaseView | null, label: string, icon: React.ReactNode) =>
    x ? (
      <Button asChild variant="ghost" size="icon-sm" aria-label={`${label}: ${x.title}`} title={x.title}>
        <Link href={sameStep(x)}>{icon}</Link>
      </Button>
    ) : (
      <Button variant="ghost" size="icon-sm" aria-label={label} disabled>
        {icon}
      </Button>
    );

  return strip(
    <div className="flex w-full items-center gap-4">
      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-body-compact tabular-nums">
        <span className="font-medium">
          {inQueue ? `Case ${queueAt + 1} of ${queue.length} to fix` : `Case ${at + 1} of ${cases.length}`}
        </span>
        <span aria-hidden className="text-muted-foreground max-sm:hidden">
          ·
        </span>
        <span className="font-mono text-muted-foreground max-sm:hidden">{c.reference}</span>
        {c.original ? (
          <span className="max-sm:hidden">
            <OriginalDoc original={c.original} />
          </span>
        ) : null}
      </p>
      {demo && editable(c) ? (
        <Button variant="ghost" size="sm" className="max-sm:hidden" onClick={() => update(demoFill)}>
          <WandSparklesIcon data-icon="inline-start" aria-hidden />
          Demo values
        </Button>
      ) : null}
      <nav aria-label="Cases in this batch" className="flex shrink-0 items-center gap-1">
        {move(prev, inQueue ? "Previous case to fix" : "Previous case", <ChevronLeftIcon aria-hidden />)}
        {move(next, inQueue ? "Next case to fix" : "Next case", <ChevronRightIcon aria-hidden />)}
      </nav>
    </div>,
  );
}

/* ───────────────────────────── What to fix here ───────────────────────────── */

type ValueFix = Extract<FlagFix, { kind: "text" | "date" | "select" }>;

const valueFixOf = (f: Flag): ValueFix | null =>
  f.fix && (f.fix.kind === "text" || f.fix.kind === "date" || f.fix.kind === "select") ? f.fix : null;

/** The value at a draft path such as `advocates.0.barNumber`. */
function valueAt(draft: unknown, path: string): string {
  const v = path
    .split(".")
    .reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), draft);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Under the section's title: what is open in this section, in one short card. The fields
 * themselves carry the fixes, so nothing here repeats a field (bulk audit: the advocate was
 * asked for twice on one screen, with two different controls). What it adds is the batch:
 * once a gap the batch shares is filled here, the same value can go on every other case
 * that has it, in one press.
 */
function FixList({
  batchId,
  batch,
  c,
  step,
  setBatch,
  onBatchFixed,
}: {
  batchId: string;
  batch: BatchView;
  c: CaseView;
  step: StepId | null;
  setBatch: (b: BatchView) => void;
  onBatchFixed: () => void;
}) {
  const { flush, draft } = useFiling();
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);

  if (!editable(c)) return null;

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

  const details = detailFlags(c);
  const here = details.filter((f) => f.section === step);

  // The batch's shared gaps in this section, and how many other open cases still have each.
  const shared = new Map<string, { fix: ValueFix; n: number }>();
  for (const x of batch.cases) {
    if (x.id === c.id || !editable(x)) continue;
    for (const f of x.flags) {
      const fix = valueFixOf(f);
      if (!f.batchWide || !fix || f.section !== step) continue;
      const seen = shared.get(fix.path);
      if (seen) seen.n += 1;
      else shared.set(fix.path, { fix, n: 1 });
    }
  }
  const stillHere = (path: string) => here.some((f) => valueFixOf(f)?.path === path);
  const offers = [...shared.values()]
    .map(({ fix, n }) => {
      const value = valueAt(draft, fix.path);
      const shown =
        fix.kind === "select"
          ? (fix.options.find((o) => o.value.toUpperCase() === value.toUpperCase())?.label ?? value)
          : value;
      return { fix, n, value, shown };
    })
    .filter((o) => o.value && !stillHere(o.fix.path));

  if (!here.length && !offers.length) return null;

  const others = (n: number) => `${n} other ${n === 1 ? "case" : "cases"}`;

  // What is open here, as the product's one inline note, one per thing: red to fix, amber
  // to check, with what can be done from here as the note's action. Other sections say
  // their own on the rail and in the footer's "Next to fix", so they are not listed here.
  return (
    <div className="flex flex-col gap-2">
      {here.map((f, i) => {
        const path = valueFixOf(f)?.path;
        const n = f.batchWide && path ? (shared.get(path)?.n ?? 0) : 0;
        return (
          <StatusLine
            key={f.id}
            tone={f.level === "hold" ? "error" : "warning"}
            still={i > 0}
            action={<FlagAction f={f} caseId={c.id} busy={busy} act={act} />}
          >
            {f.message}
            {n ? (
              <span className="block font-normal text-muted-foreground">
                Fill it in below; then you can use it for the {others(n)} missing it too.
              </span>
            ) : null}
          </StatusLine>
        );
      })}
      {offers.map((o) => (
        <StatusLine
          key={o.fix.path}
          tone="info"
          action={
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void act({ action: "fix", caseId: c.id, path: o.fix.path, value: o.value, everyCase: true }, true)
              }
            >
              {o.n === 1 ? "Use on it" : `Use on all ${o.n}`}
            </Button>
          }
        >
          <span className="tabular-nums">{others(o.n)}</span> {o.n === 1 ? "is" : "are"} missing the{" "}
          {o.fix.label.toLowerCase()}. Use {o.shown} on {o.n === 1 ? "it" : "them"} too?
        </StatusLine>
      ))}
      {problem ? <StatusLine tone="error">{problem}</StatusLine> : null}
    </div>
  );
}

/** What can be done about one open check from here, if anything: skip it, or declare. */
function FlagAction({
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
  if (fix?.kind === "declare-no-contact")
    return (
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => void act({ action: "declare-no-contact", caseId, accusedId: fix.accusedId })}
      >
        Declare neither is known
      </Button>
    );
  if (f.level === "soft")
    return (
      <Button variant="ghost" disabled={busy} onClick={() => void act({ action: "skip", caseId, flagId: f.id })}>
        {f.rule === "dcm-poor" ? "Keep this file" : "Skip this check"}
      </Button>
    );
  return null;
}
