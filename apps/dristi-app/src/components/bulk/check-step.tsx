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
import { DETAIL_FIELDS, DETAIL_FIELD_GROUPS, detailField, bracketsIn } from "@/lib/filing/detail-fields";
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
import { Card, CardContent } from "@/components/ui/card";
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
import { RichTextEditor, type BracketMarks, type RichTextEditorHandle } from "@/components/filing/rich-text-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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
  /** The facts of the case this case will hold, as Create writes them. */
  facts: string;
  /** Its row brings its own facts of the case in the file. */
  own: boolean;
  /** Its facts come from the batch's text (for an `own` case: chosen instead of the row's). */
  fromBatch: boolean;
  /** What each field reads as in this case (first case only, for the editor's field card). */
  sample?: Record<string, string>;
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
        const ownText = new Set(request.cases.filter((c) => c.otherDetails?.trim()).map((c) => c.reference.trim()));
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
              facts: bc.draft.adr.otherDetails ?? "",
              own: ownText.has(bc.reference),
              fromBatch: !!bc.draft.adr.detailsFormat,
              sample: i === 0 ? Object.fromEntries(DETAIL_FIELDS.map((f) => [f.name, f.resolve(bc.draft)])) : undefined,
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

const FIELD_LIST = DETAIL_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => ({ name: f.name, group: g.label })));
/** The story reads as prose: body size, open leading, room between its paragraphs. */
const STORY_CLASS = "px-6 py-5 text-body leading-7 [&_li]:mb-2 [&_li]:pl-1 [&_ol]:ml-1 [&_p]:mb-4";

/** A case's facts, read-only, with any part still to write marked as the editor marks it. */
function previewHtml(html: string): string {
  return html.replace(/(^|>)([^<]*)/g, (_, open: string, text: string) =>
    open +
    text.replace(
      /\[([^\]\n]+)\]/g,
      (_w, name: string) =>
        `<mark class="rounded-md border border-dashed border-warning-ink bg-warning-muted px-1 text-warning-muted-foreground">${name}</mark>`,
    ),
  );
}

/**
 * Facts of the case (PRD PRY-1, "Additional details" in the file; optional): the story the
 * advocate tells, written once here for the batch (owner, 2026-11-12). Fields in the text
 * are tokens each case fills; the parts no field can fill are highlighted to write here.
 *
 * Rows that bring their own story in the file: whether this text replaces theirs is asked
 * on Continue, once the text exists (owner, 2026-11-12; `upload-screen.tsx`). Here Preview
 * only shows where each case's story comes from, so the filer can read them first.
 */
export function FactsCard({
  formats,
  templateId,
  html,
  onChange,
  own,
  total,
  cases,
}: {
  formats: readonly DetailsFormat[];
  templateId: string | undefined;
  html: string;
  onChange: (templateId: string | undefined, html: string) => void;
  /** Rows whose Additional details column has text. */
  own: number;
  total: number;
  /** The cases as Create will make them, for the preview; `null` while they are built. */
  cases: CheckCase[] | null;
}) {
  const editor = React.useRef<RichTextEditorHandle>(null);
  const [pending, setPending] = React.useState<DetailsFormat | null>(null);
  const [previewKey, setPreviewKey] = React.useState<string>("");
  const [mode, setMode] = React.useState<"write" | "preview">("write");

  const current = formats.find((f) => f.id === templateId);
  const edited = current ? html !== formatForFiler(current) : !isEmpty(html);
  const blanks = writtenBlanks(html);
  const empty = isEmpty(html);
  const ownCases = cases?.filter((c) => c.own) ?? [];
  // The cases with their own story first: they are the ones the question on Continue is about.
  const listed = cases ? [...ownCases, ...cases.filter((c) => !c.own)] : [];
  const preview = listed.find((c) => c.key === previewKey) ?? listed[0] ?? null;
  // The editor's brackets: fields it offers on `[`, and a real case to show a field's value.
  const first = cases?.[0];
  const marks = React.useMemo<BracketMarks>(
    () => ({
      isField: (name) => !!detailField(name),
      fields: FIELD_LIST,
      sample: (name) => first?.sample?.[detailField(name)?.name ?? name] || undefined,
      sampleLabel: first?.accused || undefined,
    }),
    [first],
  );

  const choose = (format: DetailsFormat) => {
    if (edited) setPending(format);
    else onChange(format.id, formatForFiler(format));
  };

  return (
    <Card variant="raised">
      <CardContent className="flex flex-col gap-5">
        {/* Write and Preview share one box, so the preview is never a scroll away
            (owner, 2026-11-12). */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as "write" | "preview")} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="preview" disabled={(empty && !own) || !cases?.length}>
                Preview
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="write" className="mt-0">
        <div className="flex flex-col gap-2">
            <RichTextEditor
              value={html}
              onChange={(next) => onChange(templateId, next)}
              placeholder="Write the facts, or start from a template"
              ariaLabel="Facts of the case"
              minHeightClassName="min-h-96"
              contentClassName={STORY_CLASS}
              handleRef={editor}
              marks={marks}
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
            {/* One line, and only when something is left: the highlighted parts are the story. */}
            {empty ? (
              <p className="text-body-compact text-muted-foreground">
                Left empty, these cases go without facts of the case. They can still be written in each case.
              </p>
            ) : blanks.length ? (
              <p className="flex items-start gap-2 text-body-compact">
                <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-ink" />
                <span>
                  {blanks.length === 1 ? "1 highlighted part is" : `${blanks.length} highlighted parts are`} still to
                  write. Write {blanks.length === 1 ? "it" : "them"} here for every case, or later in each one.
                </span>
              </p>
            ) : null}
          </div>
          </TabsContent>
          <TabsContent value="preview" className="mt-0 flex flex-col gap-2">
            {/* Every case on the left, the one chosen read as it will be filed on the right:
                a click is answered by the page beside it. */}
            <div className="grid gap-4 md:grid-cols-[17rem_minmax(0,1fr)]">
              <ul aria-label="Cases" className="flex max-h-[34rem] flex-col gap-0.5 overflow-y-auto rounded-xl bg-surface-sunken p-1.5">
                {listed.map((c, i) => {
                  const on = c.key === preview?.key;
                  const head = i === 0 && own > 0 ? `Own story in the Excel · ${own}` : i === own && own > 0 ? `No story in the Excel · ${total - own}` : null;
                  return (
                    <li key={c.key} className="flex flex-col">
                      {head ? (
                        <span className={cn("px-3 pb-1 text-body-compact text-muted-foreground tabular-nums", i ? "pt-4" : "pt-2")}>
                          {head}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-current={on || undefined}
                        onClick={() => setPreviewKey(c.key)}
                        className={cn(
                          "flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-body-compact outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                          on ? "bg-card font-medium shadow-raised" : "hover:bg-accent",
                        )}
                      >
                        <span className="min-w-0 truncate">{c.accused || c.reference}</span>
                        {c.own ? (
                          <span className="shrink-0 text-muted-foreground">{c.fromBatch ? "Batch text" : "Excel story"}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {preview ? (
                <div className="flex min-w-0 flex-col rounded-xl border border-input bg-card">
                  <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-hairline py-2 pr-6 pl-6">
                    <span className="min-w-0 truncate text-body font-semibold">{preview.accused || preview.reference}</span>
                    <span className="text-body-compact text-muted-foreground">
                      {preview.own && !preview.fromBatch ? "Excel story" : "Batch text"}
                    </span>
                  </div>
                  <div
                    key={`${preview.key}-${preview.fromBatch}`}
                    className={cn(
                      "min-h-96 animate-in text-foreground duration-200 fade-in-0 [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc [&_p:last-child]:mb-0",
                      STORY_CLASS,
                    )}
                    // The case's own facts, built by the app from its text and row (escaped there).
                    dangerouslySetInnerHTML={{ __html: previewHtml(preview.facts) || "<p>No facts of the case.</p>" }}
                  />
                </div>
              ) : null}
            </div>
            <p className="text-body-compact text-muted-foreground">
              How each case reads in its complaint, under Facts of the case.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>

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
