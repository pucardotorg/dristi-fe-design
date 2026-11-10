"use client";

/**
 * The upload's Check: the cases the file will create, each judged by the same rules Case
 * details uses, and the facts of the case they start with.
 *
 * Owner, 2026-11-10: Check said "Nothing missing" for every row and Case details then had
 * 2 to fix and 10 to check, because Check only looked for empty cells. Now the cases are
 * built here exactly as Create builds them (`buildBatch`, then the batch's parties) and
 * read with `caseFlags`, so a case says the same thing on both sides of Create.
 */

import * as React from "react";
import {
  ExternalLinkIcon,
  FileTextIcon,
  ChevronDownIcon,
  PlusIcon,
  TriangleAlertIcon,
} from "lucide-react";

import type { ApiBatchRequest } from "@/lib/bulk/contract";
import { buildBatch, writeFacts } from "@/lib/bulk/intake";
import { applyParties, type BatchParties } from "@/lib/bulk/parties";
import { caseFlags, type Flag } from "@/lib/bulk/scrutiny";
import { detailField, bracketsIn } from "@/lib/filing/detail-fields";
import { formatForFiler, type DetailsFormat } from "@/lib/filing/details-formats";
import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DetailFieldMenu } from "@/components/filing/detail-field-menu";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/filing/rich-text-editor";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";

import { aboutDetails } from "./batch-marks";
import { CaseSearch, Pager, pageOf } from "./case-list-tools";
import { FlagSummary } from "./scrutiny-tab";

/* ───────────────────────────── The cases, as Create will make them ───────────────────────────── */

export type CheckCase = {
  key: string;
  reference: string;
  accused: string;
  cheque: string;
  amount: number;
  /** About the case's details; documents are the Documents step's. */
  flags: Flag[];
  state: "ready" | "fix" | "check";
};

/**
 * The cases the request makes, judged as Case details will judge them. `null` while they
 * are being built. Rebuilt a moment after the request stops changing (typing in the facts).
 */
export function useCheckCases(request: ApiBatchRequest | null, parties: BatchParties | null): CheckCase[] | null {
  const [cases, setCases] = React.useState<CheckCase[] | null>(null);
  React.useEffect(() => {
    if (!request) return;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const built = await buildBatch(request, { kind: "excel", system: "Excel upload" }, async () => null);
        if (!alive) return;
        setCases(
          built.cases.map((bc, i) => {
            if (parties) {
              applyParties(bc.draft, parties);
              bc.unknownBar = [];
              if (request.detailsFormat && bc.draft.adr.detailsFormat) writeFacts(bc.draft, request.detailsFormat);
            }
            const flags = caseFlags(bc).filter(aboutDetails);
            const q = bc.draft.cheques[0];
            return {
              key: `${bc.reference}-${i}`,
              reference: bc.reference,
              accused: bc.draft.accused[0]?.name || "",
              cheque: q?.chequeNumber ?? "",
              amount: Number(String(q?.amount ?? "").replace(/[^\d.]/g, "")) || 0,
              flags,
              state: flags.some((f) => f.level === "hold") ? "fix" : flags.length ? "check" : "ready",
            };
          }),
        );
      } catch {
        if (alive) setCases([]);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [request, parties]);
  return request ? cases : null;
}

export function checkCounts(cases: CheckCase[]) {
  return {
    ready: cases.filter((c) => c.state === "ready").length,
    fix: cases.filter((c) => c.state === "fix").length,
    check: cases.filter((c) => c.state === "check").length,
  };
}

type Show = "all" | "ready" | "fix" | "check";

/** Every case the file makes, in Case details' own row: who, reference, what is left. */
export function CheckCases({ cases }: { cases: CheckCase[] }) {
  const [show, setShow] = React.useState<Show>("all");
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(0);
  const n = checkCounts(cases);
  const term = q.trim().toLowerCase();
  const list = cases
    .filter((c) => show === "all" || c.state === show)
    .filter((c) => !term || [c.accused, c.reference, c.cheque].some((v) => v.toLowerCase().includes(term)));
  const { pages, at, shown } = pageOf(list, page);

  return (
    <section aria-label="The cases this file makes" className="flex flex-col gap-3">
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
        >
          <SegmentedControlItem value="all">All {cases.length}</SegmentedControlItem>
          {n.fix ? <SegmentedControlItem value="fix">To fix {n.fix}</SegmentedControlItem> : null}
          {n.check ? <SegmentedControlItem value="check">To check {n.check}</SegmentedControlItem> : null}
          <SegmentedControlItem value="ready">Ready {n.ready}</SegmentedControlItem>
        </SegmentedControl>
        <CaseSearch
          id="check-search"
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(0);
          }}
        />
      </div>
      <Card variant="raised" className="gap-0 p-2">
        <div className="overflow-x-auto">
          <Table className="border-separate border-spacing-0" aria-label="Cases this file makes">
            <TableHeader>
              <TableRow className={TABLE_HEAD_ROW}>
                <TableHead className={TABLE_HEAD}>Accused</TableHead>
                <TableHead className={TABLE_HEAD}>Your reference</TableHead>
                <TableHead className={TABLE_HEAD}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className={tableBodyClass({ hover: false })}>
              {shown.map((c) => (
                <TableRow key={c.key} className={tableRowClass({ hover: false })}>
                  <TableCell className={TABLE_CELL}>
                    <span className="font-medium">{c.accused || "—"}</span>
                    <span className="block text-body-compact text-muted-foreground tabular-nums">
                      {c.cheque ? `Cheque ${c.cheque}` : ""}
                      {c.amount ? ` · ${money(c.amount)}` : ""}
                    </span>
                  </TableCell>
                  <TableCell className={cn(TABLE_CELL, "font-mono")}>{c.reference || "—"}</TableCell>
                  <TableCell className={cn(TABLE_CELL, "w-full min-w-64 whitespace-normal")}>
                    <FlagSummary flags={c.flags} done="Ready" />
                  </TableCell>
                </TableRow>
              ))}
              {shown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className={cn(TABLE_CELL, "py-8 text-center text-muted-foreground")}>
                    No cases match.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <Pager total={list.length} at={at} pages={pages} onPage={setPage} />
      </Card>
    </section>
  );
}

/* ───────────────────────────── Facts of the case ───────────────────────────── */

const FORMATS_HREF = "/filings/formats";
const isEmpty = (html: string) => !html.replace(/<[^>]*>|&nbsp;/g, "").trim();

/** The parts of a text no case's details can fill: written in each case. */
export function writtenBlanks(html: string): string[] {
  return bracketsIn(html).filter((name) => !detailField(name));
}

/**
 * The facts of the case the cases start with (PRD PRY-1, "Additional details" in the file
 * and the form; optional). The text arrives already written from the system template;
 * the filer edits it, switches template, or clears it, and is told what each means.
 * A row that brings its own text in the file keeps it.
 */
export function FactsCard({
  formats,
  templateId,
  html,
  onChange,
  own,
  total,
}: {
  formats: readonly DetailsFormat[];
  templateId: string | undefined;
  html: string;
  onChange: (templateId: string | undefined, html: string) => void;
  /** Rows whose Additional details column has text. */
  own: number;
  total: number;
}) {
  const editor = React.useRef<RichTextEditorHandle>(null);
  const [pending, setPending] = React.useState<DetailsFormat | null>(null);
  const rest = total - own;
  const current = formats.find((f) => f.id === templateId);
  const edited = current ? html !== formatForFiler(current) : !isEmpty(html);
  const blanks = writtenBlanks(html);
  const empty = isEmpty(html);

  const choose = (format: DetailsFormat) => {
    if (edited) setPending(format);
    else onChange(format.id, formatForFiler(format));
  };

  const fact =
    own === 0
      ? `No row has text in the file's Additional details column, so all ${total} cases start with the text below.`
      : rest === 0
        ? `All ${total} rows bring their own in the file's Additional details column, and keep it.`
        : `${own} of ${total} rows bring their own in the file's Additional details column and keep it. The other ${rest} start with the text below.`;

  return (
    <Card variant="raised">
      <CardHeader>
        <CardTitle className="text-body font-semibold">Facts of the case</CardTitle>
        <CardDescription className="tabular-nums">{fact}</CardDescription>
      </CardHeader>
      {rest > 0 ? (
        <CardContent className="flex flex-col gap-3">
          <RichTextEditor
            value={html}
            onChange={(next) => onChange(templateId, next)}
            placeholder="Write the facts, or start from a template"
            ariaLabel="Facts of the case"
            minHeightClassName="min-h-64"
            handleRef={editor}
            toolbarEnd={
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="max-w-64">
                      <FileTextIcon data-icon="inline-start" aria-hidden />
                      <span className="truncate">{current ? current.name : "Templates"}</span>
                      <ChevronDownIcon data-icon="inline-end" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-64">
                    <DropdownMenuLabel>Start from a template</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={current?.id ?? ""}
                      onValueChange={(id) => {
                        const format = formats.find((f) => f.id === id);
                        if (format) choose(format);
                      }}
                    >
                      {formats.map((f) => (
                        <DropdownMenuRadioItem key={f.id} value={f.id}>
                          {f.name || "Untitled"}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href={FORMATS_HREF} target="_blank" rel="noopener">
                        <PlusIcon aria-hidden />
                        New template
                        <ExternalLinkIcon aria-hidden className="ml-auto text-muted-foreground" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DetailFieldMenu
                  onPick={(field) => editor.current?.insertText(`[${field.name}]`)}
                  describe={() => "Filled in from each case"}
                />
              </>
            }
          />

          {/* What the text in the box means for the cases, in one place. */}
          {empty ? (
            <p className="text-body-compact text-muted-foreground">
              Left empty, the {rest} case{rest === 1 ? "" : "s"} go without facts of the case. They are
              optional, and can still be written in each case.
            </p>
          ) : (
            <div className="flex flex-col gap-2 text-body-compact">
              <p className="text-muted-foreground">
                Each case gets this text with its own details in place of the fields in brackets.
              </p>
              {blanks.length ? (
                <p className="flex items-start gap-2">
                  <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-ink" />
                  <span>
                    {blanks.length === 1 ? "One part" : `${blanks.length} parts`} can only be written in each case
                    ({blanks.map((b) => `“${b}”`).join(", ")}). Those cases wait under To check until{" "}
                    {blanks.length === 1 ? "it is" : "they are"} written.
                  </span>
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      ) : null}

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the text with &ldquo;{pending?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>Your changes to the text in the box will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my text</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) onChange(pending.id, formatForFiler(pending));
                setPending(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
