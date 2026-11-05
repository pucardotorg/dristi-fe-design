"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronDownIcon,
  CirclePlayIcon,
  PlusIcon,
  SearchIcon,
  WandSparklesIcon,
  UploadIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

import { readability } from "@/lib/filing/readability";

import { demoBlurryScan, demoPdf } from "./demo-fill";
import { bulkApi, caseFlowHref, useBulkFileUrl, type CaseView } from "./api";
import { BatchFooter } from "./batch-footer";
import type { BatchCtx } from "./batch-screen";
import { OriginalDoc } from "./original-doc";
import { DocumentsGuide, guideSeen } from "./documents-guide";
import { useDemoTools } from "./demo-tools";
import { StatusLine, StatusMark } from "@/components/feedback";
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
 * One document of one case, in one compact line: click or drop a file onto an empty slot;
 * a filled slot shows the file, with View and Replace. Locked once the case is signed, as
 * a single filing is.
 */

export function Slot({
  doc,
  locked,
  busy,
  onFile,
  poor,
  onKeep,
}: {
  doc: Doc;
  locked: boolean;
  busy: boolean;
  onFile: (file: File) => void;
  /** The open "blurry or cropped" warning on this file, if any. */
  poor?: Flag;
  /** Keep the file as it is: skips the warning. */
  onKeep?: () => void;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const filled = !!doc.file;
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

  // Small text buttons, as the product's own "Replace file"; 32px tall with a 40px hit area.
  const SMALL_BTN = "relative after:absolute after:-inset-y-1 after:inset-x-0";
  const fileLine = doc.file
    ? `${doc.file.name} · ${sizeOf(doc.file.size)}`
    : "";

  const name = (
    <span className="flex min-w-0 flex-1 items-baseline gap-2">
      <span className="truncate text-body-compact font-medium">{doc.name}</span>
    </span>
  );

  return (
    <div {...drop} className={cn("rounded-lg", over && "ring-2 ring-ring")}>
      {filled ? (
        <div
          className="flex h-10 items-center gap-2 rounded-lg bg-surface-sunken pr-1 pl-3"
          title={fileLine}
        >
          {busy ? (
            <Spinner className="shrink-0" />
          ) : poor ? (
            <StatusMark tone="warning" size={16} still label="Uploaded, hard to read" />
          ) : (
            <StatusMark size={16} still label="Uploaded" />
          )}
          {name}
          <Button
            asChild
            variant="ghost"
            size="xs"
            className={SMALL_BTN}
            aria-label={`View ${doc.name}: ${fileLine}`}
            title={fileLine}
          >
            <a href={href ?? undefined} target="_blank" rel="noreferrer">
              View
            </a>
          </Button>
          {canUpload ? (
            <Button
              variant="ghost"
              size="xs"
              className={SMALL_BTN}
              disabled={busy}
              onClick={choose}
              aria-label={`Replace ${doc.name}`}
            >
              Replace
            </Button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={choose}
          disabled={!canUpload || busy}
          title={canUpload ? "Drop a file here, or click to choose" : undefined}
          aria-label={`Upload ${doc.name}${doc.required ? ", required" : ", optional"}`}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-lg border border-dashed px-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none",
            doc.required ? "border-input" : "border-hairline",
            canUpload && "hover:bg-accent",
            !canUpload && "cursor-not-allowed",
          )}
        >
          {busy ? (
            <Spinner className="shrink-0" />
          ) : (
            <UploadIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
          {name}
          <span
            className={cn(
              "shrink-0 text-caption",
              doc.required ? "text-destructive-ink" : "text-muted-foreground",
            )}
          >
            {doc.required ? "Required" : "Optional"}
          </span>
        </button>
      )}
      {filled && poor ? (
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 px-3 text-caption text-warning-ink">
          <span>{poor.message}</span>
          {onKeep && canUpload ? (
            <button
              type="button"
              className="text-foreground underline disabled:opacity-50"
              disabled={busy}
              onClick={onKeep}
            >
              Keep this file
            </button>
          ) : null}
        </p>
      ) : null}
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
    </div>
  );
}

/**
 * Documents, case by case: a searchable list of the open cases, one row each, with the
 * first case missing something open to its slots (click or drop a file onto one). Cases
 * that were complete when the tab opened are kept out of the way until asked for, and the
 * list is read in pages, so a batch of hundreds is not one long scroll of open panels
 * (bulk audit, 2026-11-04; v8 prototype). Signed and filed cases are locked, so they are
 * not listed here.
 */
export function DocumentsTab({ batch, setBatch, go }: BatchCtx) {
  const ai = useSearchParams().get("ai");
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
  const [showAll, setShowAll] = React.useState(false);
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
  const open = batch.cases
    .filter((c) => c.stage === "held" || c.stage === "ready")
    .sort((a, b) => rank(a.id) - rank(b.id));
  const locked = batch.cases.length - open.length;
  const incomplete = open.filter((c) => c.docs.have < c.docs.need);
  const missing = incomplete.reduce(
    (n, c) => n + (c.docs.need - c.docs.have),
    0,
  );
  const scans = open.reduce((n, c) => n + poorOf(c).length, 0);
  // The cases that had something to add when the tab opened, and the first of them open.
  const [startedOpen] = React.useState(() => new Set(open.filter(needsWork).map((c) => c.id)));
  const [expanded, setExpanded] = React.useState<string | null>(
    () => open.find((c) => startedOpen.has(c.id))?.id ?? null,
  );

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

  // Which cases show: those with something to add, plus any searched for. A case that was
  // complete when the tab opened stays out of the way until asked for; one finished here
  // stays where it is, so the list never moves under the filer's hand.
  const term = search.trim().toLowerCase();
  const matches = (c: CaseView) =>
    !term || [c.accused, c.title, c.reference, c.cheque].some((v) => v.toLowerCase().includes(term));
  const doneAtOpen = (c: CaseView) => !startedOpen.has(c.id);
  const hidden = open.filter((c) => doneAtOpen(c)).length;
  const shownCases = open.filter((c) => matches(c) && (showAll || term || !doneAtOpen(c) || hidden === open.length));
  const listed = shownCases.slice(0, limit);

  return (
    <div className="flex flex-col gap-4">
      <DocumentsGuide open={guide} onOpenChange={setGuide} />

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      {open.length === 0 ? (
        <Card variant="raised">
          <CardContent className="text-body-compact text-muted-foreground">All documents are in.</CardContent>
        </Card>
      ) : (
        <Card variant="raised" className="gap-0 py-0">
          <div className="flex flex-col gap-4 border-b border-hairline p-4 sm:p-6">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h2 className="text-body font-semibold tabular-nums">
                  {missing
                    ? `${missing} required document${missing === 1 ? "" : "s"} to add, across ${incomplete.length} case${incomplete.length === 1 ? "" : "s"}`
                    : "Every required document is in"}
                </h2>
                <p className="text-body-compact text-muted-foreground tabular-nums">
                  {[
                    `${open.length - incomplete.length} of ${open.length} cases complete`,
                    scans ? `${scans} scan${scans === 1 ? "" : "s"} hard to read` : null,
                    locked ? `${locked} signed or filed, so locked` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {demo && incomplete.length && !closed ? (
                  <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void fillDemo(incomplete)}>
                    <WandSparklesIcon data-icon="inline-start" aria-hidden />
                    Demo files for all
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" className="-mr-2" onClick={() => setGuide(true)}>
                  <CirclePlayIcon data-icon="inline-start" aria-hidden />
                  How this works
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="w-full sm:w-80">
                <Label htmlFor="documents-search" className="sr-only">
                  Search cases
                </Label>
                <InputGroup>
                  <InputGroupAddon>
                    <SearchIcon aria-hidden />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="documents-search"
                    type="search"
                    autoComplete="off"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setLimit(PAGE);
                    }}
                    placeholder="Accused, reference or cheque"
                  />
                </InputGroup>
              </div>
              {hidden && hidden < open.length && !term ? (
                <Button variant="ghost" className="-ml-2" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>
                  {showAll ? `Hide the ${hidden} complete` : `Show all ${open.length} cases`}
                </Button>
              ) : null}
            </div>
          </div>

          {listed.length === 0 ? (
            <p className="p-6 text-body-compact text-muted-foreground">No case matches “{search.trim()}”.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline">
              {listed.map((c) => {
                const complete = c.docs.have >= c.docs.need;
                const poor = poorOf(c).length;
                const isOpen = expanded === c.id;
                const panel = `docs-${c.id}`;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panel}
                      onClick={() => setExpanded(isOpen ? null : c.id)}
                      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none focus-visible:ring-inset sm:px-6"
                    >
                      <span className="flex min-w-0 flex-1 basis-48 flex-col">
                        <span className="text-body-compact font-medium">{c.accused || c.title}</span>
                        <span className="text-body-compact text-muted-foreground tabular-nums">
                          {c.reference}
                          {c.cheque ? ` · Cheque ${c.cheque}` : ""}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "text-body-compact tabular-nums",
                          complete && !poor ? "text-muted-foreground" : "text-warning-ink",
                        )}
                      >
                        {complete
                          ? poor
                            ? `${poor} scan${poor === 1 ? "" : "s"} to check`
                            : `All ${c.docs.need} added`
                          : c.docs.have
                            ? `${c.docs.need - c.docs.have} of ${c.docs.need} to add`
                            : "None added yet"}
                      </span>
                      <ChevronDownIcon
                        aria-hidden
                        className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform sm:ml-0", isOpen && "rotate-180")}
                      />
                    </button>
                    {isOpen ? (
                      <div
                        id={panel}
                        className="grid grid-cols-1 gap-4 px-4 pb-4 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-6 sm:px-6"
                      >
                        {/* The case in brief beside its slots: what each paper should show. */}
                        <div className="flex min-w-0 flex-col gap-3">
                          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-body-compact">
                            {c.facts.map((f, k) => (
                              <React.Fragment key={k}>
                                <dt className="text-muted-foreground">{f.label}</dt>
                                <dd className="min-w-0 break-words tabular-nums">{f.value}</dd>
                              </React.Fragment>
                            ))}
                          </dl>
                          {c.original ? (
                            <div className="border-t border-hairline pt-3">
                              <OriginalDoc original={c.original} />
                            </div>
                          ) : null}
                        </div>
                        <div className="flex min-w-0 flex-col gap-2">
                          <ul className="grid grid-cols-1 content-start gap-2 lg:grid-cols-2">
                            {c.documents.map((d) => {
                              const flag = poorOf(c).find(
                                (f) => f.fix?.kind === "upload" && f.fix.slotKey === d.slotKey,
                              );
                              return (
                                <li key={`${d.group}-${d.slotKey ?? d.name}`}>
                                  <Slot
                                    doc={d}
                                    locked={closed}
                                    busy={busy === `${c.id}:${d.slotKey}`}
                                    onFile={(file) => void upload(c, d, file)}
                                    poor={flag}
                                    onKeep={flag ? () => void keep(c, flag) : undefined}
                                  />
                                </li>
                              );
                            })}
                          </ul>
                          {/* Optional papers are the case's own: its filing Documents section
                              takes them, and they show there and in the case file. */}
                          <div className="flex flex-wrap items-center gap-2">
                            {!closed ? (
                              <Button asChild variant="ghost" className="-ml-3 w-fit">
                                <Link href={caseFlowHref(batch.id, c, "documents", ai)}>
                                  <PlusIcon data-icon="inline-start" aria-hidden />
                                  Add other document
                                </Link>
                              </Button>
                            ) : null}
                            {demo && !complete && !closed ? (
                              <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void fillDemo([c])}>
                                <WandSparklesIcon data-icon="inline-start" aria-hidden />
                                Demo files
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {shownCases.length > listed.length ? (
            <div className="border-t border-hairline px-4 py-3 sm:px-6">
              <Button variant="ghost" className="-ml-3" onClick={() => setLimit((n) => n + PAGE)}>
                Show {Math.min(PAGE, shownCases.length - listed.length)} more of{" "}
                {shownCases.length - listed.length}
              </Button>
            </div>
          ) : null}
        </Card>
      )}
      {locked ? (
        <p className="text-body-compact text-muted-foreground tabular-nums">
          {locked} case{locked === 1 ? " is" : "s are"} signed or filed, so {locked === 1 ? "its" : "their"}{" "}
          documents cannot change.{" "}
          <button type="button" className="underline" onClick={() => go(batch.counts.filed ? "filed" : "pay")}>
            {batch.counts.filed ? "See filed cases" : "Go to payment"}
          </button>
        </p>
      ) : null}
      <BatchFooter>
        <FilingFooter
        showSaveState={false}
        onBack={() => go("scrutiny")}
        continueLabel="Continue to review"
        onContinue={() => go("review")}
      />
      </BatchFooter>
    </div>
  );
}
