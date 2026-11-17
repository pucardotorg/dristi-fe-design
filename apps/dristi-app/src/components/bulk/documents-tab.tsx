"use client";

import * as React from "react";
import {
  CheckIcon,
  CirclePlayIcon,
  EllipsisVerticalIcon,
  FileCheck2Icon,
  FlaskConicalIcon,
  PlusIcon,
  TriangleAlertIcon,
  WandSparklesIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";

import { readability } from "@/lib/filing/readability";

import { demoBlurryScan, demoPdf } from "./demo-fill";
import { bulkApi, useBulkFileUrl, type CaseView } from "./api";
import { BatchFooter } from "./batch-footer";
import type { BatchCtx } from "./batch-screen";
import { RemoveCaseItem, useRemoveCase } from "./remove-case";
import { aboutDetails, batchTallies, caseState, readyToSign } from "./batch-marks";
import { StepMeta } from "./step-meta";
import { bulkStepTitle } from "./bulk-steps";
import { notify } from "@/components/ui/notify";
import { CaseSearch, Pager, PagerTop, pageOf } from "./case-list-tools";
import { FilterPills } from "./filter-pills";
import { DocumentsGuide, guideSeen } from "./documents-guide";
import { useDemoTools } from "./demo-tools";
import { StatusLine } from "@/components/feedback";
import { FilingFooter } from "@/components/filing/filing-footer";

type Doc = CaseView["documents"][number];

/**
 * A document column: one compact width for each, so the marks sit close on an even grid and
 * a two-word name takes two lines (owner, 2026-11-17: one-line names spread the marks too far
 * apart; the compact first version read as less work).
 */
const DOC_COL = "w-20 min-w-20 px-1";
type Flag = CaseView["flags"][number];

const ACCEPT = ".pdf,.jpg,.jpeg,.png";
/** Cases listed at a time; a batch of hundreds is read in pages, not one long scroll. */

function sizeOf(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/**
 * What a chip calls a document: the short name its parentheses give ("Postal receipt",
 * "AD card"), so a row of five reads at a glance. The full name stays in the chip's
 * accessible name and tooltip.
 */
function chipName(name: string): string {
  const paren = /\(([^)]+)\)\s*(\d+)?$/.exec(name);
  if (paren) return `${paren[1][0].toUpperCase()}${paren[1].slice(1)}${paren[2] ? ` ${paren[2]}` : ""}`;
  return name.replace(/^Cheque return memo/, "Return memo").replace(/^Reply to the demand notice/, "Reply to notice");
}

/**
 * One document of one case, as a chip in its row (BLK-11, "a slot per document"): still
 * one file per slot, the line-item upload v8 kept.
 *
 *   · Empty: a dashed chip, "+ Cheque". Click to choose a file, or drop one on it. Red
 *     when required (it blocks filing), quiet when optional.
 *   · Added: "✓ Cheque", which opens View and Replace.
 *   · Added but hard to read: amber, which also offers "Keep this file".
 */
function SlotChip({
  doc,
  locked,
  busy,
  onFile,
  poor,
  onKeep,
  cell = false,
  n,
}: {
  doc: Doc;
  locked: boolean;
  busy: boolean;
  onFile: (file: File) => void;
  poor?: Flag;
  onKeep?: () => void;
  /** In the grid: the column names the document, so the cell is only its state. */
  cell?: boolean;
  /** Which one, where a case has more than one of this document (two cheques). */
  n?: number;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const href = useBulkFileUrl(doc.file?.id);
  const canUpload = !locked && !!doc.slotKey;
  const choose = () => {
    if (canUpload && !busy) input.current?.click();
  };
  const drop = {
    onDragOver: (e: React.DragEvent) => {
      if (!canUpload) return;
      e.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && canUpload && !busy) onFile(file);
    },
  };
  const chip = "inline-flex h-10 max-w-full items-center gap-1.5 rounded-lg px-3 text-body-compact transition-colors focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none disabled:opacity-60";
  const picker = (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) onFile(file);
      }}
    />
  );

  if (!doc.file && cell) {
    // Empty, in the grid: a quiet dashed well. Missing is the norm on this step, so it is
    // not red (owner, 2026-11-12: fifty red chips read as an alarm on every case).
    return (
      <>
        <button
          type="button"
          {...drop}
          disabled={!canUpload || busy}
          onClick={choose}
          aria-label={`Add file: ${doc.name}${doc.required ? "" : ", optional"}`}
          title={`Add ${doc.name}`}
          data-n={n}
          className={cn(
            // A mark, not a button label: the column says which document, so the cell is
            // only "not yet" (a dashed ring) and the grid reads as a checklist, not a wall
            // of buttons. The hit area stays 36px; dropping a file lights the ring.
            "relative inline-flex size-9 items-center justify-center rounded-full border border-dashed border-input text-muted-foreground transition-colors hover:border-solid hover:border-ring hover:bg-brand-muted hover:text-brand-muted-foreground focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none disabled:opacity-60",
            over && "border-solid border-ring bg-brand-muted text-brand-muted-foreground",
          )}
        >
          {busy ? <Spinner className="size-4" /> : <PlusIcon aria-hidden className="size-4 shrink-0" />}
        </button>
        {picker}
      </>
    );
  }

  if (!doc.file) {
    return (
      <>
        <button
          type="button"
          {...drop}
          disabled={!canUpload || busy}
          onClick={choose}
          aria-label={`Add file: ${doc.name}${doc.required ? "" : ", optional"}`}
          title={doc.name}
          className={cn(
            chip,
            "border border-dashed bg-card",
            doc.required ? "border-destructive text-destructive-ink hover:bg-destructive/5" : "border-input text-muted-foreground hover:bg-accent",
            over && "ring-2 ring-ring",
          )}
        >
          {busy ? <Spinner className="size-4" /> : <PlusIcon aria-hidden className="size-4 shrink-0" />}
          <span className="truncate">{chipName(doc.name)}</span>
          {doc.required ? null : <span className="text-muted-foreground">optional</span>}
        </button>
        {picker}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            {...drop}
            disabled={busy}
            aria-label={`${doc.name}: ${doc.file.name}${poor ? ", hard to read" : ""}`}
            title={`${doc.name}: ${doc.file.name} · ${sizeOf(doc.file.size)}`}
            className={cn(
              cell
                ? "relative inline-flex size-9 items-center justify-center rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none"
                : chip,
              poor
                ? "bg-warning-muted text-warning-ink hover:bg-warning-muted/80"
                : cell
                  ? // Done is the quiet state: a bare tick, filled only under the pointer, so
                    // the grid's eye goes to what is still missing or hard to read.
                    "text-success hover:bg-success-muted"
                  : "bg-muted text-foreground hover:bg-accent",
              over && "ring-2 ring-ring",
            )}
          >
            {busy ? (
              <Spinner className="size-4" />
            ) : poor ? (
              <TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
            ) : (
              <CheckIcon aria-hidden className="size-4 shrink-0 text-success" />
            )}
            {cell ? null : (
              <span className="truncate">
                {chipName(doc.name)}
                {poor ? ": hard to read" : ""}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          {poor ? <p className="max-w-72 px-2 py-1.5 text-body-compact text-warning-ink">{poor.message}</p> : null}
          <DropdownMenuItem asChild>
            <a href={href ?? undefined} target="_blank" rel="noreferrer">
              View {doc.file.name}
            </a>
          </DropdownMenuItem>
          {canUpload ? <DropdownMenuItem onSelect={choose}>Replace</DropdownMenuItem> : null}
          {poor && onKeep && canUpload ? <DropdownMenuItem onSelect={onKeep}>Keep this scan</DropdownMenuItem> : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {picker}
    </>
  );
}

/**
 * One cell holding several of the same document (three cheques, their three memos): a
 * pill saying how many are in, "1/3", which lists each with its state. The column stays
 * one mark wide however many a case has (owner, 2026-11-12: scale to two or more
 * cheques). A file dropped on it goes into the first empty one.
 */
function GroupCell({
  docs,
  locked,
  busy,
  onFile,
}: {
  docs: Doc[];
  locked: boolean;
  busy: boolean;
  onFile: (d: Doc, file: File) => void;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [target, setTarget] = React.useState<Doc | null>(null);
  const [over, setOver] = React.useState(false);
  const have = docs.filter((d) => d.file).length;
  const all = have === docs.length;
  const firstEmpty = docs.find((d) => !d.file && d.slotKey);
  const pick = (d: Doc) => {
    setTarget(d);
    input.current?.click();
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={busy}
            aria-label={`${docs.length} ${chipName(docs[0].name).replace(/\s\d+$/, "")} documents, ${have} added`}
            onDragOver={(e) => {
              if (locked || !firstEmpty) return;
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file && firstEmpty && !locked) onFile(firstEmpty, file);
            }}
            className={cn(
              "inline-flex h-9 min-w-14 items-center justify-center gap-1 rounded-full px-3 text-body-compact font-medium tabular-nums transition-colors focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none disabled:opacity-60",
              all
                ? "bg-success-muted text-success-ink"
                : "border border-dashed border-input text-muted-foreground hover:border-solid hover:border-ring hover:bg-brand-muted hover:text-brand-muted-foreground",
              over && "border-solid border-ring bg-brand-muted",
            )}
          >
            {busy ? <Spinner className="size-4" /> : all ? <CheckIcon aria-hidden className="size-4" /> : null}
            {have}/{docs.length}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="min-w-60">
          {docs.map((d) => (
            <DropdownMenuItem key={d.slotKey ?? d.name} disabled={locked || !d.slotKey} onSelect={() => pick(d)}>
              {d.file ? <CheckIcon aria-hidden className="text-success-ink" /> : <PlusIcon aria-hidden />}
              {chipName(d.name)}
              <span className="ml-auto text-muted-foreground">{d.file ? "Replace" : "Add"}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && target) onFile(target, file);
        }}
      />
    </>
  );
}

/**
 * A case's papers of its own, in the trailing "Other" column: a dashed ring while there
 * are none, a count once there are, and in place a list of them (view, replace) with a
 * name and a file to add another. Never counted against the case.
 */
function OtherCell({
  docs,
  locked,
  busy,
  open,
  onOpenChange,
  onAdd,
  onReplace,
}: {
  docs: Doc[];
  locked: boolean;
  busy: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, file: File) => void;
  onReplace: (d: Doc, file: File) => void;
}) {
  const [name, setName] = React.useState("");
  const addInput = React.useRef<HTMLInputElement>(null);
  const replaceInput = React.useRef<HTMLInputElement>(null);
  const [target, setTarget] = React.useState<Doc | null>(null);
  if (locked && !docs.length) return <span className="text-muted-foreground">—</span>;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={busy}
          aria-label={docs.length ? `${docs.length} other ${docs.length === 1 ? "document" : "documents"}` : "Add other document"}
          className={cn(
            "inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2.5 text-body-compact font-medium tabular-nums transition-colors focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none disabled:opacity-60",
            docs.length
              ? "bg-success-muted text-success-ink"
              : "border border-dashed border-hairline text-muted-foreground hover:border-solid hover:border-ring hover:bg-brand-muted hover:text-brand-muted-foreground",
          )}
        >
          {busy ? <Spinner className="size-4" /> : docs.length ? docs.length : <PlusIcon aria-hidden className="size-4" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-3">
        {docs.length ? (
          <ul className="flex flex-col gap-1">
            {docs.map((d) => (
              <li key={d.slotKey ?? d.name} className="flex items-center gap-2 text-body-compact">
                <CheckIcon aria-hidden className="size-4 shrink-0 text-success-ink" />
                <span className="min-w-0 flex-1 truncate" title={d.name}>
                  {d.name}
                </span>
                {d.file ? <OtherView fileId={d.file.id} /> : null}
                {locked || !d.slotKey ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-body-compact"
                    onClick={() => {
                      setTarget(d);
                      replaceInput.current?.click();
                    }}
                  >
                    Replace
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {locked ? null : (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) addInput.current?.click();
            }}
          >
            {/* In a DS Field, so the label is tied to the input (Input takes its id from it). */}
            <Field className="gap-2">
              <FieldLabel className="text-body-compact">
                {docs.length ? "Add other document" : "Document name"}
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Loan agreement"
                  className="flex-1"
                />
                <Button type="submit" variant="secondary" disabled={!name.trim()}>
                  Choose file
                </Button>
              </div>
            </Field>
          </form>
        )}
        <input
          ref={addInput}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file && name.trim()) {
              onAdd(name.trim(), file);
              setName("");
            }
          }}
        />
        <input
          ref={replaceInput}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file && target) onReplace(target, file);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Opens one of a case's own papers in a new tab. */
function OtherView({ fileId }: { fileId: string }) {
  const href = useBulkFileUrl(fileId);
  return (
    <Button asChild variant="ghost" size="sm" className="text-body-compact">
      <a href={href ?? undefined} target="_blank" rel="noreferrer">
        View
      </a>
    </Button>
  );
}

type Show = "missing" | "complete" | "all";

/**
 * Documents, case by case: one row per case with a chip for each of its documents, so
 * what is missing across the batch is seen at once and added where it is (BLK-11). The
 * batch's own documents (the complainant's, set in Common details) are not repeated in
 * every row unless one is missing. Cases still being fixed join later; signed and filed
 * cases are locked. Read 10 or 15 at a time: a row is a full line of marks, and a longer
 * page only buries the pager (owner, 2026-11-17).
 */
/** The sandbox's three ways to fill a batch's documents (`sandboxDocuments`). */
/** Cases a page of the grid holds: 10 or 15, never more. */
const DOC_PAGE_SIZES = [10, 15] as const;

/**
 * The grid's headings rest under the page's sticky stack (the top bar and the batch's
 * steps), measured, since the steps row can wrap or carry a second row. Where even the
 * two-line column names can't make the grid fit (a narrow desk with the rail open), it
 * scrolls sideways instead and the headings stop pinning: a scrolling box would hold
 * them, and a clipped column is worse than headings that scroll away (as the Filings
 * queue does).
 */
function useStickyHead() {
  const box = React.useRef<HTMLDivElement>(null);
  const [tight, setTight] = React.useState(false);
  const [top, setTop] = React.useState(0);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const steps = document.querySelector('nav[aria-label="Batch steps"]')?.parentElement ?? null;
    const check = () => {
      const table = el.querySelector("table");
      setTight(!!table && table.scrollWidth > el.clientWidth + 1);
      if (steps) setTop((parseFloat(getComputedStyle(steps).top) || 0) + steps.offsetHeight);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    const table = el.querySelector("table");
    if (table) ro.observe(table);
    if (steps) ro.observe(steps);
    return () => ro.disconnect();
  });
  return { boxRef: box, tight, top };
}

const SANDBOX_FILLS = [
  { id: "all", label: "Every document", detail: "Every case ready to sign" },
  { id: "most", label: "Most documents", detail: "About one case in seven still missing one or two" },
  { id: "issues", label: "Every document, some unreadable", detail: "One scan in twenty too blurry to read" },
] as const;

export function DocumentsTab({ batch, setBatch, go }: BatchCtx) {
  const { ask: askRemove, dialog: removeDialog } = useRemoveCase(batch, setBatch);
  // The walkthrough, once per browser, the first time there is something to add. The tab
  // only mounts once the batch has loaded in the browser, so storage can be read here.
  const [guide, setGuide] = React.useState(
    () =>
      !batch.clubbedInto &&
      batch.cases.some(
        (c) => (c.stage === "held" || c.stage === "ready") && c.docs.have < c.docs.need,
      ) &&
      !guideSeen(),
  );
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const closed = !!batch.clubbedInto;
  const demo = useDemoTools();
  const [search, setSearch] = React.useState("");
  // The "Other" column, opened before any case has a paper of its own; and whose
  // "Other" popover is open (from the row menu).
  const [otherCol, setOtherCol] = React.useState(false);
  const [otherFor, setOtherFor] = React.useState<string | null>(null);
  // Asked for from a row menu: opened once that menu has closed and handed focus back.
  const pendingOther = React.useRef<string | null>(null);
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState<number>(DOC_PAGE_SIZES[0]);
  const { boxRef: headBox, tight: headTight, top: headTop } = useStickyHead();

  // Cases missing something first, in the order they had when the tab opened, so a case
  // does not jump away the moment its last document goes in.
  const poorOf = (c: CaseView) => c.flags.filter((f) => f.rule === "dcm-poor");
  const needsWork = (c: CaseView) =>
    c.docs.have < c.docs.need || poorOf(c).length > 0;
  const [order] = React.useState(() =>
    [...batch.cases]
      .sort((a, b) => Number(!needsWork(a)) - Number(!needsWork(b)))
      .map((c) => c.id),
  );
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  // Cases still being fixed join later, once their details are done (v8): their document
  // list can change with the fix, so nothing is uploaded against it yet.
  const { fixing } = batchTallies(batch);
  const open = batch.cases
    .filter((c) => (c.stage === "held" || c.stage === "ready") && caseState(c) !== "fix")
    .sort((a, b) => rank(a.id) - rank(b.id));
  // Signed or filed: their documents can't change. (This once counted the cases still
  // being fixed too, and said "2 cases are signed or filed" on a batch with none.)
  const locked = batch.counts.signed + batch.counts.filed;
  const lackingCases = open.filter(needsWork);
  // The cases that had something to add when the tab opened: "Missing" keeps them listed
  // as they are finished, so the list never moves under the filer's hand.
  const [startedOpen] = React.useState(() => new Set(open.filter(needsWork).map((c) => c.id)));
  const [show, setShow] = React.useState<Show>(() => (startedOpen.size ? "missing" : "all"));
  // Ready to sign: the same rule Sign uses, so the two steps agree (`readyToSign`).
  const complete = open.filter(readyToSign).length;

  const upload = async (c: CaseView, d: Doc, file: File) => {
    if (!d.slotKey) return;
    setBusy(`${c.id}:${d.slotKey}`);
    setError(null);
    try {
      const poor = (await readability(file)) === "bad";
      setBatch(await bulkApi.attach(batch.id, c.id, d.slotKey, file, poor));
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  // A kept scan, counted again (`SkippedWarnings`).
  const unkeep = async (c: CaseView, f: Flag) => {
    setBusy(`${c.id}:unskip`);
    setError(null);
    try {
      setBatch(await bulkApi.act(batch.id, { action: "unskip", caseId: c.id, flagId: f.id }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const keep = async (c: CaseView, f: Flag) => {
    setBusy(`${c.id}:${f.fix?.kind === "upload" ? f.fix.slotKey : ""}`);
    setError(null);
    try {
      setBatch(await bulkApi.act(batch.id, { action: "skip", caseId: c.id, flagId: f.id }));
      // Said where the filer is: the list of skipped warnings is above the table.
      notify.neutral("Warning skipped", {
        icon: TriangleAlertIcon,
        action: { label: "Undo", onClick: () => void unkeep(c, f) },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Demo: a small PDF into every empty slot, one case or the whole batch. The first
  // case's first slot gets a scan too small to read, so the blurry-scan warning shows.
  const blurryAt = batch.cases[0]?.id;
  const fillDemo = async (cases: CaseView[]) => {
    setError(null);
    for (const c of cases)
      for (const [i, d] of c.documents.filter((x) => !x.file && x.slotKey).entries()) {
        setBusy(`${c.id}:${d.slotKey}`);
        try {
          const blurry = c.id === blurryAt && i === 0;
          const file = blurry ? await demoBlurryScan(d.name) : demoPdf(d.name);
          setBatch(
            await bulkApi.attach(batch.id, c.id, d.slotKey!, file, blurry),
          );
        } catch (e) {
          setError((e as Error).message);
          setBusy(null);
          return;
        }
      }
    setBusy(null);
    notify.success(cases.length === 1 ? "Demo files added" : `Demo files added to ${cases.length} cases`);
  };

  // Sandbox: the whole batch at once, on the server (300 cases would be 1,800 uploads).
  const sandboxFill = async (scenario: (typeof SANDBOX_FILLS)[number]["id"]) => {
    setError(null);
    setBusy("sandbox");
    const n = lackingCases.length;
    try {
      setBatch(await bulkApi.sandboxDocuments(batch.id, scenario));
      notify.success(`Documents filled for ${n} case${n === 1 ? "" : "s"}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const term = search.trim().toLowerCase();
  const matches = (c: CaseView) =>
    !term || [c.accused, c.title, c.draftNumber, c.cheque].some((v) => v.toLowerCase().includes(term));
  const base = { missing: open.filter((c) => startedOpen.has(c.id)), complete: open.filter((c) => !needsWork(c)), all: open }[show];
  const shownCases = base.filter(matches);
  const { pages, at, shown: listed } = pageOf(shownCases, page, size);
  // The batch's own documents: shown in a row only while one is missing.
  const own = (d: Doc) => d.group.startsWith("Complainant") && !!d.file;

  // The grid's columns: one per kind of document a case must have, named once, in the
  // order they first appear. A second cheque is "Cheque 2" in the Cheque column, not a
  // column of its own, and optional papers share one column, so the grid stays the width
  // of the page however the cases differ (no scroll inside the scroll).
  const typeOf = (d: Doc) => chipName(d.name).replace(/\s\d+$/, "");
  const columns: { key: string; required: boolean }[] = [];
  for (const c of listed)
    for (const d of c.documents.filter((x) => !own(x) && x.required)) {
      const key = typeOf(d);
      if (!columns.some((col) => col.key === key)) columns.push({ key, required: true });
    }
  // The optional papers a case's own sections offer (a reply to the notice) are columns too,
  // always: the grid lists what individual filing's Documents step lists, nothing more, and
  // a document for a section the case lacks, such as a second cheque, waits until that
  // section is added on Case details (BLK-11e).
  for (const c of listed)
    for (const d of c.documents.filter((x) => !own(x) && !x.required && !x.custom)) {
      const key = typeOf(d);
      if (!columns.some((col) => col.key === key)) columns.push({ key, required: false });
    }
  // Papers only one case has share a trailing "Other" column, shown once any case has one
  // or the filer starts one, so a one-off never adds a column every case would carry.
  const customOf = (c: CaseView) => c.documents.filter((x) => x.custom);
  const showOther = otherCol || listed.some((c) => customOf(c).length > 0);
  const addOther = async (c: CaseView, name: string, file: File) => {
    setBusy(`${c.id}:other`);
    setError(null);
    try {
      setBatch(await bulkApi.attach(batch.id, c.id, `new:${name}`, file));
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  // A row's rarer acts, out of the cells: optional papers go to the case's own Documents
  // section; demo files fill the row in the sandbox.
  const rowMenu = (c: CaseView) =>
    closed ? null : (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`More for ${c.accused || c.title}`}>
            <EllipsisVerticalIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-56"
          // The menu would hand focus back to its trigger and so close the popover it just
          // asked for: open the popover instead, once the menu is gone.
          onCloseAutoFocus={(e) => {
            if (!pendingOther.current) return;
            e.preventDefault();
            const id = pendingOther.current;
            pendingOther.current = null;
            window.requestAnimationFrame(() => setOtherFor(id));
          }}
        >
          {/* Individual filing's "Add other document" for the case's own section: added
              right here, in the row's Other cell, never by leaving for the case. */}
          <DropdownMenuItem
            onSelect={() => {
              setOtherCol(true);
              pendingOther.current = c.id;
            }}
          >
            <PlusIcon aria-hidden />
            Add other document
          </DropdownMenuItem>
          {demo && c.docs.have < c.docs.need ? (
            <DropdownMenuItem disabled={!!busy} onSelect={() => void fillDemo([c])}>
              <WandSparklesIcon aria-hidden />
              Demo files
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <RemoveCaseItem c={c} onSelect={askRemove} />
        </DropdownMenuContent>
      </DropdownMenu>
    );

  // The cases that aren't here, and where they are, as links to those steps: still being
  // fixed, signed and waiting at Pay, or filed.
  const away = [
    { count: fixing, label: `in ${bulkStepTitle("details")}`, onGo: () => go("scrutiny") },
    { count: batch.counts.signed, label: `at ${bulkStepTitle("pay")}`, onGo: () => go("pay") },
    { count: batch.counts.filed, label: "filed", onGo: () => go("filed") },
  ];
  const awayCount = fixing + locked;

  return (
    <div className="flex flex-col gap-4">
      <DocumentsGuide open={guide} onOpenChange={setGuide} />

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          value={show}
          onChange={(v) => {
            setShow(v as Show);
            setPage(0);
          }}
          total={open.length}
          filters={[
            { id: "missing", label: "Missing documents", count: startedOpen.size ? lackingCases.length : 0 },
            { id: "complete", label: "Documents added", count: open.length - lackingCases.length },
          ]}
        />
        <CaseSearch
          id="documents-search"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(0);
          }}
        />
        <PagerTop total={shownCases.length} at={at} pages={pages} onPage={setPage} size={size} />
      </div>

      {/* Visible, not hidden: the Card's clip would hold the grid's headings in place of
          the page, so they could never pin. */}
      <Card variant="raised" className="gap-0 overflow-visible p-2">
        {/* The list's first row: the batch's cases this list leaves out and where they are,
            and the warnings skipped here (owner, 2026-11-17: on the page it floated). */}
        <StepMeta
          attached
          className="-mx-2 mb-2 border-b border-hairline px-6 pt-2 pb-3"
          lead={`${awayCount} ${awayCount === 1 ? "case" : "cases"} not in this step`}
          elsewhere={away}
          skipped={{
            items: open.flatMap((c) => c.skipped.filter((f) => !aboutDetails(f)).map((f) => ({ c, f }))),
            busy: !!busy || closed,
            onUndo: (c, f) => void unkeep(c, f),
          }}
        />
        {listed.length === 0 ? (
          <p className="p-4 text-body-compact text-muted-foreground">
            {term ? `No case matches “${search.trim()}”.` : show === "complete" ? "No case has every document yet." : "Every case has its documents."}
          </p>
        ) : (
          <>
            {/* A grid, cases against documents (BLK-11): each document named once, in its
                column, and each cell only its state, so what is missing across the batch
                reads at a glance (owner, 2026-11-12: the chip rows repeated every name on
                every case and painted fifty red chips). */}
            <div
              ref={headBox}
              className={cn(
                "hidden md:block",
                headTight ? "overflow-x-auto" : "overflow-x-clip [&>[data-slot=table-container]]:overflow-visible",
              )}
            >
              <Table className="border-separate border-spacing-0" aria-label="Documents for each case">
                {/* Pinned under the steps while the grid scrolls by; the card's white behind
                    the well's rounded ends, so no row shows through its corners. */}
                <TableHeader
                  className={headTight ? undefined : "sticky z-10 bg-card"}
                  style={headTight ? undefined : { top: headTop }}
                >
                  <TableRow className={TABLE_HEAD_ROW}>
                    <TableHead className={cn(TABLE_HEAD, "w-full min-w-44")}>Accused</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col.key} className={cn(TABLE_HEAD, DOC_COL, "h-auto py-2.5 text-center leading-tight whitespace-normal text-balance")}>
                        {col.key}
                        {col.required ? null : <span className="sr-only"> (optional)</span>}
                      </TableHead>
                    ))}
                    {showOther ? (
                      <TableHead className={cn(TABLE_HEAD, DOC_COL, "h-auto py-2.5 text-center leading-tight")}>Other</TableHead>
                    ) : null}
                    {closed ? null : (
                      <TableHead className={cn(TABLE_HEAD, "w-12 px-2")}>
                        <span className="sr-only">More</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody className={tableBodyClass({ hover: false })}>
                  {listed.map((c) => {
                    const mine = c.documents.filter((d) => !own(d));
                    const need = mine.filter((d) => d.required);
                    const have = need.filter((d) => d.file).length;
                    return (
                      <TableRow key={c.id} className={tableRowClass({ hover: false })}>
                        <TableCell className={cn(TABLE_CELL, "max-w-64")}>
                          {/* The marks say what is missing; a screen reader gets it as a count. */}
                          <span className="sr-only">{`${have} of ${need.length} required documents added. `}</span>
                          <span className="block truncate font-medium" title={c.accused || c.title}>
                            {c.accused || c.title}
                          </span>
                          <span className="block truncate font-mono text-body-compact text-muted-foreground">{c.draftNumber}</span>
                        </TableCell>
                        {columns.map((col) => {
                          const ds = mine.filter((x) => typeOf(x) === col.key);
                          if (!ds.length)
                            return (
                              <TableCell key={col.key} className={cn(TABLE_CELL, DOC_COL, "text-center text-muted-foreground")}>
                                <span aria-label="Not needed for this case">—</span>
                              </TableCell>
                            );
                          return (
                            <TableCell key={col.key} className={cn(TABLE_CELL, DOC_COL, "text-center")}>
                              {ds.length > 1 ? (
                                <GroupCell
                                  docs={ds}
                                  locked={closed}
                                  busy={ds.some((d) => busy === `${c.id}:${d.slotKey}`)}
                                  onFile={(d, file) => void upload(c, d, file)}
                                />
                              ) : (
                                (() => {
                                  const d = ds[0];
                                  const flag = poorOf(c).find((f) => f.fix?.kind === "upload" && f.fix.slotKey === d.slotKey);
                                  return (
                                    <SlotChip
                                      cell
                                      doc={d}
                                      locked={closed}
                                      busy={busy === `${c.id}:${d.slotKey}`}
                                      onFile={(file) => void upload(c, d, file)}
                                      poor={flag}
                                      onKeep={flag ? () => void keep(c, flag) : undefined}
                                    />
                                  );
                                })()
                              )}
                            </TableCell>
                          );
                        })}
                        {showOther ? (
                          <TableCell className={cn(TABLE_CELL, DOC_COL, "text-center")}>
                            <OtherCell
                              docs={customOf(c)}
                              locked={closed}
                              busy={busy === `${c.id}:other` || customOf(c).some((d) => busy === `${c.id}:${d.slotKey}`)}
                              open={otherFor === c.id}
                              onOpenChange={(o) => setOtherFor(o ? c.id : null)}
                              onAdd={(name, file) => void addOther(c, name, file)}
                              onReplace={(d, file) => void upload(c, d, file)}
                            />
                          </TableCell>
                        ) : null}
                        {closed ? null : <TableCell className={cn(TABLE_CELL, "w-12 px-2 text-center")}>{rowMenu(c)}</TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* A phone has no width for columns: each case keeps its row of named chips. */}
            <ul className="flex flex-col md:hidden">
              {listed.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 border-b border-hairline px-2 py-3.5 last:border-b-0">
                  <span className="flex min-w-0 flex-col text-body-compact">
                    <span className="font-medium">{c.accused || c.title}</span>
                    <span className="font-mono text-muted-foreground">{c.draftNumber}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2" role="group" aria-label={`Documents for ${c.accused || c.title}`}>
                    {c.documents
                      .filter((d) => !own(d))
                      .map((d) => {
                        const flag = poorOf(c).find((f) => f.fix?.kind === "upload" && f.fix.slotKey === d.slotKey);
                        return (
                          <SlotChip
                            key={`${d.group}-${d.slotKey ?? d.name}`}
                            doc={d}
                            locked={closed}
                            busy={busy === `${c.id}:${d.slotKey}`}
                            onFile={(file) => void upload(c, d, file)}
                            poor={flag}
                            onKeep={flag ? () => void keep(c, flag) : undefined}
                          />
                        );
                      })}
                    {rowMenu(c)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pager
          total={shownCases.length}
          at={at}
          pages={pages}
          onPage={setPage}
          size={size}
          sizes={DOC_PAGE_SIZES}
          onSize={(n) => {
            setSize(n);
            setPage(0);
          }}
        />
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setGuide(true)}>
          <CirclePlayIcon data-icon="inline-start" aria-hidden />
          How this works
        </Button>
        {demo && lackingCases.length && !closed ? (
          <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void fillDemo(lackingCases)}>
            <WandSparklesIcon data-icon="inline-start" aria-hidden />
            Demo files for all
          </Button>
        ) : null}
        {/* Sandbox, the product's flask: the whole batch's documents in one go, in one of
            three states, so a 300-case batch can be taken past Documents in a moment. */}
        {lackingCases.length && !closed ? (
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Sandbox: fill the documents"
                      disabled={!!busy}
                      className="ml-auto text-muted-foreground"
                    >
                      {busy === "sandbox" ? <Spinner /> : <FlaskConicalIcon aria-hidden />}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Sandbox: fill the documents</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Fill every case&apos;s documents</DropdownMenuLabel>
              {SANDBOX_FILLS.map((x) => (
                <DropdownMenuItem key={x.id} className="items-start" onSelect={() => void sandboxFill(x.id)}>
                  <FileCheck2Icon aria-hidden className="mt-0.5" />
                  <span className="flex min-w-0 flex-col">
                    <span>{x.label}</span>
                    <span className="text-body-compact text-muted-foreground">{x.detail}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {removeDialog}

      <BatchFooter>
        <FilingFooter
          showSaveState={false}
          onBack={() => go("scrutiny")}
          // Cases still missing a file never hold the ready ones up (v8, BLK-08); with none
          // ready there is nothing to take on yet.
          continueVariant={lackingCases.length ? "outline" : "default"}
          continueLabel={lackingCases.length && complete ? `Continue with ${complete} ready to sign` : "Continue to signing"}
          continueDisabled={!complete}
          onContinue={() => go("sign")}
        />
      </BatchFooter>
    </div>
  );
}
