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
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileSpreadsheetIcon,
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
import { Badge } from "@/components/ui/badge";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { cn } from "@/lib/utils";

import { aboutDetails } from "./batch-marks";
import { StatusWord } from "./stage";

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

/**
 * Check's one decision, as one card (owner, 2026-11-12: three equal stat tiles read as a
 * sum and decided nothing). The file and what became of its rows (BLK-10, BLK-36), then
 * the cases it makes as the hero, then how many of those Case details will ask about, by
 * the same rules (`caseFlags`), so the counts agree after Create. Counts only: never a
 * list of cases or reasons, which would not scale to a 500-row file.
 */
export function CheckCard({
  source,
  meta,
  total,
  fix,
  check,
  created = false,
  footer,
}: {
  /** The file, or the system that sent the batch. */
  source: string;
  /** What became of the file's rows: "14 rows · 2 template rows set aside". */
  meta?: string;
  total: number;
  fix: number;
  check: number;
  /** The batch exists: say what it holds rather than what it will. */
  created?: boolean;
  /** The facts of the case line, with its way back. */
  footer?: React.ReactNode;
}) {
  const done = total - fix - check;
  return (
    <Card variant="raised" className="gap-0 p-0">
      <div className="flex items-center gap-4 px-6 pt-6">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand-muted-foreground">
          <FileSpreadsheetIcon className="size-6" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="truncate text-title-s font-semibold" title={source}>
            {source}
          </h2>
          {meta ? <p className="text-body-compact text-muted-foreground tabular-nums">{meta}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-3 px-6 pt-6 pb-6">
        <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
          <span className="text-title-l font-semibold">
            {total} {total === 1 ? "case" : "cases"}
          </span>
          <span className="text-body text-muted-foreground">{created ? "in this batch" : "will be created as drafts"}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-body-compact tabular-nums">
          {fix ? <StatusWord state="fix" word={`${fix} to fix`} /> : null}
          {check ? <StatusWord state="check" word={`${check} to check`} /> : null}
          <span className="text-muted-foreground">
            {done === total ? "Nothing to fix or check" : `${done} with nothing to fix or check`}
          </span>
        </div>
        {fix + check ? (
          <p className="text-body-compact text-muted-foreground">
            {created ? "They're worked through in Case details." : "You'll work through them in Case details, after you create the batch."}
          </p>
        ) : null}
      </div>
      {footer ? <div className="border-t border-hairline px-6 py-4">{footer}</div> : null}
    </Card>
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
  const at = preview ? listed.indexOf(preview) : -1;
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

  const modeTabs = (
    <TabsList>
      <TabsTrigger value="write">Write</TabsTrigger>
      <TabsTrigger value="preview" disabled={(empty && !own) || !cases?.length}>
        Preview
      </TabsTrigger>
    </TabsList>
  );

  const choose = (format: DetailsFormat) => {
    if (edited) setPending(format);
    else onChange(format.id, formatForFiler(format));
  };

  return (
    <Card variant="raised">
      <CardContent className="flex flex-col gap-5">
        {/* What this text is for, up front: the empty rows. What becomes of the rows that
            already have a story is asked on Continue (owner, 2026-11-12). */}
        {own > 0 ? (
          <div className="flex flex-col gap-0.5 tabular-nums">
            <p className="text-body-compact font-semibold">
              Writing for the {total - own} {total - own === 1 ? "case" : "cases"} with no story in the Excel
            </p>
            <p className="text-body-compact text-muted-foreground">
              {own === 1
                ? "1 case already has its own. You'll choose what happens to it when you continue."
                : `${own} cases already have their own. You'll choose what happens to them when you continue.`}
            </p>
          </div>
        ) : null}

        {/* Write and Preview are the box's own header, as on a comment box: one frame,
            its first control the mode, its tools after it (owner, 2026-11-12). */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as "write" | "preview")} className="flex flex-col gap-4">
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
              toolbarStart={modeTabs}
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
            {/* One document, read in the page's own scroll (owner, 2026-11-12: a list beside
                it scrolled inside the scroll). Its toolbar moves between cases the way the
                Write box's toolbar formats text: the same frame in both tabs. */}
            {preview ? (
              <div className="flex min-w-0 flex-col rounded-xl border border-input bg-card">
                <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2">
                  {modeTabs}
                  <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                  <div className="w-60 min-w-0">
                    <CasePicker cases={listed} value={preview} onChange={(c) => setPreviewKey(c.key)} />
                  </div>
                  {preview.own && !preview.fromBatch ? <Badge variant="secondary">From the Excel</Badge> : null}
                  {/* The pager where mail and document viewers keep it: count, then arrows. */}
                  <div className="ml-auto flex items-center gap-1">
                    <span className="mr-2 text-body-compact text-muted-foreground tabular-nums">
                      {at + 1} of {listed.length}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Previous case"
                      disabled={at <= 0}
                      onClick={() => setPreviewKey(listed[at - 1].key)}
                    >
                      <ChevronLeftIcon aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Next case"
                      disabled={at >= listed.length - 1}
                      onClick={() => setPreviewKey(listed[at + 1].key)}
                    >
                      <ChevronRightIcon aria-hidden />
                    </Button>
                  </div>
                </div>
                <div
                  key={`${preview.key}-${preview.fromBatch}`}
                  className={cn(
                    "min-h-72 animate-in text-foreground duration-200 fade-in-0 [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc [&_p:last-child]:mb-0",
                    STORY_CLASS,
                  )}
                  // The case's own facts, built by the app from its text and row (escaped there).
                  dangerouslySetInnerHTML={{ __html: previewHtml(preview.facts) || "<p>No facts of the case.</p>" }}
                />
              </div>
            ) : null}
            <p className="text-body-compact text-muted-foreground">
              As it reads in each complaint, under Facts of the case.
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

type CaseGroup = { value: string; items: CheckCase[] };

/**
 * Preview's case picker, typeable like the filing's selects, with the cases grouped by
 * where their story comes from, so the list itself says which are which (owner,
 * 2026-11-12). Only the batch's own cases, so it lives here rather than in the shared
 * `OptionSelect`.
 */
function CasePicker({
  cases,
  value,
  onChange,
}: {
  cases: CheckCase[];
  value: CheckCase;
  onChange: (c: CheckCase) => void;
}) {
  const label = (c: CheckCase) => c.accused || c.reference;
  const fromExcel = cases.filter((c) => c.own && !c.fromBatch);
  const groups: CaseGroup[] = [
    { value: `From the Excel · ${fromExcel.length}`, items: fromExcel },
    { value: `Batch text · ${cases.length - fromExcel.length}`, items: cases.filter((c) => !(c.own && !c.fromBatch)) },
  ].filter((g) => g.items.length);
  return (
    <Combobox
      items={groups}
      value={value}
      onValueChange={(c) => {
        if (c) onChange(c as CheckCase);
      }}
      itemToStringLabel={(c) => label(c as CheckCase)}
      isItemEqualToValue={(a, b) => (a as CheckCase).key === (b as CheckCase).key}
      openOnInputClick
      autoHighlight
    >
      <ComboboxInput aria-label="Case to preview" autoComplete="off" className="w-full" />
      <ComboboxContent className="pointer-events-auto">
        <ComboboxEmpty>No match</ComboboxEmpty>
        <ComboboxList>
          {(group: CaseGroup) => (
            <ComboboxGroup key={group.value} items={group.items} className="not-first:mt-1">
              <ComboboxLabel className="text-body-compact tabular-nums">{group.value}</ComboboxLabel>
              <ComboboxCollection>
                {(c: CheckCase) => (
                  <ComboboxItem key={c.key} value={c}>
                    {label(c)}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/**
 * On leaving Facts, when some rows already have a story and the batch text exists: keep
 * their stories, or give every case the batch text. Built as plainly as
 * the DS dialog, title, a plain radio list and the footer band, with no more copy than
 * the two outcomes (owner, 2026-11-12). Counts only, so it reads the same for 4 cases or
 * 400; the safe choice is first and chosen unless the filer chose the other before.
 */
export function FactsQuestion({
  open,
  onOpenChange,
  own,
  total,
  initial,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  own: number;
  total: number;
  /** The filer chose to replace them before. */
  initial: boolean;
  onChoose: (everyCase: boolean) => void;
}) {
  const [every, setEvery] = React.useState(initial);
  const go = React.useRef<HTMLButtonElement>(null);
  const empty = total - own;
  const choices = [
    { value: "keep", label: "Keep them", detail: `The batch text goes into the other ${empty}.` },
    { value: "replace", label: "Replace them", detail: `All ${total} cases use the batch text.` },
  ];
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setEvery(initial);
        onOpenChange(next);
      }}
    >
      <ChromeDialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        // Focus lands on Continue, not on a radio: the choice is already made by default.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          go.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="tabular-nums">
            {own === 1 ? "1 case already has its own story" : `${own} cases already have their own story`}
          </DialogTitle>
          <DialogDescription>It came in the Excel. What should happen to {own === 1 ? "it" : "them"}?</DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={every ? "replace" : "keep"}
          onValueChange={(v) => setEvery(v === "replace")}
          aria-label="What happens to the stories in the Excel"
          className="flex flex-col gap-4 py-1"
        >
          {choices.map((c) => (
            <div key={c.value} className="flex items-start gap-3">
              <RadioGroupItem value={c.value} id={`facts-${c.value}`} className="mt-0.5" />
              <Label htmlFor={`facts-${c.value}`} className="flex flex-col items-start gap-0.5 tabular-nums">
                <span className="text-body-compact font-medium">{c.label}</span>
                <span className="text-body-compact font-normal text-muted-foreground">{c.detail}</span>
              </Label>
            </div>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button ref={go} type="button" onClick={() => onChoose(every)}>
            Continue
          </Button>
        </DialogFooter>
      </ChromeDialogContent>
    </Dialog>
  );
}
