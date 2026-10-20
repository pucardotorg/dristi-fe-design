"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheckIcon, DownloadIcon, FileSpreadsheetIcon, Layers2Icon, PlugIcon, UploadIcon } from "lucide-react";

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
import { PANEL_CLASS } from "@/components/filing/form-card";
import { PAGE_GROUND, PAGE_GUTTER, PAGE_SUBTITLE, PAGE_TITLE } from "@/components/shell/page-frame";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { bulkApi, type BatchSummary } from "./api";
import { useGujarat } from "./court-guard";
import { StageBar } from "./stage";

export async function downloadTemplate() {
  const blob = await buildTemplate();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = TEMPLATE_FILE;
  a.click();
  URL.revokeObjectURL(url);
}

export function SourceLabel({ source }: { source: BatchSummary["source"] }) {
  const Icon = source.kind === "api" ? PlugIcon : source.kind === "excel" ? FileSpreadsheetIcon : Layers2Icon;
  return (
    <span className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span>{source.kind === "api" ? `${source.system} API` : source.kind === "excel" ? "Excel upload" : "Clubbed"}</span>
        {source.reference ? (
          <span className="truncate text-caption text-muted-foreground" title={source.reference}>
            {source.reference}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/** Every batch, newest first. Batches never mix; clubbing is the filer's deliberate act. */
export function BatchesScreen() {
  const ready = useGujarat();
  const router = useRouter();
  const [batches, setBatches] = React.useState<BatchSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [clubbing, setClubbing] = React.useState(false);

  const load = React.useCallback(() => {
    bulkApi.list().then(setBatches, (e: Error) => setError(e.message));
  }, []);
  React.useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const open = (batches ?? []).filter((b) => !b.clubbedInto);
  const closed = (batches ?? []).filter((b) => b.clubbedInto);
  const chosen = open.filter((b) => picked.has(b.id));
  const sameClient = new Set(chosen.map((b) => b.client)).size <= 1;
  const clubNote =
    chosen.length < 2 ? null : !sameClient ? "Only batches for the same complainant can be clubbed." : null;

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

  const row = (b: BatchSummary, selectable: boolean) => (
    <TableRow
      key={b.id}
      className={cn(tableRowClass({ selectable }), "cursor-pointer")}
      data-state={picked.has(b.id) ? "selected" : undefined}
      onClick={() => router.push(`/filings/bulk/${b.id}`)}
    >
      <TableCell className={cn(TABLE_CELL, "w-12 pl-6")} onClick={(e) => e.stopPropagation()}>
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
        <Link href={`/filings/bulk/${b.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
          {b.number}
        </Link>
        {b.openedAt === null ? (
          <Badge variant="destructive" className="ml-2">
            New
          </Badge>
        ) : null}
        {b.clubbedFrom.length ? (
          <div className="text-caption font-normal text-muted-foreground">From {b.clubbedFrom.join(", ")}</div>
        ) : null}
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "max-w-56 whitespace-normal")}>
        <SourceLabel source={b.source} />
        {b.source.kind === "api" && b.filingAdvocate ? (
          <div className="text-caption text-muted-foreground">To {b.filingAdvocate.name}</div>
        ) : null}
      </TableCell>
      <TableCell className={cn(TABLE_CELL, "whitespace-normal")}>{b.client}</TableCell>
      <TableCell className={cn(TABLE_CELL, "tabular-nums")}>{toLongDate(b.createdAt.slice(0, 10))}</TableCell>
      <TableCell className={cn(TABLE_CELL, "text-right tabular-nums")}>{b.total}</TableCell>
      <TableCell className={cn(TABLE_CELL, "pr-6 whitespace-normal")}>
        {b.clubbedInto ? (
          <Badge variant="outline">Clubbed into {b.clubbedIntoNumber}</Badge>
        ) : b.total > 0 && b.counts.filed === b.total ? (
          <Badge variant="success">
            <CircleCheckIcon data-icon="inline-start" aria-hidden />
            Done: all {b.total} filed
          </Badge>
        ) : (
          <StageBar counts={b.counts} />
        )}
      </TableCell>
    </TableRow>
  );

  return (
    <div className={cn("flex w-full flex-1 flex-col gap-6", PAGE_GROUND, PAGE_GUTTER)}>
      <header className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="flex flex-col gap-1">
          <h1 className={cn(PAGE_TITLE, "text-foreground")}>Bulk filing</h1>
          <p className={PAGE_SUBTITLE}>Each push from a client&apos;s system and each Excel upload is its own batch.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row md:ml-auto">
          <Button variant="outline" onClick={() => void downloadTemplate()}>
            <DownloadIcon data-icon="inline-start" aria-hidden />
            Download Excel template
          </Button>
          <Button asChild>
            <Link href="/filings/bulk/upload">
              <UploadIcon data-icon="inline-start" aria-hidden />
              Upload Excel
            </Link>
          </Button>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className={cn(PANEL_CLASS, "gap-0 py-0")}>
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <h2 className="text-body font-semibold">Batches</h2>
          {chosen.length ? (
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {clubNote ? <span className="text-caption text-warning-ink">{clubNote}</span> : null}
              <span className="text-caption text-muted-foreground tabular-nums">{chosen.length} selected</span>
              <Button variant="outline" disabled={chosen.length < 2 || !sameClient || clubbing} onClick={() => void club()}>
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
        ) : batches.length === 0 ? (
          <Empty className="border-0 pb-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Layers2Icon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>No batches yet</EmptyTitle>
              <EmptyDescription>Cases pushed from a client&apos;s system, or uploaded from Excel, arrive here as batches.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto px-2 pb-2">
            <Table className="border-separate border-spacing-0" aria-label="Batches">
              <TableHeader>
                <TableRow className={TABLE_HEAD_ROW}>
                  <TableHead className={cn(TABLE_HEAD, "w-12 pl-6")}>
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead className={TABLE_HEAD}>Batch</TableHead>
                  <TableHead className={TABLE_HEAD}>Came in by</TableHead>
                  <TableHead className={TABLE_HEAD}>Complainant</TableHead>
                  <TableHead className={TABLE_HEAD}>Received</TableHead>
                  <TableHead className={cn(TABLE_HEAD, "text-right")}>Cases</TableHead>
                  <TableHead className={cn(TABLE_HEAD, "pr-6")}>Where they stand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={tableBodyClass({ selectable: true })}>
                {open.map((b) => row(b, true))}
                {closed.map((b) => row(b, false))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
