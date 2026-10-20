"use client";

import * as React from "react";
import { CheckCircle2Icon, CircleAlertIcon, CircleCheckIcon, UploadIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

import { bulkApi, fileUrl, type CaseView } from "./api";
import type { BatchCtx } from "./batch-screen";

type Doc = CaseView["documents"][number];

const ACCEPT = ".pdf,.jpg,.jpeg,.png";


function sizeOf(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
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
}: {
  doc: Doc;
  locked: boolean;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  const filled = !!doc.file;
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
  const fileLine = doc.file ? `${doc.file.name} · ${sizeOf(doc.file.size)}` : "";

  const name = (
    <span className="flex min-w-0 flex-1 items-baseline gap-2">
      <span className="truncate text-body-compact font-medium">{doc.name}</span>
    </span>
  );

  return (
    <div {...drop} className={cn("rounded-lg", over && "ring-2 ring-ring")}>
      {filled ? (
        <div className="flex h-10 items-center gap-2 rounded-lg bg-surface-sunken pr-1 pl-3" title={fileLine}>
          {busy ? (
            <Spinner className="shrink-0" />
          ) : (
            <CircleCheckIcon className="size-4 shrink-0 text-success-ink" aria-label="Uploaded" />
          )}
          {name}
          <Button asChild variant="ghost" size="xs" className={SMALL_BTN} aria-label={`View ${doc.name}: ${fileLine}`} title={fileLine}>
            <a href={fileUrl(doc.file!.id)} target="_blank" rel="noreferrer">
              View
            </a>
          </Button>
          {canUpload ? (
            <Button variant="ghost" size="xs" className={SMALL_BTN} disabled={busy} onClick={choose} aria-label={`Replace ${doc.name}`}>
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
            !canUpload && "cursor-not-allowed"
          )}
        >
          {busy ? <Spinner className="shrink-0" /> : <UploadIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
          {name}
          <span className={cn("shrink-0 text-caption", doc.required ? "text-destructive-ink" : "text-muted-foreground")}>
            {doc.required ? "Required" : "Optional"}
          </span>
        </button>
      )}
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
 * Documents, case by case: every open case is a panel, and every document it needs is a
 * slot shown at once, to click or drop onto. Cases missing something come first. Signed
 * and filed cases are locked, so they are not listed here.
 */
export function DocumentsTab({ batch, setBatch, go }: BatchCtx) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const closed = !!batch.clubbedInto;

  // Cases missing something first, in the order they had when the tab opened, so a case
  // does not jump away the moment its last document goes in.
  const [order] = React.useState(() =>
    [...batch.cases]
      .sort((a, b) => Number(a.docs.have >= a.docs.need) - Number(b.docs.have >= b.docs.need))
      .map((c) => c.id)
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
  const missing = incomplete.reduce((n, c) => n + (c.docs.need - c.docs.have), 0);

  const upload = async (c: CaseView, d: Doc, file: File) => {
    if (!d.slotKey) return;
    setBusy(`${c.id}:${d.slotKey}`);
    setError(null);
    try {
      setBatch(await bulkApi.attach(batch.id, c.id, d.slotKey, file));
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body-compact">
        {missing ? (
          <span className="flex items-center gap-2">
            <CircleAlertIcon className="size-4 text-warning-ink" aria-hidden />
            <span className="tabular-nums">
              {missing} required document{missing === 1 ? "" : "s"} missing across {incomplete.length} case
              {incomplete.length === 1 ? "" : "s"}
            </span>
          </span>
        ) : open.length ? (
          <span className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 text-success-ink" aria-hidden />
            Every required document is in
          </span>
        ) : null}
        {locked ? (
          <span className="text-muted-foreground tabular-nums">
            {locked} case{locked === 1 ? " is" : "s are"} signed or filed, so {locked === 1 ? "its" : "their"} documents cannot change.{" "}
            <button type="button" className="underline" onClick={() => go(batch.counts.filed ? "filed" : "pay")}>
              {batch.counts.filed ? "See filed cases" : "Go to payment"}
            </button>
          </span>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {open.length === 0 ? (
        <Card className={PANEL_CLASS}>
          <CardContent className="text-body-compact text-muted-foreground">All documents are in.</CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {open.map((c) => {
            const complete = c.docs.have >= c.docs.need;
            return (
              <li key={c.id}>
                <Card className={cn(PANEL_CLASS, "gap-3 py-4")}>
                  <CardHeader className="flex flex-col gap-1 px-4 sm:flex-row sm:items-center sm:gap-4">
                    <CardTitle className="text-body font-semibold tabular-nums">{c.reference}</CardTitle>
                    <span className="min-w-0 truncate text-body-compact text-muted-foreground">{c.title}</span>
                    <Badge variant={complete ? "success" : "warning"} className="tabular-nums sm:ml-auto">
                      {c.docs.have} of {c.docs.need} required
                    </Badge>
                  </CardHeader>
                  <CardContent className="px-4">
                    <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {c.documents.map((d) => (
                        <li key={`${d.group}-${d.slotKey ?? d.name}`}>
                          <Slot
                            doc={d}
                            locked={closed}
                            busy={busy === `${c.id}:${d.slotKey}`}
                            onFile={(file) => void upload(c, d, file)}
                          />
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
