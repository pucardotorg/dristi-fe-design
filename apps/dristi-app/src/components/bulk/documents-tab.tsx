"use client";

import * as React from "react";
import { CheckIcon, FolderUpIcon, UploadIcon } from "lucide-react";

import { codeForSlot, DOC_CODE_LABEL, DOC_CODES, slotKeyFor, type DocCode } from "@/lib/bulk/contract";
import { cn } from "@/lib/utils";
import { TABLE_CELL, TABLE_HEAD, TABLE_HEAD_ROW, tableBodyClass, tableRowClass } from "@/components/chrome/table-plate";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { bulkApi, fileUrl, type CaseView } from "./api";
import type { BatchCtx } from "./batch-screen";

type Slot = { slotKey: string; code: DocCode; index: number; label: string; required: boolean; fileId: string | null };

function slotsOf(c: CaseView): Slot[] {
  return c.documents
    .filter((d) => d.slotKey)
    .map((d) => {
      const code = codeForSlot(d.slotKey!);
      return code ? { slotKey: d.slotKey!, code: code.code, index: code.index, label: d.name, required: d.required, fileId: d.file?.id ?? null } : null;
    })
    .filter((s): s is Slot => !!s);
}

/** `<reference>_<code>[_<n>].<ext>` — `GJ-PL-0041870_DCM-1.pdf`, `GJ-PL-0041870_DCM-2_2.pdf`. */
export function matchName(name: string): { reference: string; code: DocCode; index: number } | null {
  const m = /^(.+?)_(DCM-\d+)(?:_(\d+))?\.[a-z0-9]+$/i.exec(name.trim());
  if (!m) return null;
  const code = m[2].toUpperCase() as DocCode;
  if (!(DOC_CODES as readonly string[]).includes(code)) return null;
  return { reference: m[1], code, index: Number(m[3] ?? 1) };
}

type Unmatched = { file: File; caseId: string; slotKey: string };

/**
 * Documents for every case at once. Files named by the rule attach themselves; anything
 * else is placed by hand. Signed and filed cases are locked, as a single filing is.
 */
export function DocumentsTab({ batch, setBatch }: BatchCtx) {
  const editable = batch.cases.filter((c) => c.stage === "held" || c.stage === "ready");
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [unmatched, setUnmatched] = React.useState<Unmatched[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<string | null>(null);
  const pick = React.useRef<HTMLInputElement>(null);
  const cellPick = React.useRef<HTMLInputElement>(null);
  const cellTarget = React.useRef<{ caseId: string; slotKey: string } | null>(null);
  const closed = !!batch.clubbedInto;

  const codes = DOC_CODES.filter((code) => editable.some((c) => slotsOf(c).some((s) => s.code === code)));

  const upload = async (items: { file: File; caseId: string; slotKey: string }[]) => {
    setError(null);
    setProgress({ done: 0, total: items.length });
    let latest = null;
    let failed = 0;
    for (const [i, it] of items.entries()) {
      try {
        latest = await bulkApi.attach(batch.id, it.caseId, it.slotKey, it.file);
      } catch {
        failed += 1;
      }
      setProgress({ done: i + 1, total: items.length });
    }
    if (latest) setBatch(latest);
    setProgress(null);
    return failed;
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const matched: { file: File; caseId: string; slotKey: string }[] = [];
    const rest: Unmatched[] = [];
    for (const file of Array.from(files)) {
      const m = matchName(file.name);
      const c = m ? editable.find((x) => x.reference.toLowerCase() === m.reference.toLowerCase()) : undefined;
      const key = m ? slotKeyFor(m.code, m.index) : "";
      if (c && slotsOf(c).some((s) => s.slotKey === key)) matched.push({ file, caseId: c.id, slotKey: key });
      else rest.push({ file, caseId: "", slotKey: "" });
    }
    const failed = await upload(matched);
    setUnmatched((prev) => [...prev, ...rest]);
    setReport(
      `${matched.length - failed} of ${files.length} file${files.length === 1 ? "" : "s"} attached by name.` +
        (rest.length ? ` ${rest.length} need placing below.` : "") +
        (failed ? ` ${failed} could not be attached.` : "")
    );
  };

  const missingTotal = editable.reduce((n, c) => n + (c.docs.need - c.docs.have), 0);

  return (
    <div className="flex flex-col gap-6">
      <Card className={PANEL_CLASS}>
        <CardHeader>
          <CardTitle className="text-body font-semibold">Add documents</CardTitle>
          <CardDescription>
            Name each file <span className="font-mono">reference_code</span>, for example{" "}
            <span className="font-mono">{editable[0]?.reference ?? "GJ-PL-0041870"}_DCM-1.pdf</span>, and it attaches to that case.
            A second cheque&apos;s file ends <span className="font-mono">_2</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-xl border border-dashed border-input bg-surface-sunken px-6 py-8 text-center",
              closed && "opacity-60"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!closed) void onFiles(e.dataTransfer.files);
            }}
          >
            <FolderUpIcon className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-body-compact">Drop files here, or choose them</p>
            <Button variant="outline" disabled={closed || !!progress} onClick={() => pick.current?.click()}>
              <UploadIcon data-icon="inline-start" aria-hidden />
              Choose files
            </Button>
            <input
              ref={pick}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="sr-only"
              aria-label="Choose documents"
              onChange={(e) => {
                void onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {progress ? (
            <div className="flex flex-col gap-1" aria-live="polite">
              <Progress value={(progress.done / progress.total) * 100} aria-label="Upload progress" />
              <span className="text-caption text-muted-foreground tabular-nums">
                Attaching {progress.done} of {progress.total}
              </span>
            </div>
          ) : null}
          {report ? (
            <p className="text-body-compact" aria-live="polite">
              {report}
            </p>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
            {codes.map((code) => (
              <li key={code}>
                <span className="font-mono">{code}</span> {DOC_CODE_LABEL[code]}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {unmatched.length ? (
        <Card className={PANEL_CLASS}>
          <CardHeader>
            <CardTitle className="text-body font-semibold">Place these files</CardTitle>
            <CardDescription>Their names did not match a case and a document.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-hairline">
              {unmatched.map((u, i) => {
                const c = editable.find((x) => x.id === u.caseId);
                const slots = c ? slotsOf(c) : [];
                return (
                  <li key={`${u.file.name}-${i}`} className="flex flex-col gap-3 py-3 first:pt-0 md:flex-row md:items-end">
                    <span className="min-w-0 flex-1 truncate text-body-compact" title={u.file.name}>
                      {u.file.name}
                    </span>
                    <Field className="gap-1.5 md:w-56">
                      <FieldLabel htmlFor={`um-case-${i}`} className="text-caption">
                        Case
                      </FieldLabel>
                      <NativeSelect
                        id={`um-case-${i}`}
                        value={u.caseId}
                        onChange={(e) => setUnmatched((prev) => prev.map((x, k) => (k === i ? { ...x, caseId: e.target.value, slotKey: "" } : x)))}
                      >
                        <NativeSelectOption value="">Choose</NativeSelectOption>
                        {editable.map((x) => (
                          <NativeSelectOption key={x.id} value={x.id}>
                            {x.reference}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field className="gap-1.5 md:w-64">
                      <FieldLabel htmlFor={`um-slot-${i}`} className="text-caption">
                        Document
                      </FieldLabel>
                      <NativeSelect
                        id={`um-slot-${i}`}
                        value={u.slotKey}
                        disabled={!c}
                        onChange={(e) => setUnmatched((prev) => prev.map((x, k) => (k === i ? { ...x, slotKey: e.target.value } : x)))}
                      >
                        <NativeSelectOption value="">Choose</NativeSelectOption>
                        {slots.map((s) => (
                          <NativeSelectOption key={s.slotKey} value={s.slotKey}>
                            {s.code} {s.label}
                            {s.fileId ? " (replace)" : ""}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Button
                      variant="outline"
                      disabled={!u.caseId || !u.slotKey || !!progress}
                      onClick={async () => {
                        const failed = await upload([u]);
                        if (!failed) setUnmatched((prev) => prev.filter((_, k) => k !== i));
                        else setError(`${u.file.name} could not be attached.`);
                      }}
                    >
                      Attach
                    </Button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className={cn(PANEL_CLASS, "gap-0 py-0")}>
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <h2 className="text-body font-semibold">By case</h2>
          <span className="text-caption text-muted-foreground tabular-nums">
            {missingTotal ? `${missingTotal} required document${missingTotal === 1 ? "" : "s"} missing` : "Every required document is in"}
          </span>
        </div>
        <div className="overflow-x-auto px-2 pb-2">
          <Table className="border-separate border-spacing-0" aria-label="Documents by case">
            <TableHeader>
              <TableRow className={TABLE_HEAD_ROW}>
                <TableHead className={cn(TABLE_HEAD, "pl-4")}>Reference</TableHead>
                {codes.map((code) => (
                  <TableHead key={code} className={cn(TABLE_HEAD, "text-center")}>
                    <span className="block font-mono">{code}</span>
                    <span className="block text-caption font-normal">{DOC_CODE_LABEL[code]}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className={tableBodyClass({ hover: false })}>
              {editable.map((c) => {
                const slots = slotsOf(c);
                return (
                  <TableRow key={c.id} className={tableRowClass({ hover: false })}>
                    <TableCell className={cn(TABLE_CELL, "pl-4 font-medium tabular-nums")}>{c.reference}</TableCell>
                    {codes.map((code) => {
                      const mine = slots.filter((s) => s.code === code);
                      if (!mine.length) return <TableCell key={code} className={cn(TABLE_CELL, "text-center text-muted-foreground")}>—</TableCell>;
                      const missing = mine.find((s) => !s.fileId);
                      const have = mine.filter((s) => s.fileId);
                      return (
                        <TableCell key={code} className={cn(TABLE_CELL, "text-center")}>
                          <div className="flex flex-col items-center gap-1">
                            {have.map((s) => (
                              <a
                                key={s.slotKey}
                                href={fileUrl(s.fileId!)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-success-ink underline-offset-4 hover:underline"
                                aria-label={`${s.label}, ${c.reference}: view`}
                              >
                                <CheckIcon className="size-4" aria-hidden />
                                {mine.length > 1 ? <span className="tabular-nums">{s.index}</span> : "In"}
                              </a>
                            ))}
                            {missing?.required ? <span className="text-caption text-warning-ink">Missing</span> : null}
                            {missing ? (
                              <Button
                                size="sm"
                                variant={missing.required ? "outline" : "ghost"}
                                disabled={closed || !!progress}
                                onClick={() => {
                                  cellTarget.current = { caseId: c.id, slotKey: missing.slotKey };
                                  cellPick.current?.click();
                                }}
                                aria-label={`Upload ${missing.label} for ${c.reference}`}
                              >
                                {missing.required ? "Upload" : "Add"}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <input
          ref={cellPick}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="sr-only"
          aria-label="Choose one document"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file && cellTarget.current) {
              const failed = await upload([{ file, ...cellTarget.current }]);
              if (failed) setError(`${file.name} could not be attached.`);
            }
          }}
        />
      </Card>
    </div>
  );
}
