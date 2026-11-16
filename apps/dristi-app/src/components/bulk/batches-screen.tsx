"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  CircleCheckIcon,
  DownloadIcon,
  Layers2Icon,
  UploadIcon,
} from "lucide-react";

import { toLongDate } from "@/lib/filing/format";
import { buildTemplate, TEMPLATE_FILE } from "@/lib/bulk/excel";
import { cn } from "@/lib/utils";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import {
  PAGE_GROUND,
  PAGE_GUTTER,
  PAGE_SUBTITLE,
  PAGE_TITLE,
} from "@/components/shell/page-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { aiModeFrom } from "@/lib/bulk/ai-review";
import { useCourt } from "@/components/court/court-provider";

import { bulkApi, type BatchSummary } from "./api";
import { useGujarat } from "./court-guard";
import { StageBar } from "./stage";
import { waitingOnOthers } from "./signing-round";
import { StatusLine } from "@/components/feedback";
import { notify } from "@/components/ui/notify";
import { ConfirmDialog } from "@/components/shell/confirm-dialog";
import { DELETED_PARAM } from "./remove-case";

export async function downloadTemplate() {
  const blob = await buildTemplate();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = TEMPLATE_FILE;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Where a batch came from, as a tile you can tell apart without reading: green
 * spreadsheet for Excel, blue "API" for a push, grey layers for clubbed. The words follow.
 */
export function SourceLabel({
  source,
  to,
}: {
  source: BatchSummary["source"];
  to?: string | null;
}) {
  const name =
    source.kind === "api"
      ? `${source.system} API`
      : source.kind === "excel"
        ? "Excel upload"
        : source.kind === "documents"
          ? "Case documents"
          : "Clubbed";
  // No icon tile: the words say where it came from (round 3). A long file name keeps its
  // end, where uploads that start alike ("tata-capital-…") differ.
  return (
    <span className="flex min-w-0 flex-col">
      <span>{name}</span>
      {source.reference ? (
        <span className="text-body-compact text-muted-foreground" title={source.reference}>
          {middle(source.reference)}
        </span>
      ) : null}
      {to ? <span className="truncate text-body-compact text-muted-foreground">To {to}</span> : null}
    </span>
  );
}

/** A name shortened in the middle, keeping its start and its distinguishing end. */
function middle(name: string, max = 30): string {
  if (name.length <= max) return name;
  const tail = Math.ceil((max - 1) / 2);
  return `${name.slice(0, max - 1 - tail)}…${name.slice(-tail)}`;
}

/** Every batch, newest first. Batches never mix; clubbing is the filer's deliberate act. */
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
    bulkApi.list().then((list) => {
      setBatches(list);
      setAwaiting(new Set(list.filter((b) => waitingOnOthers(b.id)).map((b) => b.id)));
    }, (e: Error) => setError(e.message));
  }, []);
  React.useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  // Arriving from a batch whose last case was removed: say where it went (BLK-08b), once.
  const deleted = params.get(DELETED_PARAM);
  React.useEffect(() => {
    if (!deleted) return;
    notify.success(`${deleted} was deleted with its last case`);
    const next = new URLSearchParams(window.location.search);
    next.delete(DELETED_PARAM);
    const q = next.toString();
    router.replace(q ? `?${q}` : "?", { scroll: false });
  }, [deleted, router]);

  // Finished batches (all filed, or clubbed into another) move to Completed, so the
  // working list holds only what still needs something done.
  const finished = (b: BatchSummary) =>
    !!b.clubbedInto || (b.total > 0 && b.counts.filed === b.total);
  const open = (batches ?? []).filter((b) => !finished(b));
  const closed = (batches ?? []).filter(finished);
  const view = params.get("view") === "completed" ? "completed" : "active";
  const shown = view === "completed" ? closed : open;
  const setView = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v === "completed") next.set("view", v);
    else next.delete("view");
    const q = next.toString();
    router.replace(q ? `?${q}` : "?", { scroll: false });
  };
  const chosen = open.filter((b) => picked.has(b.id));
  const sameClient = new Set(chosen.map((b) => b.client)).size <= 1;
  const clubNote =
    chosen.length < 2
      ? null
      : !sameClient
        ? "Only batches for the same complainant can be clubbed."
        : null;

  const club = async () => {
    setClubbing(true);
    setError(null);
    try {
      const out = await bulkApi.club(chosen.map((b) => b.id));
      router.push(`/filings/bulk/${out.batchId}`);
    } catch (e) {
      setError((e as Error).message);
      setClubbing(false);
    }
  };

  // A batch not created yet opens where it was left: the upload's step, or an API batch's
  // Facts of the case (BLK-10m, §3).
  const hrefOf = (b: BatchSummary) => b.notCreated?.href ?? `/filings/bulk/${b.id}`;
  const [deleting, setDeleting] = React.useState<BatchSummary | null>(null);
  const remove = async (b: BatchSummary) => {
    try {
      await bulkApi.deleteNotCreated(b.id);
      notify.success(`${b.number} deleted`);
      load();
    } catch (e) {
      notify.error(`${b.number} could not be deleted`, { description: (e as Error).message });
    }
  };

  const row = (b: BatchSummary, selectable: boolean) => (
    <TableRow
      key={b.id}
      className={cn(tableRowClass({ selectable }), "cursor-pointer")}
      data-state={picked.has(b.id) ? "selected" : undefined}
      onClick={() => router.push(hrefOf(b))}
    >
      <TableCell
        className={cn(TABLE_CELL, "w-12 pl-6")}
        onClick={(e) => e.stopPropagation()}
      >
        {selectable ? (
          <Checkbox
            checked={picked.has(b.id)}
            onCheckedChange={(v) =>
              setPicked((prev) => {
                const next = new Set(prev);
                if (v === true) next.add(b.id);
                else next.delete(b.id);
                return next;
              })
            }
            aria-label={`Select ${b.number}`}
          />
        ) : null}
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "font-medium tabular-nums")}>
        <Link
          href={hrefOf(b)}
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {b.number}
        </Link>
        {b.openedAt === null ? (
          <Badge variant="destructive" className="ml-2">
            New
          </Badge>
        ) : null}
        {b.clubbedFrom.length ? (
          <div className="text-body-compact font-normal text-muted-foreground">
            From {b.clubbedFrom.join(", ")}
          </div>
        ) : null}
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "max-w-56 whitespace-normal")}>
        <SourceLabel
          source={b.source}
          to={b.source.kind === "api" ? b.filingAdvocate?.name : null}
        />
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "min-w-48 whitespace-normal")}>
        {b.client}
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "tabular-nums")}>
        {toLongDate(b.createdAt.slice(0, 10))}
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>
        {b.notCreated?.kind === "excel" ? <span className="text-muted-foreground">—</span> : b.total}
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "pr-6 whitespace-normal")}>
        {b.notCreated ? (
          <NotCreatedStatus b={b} onDelete={() => setDeleting(b)} />
        ) : b.clubbedInto ? (
          <Badge variant="outline">Clubbed into {b.clubbedIntoNumber}</Badge>
        ) : b.total > 0 && b.counts.filed === b.total ? (
          <Badge variant="success">
            <CircleCheckIcon data-icon="inline-start" aria-hidden />
            Done: all {b.total} filed
          </Badge>
        ) : (
          <span className="flex flex-col gap-1">
            <StageBar counts={b.states} />
            {awaiting.has(b.id) ? (
              <span className="text-body-compact text-info-ink">Waiting for another party to sign</span>
            ) : null}
          </span>
        )}
      </TableCell>
    </TableRow>
  );

  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col gap-6",
        PAGE_GROUND,
        PAGE_GUTTER,
      )}
    >
      <header className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex flex-col gap-1">
          <h1 className={cn(PAGE_TITLE, "text-foreground")}>Bulk filing</h1>
          <p className={PAGE_SUBTITLE}>
            Each push from a client&apos;s system and each Excel upload is its
            own batch.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row md:ml-auto">
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

      {error ? (
        <StatusLine tone="error">{error}</StatusLine>
      ) : null}

      <Card variant="raised" className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <h2 className="sr-only">Batches</h2>
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="active">
                In progress
                {batches ? (
                  <span className="text-muted-foreground tabular-nums">
                    {open.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed
                {batches ? (
                  <span className="text-muted-foreground tabular-nums">
                    {closed.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {chosen.length ? (
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {clubNote ? (
                <span className="text-caption text-warning-ink">
                  {clubNote}
                </span>
              ) : null}
              <span className="text-caption text-muted-foreground tabular-nums">
                {chosen.length} selected
              </span>
              <Button
                variant="outline"
                disabled={chosen.length < 2 || !sameClient || clubbing}
                onClick={() => void club()}
              >
                <Layers2Icon data-icon="inline-start" aria-hidden />
                Club {chosen.length} batches
              </Button>
            </div>
          ) : null}
        </div>

        {batches === null ? (
          <div className="flex flex-col gap-2 px-6 pb-6">
            <Skeleton className="h-10" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : batches.length > 0 && shown.length === 0 ? (
          <p className="px-6 pb-6 text-body-compact text-muted-foreground">
            {view === "completed"
              ? "No completed batches."
              : "No batches in progress."}
          </p>
        ) : batches.length === 0 ? (
          <Empty className="border-0 pb-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Layers2Icon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No batches yet</EmptyTitle>
              <EmptyDescription>
                Cases pushed from a client&apos;s system, or uploaded from
                Excel, arrive here as batches.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {/* Phones: one stacked card per batch, nothing to scroll sideways. */}
            <ul
              className="flex flex-col divide-y divide-hairline md:hidden"
              aria-label="Batches"
            >
              {shown.map((b) => {
                const selectable = !finished(b) && !b.notCreated;
                return (
                  <li key={b.id} className="flex items-start gap-3 px-4 py-3">
                    {selectable ? (
                      <span className="flex h-10 items-center">
                        <Checkbox
                          checked={picked.has(b.id)}
                          onCheckedChange={(v) =>
                            setPicked((prev) => {
                              const next = new Set(prev);
                              if (v === true) next.add(b.id);
                              else next.delete(b.id);
                              return next;
                            })
                          }
                          aria-label={`Select ${b.number}`}
                        />
                      </span>
                    ) : null}
                    <Link
                      href={hrefOf(b)}
                      className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none"
                    >
                      <span className="flex min-h-10 flex-wrap items-center gap-2">
                        <span className="text-body-compact font-semibold tabular-nums">
                          {b.number}
                        </span>
                        {b.openedAt === null ? (
                          <Badge variant="destructive">New</Badge>
                        ) : null}
                        <span className="ml-auto text-caption text-muted-foreground tabular-nums">
                          {b.total} case{b.total === 1 ? "" : "s"} ·{" "}
                          {toLongDate(b.createdAt.slice(0, 10))}
                        </span>
                      </span>
                      <SourceLabel
                        source={b.source}
                        to={
                          b.source.kind === "api"
                            ? b.filingAdvocate?.name
                            : null
                        }
                      />
                      {b.notCreated ? (
                        <span className="flex flex-col text-body-compact">
                          <span className="font-medium">Not created yet</span>
                          <span className="text-muted-foreground">{sentence(b.notCreated.where)}</span>
                        </span>
                      ) : b.clubbedInto ? (
                        <Badge variant="outline">
                          Clubbed into {b.clubbedIntoNumber}
                        </Badge>
                      ) : b.total > 0 && b.counts.filed === b.total ? (
                        <Badge variant="success">
                          <CircleCheckIcon
                            data-icon="inline-start"
                            aria-hidden
                          />
                          Done: all {b.total} filed
                        </Badge>
                      ) : (
                        <StageBar counts={b.states} />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto px-2 pb-2 md:block">
              <Table
                className="border-separate border-spacing-0"
                aria-label="Batches"
              >
                <TableHeader>
                  <TableRow className={TABLE_HEAD_ROW}>
                    <TableHead className={cn(TABLE_HEAD, "w-12 pl-6")}>
                      <span className="sr-only">Select</span>
                    </TableHead>
                    <TableHead className={TABLE_HEAD}>Batch</TableHead>
                    <TableHead className={TABLE_HEAD}>Came in by</TableHead>
                    <TableHead className={TABLE_HEAD}>Complainant</TableHead>
                    <TableHead className={TABLE_HEAD}>Received</TableHead>
                    <TableHead className={cn(TABLE_HEAD, "text-right")}>
                      Cases
                    </TableHead>
                    <TableHead className={cn(TABLE_HEAD, "pr-6")}>
                      Where they stand
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={tableBodyClass({ selectable: true })}>
                  {shown.map((b) => row(b, !finished(b) && !b.notCreated))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        title={deleting ? `Delete ${deleting.number}?` : "Delete this batch?"}
        description="It isn't created yet, so no case is lost: what you entered for this upload goes. Your Excel file stays as it is."
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

/**
 * A batch not created yet, where it stands: the words, then Continue (back where it was
 * left) and, for an upload, Delete (BLK-10m). An API batch can't be deleted here; it waits
 * for Facts of the case and Create (§3).
 */
function NotCreatedStatus({ b, onDelete }: { b: BatchSummary; onDelete: () => void }) {
  const n = b.notCreated!;
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">Not created yet</span>
        <span className="text-body-compact text-muted-foreground">{sentence(n.where)}</span>
      </span>
      <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Button asChild size="sm" variant="outline">
          <Link href={n.href}>
            Continue
            <ArrowRightIcon data-icon="inline-end" aria-hidden />
          </Link>
        </Button>
        {n.kind === "excel" ? (
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onDelete}>
            Delete
          </Button>
        ) : null}
      </span>
    </span>
  );
}
