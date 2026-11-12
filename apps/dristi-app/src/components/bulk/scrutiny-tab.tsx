"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  CircleAlertIcon,
  EllipsisVerticalIcon,
  OctagonAlertIcon,
  Trash2Icon,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
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
import { caseState, detailFlags, isOpen } from "./batch-marks";
import type { BatchCtx } from "./batch-screen";
import { CaseSearch, Pager, caseMatches, pageOf } from "./case-list-tools";
import { FilterPills } from "./filter-pills";
import { StatusWord, shortReason } from "./stage";
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
    name: "To fix",
  },
  check: {
    Icon: CircleAlertIcon,
    disc: "bg-warning-muted text-warning-muted-foreground",
    ink: "text-warning-ink",
    ring: "border-warning-ink bg-warning-muted",
    name: "To check",
  },
};

/**
 * One flag, as a line: a tinted mark for its kind, what is wrong, and where. Inside the
 * section it is about, `where` is left off: a chip naming the page you are on is noise
 * (round 3).
 */
export function FlagLine({ flag, where = true }: { flag: Flag; where?: boolean }) {
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
        {flag.message}
        {where ? (
          <>
            {" "}
            <Badge variant="outline" className="ml-1 align-middle text-body-compact font-normal text-muted-foreground">
              {flag.where}
            </Badge>
          </>
        ) : null}
      </span>
    </div>
  );
}

/** To fix first, then to check, then the cases whose details are done. */
const rankOf = (c: CaseView) => {
  const s = caseState(c);
  return s === "fix" ? 0 : s === "check" ? 1 : 2;
};

type Show = "fix" | "check" | "all";

/**
 * A case's one status here: red To fix or amber To check with its first reason. A case
 * whose details are done shows nothing: nothing on it needs the filer (owner, 2026-11-12).
 * Documents are the Documents step's, never said here.
 */
function ToFix({ c }: { c: CaseView }) {
  const rank = rankOf(c);
  if (rank === 2) return null;
  // How many, not which: a list of field names does not scale (owner, 2026-11-12). The
  // case itself says which, at the first one.
  const f = detailFlags(c);
  const n = rank === 0 ? f.filter((x) => x.level === "hold").length : f.length;
  // "Field", not "error" (developer language); "warning" is the PRD's own word (BLK-12).
  const what = rank === 0 ? (n === 1 ? "1 field" : `${n} fields`) : n === 1 ? "1 warning" : `${n} warnings`;
  return <StatusWord state={rank === 0 ? "fix" : "check"} reason={what} />;
}

/**
 * A case's details flags as one line: the first thing to fix (or check), and how many
 * more. Shared with the upload's Check, so a case reads the same before and after it is
 * created (owner, 2026-11-10: Check said "Nothing missing", Case details then said 2 to fix).
 */
export function FlagSummary({ flags: f, done = "Details done" }: { flags: Flag[]; done?: string }) {
  const holds = f.filter((x) => x.level === "hold");
  const first = holds[0] ?? f[0];
  if (!first) return <StatusWord state="complete" word={done} />;
  const hold = first.level === "hold";
  const n = hold ? holds.length : f.length;
  return <StatusWord state={hold ? "fix" : "check"} reason={shortReason(first.message)} more={n - 1} />;
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
  const router = useRouter();
  const ai = params.get("ai");
  // The case the filer came back from, marked so they can find their place.
  const last = params.get("case");

  const open = batch.cases.filter(isOpen);
  const fixing = open.filter((c) => rankOf(c) === 0);
  const checking = open.filter((c) => rankOf(c) === 1);
  const [show, setShow] = React.useState<Show>(fixing.length ? "fix" : "all");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [removing, setRemoving] = React.useState<CaseView | null>(null);

  const term = search.trim().toLowerCase();
  const inShow = { fix: fixing, check: checking, all: open }[show];
  const listed = [...inShow].sort((a, b) => rankOf(a) - rankOf(b)).filter((c) => caseMatches(c, term));
  const { pages, at, shown } = pageOf(listed, page);

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
        <FilterPills
          value={show}
          onChange={(v) => {
            setShow(v as Show);
            setPage(0);
          }}
          total={open.length}
          filters={[
            { id: "fix", label: "To fix", count: fixing.length },
            { id: "check", label: "To check", count: checking.length },
          ]}
        />
        <CaseSearch
          id="details-search"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(0);
          }}
        />
      </div>

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      <Card variant="raised" className="gap-0 p-2">
        {shown.length === 0 ? (
          <p className="flex flex-wrap items-center gap-x-2 p-4 text-body-compact text-muted-foreground">
            {term ? `No case matches “${search.trim()}”.` : show === "fix" ? "Nothing left to fix." : show === "check" ? "Nothing left to check." : "No case here."}
            {!term && show !== "all" ? (
              <Button variant="link" className="h-auto p-0 text-body-compact" onClick={() => setShow("all")}>
                Show all {open.length}
              </Button>
            ) : null}
          </p>
        ) : (
          <>
            {/* A table from md up; on a phone each case is a stacked row. */}
            <div className="hidden overflow-x-auto md:block">
              <Table className="border-separate border-spacing-0" aria-label="Cases">
                <TableHeader>
                  <TableRow className={TABLE_HEAD_ROW}>
                    <TableHead className={cn(TABLE_HEAD, "w-full")}>Accused</TableHead>
                    <TableHead className={TABLE_HEAD}>Status</TableHead>
                    <TableHead className={cn(TABLE_HEAD, "w-28")}>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={tableBodyClass({ marksOpenRow: true })}>
                  {shown.map((c) => {
                    const href = caseFlowHref(batch.id, c, undefined, ai);
                    return (
                      <TableRow
                        key={c.id}
                        className={cn(tableRowClass({ open: c.id === last }), "cursor-pointer")}
                        aria-current={c.id === last ? "true" : undefined}
                        // The whole row opens the case; the name stays the keyboard's link.
                        onClick={() => router.push(href)}
                      >
                        <TableCell className={cn(TABLE_CELL, "max-w-0")}>
                          {/* The row's fill is the hover; the name stays the keyboard's link. */}
                          <Link
                            href={href}
                            title={c.accused || c.title}
                            className="block truncate font-medium outline-none focus-visible:underline"
                          >
                            {c.accused || c.title}
                          </Link>
                          {/* The filer's own reference, to find the case by (BLK-07): a quiet
                              fact under the name, as on a phone, not a column of its own. */}
                          <span className="block truncate text-body-compact text-muted-foreground tabular-nums">
                            <span className="font-mono">{c.reference}</span>
                            {c.amount ? ` · ${money(c.amount)}` : ""}
                          </span>
                        </TableCell>
                        <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>
                          <ToFix c={c} />
                        </TableCell>
                        <TableCell className={TABLE_CELL}>
                          <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {rankOf(c) < 2 ? (
                              <Button asChild variant="ghost" size="sm" className="text-body-compact">
                                <Link href={href}>{rankOf(c) === 0 ? "Fix" : "Check"}</Link>
                              </Button>
                            ) : null}
                            {!closed ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-muted-foreground"
                                    aria-label={`More for ${c.title}`}
                                    disabled={busy}
                                  >
                                    <EllipsisVerticalIcon aria-hidden />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(c)}>
                                    <Trash2Icon aria-hidden />
                                    Remove {c.title} from this batch
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Phone: the case is the link, Fix is the visible action, and Remove waits in a
                menu so the destructive action is never the most prominent (round 3). */}
            <ul className="flex flex-col divide-y divide-hairline md:hidden">
              {shown.map((c) => {
                const href = caseFlowHref(batch.id, c, undefined, ai);
                return (
                  <li key={c.id} className="flex flex-col gap-2 px-2 py-3" aria-current={c.id === last ? "true" : undefined}>
                    <Link href={href} className="flex min-w-0 flex-col gap-1 rounded-lg focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none">
                      <span className="text-body-compact font-medium">{c.accused || c.title}</span>
                      <span className="text-body-compact text-muted-foreground">
                        <span className="font-mono">{c.reference}</span>
                        {c.amount ? <span className="tabular-nums"> · {money(c.amount)}</span> : null}
                      </span>
                      <span className="text-body-compact">
                        <ToFix c={c} />
                      </span>
                    </Link>
                    <span className="flex items-center gap-2">
                      {rankOf(c) < 2 ? (
                        <Button asChild variant="secondary" className="flex-1">
                          <Link href={href}>{rankOf(c) === 0 ? "Fix" : "Check"}</Link>
                        </Button>
                      ) : (
                        <span className="flex-1" />
                      )}
                      {!closed ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`More for ${c.title}`} disabled={busy}>
                              <EllipsisVerticalIcon aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem variant="destructive" onSelect={() => setRemoving(c)}>
                              <Trash2Icon aria-hidden />
                              Remove from this batch
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <Pager total={listed.length} at={at} pages={pages} onPage={setPage} />
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
          stackExtra
          extra={
            firstToFix && open.length > fixing.length ? (
              <Button variant="outline" size="lg" onClick={() => go("documents")}>
                Continue with {open.length - fixing.length} {open.length - fixing.length === 1 ? "case" : "cases"}
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
