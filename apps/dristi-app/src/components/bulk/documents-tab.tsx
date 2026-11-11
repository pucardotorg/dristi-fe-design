"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckIcon, CirclePlayIcon, PlusIcon, TriangleAlertIcon, WandSparklesIcon } from "lucide-react";

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

import { readability } from "@/lib/filing/readability";

import { demoBlurryScan, demoPdf } from "./demo-fill";
import { bulkApi, caseFlowHref, useBulkFileUrl, type CaseView } from "./api";
import { BatchFooter } from "./batch-footer";
import type { BatchCtx } from "./batch-screen";
import { batchTallies, caseState } from "./batch-marks";
import { CaseSearch } from "./case-list-tools";
import { chequeLine } from "./case-rows";
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
}: {
  doc: Doc;
  locked: boolean;
  busy: boolean;
  onFile: (file: File) => void;
  poor?: Flag;
  onKeep?: () => void;
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
              chip,
              poor ? "bg-warning-muted text-warning-ink hover:bg-warning-muted/80" : "bg-muted text-foreground hover:bg-accent",
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
            <span className="truncate">
              {chipName(doc.name)}
              {poor ? ": hard to read" : ""}
            </span>
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

type Show = "missing" | "complete" | "all";

/**
 * Documents, case by case: one row per case with a chip for each of its documents, so
 * what is missing across the batch is seen at once and added where it is (BLK-11). The
 * batch's own documents (the complainant's, set in Common details) are not repeated in
 * every row unless one is missing. Cases still being fixed join later; signed and filed
 * cases are locked. Read 25 at a time.
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
          <ul className="flex flex-col">
            <li aria-hidden className="hidden gap-4 rounded-lg bg-muted px-4 py-2.5 text-body-compact font-medium text-muted-foreground md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
              <span>Accused</span>
              <span>Documents</span>
            </li>
            {listed.map((c) => (
              <li
                key={c.id}
                className="grid gap-x-4 gap-y-2 border-b border-hairline px-4 py-3.5 last:border-b-0 md:grid-cols-[16rem_minmax(0,1fr)] md:items-start"
              >
                <span className="flex min-w-0 flex-col text-body-compact">
                  <span className="font-medium">{c.accused || c.title}</span>
                  <span className="font-mono text-muted-foreground">{c.reference}</span>
                  <span className="text-muted-foreground tabular-nums">{chequeLine(c)}</span>
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
                  {/* Optional papers are the case's own: its filing Documents section takes
                      them, and they show there and in the case file. */}
                  {!closed ? (
                    <Button asChild variant="ghost" size="sm" className="h-10">
                      <Link href={caseFlowHref(batch.id, c, "documents", ai)}>
                        <PlusIcon data-icon="inline-start" aria-hidden />
                        Other
                      </Link>
                    </Button>
                  ) : null}
                  {demo && c.docs.have < c.docs.need && !closed ? (
                    <Button variant="ghost" size="sm" className="h-10" disabled={!!busy} onClick={() => void fillDemo([c])}>
                      <WandSparklesIcon data-icon="inline-start" aria-hidden />
                      Demo files
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
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
