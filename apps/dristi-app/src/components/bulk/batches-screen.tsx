"use client";

/**
 * Bulk filing: the batches, as a queue of what needs the filer (owner, 2026-11-17: the
 * list of every batch with a progress bar and legend each "looks horribly bad"; redesigned
 * from the ux-designer's "Needs you" recommendation).
 *
 *  · Opens on Needs you: created batches whose next step is the filer's, soonest File by
 *    first, since a missed limitation date is the costly mistake.
 *  · Each batch says where it stands in one line and offers its one next act, verb and
 *    count ("Fix · 71"), in a column of equal buttons. No bar, no legend.
 *  · Uploads not created yet have their own filter and one sentence above the list.
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import { useCourt } from "@/components/court/court-provider";

import { bulkApi, type BatchSummary } from "./api";
import { useGujarat } from "./court-guard";
import { FilterPills } from "./filter-pills";
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

type View = "needs" | "waiting" | "notCreated" | "done";

const VIEWS: { id: View; label: string }[] = [
  { id: "needs", label: "Needs you" },
  { id: "waiting", label: "Waiting on others" },
  { id: "notCreated", label: "Not created" },
  { id: "done", label: "Done" },
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

const isDone = (b: BatchSummary) => !!b.clubbedInto || (b.total > 0 && b.counts.filed === b.total);

/** Where it came from, in one muted line: "Excel · tata-…nov.xlsx · 12 Nov". */
function originLine(b: BatchSummary): { text: string; title?: string } {
  const when = shortDate(b.createdAt);
  if (b.source.kind === "clubbed") return { text: `Clubbed from ${b.clubbedFrom.join(", ")} · ${when}` };
  const kind = b.source.kind === "api" ? `${b.source.system} API` : b.source.kind === "documents" ? "Case documents" : "Excel";
  const ref = b.source.reference;
  return { text: [kind, ref ? middle(ref) : "", when].filter(Boolean).join(" · "), title: ref ?? undefined };
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
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [clubbing, setClubbing] = React.useState(false);

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
    setPicked(new Set());
    const q = next.toString();
    router.replace(q ? `?${q}` : "?", { scroll: false });
  };

  const byUpdated = (a: BatchSummary, b: BatchSummary) => b.updatedAt.localeCompare(a.updatedAt);
  // Soonest File by first (none last), then the most recently worked on.
  const byFileBy = (a: BatchSummary, b: BatchSummary) =>
    (a.fileBy ?? "9999") === (b.fileBy ?? "9999") ? byUpdated(a, b) : (a.fileBy ?? "9999").localeCompare(b.fileBy ?? "9999");
  const shown = all.filter((b) => view === "all" || viewOf(b) === view).sort(view === "needs" ? byFileBy : byUpdated);

  const count = (v: View) => all.filter((b) => viewOf(b) === v).length;
  const needs = all.filter((b) => viewOf(b) === "needs").sort(byFileBy);
  const notCreated = count("notCreated");
  const clients = new Set(all.map((b) => b.client).filter(Boolean)).size;

  const clubbable = (b: BatchSummary) => !b.notCreated && !isDone(b);
  const canPick = shown.some(clubbable);
  const chosen = all.filter((b) => picked.has(b.id) && clubbable(b));
  const sameClient = new Set(chosen.map((b) => b.client)).size <= 1;
  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const club = async () => {
    setClubbing(true);
    setError(null);
    try {
      const out = await bulkApi.club(chosen.map((b) => b.id));
      notify.success(`${chosen.length} batches clubbed into ${out.batchNumber}`);
      router.push(`/filings/bulk/${out.batchId}`);
    } catch (e) {
      setError((e as Error).message);
      setClubbing(false);
    }
  };

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
    if (!b.fileBy || b.notCreated || isDone(b)) return <span className="text-muted-foreground">—</span>;
    // Past: the date stays readable and only the word carries the red, so a long list of
    // late batches doesn't turn into a wall of red.
    const past = b.fileBy < today();
    return (
      <span className="text-foreground tabular-nums">
        {shortDate(b.fileBy)}
        {past ? <span className="font-medium text-destructive-ink"> · Past</span> : null}
      </span>
    );
  };

  /** Where it stands: what's done, then any blocker the action doesn't already name. */
  const stands = (b: BatchSummary, act: Act | null): { line: React.ReactNode; sub?: string } => {
    // On its own filter "Not created yet" would repeat the pill on every row.
    if (b.notCreated)
      return view === "notCreated" ? { line: sentence(b.notCreated.where) } : { line: "Not created yet", sub: sentence(b.notCreated.where) };
    if (b.clubbedInto) return { line: <span className="text-muted-foreground">Clubbed into {b.clubbedIntoNumber}</span> };
    if (isDone(b))
      return {
        line: (
          <span className="inline-flex items-center gap-1.5 text-success-ink">
            <CircleCheckIcon className="size-4" aria-hidden />
            All {b.total} filed
          </span>
        ),
      };
    const s = b.states;
    const done = [s.filed ? `${s.filed} filed` : "", s.signed ? `${s.signed} signed` : "", s.complete ? `${s.complete} ready to sign` : ""].filter(Boolean);
    const blockers = [
      s.fix && act?.verb !== "Fix" ? `${s.fix} to fix` : "",
      s.docs && act?.verb !== "Add documents" ? `${s.docs} missing ${s.docs === 1 ? "a document" : "documents"}` : "",
    ].filter(Boolean);
    if (awaiting.has(b.id)) return { line: "Waiting for another party to sign", sub: done.join(" · ") || undefined };
    return {
      line: done.length ? done.join(" · ") : <span className="text-muted-foreground">None ready yet</span>,
      sub: blockers.join(" · ") || undefined,
    };
  };

  const actionCell = (b: BatchSummary, act: Act | null, className?: string) => (
    <span className={cn("flex items-center justify-end gap-1", className)} onClick={(e) => e.stopPropagation()}>
      {act ? (
        <Button asChild variant="outline" className="w-36 justify-between md:w-44">
          <Link href={act.href} aria-label={act.count ? `${act.verb} ${plural(act.count, "case")} in ${b.number}` : `${act.verb} ${b.number}`}>
            <span>{act.verb}</span>
            {act.count ? <span className="text-muted-foreground tabular-nums">{act.count}</span> : null}
          </Link>
        </Button>
      ) : null}
      {b.notCreated?.kind === "excel" ? (
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
      ) : b.notCreated ? (
        <span aria-hidden className="size-10" />
      ) : null}
    </span>
  );

  const anyMenu = shown.some((b) => b.notCreated);
  const showClient = clients > 1;

  /* ── Empty states ── */

  const emptyFor: Record<View | "all", { title: string; line: string }> = {
    needs: { title: "Nothing needs you", line: "Every batch is waiting on someone else or done." },
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

      <Card variant="raised" className="gap-0 p-2">
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
            {/* The filters, and what the selection can do, on one line. */}
            <div className="flex flex-wrap items-center gap-3 px-4 pt-2 pb-3">
              <FilterPills
                value={view}
                onChange={setView}
                total={all.length}
                filters={VIEWS.map((v) => ({ ...v, count: count(v.id) }))}
                label="Show batches"
              />
              {chosen.length ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-body-compact text-muted-foreground tabular-nums" aria-live="polite">
                    {chosen.length} selected
                  </span>
                  <Button variant="outline" disabled={chosen.length < 2 || !sameClient || clubbing} onClick={() => void club()}>
                    <Layers2Icon data-icon="inline-start" aria-hidden />
                    Club {chosen.length} batches
                  </Button>
                  <Button variant="link" className="h-auto p-0 font-normal text-muted-foreground underline" onClick={() => setPicked(new Set())}>
                    Clear
                  </Button>
                </div>
              ) : null}
            </div>
            {chosen.length > 1 && !sameClient ? (
              <p className="px-4 pb-3 text-body-compact text-warning-ink">Only batches for the same complainant can be clubbed.</p>
            ) : null}
            {view === "needs" && notCreated ? (
              <p className="px-4 pb-3 text-body-compact text-muted-foreground tabular-nums">
                {notCreated === 1 ? "1 upload isn't" : `${notCreated} uploads aren't`} created yet.{" "}
                <Button
                  variant="link"
                  className="h-auto p-0 align-baseline text-body-compact font-normal underline"
                  onClick={() => setView("notCreated")}
                >
                  Show {notCreated === 1 ? "it" : "them"}
                </Button>
              </p>
            ) : null}

            {shown.length === 0 ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyTitle>{emptyFor[view].title}</EmptyTitle>
                  {emptyFor[view].line ? <EmptyDescription>{emptyFor[view].line}</EmptyDescription> : null}
                </EmptyHeader>
                <EmptyContent>
                  <Button variant="outline" onClick={() => setView("all")}>
                    Show all batches
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <>
                {/* Phones: one stacked row per batch, the act beside its number. */}
                <ul className="flex flex-col divide-y divide-hairline md:hidden" aria-label="Batches">
                  {shown.map((b) => {
                    const act = actOf(b);
                    const st = stands(b, act);
                    return (
                      <li key={b.id} className="flex flex-col gap-1 px-4 py-3 text-body-compact">
                        <span className="flex min-h-10 items-center gap-2">
                          {clubbable(b) ? (
                            <Checkbox checked={picked.has(b.id)} onCheckedChange={(v) => toggle(b.id, v === true)} aria-label={`Select ${b.number}`} />
                          ) : null}
                          <Link href={open(b)} className="font-medium tabular-nums hover:underline">
                            {b.number}
                          </Link>
                          {b.openedAt === null ? <Badge variant="outline">New</Badge> : null}
                          {actionCell(b, act, "ml-auto")}
                        </span>
                        <span>{st.line}</span>
                        {st.sub ? <span className="text-muted-foreground">{st.sub}</span> : null}
                        <span className="text-muted-foreground tabular-nums">
                          {b.fileBy && !b.notCreated && !isDone(b) ? (
                            <>
                              File by {shortDate(b.fileBy)}
                              {b.fileBy < today() ? <span className="font-medium text-destructive-ink"> · Past</span> : null}
                              {" · "}
                            </>
                          ) : null}
                          {b.notCreated?.kind === "excel" ? "" : plural(b.total, "case")}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="hidden overflow-x-auto md:block">
                  <Table className="border-separate border-spacing-0" aria-label="Batches">
                    <TableHeader>
                      <TableRow className={TABLE_HEAD_ROW}>
                        {canPick ? (
                          <TableHead className={cn(TABLE_HEAD, "w-10 pr-0")}>
                            <span className="sr-only">Select to club</span>
                          </TableHead>
                        ) : null}
                        <TableHead className={TABLE_HEAD}>Batch</TableHead>
                        {showClient ? <TableHead className={TABLE_HEAD}>Complainant</TableHead> : null}
                        <TableHead className={cn(TABLE_HEAD, "w-32 whitespace-nowrap")}>File by</TableHead>
                        <TableHead className={cn(TABLE_HEAD, "w-24 text-right")}>Cases</TableHead>
                        <TableHead className={cn(TABLE_HEAD, "w-72")}>Where it stands</TableHead>
                        <TableHead className={cn(TABLE_HEAD, anyMenu ? "w-60" : "w-52")}>
                          <span className="sr-only">Next step</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className={tableBodyClass({ selectable: canPick })}>
                      {shown.map((b) => {
                        const act = actOf(b);
                        const st = stands(b, act);
                        const origin = originLine(b);
                        const on = picked.has(b.id);
                        return (
                          <TableRow
                            key={b.id}
                            className={cn(tableRowClass({ selectable: canPick }), "cursor-pointer")}
                            data-state={on ? "selected" : undefined}
                            onClick={() => router.push(open(b))}
                          >
                            {canPick ? (
                              <TableCell className={cn(TABLE_CELL, "w-10 pr-0")} onClick={(e) => e.stopPropagation()}>
                                {clubbable(b) ? (
                                  <Checkbox checked={on} onCheckedChange={(v) => toggle(b.id, v === true)} aria-label={`Select ${b.number}`} />
                                ) : null}
                              </TableCell>
                            ) : null}
                            <TableCell className={cn(TABLE_CELL, "w-full max-w-0 min-w-48")}>
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
                              <TableCell className={cn(TABLE_CELL, "min-w-40 whitespace-normal")}>{b.client || "—"}</TableCell>
                            ) : null}
                            <TableCell className={TABLE_CELL}>{fileByCell(b)}</TableCell>
                            <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>
                              {b.notCreated?.kind === "excel" ? <span className="text-muted-foreground">—</span> : b.total}
                            </TableCell>
                            <TableCell className={cn(TABLE_CELL, "min-w-64 whitespace-nowrap tabular-nums")}>
                              <span className="block text-foreground">{st.line}</span>
                              {st.sub ? <span className="block text-muted-foreground">{st.sub}</span> : null}
                            </TableCell>
                            <TableCell className={TABLE_CELL}>{actionCell(b, act)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </>
        )}
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
