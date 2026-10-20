"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  WandSparklesIcon,
} from "lucide-react";

import { money } from "@/lib/filing/format";
import type { FilingDraft } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import { CourtDocument } from "@/components/filing/sections/preview/court-document";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { bulkApi, type BatchView } from "./api";
import { saveLabel, useAutosave } from "./autosave";
import { demoPdf } from "./demo-fill";
import { Slot } from "./documents-tab";
import { CaseEditor, detailFlags, filledByEdit, pathOf } from "./scrutiny-tab";
import { CaseBadge } from "./stage";

type View = "details" | "documents" | "review";

/**
 * One case of a batch, in two views: Details, every field editable in the single filing's
 * sections, and Review, the case as the single filing's synopsis shows it. Every case's
 * draft is loaded once, so previous and next (or the arrow keys) switch at once, and the
 * view chosen stays as you move.
 */
export function CaseWorkspace({
  batch,
  setBatch,
  index,
  onIndex,
  title,
  className,
}: {
  batch: BatchView;
  setBatch: (b: BatchView) => void;
  index: number;
  onIndex: (index: number) => void;
  /** Renders the case's name: a dialog title in the modal, a page heading on the page. */
  title: (text: string) => React.ReactNode;
  className?: string;
}) {
  const cases = batch.cases;
  const c = cases[index];
  const [view, setView] = React.useState<View>("details");
  const [drafts, setDrafts] = React.useState<Record<
    string,
    FilingDraft
  > | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadDrafts = React.useCallback(
    () =>
      fetch(`/api/bulk/batches/${batch.id}/drafts`, { cache: "no-store" })
        .then(async (r) => {
          const json = await r.json();
          if (!r.ok)
            throw new Error(json.error ?? "The cases could not be loaded.");
          setDrafts(json.drafts);
        })
        .catch((e) => setFailed((e as Error).message)),
    [batch.id],
  );
  React.useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  const auto = useAutosave({
    batch,
    setBatch,
    caseId: c.id,
    everyCase: (path) =>
      detailFlags(c).some((f) => f.batchWide && pathOf(f) === path),
  });
  const edits = auto.edits;
  // Moving on waits for a save still running, then the next case opens clean.
  const go = async (k: number) => {
    if (k < 0 || k >= cases.length) return;
    await auto.flush();
    auto.reset();
    setError(null);
    onIndex(k);
  };
  const editable = c.stage === "held" || c.stage === "ready";
  // Review reads the saved draft; reread it when Review opens, after any autosaves.
  const flush = auto.flush;
  React.useEffect(() => {
    if (view === "review") void flush().then(loadDrafts);
  }, [view, flush, loadDrafts]);

  const [uploading, setUploading] = React.useState<string | null>(null);
  const attach = async (slotKey: string, file: File) => {
    setUploading(slotKey);
    setError(null);
    try {
      setBatch(await bulkApi.attach(batch.id, c.id, slotKey, file));
      await loadDrafts();
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
    } finally {
      setUploading(null);
    }
  };

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      setBatch(await bulkApi.act(batch.id, body));
      // Review reads the draft; a part added or removed changes it.
      if (body.action === "part") await loadDrafts();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn("flex min-h-0 flex-col", className)}
      onKeyDown={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea, select, [contenteditable=true]"))
          return;
        if (e.key === "ArrowLeft") go(index - 1);
        if (e.key === "ArrowRight") go(index + 1);
      }}
    >
      {/* The header keeps one height whatever the case, so moving on never shifts it. */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-hairline px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={index === 0}
            onClick={() => go(index - 1)}
            aria-label="Previous case"
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <span className="min-w-16 text-center text-body-compact text-muted-foreground tabular-nums">
            {index + 1} of {cases.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={index === cases.length - 1}
            onClick={() => go(index + 1)}
            aria-label="Next case"
          >
            <ChevronRightIcon aria-hidden />
          </Button>
          <div className="ml-2 flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate">{title(c.title)}</span>
              <CaseBadge
                c={c}
                done={
                  detailFlags(c).filter(
                    (f) => f.level === "hold" && filledByEdit(f, c, edits),
                  ).length
                }
              />
            </div>
            <span className="truncate text-body-compact text-muted-foreground tabular-nums">
              {c.reference}
              {c.cheque ? ` · Cheque ${c.cheque}` : ""}
              {c.amount ? ` · ${money(c.amount)}` : ""}
            </span>
          </div>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList variant="line">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="documents">
              Documents
              <span className="tabular-nums text-muted-foreground">
                {c.docs.have}/{c.docs.need}
              </span>
            </TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-sunken px-4 py-6 sm:px-6">
        {error || failed ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error ?? failed}</AlertDescription>
          </Alert>
        ) : null}
        {view === "details" ? (
          <CaseEditor
            c={c}
            batchId={batch.id}
            edits={edits}
            setEdit={auto.setEdit}
            onCommit={auto.commit}
            saveState={saveLabel(auto.state, auto.error)}
            busy={busy || !editable || !!batch.clubbedInto}
            onAct={act}
            header={false}
          />
        ) : view === "documents" ? (
          <div className="flex flex-col gap-4">
            {editable && c.documents.some((d) => !d.file && d.slotKey) ? (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={!!uploading}
                onClick={async () => {
                  for (const d of c.documents.filter(
                    (x) => !x.file && x.slotKey,
                  ))
                    await attach(d.slotKey!, demoPdf(d.name));
                }}
              >
                <WandSparklesIcon data-icon="inline-start" aria-hidden />
                Fill with demo files
              </Button>
            ) : null}
            {[...new Set(c.documents.map((d) => d.group))].map((group) => (
              <section key={group} className="flex flex-col gap-2">
                <h4 className="text-body font-semibold">{group}</h4>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {c.documents
                    .filter((d) => d.group === group)
                    .map((d) => (
                      <Slot
                        key={`${group}-${d.name}`}
                        doc={d}
                        locked={!editable || !!batch.clubbedInto}
                        busy={uploading === d.slotKey}
                        onFile={(file) => void attach(d.slotKey!, file)}
                      />
                    ))}
                </div>
              </section>
            ))}
          </div>
        ) : drafts?.[c.id] ? (
          <CourtDocument draft={drafts[c.id]} />
        ) : (
          <Skeleton className="h-[60vh] w-full rounded-xl" />
        )}
      </div>
    </div>
  );
}
