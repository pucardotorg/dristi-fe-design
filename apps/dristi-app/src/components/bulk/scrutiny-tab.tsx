"use client";

import * as React from "react";
import { CheckCircle2Icon, CircleAlertIcon, OctagonAlertIcon, Undo2Icon } from "lucide-react";

import type { Flag, FlagFix } from "@/lib/bulk/scrutiny";
import { cn } from "@/lib/utils";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { bulkApi, type CaseView } from "./api";
import type { BatchCtx } from "./batch-screen";
import { Slot } from "./documents-tab";

/** One flag, as a line: what kind, where, what. */
export function FlagLine({ flag }: { flag: Flag }) {
  const hold = flag.level === "hold";
  return (
    <div className="flex items-start gap-2 text-body-compact">
      {hold ? (
        <OctagonAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive-ink" aria-hidden />
      ) : (
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden />
      )}
      <span className="min-w-0">
        <span className="font-medium">{hold ? "Hold" : "Check"}</span>
        <span className="text-muted-foreground"> · {flag.where} · </span>
        <span className="tabular-nums text-muted-foreground">{flag.field}</span>
        <span className="block">{flag.message}</span>
      </span>
    </div>
  );
}

function FixForm({
  fix,
  busy,
  onSave,
}: {
  fix: Extract<FlagFix, { path: string }>;
  busy: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = React.useState(fix.value);
  const id = React.useId();
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSave(value);
      }}
    >
      <Field className="min-w-0 flex-1 gap-1.5">
        <FieldLabel htmlFor={id} className="text-caption">
          {fix.label}
        </FieldLabel>
        {fix.kind === "select" ? (
          <NativeSelect id={id} value={value} onChange={(e) => setValue(e.target.value)}>
            <NativeSelectOption value="">Choose</NativeSelectOption>
            {fix.options.map((o) => (
              <NativeSelectOption key={o.value} value={o.value}>
                {o.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : fix.kind === "text" && fix.multiline ? (
          <Textarea id={id} value={value} onChange={(e) => setValue(e.target.value)} rows={3} />
        ) : (
          <Input
            id={id}
            type={fix.kind === "date" ? "date" : "text"}
            inputMode={fix.kind === "text" ? fix.inputMode : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" variant="outline" disabled={busy || !value.trim()}>
        Save
      </Button>
    </form>
  );
}

/**
 * Bulk scrutiny: the filing rules over every case, before anything is signed or paid.
 * A hold keeps a case back; a check can be skipped. Fixes are made here, in place.
 */
export function ScrutinyTab({ batch, setBatch, go }: BatchCtx) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const closed = !!batch.clubbedInto;

  const [uploading, setUploading] = React.useState<string | null>(null);
  const attach = async (caseId: string, slotKey: string, file: File) => {
    setUploading(`${caseId}:${slotKey}`);
    setError(null);
    try {
      setBatch(await bulkApi.attach(batch.id, caseId, slotKey, file));
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = batch.cases.filter((c) => c.stage === "held" || c.stage === "ready");
  const flagged = open.filter((c) => c.flags.length);
  const clear = open.length - flagged.length;
  const held = open.filter((c) => c.stage === "held").length;
  const checks = open.filter((c) => c.stage === "ready" && c.flags.length).length;

  // The same rule across cases, so a check can be skipped for all of them at once.
  const groups = new Map<string, { flag: Flag; cases: CaseView[] }>();
  for (const c of flagged) {
    for (const f of c.flags) {
      const g = groups.get(f.rule) ?? { flag: f, cases: [] };
      g.cases.push(c);
      groups.set(f.rule, g);
    }
  }
  const softGroups = [...groups.values()].filter((g) => g.flag.level === "soft" && g.cases.length > 1);
  const skipped = open.flatMap((c) => c.skipped.map((f) => ({ c, f })));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className={cn(PANEL_CLASS, "gap-1 py-4")}>
          <CardContent className="flex items-center gap-3 px-4">
            <CheckCircle2Icon className="size-5 text-success-ink" aria-hidden />
            <div>
              <div className="text-title-s font-semibold tabular-nums">{clear}</div>
              <div className="text-caption text-muted-foreground">Clear to sign</div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(PANEL_CLASS, "gap-1 py-4")}>
          <CardContent className="flex items-center gap-3 px-4">
            <CircleAlertIcon className="size-5 text-warning-ink" aria-hidden />
            <div>
              <div className="text-title-s font-semibold tabular-nums">{checks}</div>
              <div className="text-caption text-muted-foreground">With checks to answer</div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn(PANEL_CLASS, "gap-1 py-4")}>
          <CardContent className="flex items-center gap-3 px-4">
            <OctagonAlertIcon className="size-5 text-destructive-ink" aria-hidden />
            <div>
              <div className="text-title-s font-semibold tabular-nums">{held}</div>
              <div className="text-caption text-muted-foreground">Held for review</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-body-compact text-muted-foreground">
        A hold is a requirement not met: the case stays in draft until it is fixed, and the rest of the batch goes ahead. A
        check is a value worth a second look: fix it, or skip it and the case goes ahead.
      </p>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {softGroups.length ? (
        <Card className={PANEL_CLASS}>
          <CardHeader>
            <CardTitle className="text-body font-semibold">Checks across the batch</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {softGroups.map((g) => (
              <div key={g.flag.rule} className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-sunken p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="text-body-compact font-medium">
                    <span className="tabular-nums">{g.flag.field}</span> on <span className="tabular-nums">{g.cases.length}</span> cases
                  </div>
                  <div className="text-caption text-muted-foreground">{g.cases.map((c) => c.reference).join(", ")}</div>
                </div>
                <Button variant="outline" disabled={busy || closed} onClick={() => void act({ action: "skip-rule", rule: g.flag.rule })}>
                  Skip for all {g.cases.length}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {flagged.length === 0 ? (
        <Alert variant="success">
          <CheckCircle2Icon aria-hidden />
          <AlertTitle>Every open case is clear</AlertTitle>
          <AlertDescription>
            <button type="button" className="underline" onClick={() => go("sign")}>
              Go to signing
            </button>
          </AlertDescription>
        </Alert>
      ) : (
        <ul className="flex flex-col gap-4">
          {flagged.map((c) => (
            <li key={c.id}>
              <Card className={PANEL_CLASS}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-body font-semibold">
                    <span className="tabular-nums">{c.reference}</span>
                    {c.stage === "held" ? <Badge variant="destructive">Held</Badge> : <Badge variant="warning">Checks to answer</Badge>}
                  </CardTitle>
                  <CardDescription>{c.title}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col divide-y divide-hairline">
                    {c.flags.map((f) => (
                      <li key={f.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                        <FlagLine flag={f} />
                        <div className="flex flex-col gap-2 pl-6">
                          {f.fix && "path" in f.fix ? (
                            <>
                              <FixForm
                                key={`${f.id}-${f.fix.value}`}
                                fix={f.fix}
                                busy={busy || closed}
                                onSave={(value) =>
                                  void act({ action: "fix", caseId: c.id, path: (f.fix as { path: string }).path, value, everyCase: !!f.batchWide })
                                }
                              />
                              {f.batchWide ? (
                                <span className="text-caption text-muted-foreground">Saving changes it on every open case in the batch.</span>
                              ) : null}
                            </>
                          ) : null}
                          {f.fix?.kind === "declare-no-contact" ? (
                            <Button
                              variant="outline"
                              className="w-fit"
                              disabled={busy || closed}
                              onClick={() => void act({ action: "declare-no-contact", caseId: c.id, accusedId: (f.fix as { accusedId: string }).accusedId })}
                            >
                              Declare that neither is known
                            </Button>
                          ) : null}
                          {f.fix?.kind === "upload"
                            ? (() => {
                                const slotKey = f.fix.slotKey;
                                const doc = c.documents.find((d) => d.slotKey === slotKey);
                                return doc ? (
                                  <Slot
                                    doc={doc}
                                    locked={closed}
                                    busy={uploading === `${c.id}:${slotKey}`}
                                    onFile={(file) => void attach(c.id, slotKey, file)}
                                  />
                                ) : null;
                              })()
                            : null}
                          {f.fix?.kind === "documents" ? (
                            <Button variant="outline" className="w-fit" onClick={() => go("documents")}>
                              Add it on Documents
                            </Button>
                          ) : null}
                          {f.level === "soft" ? (
                            <Button
                              variant="ghost"
                              className="w-fit"
                              disabled={busy || closed}
                              onClick={() => void act({ action: "skip", caseId: c.id, flagId: f.id })}
                            >
                              Skip this check
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {skipped.length ? (
        <Card className={PANEL_CLASS}>
          <CardHeader>
            <CardTitle className="text-body font-semibold">Skipped checks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-hairline">
              {skipped.map(({ c, f }) => (
                <li key={`${c.id}-${f.id}`} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <span className="text-body-compact font-medium tabular-nums">{c.reference}</span>
                    <FlagLine flag={f} />
                  </div>
                  <Button variant="ghost" disabled={busy || closed} onClick={() => void act({ action: "unskip", caseId: c.id, flagId: f.id })}>
                    <Undo2Icon data-icon="inline-start" aria-hidden />
                    Undo skip
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
