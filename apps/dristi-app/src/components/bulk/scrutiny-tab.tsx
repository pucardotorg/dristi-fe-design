"use client";

import * as React from "react";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  OctagonAlertIcon,
  SparklesIcon,
  Undo2Icon,
} from "lucide-react";

import type { Flag, FlagFix } from "@/lib/bulk/scrutiny";
import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { bulkApi, type CaseView } from "./api";
import type { BatchCtx } from "./batch-screen";

type Kind = "hold" | "ai" | "check";
const kindOf = (f: Flag): Kind =>
  f.level === "hold" ? "hold" : f.source === "ai" ? "ai" : "check";
/** The most serious kind on a case: a hold, else a rule check, else an AI check. */
const worst = (c: CaseView): Kind => {
  const kinds = c.flags.map(kindOf);
  return kinds.includes("hold")
    ? "hold"
    : kinds.includes("check")
      ? "check"
      : "ai";
};

/** Glyph, tint and name per kind. Colour is never alone: the glyph and the words differ too. */
const KIND: Record<
  Kind,
  { Icon: typeof OctagonAlertIcon; disc: string; bar: string; name: string }
> = {
  hold: {
    Icon: OctagonAlertIcon,
    disc: "bg-destructive-muted text-destructive-muted-foreground",
    bar: "bg-destructive",
    name: "Needs fixing",
  },
  check: {
    Icon: CircleAlertIcon,
    disc: "bg-warning-muted text-warning-muted-foreground",
    bar: "bg-warning",
    name: "To check",
  },
  ai: {
    Icon: SparklesIcon,
    disc: "bg-info-muted text-info-muted-foreground",
    bar: "bg-info",
    name: "AI check",
  },
};

/** One flag, as a line: a tinted mark for its kind, what is wrong, and where. */
export function FlagLine({ flag }: { flag: Flag }) {
  const k = KIND[kindOf(flag)];
  return (
    <div className="flex items-start gap-2 text-body-compact">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          k.disc,
        )}
        title={k.name}
      >
        <k.Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="sr-only">{k.name}: </span>
        {flag.message}{" "}
        <Badge
          variant="outline"
          className="ml-1 align-middle font-normal text-muted-foreground"
        >
          {flag.where}
        </Badge>
      </span>
    </div>
  );
}

/**
 * The details a case is missing, as one form: each field named, with where it belongs,
 * two to a row, and one Save for all of them. Only what was filled is sent.
 */
function FillForm({
  flags,
  busy,
  onSave,
}: {
  flags: Flag[];
  busy: boolean;
  onSave: (
    items: { path: string; value: string; everyCase: boolean }[],
  ) => void;
}) {
  const fixes = flags.map((f) => ({
    f,
    fix: f.fix as Extract<FlagFix, { path: string }>,
  }));
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(fixes.map(({ fix }) => [fix.path, fix.value])),
  );
  const base = React.useId();
  if (!fixes.length) return null;
  const changed = fixes.filter(
    ({ fix }) =>
      (values[fix.path] ?? "").trim() && values[fix.path] !== fix.value,
  );
  const set = (path: string, v: string) =>
    setValues((prev) => ({ ...prev, [path]: v }));
  return (
    <form
      className="flex flex-col gap-3 rounded-lg bg-surface-sunken p-3 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(
          changed.map(({ f, fix }) => ({
            path: fix.path,
            value: values[fix.path],
            everyCase: !!f.batchWide,
          })),
        );
      }}
    >
      <p className="text-body-compact font-medium">
        <span className="tabular-nums">{fixes.length}</span> detail
        {fixes.length === 1 ? "" : "s"} to fill
      </p>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {fixes.map(({ f, fix }) => {
          const id = `${base}-${fix.path}`;
          const value = values[fix.path] ?? "";
          return (
            <Field
              key={f.id}
              className={cn(
                "gap-1",
                fix.kind === "text" && fix.multiline && "sm:col-span-2",
              )}
            >
              <FieldLabel
                htmlFor={id}
                className="flex flex-wrap items-baseline gap-x-2 text-body-compact"
              >
                {fix.label}
                <span className="text-caption font-normal text-muted-foreground">
                  {f.where}
                </span>
              </FieldLabel>
              {fix.kind === "select" ? (
                <NativeSelect
                  id={id}
                  value={value}
                  onChange={(e) => set(fix.path, e.target.value)}
                  className="w-full"
                >
                  <NativeSelectOption value="">Choose</NativeSelectOption>
                  {fix.options.map((o) => (
                    <NativeSelectOption key={o.value} value={o.value}>
                      {o.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              ) : fix.kind === "text" && fix.multiline ? (
                <Textarea
                  id={id}
                  value={value}
                  onChange={(e) => set(fix.path, e.target.value)}
                  rows={2}
                  className="field-sizing-content"
                />
              ) : (
                <Input
                  id={id}
                  type={fix.kind === "date" ? "date" : "text"}
                  inputMode={fix.kind === "text" ? fix.inputMode : undefined}
                  value={value}
                  onChange={(e) => set(fix.path, e.target.value)}
                />
              )}
              {f.batchWide ? (
                <span className="text-caption text-muted-foreground">
                  Changes it on every open case in the batch.
                </span>
              ) : null}
            </Field>
          );
        })}
      </div>
      <Button
        type="submit"
        className="self-end"
        disabled={busy || !changed.length}
      >
        {changed.length > 1 ? `Save ${changed.length}` : "Save"}
      </Button>
    </form>
  );
}

/** A case's flags about its details; missing documents are shown on the Documents tab. */
const detailFlags = (c: CaseView) =>
  c.flags.filter(
    (f) =>
      f.section !== "documents" &&
      f.fix?.kind !== "upload" &&
      f.fix?.kind !== "documents",
  );

/**
 * Bulk scrutiny: the filing rules over every case, before anything is signed or paid.
 * A hold keeps a case back; a check can be skipped. Fixes are made here, in place.
 */
export function ScrutinyTab({ batch, setBatch, go }: BatchCtx) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const closed = !!batch.clubbedInto;

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

  // Several fixes on one case, saved one after another; the batch comes back after each.
  const fixAll = async (
    caseId: string,
    items: { path: string; value: string; everyCase: boolean }[],
  ) => {
    setBusy(true);
    setError(null);
    try {
      let view = batch;
      for (const it of items)
        view = await bulkApi.act(batch.id, { action: "fix", caseId, ...it });
      setBatch(view);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const open = batch.cases.filter(
    (c) => c.stage === "held" || c.stage === "ready",
  );
  const flagged = open.filter((c) => detailFlags(c).length);
  const clear = open.length - flagged.length;

  // The same rule across cases, so a check can be skipped for all of them at once.
  const groups = new Map<string, { flag: Flag; cases: CaseView[] }>();
  for (const c of flagged) {
    for (const f of c.flags) {
      const g = groups.get(f.rule) ?? { flag: f, cases: [] };
      g.cases.push(c);
      groups.set(f.rule, g);
    }
  }
  const softGroups = [...groups.values()].filter(
    (g) => g.flag.level === "soft" && g.cases.length > 1,
  );
  const skipped = open.flatMap((c) => c.skipped.map((f) => ({ c, f })));

  // Filter chips stand in for a legend: each names a kind, shows its mark and count.
  const [show, setShow] = React.useState<Kind | "all">("all");
  const count = (k: Kind) =>
    flagged.filter((c) => detailFlags(c).some((f) => kindOf(f) === k)).length;
  const shown =
    show === "all"
      ? flagged
      : flagged.filter((c) => detailFlags(c).some((f) => kindOf(f) === show));
  const chips: { id: Kind | "all"; label: string; n: number }[] = [
    { id: "all", label: "All", n: flagged.length },
    { id: "hold", label: KIND.hold.name, n: count("hold") },
    { id: "check", label: KIND.check.name, n: count("check") },
    ...(batch.ai === "on"
      ? [{ id: "ai" as const, label: KIND.ai.name, n: count("ai") }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Show cases"
      >
        {chips.map((c) => {
          const k = c.id === "all" ? null : KIND[c.id];
          return (
            <Button
              key={c.id}
              variant="outline"
              aria-pressed={show === c.id}
              disabled={c.n === 0 && c.id !== "all"}
              onClick={() => setShow(c.id)}
              className="rounded-full aria-pressed:border-primary aria-pressed:bg-accent-strong"
            >
              {k ? (
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full",
                    k.disc,
                  )}
                  aria-hidden
                >
                  <k.Icon className="size-3" />
                </span>
              ) : null}
              {c.label}
              <span className="tabular-nums text-muted-foreground">{c.n}</span>
            </Button>
          );
        })}
        <span className="ml-auto flex items-center gap-1.5 text-body-compact text-muted-foreground">
          <CheckCircle2Icon className="size-4 text-success-ink" aria-hidden />
          <span className="tabular-nums">{clear}</span> ready to sign
        </span>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {softGroups.length ? (
        <ul className="flex flex-col gap-2">
          {softGroups.map((g) => {
            const k = KIND[kindOf(g.flag)];
            return (
              <li
                key={g.flag.rule}
                className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-sunken px-4 py-2"
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full",
                    k.disc,
                  )}
                  aria-hidden
                >
                  <k.Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 text-body-compact">
                  <span className="sr-only">{k.name}: </span>
                  Same check on{" "}
                  <span className="font-medium tabular-nums">
                    {g.cases.length} cases
                  </span>{" "}
                  <span className="text-muted-foreground">{g.flag.where}</span>
                </span>
                <Button
                  variant="outline"
                  disabled={busy || closed}
                  onClick={() =>
                    void act({ action: "skip-rule", rule: g.flag.rule })
                  }
                >
                  Skip for all {g.cases.length}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {flagged.length === 0 ? (
        <Alert variant="success">
          <CheckCircle2Icon aria-hidden />
          <AlertTitle>All cases are ready to sign</AlertTitle>
          <AlertDescription>
            <button
              type="button"
              className="underline"
              onClick={() => go("sign")}
            >
              Go to Sign
            </button>
          </AlertDescription>
        </Alert>
      ) : (
        <Card className={cn(PANEL_CLASS, "gap-0 py-0")}>
          <ul className="flex flex-col divide-y divide-hairline">
            {shown.map((c) => (
              <li
                key={c.id}
                id={`bulk-case-${c.id}`}
                className="relative flex scroll-mt-20 flex-col gap-2 py-3 pr-4 pl-5 sm:pr-6 sm:pl-7"
              >
                {/* The bar says, before reading, whether the case is held or only has checks. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-3 left-2 w-1 rounded-full sm:left-3",
                    KIND[worst(c)].bar,
                  )}
                />
                {/* Who against whom first, then what tells this case apart. */}
                <div className="flex min-w-0 flex-col">
                  <span className="text-body font-semibold">{c.title}</span>
                  <span className="flex flex-wrap gap-x-2 text-caption text-muted-foreground tabular-nums">
                    <span>{c.reference}</span>
                    {c.cheque ? <span>· Cheque {c.cheque}</span> : null}
                    {c.amount ? <span>· {money(c.amount)}</span> : null}
                  </span>
                  <span className="sr-only">{KIND[worst(c)].name}</span>
                </div>
                {/* Every missing detail of the case in one form, saved together. */}
                {show === "all" || show === "hold" ? (
                  <FillForm
                    key={c.flags.map((f) => f.id).join("|")}
                    flags={detailFlags(c).filter(
                      (f) => f.fix && "path" in f.fix,
                    )}
                    busy={busy || closed}
                    onSave={(items) => void fixAll(c.id, items)}
                  />
                ) : null}
                <ul className="flex flex-col gap-2">
                  {detailFlags(c)
                    .filter((f) => show === "all" || kindOf(f) === show)
                    .filter((f) => !(f.fix && "path" in f.fix))
                    .map((f) => (
                      <li
                        key={f.id}
                        className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <FlagLine flag={f} />
                        </div>
                        {/* The one-click actions sit at the row's end, as in a mail list. */}
                        {f.fix?.kind === "declare-no-contact" ? (
                          <Button
                            variant="outline"
                            className="ml-8 w-fit shrink-0 sm:ml-0"
                            disabled={busy || closed}
                            onClick={() =>
                              void act({
                                action: "declare-no-contact",
                                caseId: c.id,
                                accusedId: (f.fix as { accusedId: string })
                                  .accusedId,
                              })
                            }
                          >
                            Declare neither is known
                          </Button>
                        ) : null}
                        {f.level === "soft" ? (
                          <Button
                            variant="ghost"
                            className="ml-8 w-fit shrink-0 sm:ml-0"
                            disabled={busy || closed}
                            onClick={() =>
                              void act({
                                action: "skip",
                                caseId: c.id,
                                flagId: f.id,
                              })
                            }
                          >
                            Skip
                          </Button>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {skipped.length ? (
        <Card className={PANEL_CLASS}>
          <CardHeader>
            <CardTitle className="text-body font-semibold">
              Skipped checks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-hairline">
              {skipped.map(({ c, f }) => (
                <li
                  key={`${c.id}-${f.id}`}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-body-compact font-medium tabular-nums">
                      {c.reference}
                    </span>
                    <FlagLine flag={f} />
                  </div>
                  <Button
                    variant="ghost"
                    disabled={busy || closed}
                    onClick={() =>
                      void act({ action: "unskip", caseId: c.id, flagId: f.id })
                    }
                  >
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
