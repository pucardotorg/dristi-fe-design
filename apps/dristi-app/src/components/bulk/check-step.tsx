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
import { totalChequeAmount } from "@/lib/filing/selectors";
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
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
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
import { DetailFieldMenu } from "@/components/filing/detail-field-menu";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/filing/rich-text-editor";

import { aboutDetails } from "./batch-marks";
import { CaseRows, type CaseRow } from "./case-rows";
import { FlagSummary } from "./scrutiny-tab";

/* ───────────────────────────── The cases, as Create will make them ───────────────────────────── */

export type CheckCase = {
  key: string;
  reference: string;
  accused: string;
  cheque: string;
  cheques: number;
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
            // Every accused and the total of every cheque: the batch's own rule, so a case
            // reads the same on both sides of Create (audit, 2026-11-10).
            return {
              key: `${bc.reference}-${i}`,
              reference: bc.reference,
              accused: bc.draft.accused.map((a) => a.name).filter(Boolean).join(", "),
              cheque: bc.draft.cheques[0]?.chequeNumber ?? "",
              cheques: bc.draft.cheques.length,
              amount: totalChequeAmount(bc.draft.cheques),
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

/** Every case the file makes, in the Cases step's one list. */
export function CheckCases({ cases }: { cases: CheckCase[] }) {
  const rows: CaseRow[] = cases.map((c) => ({
    ...c,
    // Before Create there are no documents yet, so nothing is "Ready to sign": a case
    // with nothing open in its details says so.
    status: <FlagSummary flags={c.flags} done="Details done" />,
  }));
  return (
    <CaseRows
      rows={rows}
      label="The cases this file makes"
      searchId="check-search"
      filters={[
        { id: "fix", label: "To fix" },
        { id: "check", label: "To check" },
        { id: "ready", label: "Details done" },
      ]}
    />
  );
}

/* ───────────────────────────── Facts of the case ───────────────────────────── */

/**
 * Check's one line about the facts decided on the step before, with the way back to it:
 * the decision is made on its own sub-step, not again beside the cases.
 */
export function FactsLine({ name, cases, onEdit }: { name: string | null; cases: number; onEdit: () => void }) {
  const n = `${cases} case${cases === 1 ? "" : "s"}`;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-body-compact text-muted-foreground tabular-nums">
      <span>
        {name ? (
          <>
            Facts of the case: <span className="text-foreground">{name}</span>, for {n}.
          </>
        ) : (
          <>No facts of the case for {n}.</>
        )}
      </span>
      <Button type="button" variant="link" className="h-auto p-0 text-body-compact" onClick={onEdit}>
        Change
      </Button>
    </p>
  );
}

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
      {/* The page is titled Facts of the case; the card opens on what the file brought. */}
      <CardHeader>
        <CardDescription className="text-body text-foreground tabular-nums">{fact}</CardDescription>
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
