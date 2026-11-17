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
  BookmarkPlusIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ChevronDownIcon,
  Settings2Icon,
  TriangleAlertIcon,
} from "lucide-react";

import type { ApiBatchRequest } from "@/lib/bulk/contract";
import type { FactsPicks } from "@/lib/bulk/types";
import { buildBatch, writeFacts } from "@/lib/bulk/intake";
import { applyParties, type BatchParties } from "@/lib/bulk/parties";
import { caseFlags, type Flag } from "@/lib/bulk/scrutiny";
import { TEMPLATE_FIELD_GROUPS, detailField, bracketsIn } from "@/lib/filing/detail-fields";
import {
  DEFAULT_FORMATS,
  formatForFiler,
  newFormatId,
  saveDetailsFormat,
  type DetailsFormat,
} from "@/lib/filing/details-formats";
import { draftTitle, totalChequeAmount } from "@/lib/filing/selectors";
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
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { cn } from "@/lib/utils";

import { aboutDetails } from "./batch-marks";
import { CaseFinder, CaseStepper, type FinderCase } from "./case-finder";
import { FactsCases, type FactsSource } from "./facts-cases";
import { STATE } from "./stage";

/* ───────────────────────────── The cases, as Create will make them ───────────────────────────── */

export type CheckCase = {
  key: string;
  reference: string;
  /** "Tata Capital Ltd vs. Paresh V. Panchal": how a case is read. */
  title: string;
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
  /** Where its facts come from: its own, the batch's text, written for it on the screen. */
  source: FactsSource;
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
/**
 * Where cases' own stories came from, in the screens' words: "the Excel" for an upload,
 * "Provakil's request" for a push (§3), so Facts of the case never names a file there isn't.
 */
export const StoriesFrom = React.createContext<string>("the Excel");

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
              title: draftTitle(bc.draft),
              accused: bc.draft.accused.map((a) => a.name).filter(Boolean).join(", "),
              cheque: bc.draft.cheques[0]?.chequeNumber ?? "",
              cheques: bc.draft.cheques.length,
              amount: totalChequeAmount(bc.draft.cheques),
              facts: bc.draft.adr.otherDetails ?? "",
              own: ownText.has(bc.reference),
              fromBatch: !!bc.draft.adr.detailsFormat,
              source: request.factsFor?.[bc.reference]
                ? "written"
                : bc.draft.adr.detailsFormat
                  ? "batch"
                  : ownText.has(bc.reference)
                    ? "own"
                    : "none",
              sample: i === 0 ? Object.fromEntries(TEMPLATE_FIELD_GROUPS.flatMap((g) => g.fields).map((f) => [f.name, f.resolve(bc.draft)])) : undefined,
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

/** The cases the batch's text is for (or would be): none of their own kept or written. */
export const withoutOwn = (cases: CheckCase[]) => cases.filter((c) => c.source === "batch" || c.source === "none").length;

export function checkCounts(cases: CheckCase[]) {
  return {
    ready: cases.filter((c) => c.state === "ready").length,
    fix: cases.filter((c) => c.state === "fix").length,
    check: cases.filter((c) => c.state === "check").length,
  };
}

/**
 * Check's decision, said plainly (owner, 2026-11-12, after stat tiles, a hero line and a
 * ledger all read wrong): how many cases Create makes, then only what needs the filer,
 * one short sentence each. A case with nothing open needs no line. Counts come from the
 * same rules as Case details (`caseFlags`), so they agree after Create; never a list of
 * cases or reasons, which would not scale to a 500-row file.
 */
export function CheckCard({
  total,
  fix,
  check,
  cannot = 0,
  created = false,
  footer,
}: {
  total: number;
  fix: number;
  check: number;
  /** Rows the file can't make; listed in their own card below. */
  cannot?: number;
  /** The batch exists: say what it holds rather than what it will. */
  created?: boolean;
  /** The facts of the case line, with its way back. */
  footer?: React.ReactNode;
}) {
  const lines: { state: "fix" | "check"; text: string }[] = [];
  if (fix) lines.push({ state: "fix", text: `${fix} ${fix === 1 ? "needs" : "need"} fixing before ${fix === 1 ? "it can" : "they can"} be filed` });
  if (check) lines.push({ state: "check", text: `${check} ${check === 1 ? "has" : "have"} warnings to look at` });
  if (cannot) lines.push({ state: "fix", text: `${cannot} ${cannot === 1 ? "row" : "rows"} can't be created and ${cannot === 1 ? "is" : "are"} left out` });
  return (
    <Card variant="raised" className="gap-0 p-0">
      <div className="flex flex-col gap-4 p-6">
        <h2 className="text-title-s font-semibold tabular-nums">
          {total} {total === 1 ? "case" : "cases"} {created ? "in this batch" : "will be created"}
        </h2>
        {lines.length ? (
          <ul className="flex flex-col gap-2">
            {lines.map((l) => {
              const Icon = STATE[l.state].icon;
              return (
                <li key={l.text} className="flex items-center gap-3 text-body tabular-nums">
                  <Icon aria-hidden className={cn("size-4 shrink-0", STATE[l.state].ink)} />
                  {l.text}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">Every case is complete.</p>
        )}
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

// Every e-filing field, by the section it is entered in (BLK-10c); typing after `[` searches
// across sections.
const FIELD_LIST = TEMPLATE_FIELD_GROUPS.flatMap((g) => g.fields.map((f) => ({ name: f.name, group: g.label })));
/** The details read as prose: body size, open leading, room between its paragraphs. */
const PROSE_CLASS = "px-6 py-5 text-body leading-7 [&_li]:mb-2 [&_li]:pl-1 [&_ol]:ml-1 [&_p]:mb-4";

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

/** A case as the finder lists it: its title, and its row before the batch has a number. */
const finderCase = (from: string) => (c: CheckCase): FinderCase => ({
  id: c.key,
  title: c.title,
  draftNumber: /^R\d+$/.test(c.reference) ? `Row ${c.reference.slice(1)}` : c.reference,
  cheque: c.cheque,
  group: c.own && !c.fromBatch ? "own" : "batch",
  status: c.own && !c.fromBatch ? `From ${from}` : "This text",
});

/**
 * Facts of the case (PRD PRY-1, "Additional details" in the file; optional): the story the
 * advocate tells, written once here for the batch (owner, 2026-11-12). Fields in the text
 * are tokens each case fills; the parts no field can fill are highlighted to write here.
 *
 * Two tabs (owner, 2026-11-17): the batch text, open first because it is the work, and
 * every case with the facts it will hold, where each can take its own text, the batch's,
 * or text written for it alone (`facts-cases.tsx`). Nothing is asked on Continue.
 */
export function FactsCard({
  formats,
  templateId,
  html,
  onChange,
  own,
  total,
  cases,
  picks,
  onPicks,
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
  picks: FactsPicks;
  onPicks: (next: FactsPicks) => void;
}) {
  const from = React.useContext(StoriesFrom);
  const editor = React.useRef<RichTextEditorHandle>(null);
  const [pending, setPending] = React.useState<DetailsFormat | null>(null);
  const [previewKey, setPreviewKey] = React.useState<string>("");
  const [mode, setMode] = React.useState<"write" | "preview">("write");

  const current = formats.find((f) => f.id === templateId);
  // The default everyone has, and the filer's own templates (BLK-10d, Q-18).
  const builtIn = formats.filter((f) => DEFAULT_FORMATS.some((d) => d.id === f.id));
  const mine = formats.filter((f) => !builtIn.includes(f));
  // The name being typed for "Save this text as a template"; `null` when not saving.
  const [saving, setSaving] = React.useState<string | null>(null);
  const save = () => {
    const name = saving?.trim();
    if (!name) return;
    const id = newFormatId();
    saveDetailsFormat({ id, name, html, mappings: {} });
    onChange(id, html);
    setSaving(null);
  };
  const edited = current ? html !== formatForFiler(current) : !isEmpty(html);
  const blanks = writtenBlanks(html);
  const empty = isEmpty(html);
  const [view, setView] = React.useState<"text" | "cases">("text");
  // The preview walks the cases this text is for.
  const pool = cases?.filter((c) => c.source === "batch") ?? [];
  const usingBatch = cases ? pool.length : total - own;
  const shownPreview = pool.find((c) => c.key === previewKey) ?? pool[0] ?? null;
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
      <TabsTrigger value="preview" disabled={empty || !pool.length}>
        Preview
      </TabsTrigger>
    </TabsList>
  );

  const choose = (format: DetailsFormat) => {
    if (edited) setPending(format);
    else onChange(format.id, formatForFiler(format));
  };

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as "text" | "cases")} className="flex flex-col gap-5">
      {/* The page's two views, as section tabs on the ground: the work first. */}
      <TabsList variant="line" aria-label="Facts of the case" className="h-10 w-full justify-start gap-1 rounded-none border-b border-hairline">
        <TabsTrigger value="text" className="h-10 flex-none gap-2 rounded-b-none px-3 text-body-compact">
          Batch text
          <span className="font-normal text-muted-foreground tabular-nums">{usingBatch}</span>
        </TabsTrigger>
        <TabsTrigger value="cases" className="h-10 flex-none gap-2 rounded-b-none px-3 text-body-compact">
          All cases
          <span className="font-normal text-muted-foreground tabular-nums">{total}</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="cases" className="mt-0 outline-none">
        {cases ? (
          <FactsCases rows={cases} from={from} hasBatch={!empty} picks={picks} onPicks={onPicks} />
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-96" />
          </div>
        )}
      </TabsContent>
      <TabsContent value="text" className="mt-0 outline-none">
    <Card variant="raised">
      <CardContent className="flex flex-col gap-4">
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {own > 0
            ? `For the ${usingBatch} ${usingBatch === 1 ? "case" : "cases"} without their own text in ${from}. Switch or edit any one under All cases.`
            : `For every case. Edit any one on its own under All cases.`}
        </p>

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
              contentClassName={PROSE_CLASS}
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
                    <DropdownMenuContent align="end" className="w-72">
                      {/* One default everyone starts from, then the filer's own, which only they
                          see (BLK-10d; sharing is a later version). */}
                      <DropdownMenuRadioGroup
                        value={current?.id ?? ""}
                        onValueChange={(id) => {
                          const format = formats.find((f) => f.id === id);
                          if (format) choose(format);
                        }}
                      >
                        <DropdownMenuLabel>Start from</DropdownMenuLabel>
                        {builtIn.map((f) => (
                          <DropdownMenuRadioItem key={f.id} value={f.id}>
                            <span className="min-w-0 flex-1 truncate">
                              <span className="text-muted-foreground">Default · </span>
                              {f.name}
                            </span>
                          </DropdownMenuRadioItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>My templates</DropdownMenuLabel>
                        {mine.length ? (
                          mine.map((f) => (
                            <DropdownMenuRadioItem key={f.id} value={f.id}>
                              <span className="min-w-0 flex-1 truncate">{f.name || "Untitled"}</span>
                            </DropdownMenuRadioItem>
                          ))
                        ) : (
                          <p className="px-2 py-1.5 text-body-compact text-muted-foreground">None yet. Save this text to make one.</p>
                        )}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={empty}
                        // Opened once the menu has closed, so the menu handing focus back never closes it.
                        onSelect={() => {
                          const name = current && !builtIn.includes(current) ? `${current.name} (copy)` : "";
                          window.setTimeout(() => setSaving(name), 0);
                        }}
                      >
                        <BookmarkPlusIcon aria-hidden />
                        Save this text as a template
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={FORMATS_HREF} target="_blank" rel="noopener">
                          <Settings2Icon aria-hidden />
                          Manage my templates
                          <ExternalLinkIcon aria-hidden className="ml-auto text-muted-foreground" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      </DropdownMenuItem>
                      <p className="px-2 pt-1 pb-1.5 text-body-compact text-muted-foreground">Only you see your templates.</p>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DetailFieldMenu
                    groups={TEMPLATE_FIELD_GROUPS}
                    onPick={(field) => editor.current?.insertText(`[${field.name}]`)}
                    describe={(field) => first?.sample?.[field.name] || "Filled in from each case"}
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
            {shownPreview ? (
              <div className="flex min-w-0 flex-col rounded-xl border border-input bg-card">
                <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-3 py-2">
                  {modeTabs}
                  <span aria-hidden className="mx-1 h-5 w-px bg-border" />
                  <CaseFinder
                    cases={pool.map(finderCase(from))}
                    groups={[]}
                    value={shownPreview.key}
                    onSelect={setPreviewKey}
                    label="Preview a case"
                    className="max-w-96"
                  />
                  <div className="ml-auto">
                    <CaseStepper at={pool.indexOf(shownPreview)} count={pool.length} onGo={(i) => setPreviewKey(pool[i].key)} />
                  </div>
                </div>
                <div
                  key={`${shownPreview.key}-${shownPreview.fromBatch}`}
                  className={cn(
                    "min-h-72 animate-in text-foreground duration-200 fade-in-0 [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc [&_p:last-child]:mb-0",
                    PROSE_CLASS,
                  )}
                  // The case's own facts, built by the app from its text and row (escaped there).
                  dangerouslySetInnerHTML={{ __html: previewHtml(shownPreview.facts) || "<p>No facts of the case.</p>" }}
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
      {/* Naming the text to keep it as one of the filer's own templates. */}
      <Dialog open={saving !== null} onOpenChange={(o) => !o && setSaving(null)}>
        <ChromeDialogContent className="sm:max-w-md">
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <DialogHeader>
              <DialogTitle>Save as a template</DialogTitle>
              <DialogDescription>Only you see it. It starts any batch&apos;s facts from this text.</DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                autoFocus
                value={saving ?? ""}
                onChange={(e) => setSaving(e.target.value)}
                placeholder="e.g. Personal loan, one cheque"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaving(null)}>
                Back
              </Button>
              <Button type="submit" disabled={!saving?.trim()}>
                Save template
              </Button>
            </DialogFooter>
          </form>
        </ChromeDialogContent>
      </Dialog>
    </Card>
      </TabsContent>
    </Tabs>
  );
}
