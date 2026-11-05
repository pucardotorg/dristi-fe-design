"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CirclePlayIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
  WandSparklesIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

import { readability } from "@/lib/filing/readability";

import { demoBlurryScan, demoPdf } from "./demo-fill";
import { bulkApi, caseFlowHref, useBulkFileUrl, type CaseView } from "./api";
import { BatchFooter } from "./batch-footer";
import type { BatchCtx } from "./batch-screen";
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
 * One document of one case, as a line (v8): its state, its name, the file or what is
 * still wanted, and one button to add or replace it. A file can also be dropped on the
 * line. Locked once the case is signed, as a single filing is.
 */
export function DocLine({
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
  const has = !!doc.file;
  const href = useBulkFileUrl(doc.file?.id);
  const canUpload = !locked && !!doc.slotKey;
  const choose = () => {
    if (canUpload && !busy) input.current?.click();
  };
  return (
    <div
      onDragOver={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && canUpload && !busy) onFile(file);
      }}
      className={cn("flex flex-col rounded-lg px-2 py-1.5 transition-colors hover:bg-accent", over && "ring-2 ring-ring")}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {busy ? (
          <Spinner className="size-4 shrink-0" />
        ) : poor ? (
          <StatusMark tone="warning" size={16} still label="Added, hard to read" />
        ) : has ? (
          <CircleCheckIcon aria-hidden className="size-4 shrink-0 text-success" />
        ) : (
          <CircleDashedIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 text-body-compact sm:w-56 sm:shrink-0">
          {doc.name}
          {doc.required ? null : <span className="text-muted-foreground"> optional</span>}
        </span>
        <span className="min-w-0 flex-1 basis-32 truncate text-body-compact text-muted-foreground">
          {doc.file ? (
            <a href={href ?? undefined} target="_blank" rel="noreferrer" className="hover:underline" title={`${doc.file.name} · ${sizeOf(doc.file.size)}`}>
              {doc.file.name}
            </a>
          ) : canUpload ? (
            "Click Add file, or drop it here"
          ) : null}
        </span>
        {canUpload ? (
          has ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={choose} aria-label={`Replace ${doc.name}`}>
              Replace
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={busy} onClick={choose} aria-label={`Add file: ${doc.name}`}>
              <UploadIcon data-icon="inline-start" aria-hidden />
              Add file
            </Button>
          )
        ) : null}
      </div>
      {has && poor ? (
        <p className="flex flex-wrap items-baseline gap-x-2 pl-7 text-body-compact text-warning-ink">
          <span>{poor.message}</span>
          {onKeep && canUpload ? (
            <button type="button" className="text-foreground underline disabled:opacity-50" disabled={busy} onClick={onKeep}>
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

  // Which cases show: by default only those with something to add (v8); "Show all"
  // brings back the complete ones. One finished here stays where it is until the tab is
  // opened again, so the list never moves under the filer's hand.
  const term = search.trim().toLowerCase();
  const matches = (c: CaseView) =>
    !term || [c.accused, c.title, c.reference, c.cheque].some((v) => v.toLowerCase().includes(term));
  const base = showAll ? open : open.filter((c) => startedOpen.has(c.id));
  const shownCases = base.filter(matches);
  const listed = shownCases.slice(0, limit);
  const lackingCases = open.filter(needsWork);
  const complete = open.length - lackingCases.length;
  // What the cases still lack, in words: a file missing, or only a scan to look at again.
  const short = incomplete.length
    ? `${incomplete.length} ${incomplete.length === 1 ? "case is" : "cases are"} missing documents`
    : lackingCases.length
      ? `${lackingCases.length} ${lackingCases.length === 1 ? "case has a scan" : "cases have scans"} to check`
      : null;

  return (
    <div className="flex flex-col gap-4">
      <DocumentsGuide open={guide} onOpenChange={setGuide} />

      {error ? <StatusLine tone="error">{error}</StatusLine> : null}

      <Card variant="raised">
        <CardHeader>
          <CardTitle className="text-body font-semibold tabular-nums">
            {short ?? "Every case has its documents"}
          </CardTitle>
          <CardDescription className="tabular-nums">
            {[
              lackingCases.length ? `${complete} ${complete === 1 ? "case is" : "cases are"} complete.` : null,
              missing ? `${missing} required ${missing === 1 ? "file" : "files"} to add.` : null,
              scans ? `${scans} ${scans === 1 ? "scan is" : "scans are"} hard to read.` : null,
            ]
              .filter(Boolean)
              .join(" ")}
          </CardDescription>
          <CardAction className="flex items-center gap-1">
            {demo && incomplete.length && !closed ? (
              <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void fillDemo(incomplete)}>
                <WandSparklesIcon data-icon="inline-start" aria-hidden />
                Demo files for all
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => setGuide(true)}>
              <CirclePlayIcon data-icon="inline-start" aria-hidden />
              How this works
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-72">
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
            {base.length < open.length || showAll ? (
              <Button variant="ghost" size="sm" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Only cases missing files" : `Show all ${open.length} cases`}
              </Button>
            ) : null}
          </div>

          {listed.length === 0 ? (
            <p className="py-6 text-center text-body-compact text-muted-foreground">
              {term ? `No case matches “${search.trim()}”.` : "Every case has its documents."}
            </p>
          ) : (
            <div className="flex flex-col">
              <div className="hidden items-center gap-4 border-b border-hairline px-2 pb-2 text-body-compact font-medium text-muted-foreground sm:flex">
                <span className="min-w-0 flex-1">Accused</span>
                <span className="w-44 shrink-0">Your reference</span>
                <span className="w-48 shrink-0">Documents</span>
                <span className="w-4 shrink-0" />
              </div>
              {listed.map((c) => {
                const need = c.docs.need;
                const left = need - c.docs.have;
                const poor = poorOf(c).length;
                const isOpen = expanded === c.id;
                const panel = `docs-${c.id}`;
                const missingName = c.documents.find((d) => d.required && !d.file)?.name;
                return (
                  <div key={c.id} className="border-b border-hairline last:border-b-0">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panel}
                      onClick={() => setExpanded(isOpen ? null : c.id)}
                      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2 py-3 text-left transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-focus-ring focus-visible:outline-none sm:flex-nowrap"
                    >
                      <span className="flex min-w-0 flex-1 basis-48 flex-col">
                        <span className="truncate text-body-compact font-medium">{c.accused || c.title}</span>
                        <span className="text-body-compact text-muted-foreground tabular-nums">
                          {c.cheque ? `Cheque ${c.cheque}` : ""}
                        </span>
                      </span>
                      <span className="text-body-compact tabular-nums sm:w-44 sm:shrink-0">{c.reference}</span>
                      <span className="sm:w-48 sm:shrink-0">
                        {left > 0 ? (
                          <span className="text-body-compact text-warning-ink">
                            {left === 1 && missingName ? `${missingName} missing` : left === need ? "None added yet" : `${left} missing`}
                          </span>
                        ) : poor ? (
                          <span className="text-body-compact text-warning-ink tabular-nums">
                            {poor} {poor === 1 ? "scan" : "scans"} to check
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-body-compact text-muted-foreground tabular-nums">
                            <CheckIcon aria-hidden className="size-4 text-success" />
                            All {need} added
                          </span>
                        )}
                      </span>
                      <ChevronDownIcon
                        aria-hidden
                        className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform sm:ml-0", isOpen && "rotate-180")}
                      />
                    </button>
                    {isOpen ? (
                      <div id={panel} className="flex flex-col gap-1 px-2 pb-3">
                        {c.documents.map((d) => {
                          const flag = poorOf(c).find((f) => f.fix?.kind === "upload" && f.fix.slotKey === d.slotKey);
                          return (
                            <DocLine
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
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {/* Optional papers are the case's own: its filing Documents section
                              takes them, and they show there and in the case file. */}
                          {!closed ? (
                            <Button asChild variant="ghost" size="sm" className="w-fit">
                              <Link href={caseFlowHref(batch.id, c, "documents", ai)}>
                                <PlusIcon data-icon="inline-start" aria-hidden />
                                Add other document
                              </Link>
                            </Button>
                          ) : null}
                          {demo && left > 0 && !closed ? (
                            <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void fillDemo([c])}>
                              <WandSparklesIcon data-icon="inline-start" aria-hidden />
                              Demo files
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {shownCases.length > listed.length ? (
            <Button variant="ghost" size="sm" className="w-fit" onClick={() => setLimit((n) => n + PAGE)}>
              Show {Math.min(PAGE, shownCases.length - listed.length)} more of {shownCases.length - listed.length}
            </Button>
          ) : null}
        </CardContent>
      </Card>
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
          status={
            short ? <span className="text-body-compact text-muted-foreground tabular-nums">{short}</span> : undefined
          }
          // Cases still missing a file never hold the complete ones up (v8).
          continueVariant={lackingCases.length ? "outline" : "default"}
          continueLabel={lackingCases.length ? `Continue with ${complete} complete` : "Continue to signing"}
          onContinue={() => go("sign")}
        />
      </BatchFooter>
    </div>
  );
}
