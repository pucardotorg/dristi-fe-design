"use client";

/**
 * Bulk filing: the batches, each one's steps as columns (owner, 2026-11-17: the list with
 * a bar and legend per batch "looks horribly bad", and one next act per row then made every
 * batch look the same, filed or not).
 *
 *  · Fix & check · Add documents · Sign · Pay count the cases waiting at each step, each a
 *    link to that step; Filed shows how many of the batch, with a thin bar, so a finished
 *    batch reads as done at a glance. Red only for to fix, green only for filed.
 *  · Opens on Needs you, soonest File by first, since a missed limitation date is the
 *    costly mistake. Uploads not created yet have their own filter and one sentence.
 *  · The Complainant column shows only when batches are for more than one complainant.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleCheckIcon, DownloadIcon, EllipsisIcon, Layers2Icon, Trash2Icon, UploadIcon } from "lucide-react";

import { buildTemplate, TEMPLATE_FILE } from "@/lib/bulk/excel";
import { cn } from "@/lib/utils";
import { TABLE_CELL, TABLE_HEAD, TABLE_HEAD_ROW, tableBodyClass, tableRowClass } from "@/components/chrome/table-plate";
import { PAGE_GROUND, PAGE_GUTTER, PAGE_SUBTITLE, PAGE_TITLE } from "@/components/shell/page-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { pageWindow } from "@/lib/filing/queue";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import { useCourt } from "@/components/court/court-provider";

import { bulkApi, type BatchSummary } from "./api";
import { useGujarat } from "./court-guard";
import { bulkStepTitle, type BulkStepId } from "./bulk-steps";
import { FilterPills } from "./filter-pills";
import { CaseSearch } from "./case-list-tools";
import { ListBox, dockHead, sizesWith, toListTop, useFitRows, useListDock } from "./list-dock";
import { waitingOnOthers } from "./signing-round";
import { StatusLine } from "@/components/feedback";
import { notify } from "@/components/ui/notify";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { DELETED_PARAM } from "./remove-case";
import { SandboxPushMenu } from "./sandbox-push";

export async function downloadTemplate() {
  const blob = await buildTemplate();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = TEMPLATE_FILE;
  a.click();
  URL.revokeObjectURL(url);
}

/* ───────────────────────────── Where a batch stands ───────────────────────────── */

type SortId = "deadline" | "recent" | "fix" | "number";
const SORTS: { id: SortId; label: string }[] = [
  { id: "deadline", label: "File by, soonest" },
  { id: "recent", label: "Recently worked on" },
  { id: "fix", label: "Most to fix" },
  { id: "number", label: "Newest batch" },
];

type View = "needs" | "partly" | "waiting" | "notCreated" | "done";

const VIEWS: { id: View; label: string }[] = [
  { id: "needs", label: "Needs you" },
  // Some cases filed and the rest still to come back to (owner, 2026-11-17: "filed 50 of
  // 300 and I need to come back to the unfiled ones"). Overlaps Needs you; a lens, not a stage.
  { id: "partly", label: "Partly filed" },
  { id: "waiting", label: "Waiting on others" },
  { id: "notCreated", label: "Not created" },
  { id: "done", label: "Done" },
];

/**
 * The batch's steps as columns, each counting the cases at it (owner, 2026-11-17: a single
 * next act per row made every batch look the same). The counts are the batch's own
 * exclusive ones (`progressState`), so across a row they add up to its cases. "To check"
 * is not a stage of its own: a warning never holds a case, so those cases count where
 * they actually wait (documents or signing), as the stepper counts them.
 */
type Stage = { id: BulkStepId; state: "fix" | "docs" | "complete" | "signed"; tab: string; words: string; short: string; head: string };
const STAGES: Stage[] = [
  { id: "details", state: "fix", tab: "scrutiny", words: "to fix", short: "to fix", head: "To fix" },
  { id: "documents", state: "docs", tab: "documents", words: "missing documents", short: "missing docs", head: "Documents" },
  { id: "sign", state: "complete", tab: "sign", words: "ready to sign", short: "to sign", head: "To sign" },
  { id: "pay", state: "signed", tab: "pay", words: "signed, to pay for", short: "to pay", head: "To pay" },
];

/** The filer's one next act on a batch, first match wins; `null` when nothing is theirs. */
type Act = { verb: string; count?: number; href: string };

const today = () => new Date().toISOString().slice(0, 10);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "12 Nov", with the year only when it isn't this one. */
function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
}

/** A name shortened in the middle, keeping its start and its distinguishing end. */
function middle(name: string, max = 28): string {
  if (name.length <= max) return name;
  const tail = Math.ceil((max - 1) / 2);
  return `${name.slice(0, max - 1 - tail)}…${name.slice(-tail)}`;
}

const isPartly = (b: BatchSummary) => !b.notCreated && !b.clubbedInto && b.states.filed > 0 && b.states.filed < b.total;

const isDone = (b: BatchSummary) => !!b.clubbedInto || (b.total > 0 && b.counts.filed === b.total);

/** Where it came from, in one muted line: "Excel · tata-…nov.xlsx · 12 Nov". */
function originLine(b: BatchSummary): { text: string; title?: string } {
  const when = shortDate(b.createdAt);
  if (b.source.kind === "clubbed") return { text: `Clubbed from ${b.clubbedFrom.join(", ")} · ${when}` };
  // How it came in has its own column; this line is the file or reference and the day.
  const ref = b.source.reference;
  return { text: [ref ? middle(ref, 26) : "", when].filter(Boolean).join(" · "), title: ref ?? undefined };
}

/** How the batch came in, for its own column: "Excel" or "Provakil API". */
function sourceOf(b: BatchSummary): string {
  if (b.source.kind === "clubbed") return "Clubbed";
  if (b.source.kind === "api") return `${b.source.system} API`;
  return b.source.kind === "documents" ? "Documents" : "Excel";
}

/* ───────────────────────────── The screen ───────────────────────────── */

export function BatchesScreen() {
  const ready = useGujarat();
  const { profile } = useCourt();
  const params = useSearchParams();
  const ai = aiModeFrom(params.get("ai"), profile.aiMode);
  const router = useRouter();
  const [batches, setBatches] = React.useState<BatchSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // Only the headings pin; a page holds the rows the window does.
  const list = useListDock();
  const fit = useFitRows(list.dock);

  // Batches with a signing round out, waiting on another party (kept in this browser).
  const [awaiting, setAwaiting] = React.useState<Set<string>>(new Set());
  const load = React.useCallback(() => {
    bulkApi.list().then(
      (list) => {
        setBatches(list);
        setAwaiting(new Set(list.filter((b) => waitingOnOthers(b.id)).map((b) => b.id)));
      },
      (e: Error) => setError(e.message),
    );
  }, []);
  React.useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  // Arriving from a batch whose last case was removed: say where it went (BLK-08b), once.
  const deleted = params.get(DELETED_PARAM);
  React.useEffect(() => {
    if (!deleted) return;
    notify.success(`${deleted} deleted with its last case`);
    const next = new URLSearchParams(window.location.search);
    next.delete(DELETED_PARAM);
    const q = next.toString();
    router.replace(q ? `?${q}` : "?", { scroll: false });
  }, [deleted, router]);

  const open = (b: BatchSummary, tab?: string) => b.notCreated?.href ?? `/filings/bulk/${b.id}${tab ? `?tab=${tab}` : ""}`;

  const actOf = (b: BatchSummary): Act | null => {
    if (b.notCreated) return { verb: "Continue", href: b.notCreated.href };
    if (isDone(b) || awaiting.has(b.id)) return null;
    const s = b.states;
    if (s.fix) return { verb: "Fix", count: s.fix, href: open(b, "scrutiny") };
    if (s.check) return { verb: "Check", count: s.check, href: open(b, "scrutiny") };
    if (s.docs) return { verb: "Add documents", count: s.docs, href: open(b, "documents") };
    if (s.complete) return { verb: "Sign", count: s.complete, href: open(b, "sign") };
    if (s.signed) return { verb: "Pay", count: s.signed, href: open(b, "pay") };
    return null;
  };

  const viewOf = (b: BatchSummary): View =>
    b.notCreated ? "notCreated" : isDone(b) ? "done" : awaiting.has(b.id) ? "waiting" : actOf(b) ? "needs" : "waiting";

  const all = batches ?? [];
  const raw = params.get("view");
  const view: View | "all" = raw === "all" || VIEWS.some((v) => v.id === raw) ? (raw as View | "all") : "needs";
  const setView = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v === "needs") next.delete("view");
    else next.set("view", v);
    next.delete("page");
    const q = next.toString();
    router.replace(q ? `?${q}` : "?", { scroll: false });
  };

  const byUpdated = (a: BatchSummary, b: BatchSummary) => b.updatedAt.localeCompare(a.updatedAt);
  // Soonest File by first (none last), then the most recently worked on.
  const byFileBy = (a: BatchSummary, b: BatchSummary) =>
    (a.fileBy ?? "9999") === (b.fileBy ?? "9999") ? byUpdated(a, b) : (a.fileBy ?? "9999").localeCompare(b.fileBy ?? "9999");
  const inView = (b: BatchSummary, v: View) => (v === "partly" ? isPartly(b) : viewOf(b) === v);
  // Search, order and pages, kept in the address like every other list (owner, 2026-11-17).
  const q = params.get("q") ?? "";
  const term = q.trim().toLowerCase();
  const sortId = SORTS.some((x) => x.id === params.get("sort"))
    ? (params.get("sort") as SortId)
    : view === "needs" || view === "partly" ? "deadline" : "recent";
  // A size the filer picked is kept in the address; otherwise the window decides (`useFitRows`).
  const asked = Number(params.get("size"));
  const size = Number.isInteger(asked) && asked >= 5 && asked <= 100 ? asked : fit.fit;
  const sizes = sizesWith(size);
  const setParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  };
  // A turned page starts at its first row.
  const turn = (from: Element, p: number) => {
    setParams({ page: String(p) });
    toListTop(from);
  };
  const sorter: Record<SortId, (a: BatchSummary, b: BatchSummary) => number> = {
    deadline: byFileBy,
    recent: byUpdated,
    fix: (a, b) => b.states.fix - a.states.fix || byFileBy(a, b),
    number: (a, b) => Number(b.number.replace(/\D/g, "")) - Number(a.number.replace(/\D/g, "")),
  };
  const matches = (b: BatchSummary) =>
    !term ||
    [b.number, b.client, b.source.reference ?? "", b.source.kind === "api" ? b.source.system : "Excel"].some((v) =>
      v.toLowerCase().includes(term),
    );
  const listed = all.filter((b) => (view === "all" || inView(b, view)) && matches(b)).sort(sorter[sortId]);
  const pageCount = Math.max(1, Math.ceil(listed.length / size));
  const page = Math.min(Math.max(1, Number(params.get("page")) || 1), pageCount);
  const start = (page - 1) * size;
  const shown = listed.slice(start, start + size);

  const count = (v: View) => all.filter((b) => inView(b, v)).length;
  const needs = all.filter((b) => viewOf(b) === "needs").sort(byFileBy);
  const clients = new Set(all.map((b) => b.client).filter(Boolean)).size;

  const [deleting, setDeleting] = React.useState<BatchSummary | null>(null);
  const remove = async (b: BatchSummary) => {
    try {
      await bulkApi.deleteNotCreated(b.id);
      // Gone from the list at once; the full list, which takes a moment at scale, follows.
      setBatches((prev) => prev?.filter((x) => x.id !== b.id) ?? prev);
      notify.success(`${b.number} deleted`);
      load();
    } catch (e) {
      notify.error(`${b.number} could not be deleted`, { description: (e as Error).message });
    }
  };

  // The page's one plain sentence: what needs the filer, and the soonest date it has.
  const soonest = needs.find((b) => b.fileBy)?.fileBy ?? null;
  const summary = !batches
    ? " "
    : !all.length
      ? "Upload an Excel of cases to start a batch."
      : needs.length
        ? `${plural(needs.length, "batch", "batches")} ${needs.length === 1 ? "needs" : "need"} you${
            soonest ? `. The earliest must be filed by ${shortDate(soonest)}${soonest < today() ? ", which has passed" : ""}.` : "."
          }`
        : "Nothing needs you right now.";

  /* ── Cells ── */

  const fileByCell = (b: BatchSummary) => {
    if (!b.fileBy || b.notCreated || isDone(b)) return <span className="text-muted-foreground/40">–</span>;
    // Past: the date stays readable and only the word carries the red, so a long list of
    // late batches doesn't turn into a wall of red.
    const past = b.fileBy < today();
    return (
      <span className={cn("inline-flex items-center gap-2 tabular-nums", past ? "text-destructive-ink" : "text-foreground")}>
        {shortDate(b.fileBy)}
        {past ? <span className="sr-only">, passed</span> : null}
      </span>
    );
  };

  /** The ⋯ menu: only an upload not created yet has anything in it (Delete). */
  const menuCell = (b: BatchSummary) =>
    b.notCreated?.kind === "excel" ? (
      <span onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={`More for ${b.number}`}>
              <EllipsisIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem variant="destructive" onSelect={() => window.setTimeout(() => setDeleting(b), 0)}>
              <Trash2Icon aria-hidden />
              Delete upload
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    ) : null;

  /** One stage's count, opening that step of the batch; a dash when none is there. */
  const stageCount = (b: BatchSummary, st: Stage) => {
    const n = b.states[st.state];
    if (!n)
      return (
        <span className="text-muted-foreground/40" aria-label={`None ${st.words} in ${b.number}`}>
          –
        </span>
      );
    return (
      <Link
        href={open(b, st.tab)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`${n} ${st.words} in ${b.number}`}
        className={cn(
          "inline-flex h-8 min-w-10 items-center justify-center rounded-md px-2 tabular-nums outline-none transition-colors",
          "hover:bg-surface-sunken focus-visible:ring-3 focus-visible:ring-focus-ring",
          st.state === "fix" ? "font-medium text-destructive-ink" : "text-foreground",
        )}
      >
        {n}
      </Link>
    );
  };

  /**
   * Filed, as an indicator rather than a chart (owner, 2026-11-17): nothing filed stays
   * quiet; a batch partly filed carries a small ring and what's left, so the ones to come
   * back to catch the eye; a finished one is ticked.
   */
  const filedCell = (b: BatchSummary) => {
    const n = b.states.filed;
    if (!n) return <span className="text-muted-foreground tabular-nums">0 of {b.total}</span>;
    const done = n === b.total;
    return (
      <Link
        href={open(b, "filed")}
        onClick={(e) => e.stopPropagation()}
        aria-label={done ? `All ${b.total} filed in ${b.number}` : `${n} of ${b.total} filed in ${b.number}, ${b.total - n} left`}
        className="inline-flex items-center gap-2.5 rounded-md pr-2 outline-none hover:bg-surface-sunken focus-visible:ring-3 focus-visible:ring-focus-ring"
      >
        {done ? <CircleCheckIcon aria-hidden className="size-5 shrink-0 text-success-ink" /> : <FiledRing filed={n} total={b.total} />}
        <span className="flex flex-col leading-5">
          <span className="font-medium text-foreground tabular-nums">{done ? `All ${b.total}` : `${n} of ${b.total}`}</span>
          {done ? null : <span className="text-muted-foreground tabular-nums">{b.total - n} left</span>}
        </span>
      </Link>
    );
  };

  const anyMenu = shown.some((b) => b.notCreated?.kind === "excel");
  const showClient = clients > 1;

  /* ── Empty states ── */

  const emptyFor: Record<View | "all", { title: string; line: string }> = {
    needs: { title: "Nothing needs you", line: "Every batch is waiting on someone else or done." },
    partly: { title: "No batch is partly filed", line: "A batch shows here once some of its cases are filed." },
    waiting: { title: "Nothing waiting on others", line: "No signing round is out." },
    notCreated: { title: "No unfinished uploads", line: "Every upload has been created." },
    done: { title: "No batches done yet", line: "A batch moves here once all its cases are filed." },
    all: { title: "No batches yet", line: "" },
  };

  return (
    <div className={cn("flex w-full flex-1 flex-col gap-6", PAGE_GROUND, PAGE_GUTTER)}>
      <header className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className={cn(PAGE_TITLE, "text-foreground")}>Bulk filing</h1>
          <p className={cn(PAGE_SUBTITLE, "tabular-nums")} aria-live="polite">
            {summary}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:ml-auto">
          {/* Sandbox: a client's system pushes 300 cases, as a real push arrives. */}
          <SandboxPushMenu />
          <Button variant="outline" onClick={() => void downloadTemplate()}>
            <DownloadIcon data-icon="inline-start" aria-hidden />
            Download Excel template
          </Button>
          <Button asChild>
            <Link href="/filings/bulk/upload">
              <UploadIcon data-icon="inline-start" aria-hidden />
              {ai === "on" ? "Upload cases" : "Upload Excel"}
            </Link>
          </Button>
        </div>
      </header>

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      {/* overflow-visible: a clipping card would make the pinned headings inert. */}
      <Card variant="raised" className="gap-0 overflow-visible p-2">
        <h2 className="sr-only">Batches</h2>
        {batches === null ? (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-10 w-96 max-w-full" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : all.length === 0 ? (
          <Empty className="border-0 py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Layers2Icon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No batches yet</EmptyTitle>
              <EmptyDescription>Upload an Excel of cases. Cases your client&apos;s system sends arrive here too.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" onClick={() => void downloadTemplate()}>
                <DownloadIcon data-icon="inline-start" aria-hidden />
                Download Excel template
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <>
            {/* One toolbar row, as Your filings has: the filters, then search and order at
                the right. It scrolls away; only the headings pin (`list-dock.tsx`). */}
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <FilterPills
                className="sm:min-w-fit"
                value={view}
                onChange={setView}
                total={all.length}
                filters={VIEWS.map((v) => ({ ...v, count: count(v.id) }))}
                label="Show batches"
              />
              <div className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:ml-auto sm:w-auto sm:flex-nowrap">
              <CaseSearch
                id="batches-search"
                label="Search batches"
                className="flex-1 sm:flex-none"
                value={q}
                onChange={(v) => setParams({ q: v, page: null })}
                placeholder="Batch, complainant or file"
              />
              <NativeSelect
                value={sortId}
                onChange={(e) => setParams({ sort: e.target.value, page: null })}
                aria-label="Order the batches"
                className="w-full sm:w-auto"
              >
                {SORTS.map((x) => (
                  <NativeSelectOption key={x.id} value={x.id}>
                    {x.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              </div>
            </div>


            {shown.length === 0 ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyTitle>{term ? `No batch matches “${q.trim()}”` : emptyFor[view].title}</EmptyTitle>
                  {!term && emptyFor[view].line ? <EmptyDescription>{emptyFor[view].line}</EmptyDescription> : null}
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => (term ? setParams({ q: null, page: null }) : setView("all"))}>
                    {term ? "Clear search" : "Show all batches"}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <>
                {/* Phones: one item per batch, its stages as one line of links. */}
                <ul data-list-rows className="flex flex-col divide-y divide-hairline md:hidden" aria-label="Batches">
                  {shown.map((b) => (
                    <li key={b.id} className="flex flex-col gap-1 px-4 py-3 text-body-compact">
                      <span className="flex min-h-10 items-center gap-2">
                        <Link href={open(b)} className="font-medium tabular-nums hover:underline">
                          {b.number}
                        </Link>
                        {b.openedAt === null ? <Badge variant="outline">New</Badge> : null}
                        <span className="ml-auto flex items-center gap-1">
                          {b.notCreated ? (
                            <Button asChild variant="outline" size="sm">
                              <Link href={b.notCreated.href}>Continue</Link>
                            </Button>
                          ) : null}
                          {menuCell(b)}
                        </span>
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {b.fileBy && !b.notCreated && !isDone(b) ? (
                          <>
                            File by {shortDate(b.fileBy)}
                            {b.fileBy < today() ? <span className="font-medium text-destructive-ink"> · Past</span> : null}
                          </>
                        ) : (
                          `${sourceOf(b)} · ${originLine(b).text}`
                        )}
                      </span>
                      {b.notCreated ? (
                        <span className="text-muted-foreground">{sentence(b.notCreated.where)}</span>
                      ) : b.clubbedInto ? (
                        <span className="text-muted-foreground">Clubbed into {b.clubbedIntoNumber}</span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-x-1 tabular-nums">
                          {STAGES.filter((st) => b.states[st.state]).map((st) => (
                            <React.Fragment key={st.id}>
                              <Link
                                href={open(b, st.tab)}
                                aria-label={`${b.states[st.state]} ${st.words} in ${b.number}`}
                                className={cn("font-medium hover:underline", st.state === "fix" ? "text-destructive-ink" : "text-foreground")}
                              >
                                {b.states[st.state]} {st.short}
                              </Link>
                              <span aria-hidden className="text-muted-foreground">·</span>
                            </React.Fragment>
                          ))}
                          <span className={b.states.filed ? "font-medium text-success-ink" : "text-muted-foreground"}>
                            {b.states.filed} of {b.total} filed
                          </span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <ListBox list={list} className="hidden md:block">
                  <Table className="table-fixed border-separate border-spacing-0" aria-label="Batches">
                    <colgroup>
                      <col className="w-[24%]" />
                      {showClient ? <col className="w-40" /> : null}
                      <col className="w-28" />
                      <col className="w-28" />
                      {STAGES.map((st) => (
                        <col key={st.id} />
                      ))}
                      <col className="w-36" />
                      {anyMenu ? <col className="w-14" /> : null}
                    </colgroup>
                    <TableHeader {...dockHead(list.dock)}>
                      <TableRow className={TABLE_HEAD_ROW}>
                        <TableHead className={TABLE_HEAD}>Batch</TableHead>
                        {showClient ? <TableHead className={TABLE_HEAD}>Complainant</TableHead> : null}
                        <TableHead className={TABLE_HEAD}>Source</TableHead>
                        <TableHead className={cn(TABLE_HEAD, "whitespace-nowrap")}>File by</TableHead>
                        {STAGES.map((st) => (
                          <TableHead key={st.id} className={cn(TABLE_HEAD, "px-2 text-center leading-5")} title={bulkStepTitle(st.id)}>
                            {st.head}
                          </TableHead>
                        ))}
                        <TableHead className={TABLE_HEAD}>Filed</TableHead>
                        {anyMenu ? (
                          <TableHead className={TABLE_HEAD}>
                            <span className="sr-only">More</span>
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody className={tableBodyClass()}>
                      {shown.map((b) => {
                        const origin = originLine(b);
                        // Not created, or clubbed away: no stages to count; one muted line across them.
                        const across = b.notCreated ? (
                          <span className="flex items-center gap-4">
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">
                              Not created · {sentence(b.notCreated.where)}
                            </span>
                            <Button asChild variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                              <Link href={b.notCreated.href}>Continue</Link>
                            </Button>
                          </span>
                        ) : b.clubbedInto ? (
                          <span className="text-muted-foreground">Clubbed into {b.clubbedIntoNumber}</span>
                        ) : null;
                        return (
                          <TableRow
                            key={b.id}
                            className={cn(tableRowClass(), "cursor-pointer")}
                            onClick={() => router.push(open(b))}
                          >
                            <TableCell className={TABLE_CELL}>
                              <span className="flex items-center gap-2">
                                <Link
                                  href={open(b)}
                                  className="font-medium text-foreground tabular-nums hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {b.number}
                                </Link>
                                {b.openedAt === null ? <Badge variant="outline">New</Badge> : null}
                              </span>
                              <span className="block truncate text-muted-foreground tabular-nums" title={origin.title}>
                                {origin.text}
                              </span>
                            </TableCell>
                            {showClient ? (
                              <TableCell className={cn(TABLE_CELL, "truncate")}>{b.client || "—"}</TableCell>
                            ) : null}
                            <TableCell className={cn(TABLE_CELL, "whitespace-nowrap text-foreground")}>{sourceOf(b)}</TableCell>
                            <TableCell className={cn(TABLE_CELL, "whitespace-nowrap")}>{fileByCell(b)}</TableCell>
                            {across ? (
                              <TableCell className={TABLE_CELL} colSpan={STAGES.length + 1}>
                                {across}
                              </TableCell>
                            ) : (
                              <>
                                {STAGES.map((st) => (
                                  <TableCell key={st.id} className={cn(TABLE_CELL, "px-2 text-center")}>
                                    {stageCount(b, st)}
                                  </TableCell>
                                ))}
                                <TableCell className={TABLE_CELL}>{filedCell(b)}</TableCell>
                              </>
                            )}
                            {anyMenu ? <TableCell className={cn(TABLE_CELL, "px-2")}>{menuCell(b)}</TableCell> : null}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ListBox>
              </>
            )}
          </>
        )}
        {listed.length > sizes[0] ? (
          <div data-list-pager className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline px-4 pt-4 pb-2">
            <div className="flex items-center gap-3">
              <p className="text-body-compact text-muted-foreground tabular-nums">
                Showing {start + 1}–{Math.min(start + size, listed.length)} of {listed.length}
              </p>
              <NativeSelect
                value={String(size)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setParams({ size: n === fit.fit ? null : String(n), page: null });
                }}
                aria-label="Batches per page"
                size="sm"
                className="w-auto"
              >
                {sizes.map((n) => (
                  <NativeSelectOption key={n} value={String(n)}>
                    {n} per page
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {pageCount > 1 ? (
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  {page > 1 ? (
                    <PaginationItem>
                      <PaginationPrevious href="#" onClick={(e) => (e.preventDefault(), turn(e.currentTarget, page - 1))} />
                    </PaginationItem>
                  ) : null}
                  {pageWindow(page, pageCount).map((entry, i) => (
                    <PaginationItem key={`${entry}-${i}`}>
                      {entry === "gap" ? (
                        <PaginationEllipsis />
                      ) : (
                        <PaginationLink
                          href="#"
                          isActive={entry === page}
                          aria-label={`Go to page ${entry}`}
                          onClick={(e) => (e.preventDefault(), turn(e.currentTarget, entry))}
                        >
                          {entry}
                        </PaginationLink>
                      )}
                    </PaginationItem>
                  ))}
                  {page < pageCount ? (
                    <PaginationItem>
                      <PaginationNext href="#" onClick={(e) => (e.preventDefault(), turn(e.currentTarget, page + 1))} />
                    </PaginationItem>
                  ) : null}
                </PaginationContent>
              </Pagination>
            ) : null}
          </div>
        ) : null}
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title={deleting ? `Delete ${deleting.number}?` : "Delete this upload?"}
        description="No case is lost. Your choices for this upload are deleted; the Excel file isn't touched."
        confirmLabel="Delete"
        cancelLabel="Back"
        onConfirm={() => {
          if (deleting) void remove(deleting);
          setDeleting(null);
        }}
      />
    </div>
  );
}

/** "stopped at Match values" → "Stopped at Match values". */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A small ring: the filed share of a batch, as an indicator beside its count. */
function FiledRing({ filed, total }: { filed: number; total: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  const share = total ? filed / total : 0;
  return (
    <svg viewBox="0 0 20 20" className="size-5 shrink-0 -rotate-90" aria-hidden>
      <circle cx="10" cy="10" r={r} fill="none" strokeWidth="3" className="stroke-border" />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(share * c, 2)} ${c}`}
        className="stroke-success"
      />
    </svg>
  );
}
