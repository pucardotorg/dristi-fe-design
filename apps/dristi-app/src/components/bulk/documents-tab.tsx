"use client";

import * as React from "react";
import { CheckIcon, CirclePlayIcon, EllipsisVerticalIcon, PlusIcon, TriangleAlertIcon, WandSparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { batchTallies, caseState } from "./batch-marks";
import { CaseSearch } from "./case-list-tools";
import { FilterPills } from "./filter-pills";
import { DocumentsGuide, guideSeen } from "./documents-guide";
import { useDemoTools } from "./demo-tools";
import { StatusLine } from "@/components/feedback";
import { FilingFooter } from "@/components/filing/filing-footer";

type Doc = CaseView["documents"][number];
type Flag = CaseView["flags"][number];

const ACCEPT = ".pdf,.jpg,.jpeg,.png";
/** Cases listed at a time; a batch of hundreds is read in pages, not one long scroll. */
const PAGE = 25;

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
                  ? "bg-success-muted text-success-ink hover:ring-2 hover:ring-success/40"
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
          {poor && onKeep && canUpload ? <DropdownMenuItem onSelect={onKeep}>Keep this file</DropdownMenuItem> : null}
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
  const nameId = React.useId();
  if (locked && !docs.length) return <span className="text-muted-foreground">—</span>;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={busy}
          aria-label={docs.length ? `${docs.length} other ${docs.length === 1 ? "document" : "documents"}` : "Add another document"}
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
            <Label htmlFor={nameId} className="text-body-compact">
              {docs.length ? "Add another" : "Document name"}
            </Label>
            <div className="flex gap-2">
              <Input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Loan agreement"
                className="flex-1"
              />
              <Button type="submit" variant="secondary" disabled={!name.trim()}>
                Choose file
              </Button>
            </div>
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
 * cases are locked. Read 25 at a time.
 */
export function DocumentsTab({ batch, setBatch, go }: BatchCtx) {
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
  // Optional documents the filer has added to the table as columns.
  const [extra, setExtra] = React.useState<string[]>([]);
  // The "Other" column, opened before any case has a paper of its own; and whose
  // "Other" popover is open (from the row menu).
  const [otherCol, setOtherCol] = React.useState(false);
  const [otherFor, setOtherFor] = React.useState<string | null>(null);
  // Asked for from a row menu: opened once that menu has closed and handed focus back.
  const pendingOther = React.useRef<string | null>(null);
  const [limit, setLimit] = React.useState(PAGE);

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
  const complete = open.filter((c) => caseState(c) === "complete").length;

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

  const keep = async (c: CaseView, f: Flag) => {
    setBusy(`${c.id}:${f.fix?.kind === "upload" ? f.fix.slotKey : ""}`);
    setError(null);
    try {
      setBatch(await bulkApi.act(batch.id, { action: "skip", caseId: c.id, flagId: f.id }));
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
  };

  const term = search.trim().toLowerCase();
  const matches = (c: CaseView) =>
    !term || [c.accused, c.title, c.reference, c.cheque].some((v) => v.toLowerCase().includes(term));
  const base = { missing: open.filter((c) => startedOpen.has(c.id)), complete: open.filter((c) => !needsWork(c)), all: open }[show];
  const shownCases = base.filter(matches);
  const listed = shownCases.slice(0, limit);
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
  // An optional paper becomes a column of its own once the filer adds it to the table, or
  // once any case has one (owner, 2026-11-12: a new document is a new column), so a reply
  // to the notice is collected down the batch like every other document.
  const optionalTypes: string[] = [];
  for (const c of open)
    for (const d of c.documents.filter((x) => !own(x) && !x.required && !x.custom)) {
      const key = typeOf(d);
      if (!optionalTypes.includes(key)) optionalTypes.push(key);
      if (d.file && !extra.includes(key) && !columns.some((col) => col.key === key)) columns.push({ key, required: false });
    }
  for (const key of extra) if (!columns.some((col) => col.key === key)) columns.push({ key, required: false });
  const addable = optionalTypes.filter((t) => !columns.some((col) => col.key === t));
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
          {/* A paper only this case has: added right here, in the row's Other cell, never
              by leaving for the case (owner, 2026-11-12). */}
          <DropdownMenuItem
            onSelect={() => {
              setOtherCol(true);
              pendingOther.current = c.id;
            }}
          >
            <PlusIcon aria-hidden />
            Another document for this case
          </DropdownMenuItem>
          {demo && c.docs.have < c.docs.need ? (
            <DropdownMenuItem disabled={!!busy} onSelect={() => void fillDemo([c])}>
              <WandSparklesIcon aria-hidden />
              Demo files
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );

  // The one line about cases that aren't here, and where they are.
  const away = [
    fixing ? (
      <span key="fix">
        {fixing} still being fixed at{" "}
        <button type="button" className="underline" onClick={() => go("scrutiny")}>
          Case details
        </button>
      </span>
    ) : null,
    locked ? (
      <span key="locked">
        {locked} signed or filed, at{" "}
        <button type="button" className="underline" onClick={() => go(batch.counts.signed ? "pay" : "filed")}>
          {batch.counts.signed ? "Pay" : "Filed"}
        </button>
      </span>
    ) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <DocumentsGuide open={guide} onOpenChange={setGuide} />

      {away.length ? (
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {fixing + locked} {fixing + locked === 1 ? "case isn't" : "cases aren't"} here:{" "}
          {away.map((x, i) => (
            <React.Fragment key={i}>
              {i ? "; " : ""}
              {x}
            </React.Fragment>
          ))}
          .
        </p>
      ) : null}

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills
          value={show}
          onChange={(v) => {
            setShow(v as Show);
            setLimit(PAGE);
          }}
          total={open.length}
          filters={[
            { id: "missing", label: "Missing documents", count: startedOpen.size ? lackingCases.length : 0 },
            { id: "complete", label: "Documents added", count: open.length - lackingCases.length },
          ]}
        />
        {/* A new document is a new column, collected down the batch (owner, 2026-11-12). */}
        {(addable.length || !showOther) && !closed ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="text-body-compact">
                <PlusIcon data-icon="inline-start" aria-hidden />
                Add a document
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-56">
              {addable.map((t) => (
                <DropdownMenuItem key={t} onSelect={() => setExtra((x) => [...x, t])}>
                  {t}
                  <span className="ml-auto text-muted-foreground">Every case</span>
                </DropdownMenuItem>
              ))}
              {showOther ? null : (
                <DropdownMenuItem onSelect={() => setOtherCol(true)}>
                  Another document
                  <span className="ml-auto text-muted-foreground">Some cases</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <CaseSearch
          id="documents-search"
          value={search}
          onChange={(v) => {
            setSearch(v);
            setLimit(PAGE);
          }}
        />
      </div>

      <Card variant="raised" className="gap-0 p-2">
        {listed.length === 0 ? (
          <p className="p-4 text-body-compact text-muted-foreground">
            {term ? `No case matches “${search.trim()}”.` : show === "complete" ? "No case has all its documents yet." : "Every case has its documents."}
          </p>
        ) : (
          <>
            {/* A grid, cases against documents (BLK-11): each document named once, in its
                column, and each cell only its state, so what is missing across the batch
                reads at a glance (owner, 2026-11-12: the chip rows repeated every name on
                every case and painted fifty red chips). */}
            <div className="hidden overflow-x-auto md:block">
              <Table className="border-separate border-spacing-0" aria-label="Documents for each case">
                <TableHeader>
                  <TableRow className={TABLE_HEAD_ROW}>
                    <TableHead className={cn(TABLE_HEAD, "w-full min-w-48")}>Accused</TableHead>
                    {columns.map((col) => (
                      // Two-word names wrap to two lines, so six documents fit the page's width.
                      <TableHead key={col.key} className={cn(TABLE_HEAD, "w-20 px-2 text-center leading-tight whitespace-normal", !col.required && "font-normal")}>
                        {col.key}
                        {col.required ? null : <span className="sr-only"> (optional)</span>}
                      </TableHead>
                    ))}
                    {showOther ? (
                      <TableHead className={cn(TABLE_HEAD, "w-20 px-2 text-center font-normal")}>Other</TableHead>
                    ) : null}
                    {closed ? null : (
                      <TableHead className={TABLE_HEAD}>
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
                          <span className="block truncate font-mono text-body-compact text-muted-foreground">{c.reference}</span>
                        </TableCell>
                        {columns.map((col) => {
                          const ds = mine.filter((x) => typeOf(x) === col.key);
                          if (!ds.length)
                            return (
                              <TableCell key={col.key} className={cn(TABLE_CELL, "px-2 text-center text-muted-foreground")}>
                                <span aria-label="Not needed for this case">—</span>
                              </TableCell>
                            );
                          return (
                            <TableCell key={col.key} className={cn(TABLE_CELL, "px-2 text-center")}>
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
                          <TableCell className={cn(TABLE_CELL, "px-2 text-center")}>
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
                        {closed ? null : <TableCell className={cn(TABLE_CELL, "w-12")}>{rowMenu(c)}</TableCell>}
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
                    <span className="font-mono text-muted-foreground">{c.reference}</span>
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
        {shownCases.length > listed.length ? (
          <Button variant="ghost" size="sm" className="m-2 w-fit" onClick={() => setLimit((n) => n + PAGE)}>
            Show {Math.min(PAGE, shownCases.length - listed.length)} more of {shownCases.length - listed.length}
          </Button>
        ) : null}
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
      </div>

      <BatchFooter>
        <FilingFooter
          showSaveState={false}
          onBack={() => go("scrutiny")}
          // Cases still missing a file never hold the ready ones up (v8, BLK-08); with none
          // ready there is nothing to take on yet.
          continueVariant={lackingCases.length ? "outline" : "default"}
          continueLabel={lackingCases.length && complete ? `Continue with ${complete} ready to sign` : "Continue to Sign"}
          continueDisabled={!complete}
          onContinue={() => go("sign")}
        />
      </BatchFooter>
    </div>
  );
}
