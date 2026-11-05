"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleXIcon,
  OctagonAlertIcon,
  SearchIcon,
  Trash2Icon,
  TriangleAlertIcon,
  Undo2Icon,
  WandSparklesIcon,
} from "lucide-react";

import type { Flag } from "@/lib/bulk/scrutiny";
import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { FilingFooter } from "@/components/filing/filing-footer";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";

import { bulkApi, caseFlowHref, type CaseView } from "./api";
import { BatchFooter } from "./batch-footer";
import type { BatchCtx } from "./batch-screen";
import { StatusLine } from "@/components/feedback";

type Kind = "hold" | "check";
const kindOf = (f: Flag): Kind =>
  f.level === "hold" ? "hold" : "check";

/** Glyph, tint and name per kind. Colour is never alone: the glyph and the words differ too. */
const KIND: Record<
  Kind,
  {
    Icon: typeof OctagonAlertIcon;
    disc: string;
    ink: string;
    ring: string;
    name: string;
  }
> = {
  hold: {
    Icon: OctagonAlertIcon,
    disc: "bg-destructive-muted text-destructive-muted-foreground",
    ink: "text-destructive-ink",
    ring: "border-destructive-ink",
    name: "Needs fixing",
  },
  check: {
    Icon: CircleAlertIcon,
    disc: "bg-warning-muted text-warning-muted-foreground",
    ink: "text-warning-ink",
    ring: "border-warning-ink bg-warning-muted",
    name: "To check",
  },
};

/** One flag, as a line: a tinted mark for its kind, what is wrong, and where. */
export function FlagLine({ flag }: { flag: Flag }) {
  const k = KIND[kindOf(flag)];
  return (
    <div className="flex items-start gap-2 text-body-compact">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          k.disc,
        )}
        title={k.name}
      >
        <k.Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="sr-only">{k.name}: </span>
        {flag.message}{" "}
        <Badge
          variant="outline"
          className="ml-1 align-middle font-normal text-muted-foreground"
        >
          {flag.where}
        </Badge>
      </span>
    </div>
  );
}

/** A case's flags about its details; missing documents are shown on the Documents tab. */
export const detailFlags = (c: CaseView) =>
  c.flags.filter(
    (f) =>
      f.section !== "documents" &&
      f.fix?.kind !== "upload" &&
      f.fix?.kind !== "documents",
  );

/** Fixing first, then checking, then ready. */
const rankOf = (c: CaseView) => {
  const f = detailFlags(c);
  return f.some((x) => x.level === "hold") ? 0 : f.length ? 1 : 2;
};


type Show = "fix" | "check" | "ready" | "all";
const PAGE = 25;

/** What a case still needs, in one line: the first thing to fix, or to check, or nothing. */
function ToFix({ c }: { c: CaseView }) {
  const f = detailFlags(c);
  const holds = f.filter((x) => x.level === "hold");
  const first = holds[0] ?? f[0];
  if (!first)
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <CheckIcon aria-hidden className="size-4 text-success" />
        Complete
      </span>
    );
  const hold = first.level === "hold";
  const Icon = hold ? CircleXIcon : TriangleAlertIcon;
  return (
    <span className="inline-flex min-w-0 items-start gap-1.5">
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", hold ? "text-destructive" : "text-warning-ink")} />
      <span className="min-w-0">
        <span className="sr-only">{hold ? "To fix: " : "To check: "}</span>
        {first.where}: {first.message}
        {f.length > 1 ? <span className="text-muted-foreground tabular-nums"> (and {f.length - 1} more)</span> : null}
      </span>
    </span>
  );
}

/**
 * A gap the batch shares (its advocate), fixed once for every case that has it. Main's
 * "Apply to every case", lifted to the list the way v8 lifted its batch fix ("Find for all").
 */
function SharedFix({
  label,
  options,
  path,
  cases,
  busy,
  onApply,
}: {
  label: string;
  options: { value: string; label: string }[];
  path: string;
  cases: CaseView[];
  busy: boolean;
  onApply: (caseId: string, path: string, value: string) => void;
}) {
  const id = React.useId();
  const [value, setValue] = React.useState("");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-card px-6 py-4 shadow-raised">
      <WandSparklesIcon aria-hidden className="size-5 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 basis-64 flex-col">
        <span className="text-body-compact font-medium tabular-nums">
          {cases.length} cases have no {label.toLowerCase()}
        </span>
        <span className="text-body-compact text-muted-foreground">Choose it once and it goes on all of them.</span>
      </div>
      <div className="w-full sm:w-72">
        <Label htmlFor={id} className="sr-only">
          {label} for all {cases.length}
        </Label>
        <NativeSelect id={id} value={value} onChange={(e) => setValue(e.target.value)} className="w-full">
          <NativeSelectOption value="">Choose</NativeSelectOption>
          {options.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <Button variant="outline" disabled={busy || !value} onClick={() => onApply(cases[0].id, path, value)}>
        Use for all {cases.length}
      </Button>
    </div>
  );
}

/**
 * Case details: the batch's open cases as v8 lists them. The list starts on the cases to
 * fix, can be searched by accused, reference or cheque, and is read 25 at a time. A case
 * opens in the single filing's own sections (`case-flow.tsx`), at the first section with
 * something to fix. The footer's primary is the work itself ("Fix the first case"), with
 * "Continue with N complete" beside it, so cases still to fix never hold the rest up.
 */
export function ScrutinyTab({ batch, setBatch, go }: BatchCtx) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const closed = !!batch.clubbedInto;
  const params = useSearchParams();
  const ai = params.get("ai");
  // The case the filer came back from, marked so they can find their place.
  const last = params.get("case");

  const open = batch.cases.filter((c) => c.stage === "held" || c.stage === "ready");
  const fixing = open.filter((c) => rankOf(c) === 0);
  const checking = open.filter((c) => rankOf(c) === 1);
  const complete = open.filter((c) => rankOf(c) === 2);
  const [show, setShow] = React.useState<Show>(fixing.length ? "fix" : "all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [removing, setRemoving] = React.useState<CaseView | null>(null);

  const term = search.trim().toLowerCase();
  const inShow = { fix: fixing, check: checking, ready: complete, all: open }[show];
  const listed = [...inShow]
    .sort((a, b) => rankOf(a) - rankOf(b))
    .filter((c) => !term || [c.accused, c.title, c.reference, c.cheque].some((v) => v.toLowerCase().includes(term)));
  const pages = Math.max(1, Math.ceil(listed.length / PAGE));
  const at = Math.min(page, pages - 1);
  const shown = listed.slice(at * PAGE, (at + 1) * PAGE);

  // Shared gaps the batch can fix once: a batch-wide value fix on more than one case.
  const shared = new Map<string, { label: string; options: { value: string; label: string }[]; cases: CaseView[] }>();
  for (const c of open)
    for (const f of c.flags) {
      if (!f.batchWide || f.fix?.kind !== "select") continue;
      const g = shared.get(f.fix.path) ?? { label: f.fix.label, options: f.fix.options, cases: [] };
      if (!g.cases.includes(c)) g.cases.push(c);
      shared.set(f.fix.path, g);
    }

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      setBatch(await bulkApi.act(batch.id, body));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const skipped = open.flatMap((c) => c.skipped.map((f) => ({ c, f })));

  if (!open.length)
    return (
      /* Nothing to do here is not news: neutral. */
      <StatusLine tone="neutral" still>
        Nothing open here.{" "}
        <button type="button" className="underline" onClick={() => go("sign")}>
          Go to Sign
        </button>
      </StatusLine>
    );

  const firstToFix = fixing[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      {[...shared.entries()]
        .filter(([, g]) => g.cases.length > 1 && !closed)
        .map(([path, g]) => (
          <SharedFix
            key={path}
            label={g.label}
            options={g.options}
            path={path}
            cases={g.cases}
            busy={busy}
            onApply={(caseId, p, value) => void act({ action: "fix", caseId, path: p, value, everyCase: true })}
          />
        ))}

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          type="single"
          value={show}
          onValueChange={(v) => {
            if (!v) return;
            setShow(v as Show);
            setPage(0);
          }}
          aria-label="Show cases"
          className="max-w-full overflow-x-auto"
        >
          <SegmentedControlItem value="fix">To fix {fixing.length}</SegmentedControlItem>
          <SegmentedControlItem value="check">To check {checking.length}</SegmentedControlItem>
          <SegmentedControlItem value="ready">Complete {complete.length}</SegmentedControlItem>
          <SegmentedControlItem value="all">All {open.length}</SegmentedControlItem>
        </SegmentedControl>
        <div className="w-full sm:ml-auto sm:w-72">
          <Label htmlFor="details-search" className="sr-only">
            Search cases
          </Label>
          <InputGroup>
            <InputGroupAddon>
              <SearchIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              id="details-search"
              type="search"
              autoComplete="off"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Accused, reference or cheque"
            />
          </InputGroup>
        </div>
      </div>

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      <Card variant="raised" className="gap-0 p-2">
        {shown.length === 0 ? (
          <p className="p-4 text-body-compact text-muted-foreground">
            {term ? `No case matches “${search.trim()}”.` : "No case here."}
          </p>
        ) : (
          <>
            {/* A table from md up; on a phone each case is a stacked row. */}
            <div className="hidden overflow-x-auto md:block">
              <Table className="border-separate border-spacing-0" aria-label="Cases">
                <TableHeader>
                  <TableRow className={TABLE_HEAD_ROW}>
                    <TableHead className={TABLE_HEAD}>Accused</TableHead>
                    <TableHead className={TABLE_HEAD}>Your reference</TableHead>
                    <TableHead className={TABLE_HEAD}>To fix</TableHead>
                    <TableHead className={TABLE_HEAD}>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={tableBodyClass()}>
                  {shown.map((c) => {
                    const href = caseFlowHref(batch.id, c, undefined, ai);
                    return (
                      <TableRow
                        key={c.id}
                        className={tableRowClass()}
                        aria-current={c.id === last ? "true" : undefined}
                      >
                        <TableCell className={TABLE_CELL}>
                          <Link href={href} className="font-medium hover:underline">
                            {c.accused || c.title}
                          </Link>
                          <span className="block text-body-compact text-muted-foreground tabular-nums">
                            {c.cheque ? `Cheque ${c.cheque}` : ""}
                            {c.amount ? ` · ${money(c.amount)}` : ""}
                          </span>
                        </TableCell>
                        <TableCell className={cn(TABLE_CELL, "tabular-nums")}>{c.reference}</TableCell>
                        <TableCell className={cn(TABLE_CELL, "w-full min-w-64 whitespace-normal")}>
                          <ToFix c={c} />
                        </TableCell>
                        <TableCell className={TABLE_CELL}>
                          <span className="flex justify-end gap-1">
                            <Button asChild variant="outline" size="sm">
                              <Link href={href}>{rankOf(c) === 2 ? "Open" : "Fix"}</Link>
                            </Button>
                            {!closed ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground"
                                aria-label={`Remove ${c.title} from this batch`}
                                title="Remove from this batch"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRemoving(c);
                                }}
                              >
                                <Trash2Icon aria-hidden />
                              </Button>
                            ) : null}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <ul className="flex flex-col divide-y divide-hairline md:hidden">
              {shown.map((c) => (
                <li key={c.id} className="flex items-start">
                  <Link
                    href={caseFlowHref(batch.id, c, undefined, ai)}
                    aria-current={c.id === last ? "true" : undefined}
                    className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg px-2 py-3 hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none aria-[current=true]:bg-accent"
                  >
                    <span className="text-body-compact font-medium">{c.accused || c.title}</span>
                    <span className="text-body-compact text-muted-foreground tabular-nums">
                      {c.reference}
                      {c.cheque ? ` · Cheque ${c.cheque}` : ""}
                    </span>
                    <span className="text-body-compact">
                      <ToFix c={c} />
                    </span>
                  </Link>
                  {!closed ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-1 shrink-0 text-muted-foreground"
                      aria-label={`Remove ${c.title} from this batch`}
                      disabled={busy}
                      onClick={() => setRemoving(c)}
                    >
                      <Trash2Icon aria-hidden />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
        {listed.length > PAGE ? (
          <div className="flex items-center justify-between gap-3 px-2 pt-3 pb-1 text-body-compact text-muted-foreground">
            <span className="tabular-nums">
              {at * PAGE + 1}–{Math.min(listed.length, (at + 1) * PAGE)} of {listed.length}
            </span>
            <span className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={at === 0} onClick={() => setPage(at - 1)}>
                <ChevronLeftIcon aria-hidden />
              </Button>
              <span className="tabular-nums">
                Page {at + 1} of {pages}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>
                <ChevronRightIcon aria-hidden />
              </Button>
            </span>
          </div>
        ) : null}
      </Card>

      {skipped.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-body font-semibold">Skipped checks</h3>
          <Card variant="raised" className="gap-0 px-4 py-1">
            <ul className="flex flex-col divide-y divide-hairline">
              {skipped.map(({ c, f }) => (
                <li key={`${c.id}-${f.id}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <span className="text-body-compact font-medium">{c.title}</span>
                    <FlagLine flag={f} />
                  </div>
                  <Button
                    variant="ghost"
                    disabled={busy || closed}
                    onClick={() => void act({ action: "unskip", caseId: c.id, flagId: f.id })}
                  >
                    <Undo2Icon data-icon="inline-start" aria-hidden />
                    Undo skip
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => {
          if (!o) setRemoving(null);
        }}
        title="Remove this case from the batch?"
        description={removing ? `${removing.title} · ${removing.reference} won't be filed with this batch.` : undefined}
        confirmLabel="Remove"
        cancelLabel="Back"
        onConfirm={() => {
          if (removing) void act({ action: "remove", caseId: removing.id });
          setRemoving(null);
        }}
      />

      <BatchFooter>
        <FilingFooter
          showSaveState={false}
          onBack={() => go("cases")}
          // The work first; the cases already complete go on without waiting for it (v8).
          extra={
            firstToFix ? (
              <Button variant="outline" size="lg" onClick={() => go("documents")}>
                Continue with {open.length - fixing.length} complete
                <ArrowRightIcon data-icon="inline-end" aria-hidden />
              </Button>
            ) : null
          }
          continueLabel={firstToFix ? "Fix the first case" : "Continue to documents"}
          continueHref={firstToFix ? caseFlowHref(batch.id, firstToFix, undefined, ai) : undefined}
          onContinue={firstToFix ? undefined : () => go("documents")}
        />
      </BatchFooter>
    </div>
  );
}
