"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronRightIcon,
  CircleAlertIcon,
  OctagonAlertIcon,
  PlusIcon,
  SparklesIcon,
  Undo2Icon,
  WandSparklesIcon,
} from "lucide-react";

import type { CaseField } from "@/lib/bulk/case-fields";
import type { Flag } from "@/lib/bulk/scrutiny";
import { money } from "@/lib/filing/format";
import { cn } from "@/lib/utils";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FormField } from "@/components/filing/form-field";
import { SectionTabs } from "@/components/filing/section-tabs";
import { PANEL_CLASS } from "@/components/filing/form-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { bulkApi, type CaseView } from "./api";
import { saveLabel, useAutosave } from "./autosave";
import { CaseList } from "./case-list";
import { demoEdits } from "./demo-fill";
import type { BatchCtx } from "./batch-screen";

type Kind = "hold" | "ai" | "check";
const kindOf = (f: Flag): Kind =>
  f.level === "hold" ? "hold" : f.source === "ai" ? "ai" : "check";

/** Glyph, tint and name per kind. Colour is never alone: the glyph and the words differ too. */
const KIND: Record<
  Kind,
  {
    Icon: typeof OctagonAlertIcon;
    disc: string;
    ink: string;
    ring: string;
    name: string;
  }
> = {
  hold: {
    Icon: OctagonAlertIcon,
    disc: "bg-destructive-muted text-destructive-muted-foreground",
    ink: "text-destructive-ink",
    ring: "border-destructive-ink",
    name: "Needs fixing",
  },
  check: {
    Icon: CircleAlertIcon,
    disc: "bg-warning-muted text-warning-muted-foreground",
    ink: "text-warning-ink",
    ring: "border-warning-ink bg-warning-muted",
    name: "To check",
  },
  ai: {
    Icon: SparklesIcon,
    disc: "bg-info-muted text-info-muted-foreground",
    ink: "text-info-ink",
    ring: "border-info-ink bg-info-muted",
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

/** The single filing's sections, in its order; those that repeat name their part. */
const STEPS: {
  step: string;
  title: string;
  part?: "accused" | "cheque" | "notice" | "witness";
  single: string;
}[] = [
  { step: "complainant", title: "Further complainants", single: "Complainant" },
  { step: "accused", title: "Accused", part: "accused", single: "Accused" },
  {
    step: "cheque",
    title: "Cheque & return memo",
    part: "cheque",
    single: "Cheque",
  },
  {
    step: "demand-notice",
    title: "Demand notice & debt",
    part: "notice",
    single: "Demand notice",
  },
  {
    step: "jurisdiction",
    title: "Jurisdiction & limitation",
    single: "Jurisdiction",
  },
  { step: "witnesses", title: "Witnesses", part: "witness", single: "Witness" },
];

/** Which field of a part a flag's code is about. */
const CODE_FIELD: Record<string, string> = {
  "ACC-2": "name",
  "ACC-4": "entType",
  "ACC-6": "contacts.0.mobile",
  "ACC-7": "contacts.0.email",
  "ACC-8": "addresses.0.addr.line1",
  "ACC-14": "reps.0.name",
  "CHQ-1": "dateOnCheque",
  "CHQ-2": "amount",
  "CHQ-3": "chequeNumber",
  "CHQ-5": "ifsc",
  "CHQ-8": "presentDate",
  "CHQ-9": "returnDate",
  "CHQ-10": "returnReason",
  "LDN-1": "natureDebt",
  "LDN-2": "dispatchDate",
  "LDN-3": "modeService",
  "LDN-4": "tracking",
  "LDN-5": "delivered",
  "LDN-6": "deliveryDate",
  "LDN-7": "returnDate",
  "LDN-8": "nonDeliveryReason",
  "LDN-9": "replied",
  "LDN-10": "paymentStatus",
  "LDN-11": "partAmount",
  "JUR-2": "ifsc",
  "JUR-6a": "drawerPolice",
  "JUR-12": "condonationReason",
};
const SECTION_STEP: Record<string, string> = {
  accused: "accused",
  cheque: "cheque",
  "demand-notice": "demand-notice",
  jurisdiction: "jurisdiction",
  witnesses: "witnesses",
  complainant: "complainant",
};

/** The field a flag belongs on, or `null` when it is about no one field. */
/**
 * Whether a typed value would pass the server's own checks, so the live count does not
 * say Complete for a future date or a four-digit pincode.
 */
function plausible(path: string, raw: string): boolean {
  const v = raw.trim();
  if (!v) return false;
  if (/Date$|\.returnDate$/.test(path))
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      v <= new Date().toISOString().slice(0, 10)
    );
  if (/\.pin$/.test(path)) return /^\d{6}$/.test(v.replace(/\s/g, ""));
  if (/mobile$/.test(path))
    return v.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "").length === 10;
  if (/\.ifsc$/.test(path)) return /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(v);
  if (/\.(amount|partAmount|chequeNumber)$/.test(path))
    return /^\d+$/.test(v.replace(/[,\s₹]/g, ""));
  return true;
}

/** Whether an unsaved edit fills the field a hold is about. */
export function filledByEdit(
  f: Flag,
  c: CaseView,
  edits: Record<string, string>,
): boolean {
  const p = fieldFor(f, c.fields);
  return !!p && p in edits && plausible(p, edits[p]);
}

function fieldFor(f: Flag, groups: CaseView["fields"]): string | null {
  // The cause of action not yet arisen comes from the notice's service, not from any
  // limitation field: it belongs under the date the notice was delivered (or returned).
  if (f.rule === "jur-9-early") {
    const dates = groups
      .filter((g) => g.step === "demand-notice")
      .flatMap((g) => g.fields);
    return (
      (
        dates.find((x) => x.path.endsWith(".deliveryDate")) ??
        dates.find((x) => x.path.endsWith(".returnDate"))
      )?.path ?? null
    );
  }
  const own = pathOf(f);
  if (own && groups.some((g) => g.fields.some((x) => x.path === own)))
    return own;
  const suffix = CODE_FIELD[f.field];
  const step = SECTION_STEP[f.section];
  if (!suffix || !step) return null;
  const parts = groups.filter((g) => g.step === step);
  // "Cheque 2", "Accused 1": the part with that number; one part, it is that one.
  const n = /(\d+)$/.exec(f.where)?.[1];
  const part =
    parts.find((g) => g.heading === f.where) ??
    (n ? parts[Number(n) - 1] : undefined) ??
    (parts.length === 1 ? parts[0] : parts[0]);
  return part?.fields.find((x) => x.path.endsWith(`.${suffix}`))?.path ?? null;
}

/** A case's flags about its details; missing documents are shown on the Documents tab. */
export const detailFlags = (c: CaseView) =>
  c.flags.filter(
    (f) =>
      f.section !== "documents" &&
      f.fix?.kind !== "upload" &&
      f.fix?.kind !== "documents",
  );

export const pathOf = (f: Flag) =>
  f.fix && "path" in f.fix ? f.fix.path : null;

/** Fixing first, then checking, then ready. */
const rankOf = (c: CaseView) => {
  const f = detailFlags(c);
  return f.some((x) => x.level === "hold") ? 0 : f.length ? 1 : 2;
};
const RANK: Show[] = ["hold", "check", "ready"];

type Show = "all" | "hold" | "check" | "ready";

/**
 * Case details: every open case of the batch, one at a time, whole. A list on the left
 * says where each case stands; the case on the right shows all its details in the single
 * filing's sections, editable, with what needs fixing marked on the field itself. Save
 * keeps the changes; Save and next moves on. Documents are on their own tab.
 */
export function ScrutinyTab({ batch, setBatch, go }: BatchCtx) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const closed = !!batch.clubbedInto;

  const open = batch.cases.filter(
    (c) => c.stage === "held" || c.stage === "ready",
  );
  const ordered = [...open].sort((a, b) => rankOf(a) - rankOf(b));
  const [show, setShow] = React.useState<Show>("all");
  const listed = ordered.filter(
    (c) => show === "all" || RANK[rankOf(c)] === show,
  );
  const count = (s: Show) =>
    s === "all"
      ? open.length
      : ordered.filter((c) => RANK[rankOf(c)] === s).length;

  // A case asked for in the address (from the Cases tab's Edit) opens first.
  const asked = useSearchParams().get("case");
  const [selectedId, setSelectedId] = React.useState<string | null>(asked);
  const selected = listed.find((c) => c.id === selectedId) ?? listed[0] ?? null;
  const at = selected ? listed.indexOf(selected) : -1;

  // What is typed saves on leaving the field; moving to another case waits for it.
  const auto = useAutosave({
    batch,
    setBatch,
    caseId: selected?.id ?? null,
    everyCase: (path) =>
      !!selected &&
      detailFlags(selected).some((f) => f.batchWide && pathOf(f) === path),
  });
  const edits = auto.edits;
  const choose = async (id: string) => {
    await auto.flush();
    auto.reset();
    setSelectedId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  // Complete: ready, with nothing left to fix or check. What Sign offers.
  const ready = batch.cases.filter(
    (c) => c.stage === "ready" && c.flags.length === 0,
  ).length;
  const skipped = open.flatMap((c) => c.skipped.map((f) => ({ c, f })));
  const next = listed[at + 1]?.id ?? null;
  const prev = listed[at - 1]?.id ?? null;

  const chips: { id: Show; label: string; ink?: string }[] = [
    { id: "all", label: "All" },
    { id: "hold", label: "Needs fixing", ink: "text-destructive-ink" },
    { id: "check", label: "To check", ink: "text-warning-ink" },
    { id: "ready", label: "Ready", ink: "text-success-ink" },
  ];

  if (!open.length)
    return (
      <Alert variant="success">
        <AlertDescription>
          Nothing open here.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => go("sign")}
          >
            Go to Sign
          </button>
        </AlertDescription>
      </Alert>
    );

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Show cases"
      >
        {chips.map((c) => (
          <Button
            key={c.id}
            variant="outline"
            aria-pressed={show === c.id}
            disabled={c.id !== "all" && count(c.id) === 0}
            onClick={() => {
              setShow(c.id);
              setSelectedId(null);
              auto.reset();
            }}
            className="rounded-full aria-pressed:border-primary aria-pressed:bg-accent-strong"
          >
            {c.label}
            <span
              className={cn("tabular-nums", c.ink ?? "text-muted-foreground")}
            >
              {count(c.id)}
            </span>
          </Button>
        ))}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="lg:grid lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* The cases, beside the one on screen: where each stands, with more hinted at the edges. */}
        <CaseList
          cases={listed}
          selectedId={selected?.id ?? null}
          onSelect={choose}
          // Live: on the case being edited, a field filled but not yet saved stops counting.
          stateOf={(c) => {
            const f = detailFlags(c);
            const holds = f.filter(
              (x) =>
                x.level === "hold" &&
                !(c.id === selected?.id && filledByEdit(x, c, edits)),
            ).length;
            return {
              holds,
              checks: f.filter((x) => x.level !== "hold").length,
            };
          }}
        />

        {/* Phones: the same list as a choice above the case. */}
        <Field className="mb-4 gap-1.5 lg:hidden">
          <FieldLabel htmlFor="case-pick">Case</FieldLabel>
          <NativeSelect
            id="case-pick"
            value={selected?.id ?? ""}
            onChange={(e) => choose(e.target.value)}
            className="w-full"
          >
            {listed.map((c) => (
              <NativeSelectOption key={c.id} value={c.id}>
                {c.reference} · {c.accused || c.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>

        {selected ? (
          <CaseEditor
            key={selected.id}
            c={selected}
            batchId={batch.id}
            edits={edits}
            setEdit={auto.setEdit}
            onCommit={auto.commit}
            saveState={saveLabel(auto.state, auto.error)}
            busy={busy || closed}
            onAct={act}
          />
        ) : null}
      </div>

      {skipped.length ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-body font-semibold">Skipped checks</h3>
          <Card className={cn(PANEL_CLASS, "gap-0 px-4 py-1")}>
            <ul className="flex flex-col divide-y divide-hairline">
              {skipped.map(({ c, f }) => (
                <li
                  key={`${c.id}-${f.id}`}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-body-compact font-medium">
                      {c.title}
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
          </Card>
        </section>
      ) : null}

      {selected ? (
        <FilingFooter
          showSaveState={false}
          onBack={prev ? () => void choose(prev) : undefined}
          backLabel="Previous case"
          // Signing never waits for the whole batch: once any case is complete it can go
          // ahead on its own, and the rest stay here. Next case stays beside it.
          // Two ways on from any case: the next case, or signing the cases already complete
          // (only those; the rest stay). With none complete, Sign says why instead.
          extra={
            next ? (
              <Button
                variant="outline"
                size="lg"
                onClick={() => void choose(next)}
              >
                Next case
              </Button>
            ) : null
          }
          continueLabel={
            ready
              ? `Sign ${ready} complete case${ready === 1 ? "" : "s"}`
              : "Sign"
          }
          continueBlocked={!ready}
          continueHint="No case is complete yet"
          onContinue={() => {
            if (ready) void auto.flush().then(() => go("sign"));
          }}
          className="-mx-6 -mb-6 md:-mx-8 md:-mb-8"
        />
      ) : null}
    </div>
  );
}

/** One case, whole: its issues first, then every detail in the single filing's sections. */
export function CaseEditor({
  c,
  batchId,
  edits,
  setEdit,
  onCommit,
  saveState = null,
  busy,
  onAct,
  header = true,
}: {
  c: CaseView;
  batchId: string;
  /** Off where the surrounding view already names the case (the case view's header). */
  header?: boolean;
  edits: Record<string, string>;
  setEdit: (path: string, value: string) => void;
  /** Save one field now: on leaving it, or on choosing from a list. */
  onCommit: (path: string, value: string) => void;
  /** "Saving…", "Saved", or why not. */
  saveState?: string | null;
  busy: boolean;
  onAct: (body: Record<string, unknown>) => Promise<void>;
}) {
  const flags = detailFlags(c);
  // Each flag sits on the field it is about, once: its own fix path if it has one,
  // otherwise the field its code names in the part it names ("Cheque 2" → its number).
  const byPath = new Map<string, Flag[]>();
  const loose: Flag[] = [];
  for (const f of flags) {
    const p = fieldFor(f, c.fields);
    if (p) byPath.set(p, [...(byPath.get(p) ?? []), f]);
    else loose.push(f);
  }

  // Which part is open in each repeating section.
  const [open, setOpen] = React.useState<Record<string, number>>({});
  const fieldCard = (g: CaseView["fields"][number]) => (
    <Card className={cn(PANEL_CLASS, "gap-0 p-4")}>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {g.fields.map((x) => (
          <DetailField
            key={x.path}
            field={x}
            flags={byPath.get(x.path) ?? []}
            onSkip={(f) =>
              void onAct({ action: "skip", caseId: c.id, flagId: f.id })
            }
            value={edits[x.path] ?? x.value}
            edited={x.path in edits}
            onChange={(v) => setEdit(x.path, v)}
            onCommit={(v) => onCommit(x.path, v)}
            disabled={busy}
          />
        ))}
      </div>
    </Card>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Demo: fills every date (consistent, filable today) and every empty required field. */}
      <div className="flex flex-wrap items-center gap-3">
        {!busy ? (
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => {
              for (const [path, value] of Object.entries(
                demoEdits(c.fields, edits, new Set(byPath.keys())),
              )) {
                setEdit(path, value);
                onCommit(path, value);
              }
            }}
          >
            <WandSparklesIcon data-icon="inline-start" aria-hidden />
            Fill with demo values
          </Button>
        ) : null}
        {saveState ? (
          <span
            aria-live="polite"
            className="text-caption text-muted-foreground"
          >
            {saveState}
          </span>
        ) : null}
      </div>
      {header ? (
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="text-title-s font-semibold">{c.title}</h3>
            <span className="flex flex-wrap gap-x-2 text-body-compact text-muted-foreground tabular-nums">
              <span>{c.reference}</span>
              {c.cheque ? <span>· Cheque {c.cheque}</span> : null}
              {c.amount ? <span>· {money(c.amount)}</span> : null}
            </span>
          </div>
          <Button asChild variant="ghost" className="shrink-0">
            <Link href={`/filings/bulk/${batchId}/cases/${c.id}`}>
              View case file
              <ChevronRightIcon data-icon="inline-end" aria-hidden />
            </Link>
          </Button>
        </div>
      ) : null}

      {loose.length ? (
        <Card className={cn(PANEL_CLASS, "gap-0 px-4 py-3")}>
          <ul className="flex flex-col gap-3">
            {loose.map((f) => (
              <li
                key={f.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <FlagLine flag={f} />
                </div>
                {f.fix?.kind === "declare-no-contact" ? (
                  <Button
                    variant="outline"
                    className="ml-8 w-fit shrink-0 sm:ml-0"
                    disabled={busy}
                    onClick={() =>
                      void onAct({
                        action: "declare-no-contact",
                        caseId: c.id,
                        accusedId: (f.fix as { accusedId: string }).accusedId,
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
                    disabled={busy}
                    onClick={() =>
                      void onAct({ action: "skip", caseId: c.id, flagId: f.id })
                    }
                  >
                    Skip
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* The single filing's sections, in its order; parts that repeat sit on its tab strip
          with Add and remove, as when filing one case. */}
      {STEPS.map(({ step, title, part, single }) => {
        const groups = c.fields.filter((g) => g.step === step);
        if (!part) {
          return groups.map((g) => (
            <section key={g.heading} className="flex flex-col gap-2">
              <h4 className="text-body font-semibold">{g.heading}</h4>
              {fieldCard(g)}
            </section>
          ));
        }
        const at = Math.min(open[step] ?? 0, Math.max(0, groups.length - 1));
        const g = groups[at];
        return (
          <section key={step} className="flex flex-col gap-2">
            <h4 className="text-body font-semibold">{title}</h4>
            <SectionTabs
              tabs={groups.map((x, k) => ({
                id: String(k),
                label: `${single} ${k + 1}`,
                status: x.fields.some(
                  (f) => f.required && !(edits[f.path] ?? f.value).trim(),
                )
                  ? "attention"
                  : "complete",
                removable:
                  !busy &&
                  k === groups.length - 1 &&
                  groups.length > (part === "witness" ? 0 : 1),
              }))}
              activeId={String(at)}
              onSelect={(id) => setOpen((o) => ({ ...o, [step]: Number(id) }))}
              onRemove={() =>
                void onAct({ action: "part", caseId: c.id, op: "remove", part })
              }
              addLabel={busy ? undefined : `Add ${single.toLowerCase()}`}
              onAdd={() => {
                setOpen((o) => ({ ...o, [step]: groups.length }));
                void onAct({ action: "part", caseId: c.id, op: "add", part });
              }}
            />
            {g ? (
              <>
                {fieldCard(g)}
                {/* An accused's further addresses, as the single filing's Add address. */}
                {step === "accused" && !busy ? (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void onAct({
                          action: "part",
                          caseId: c.id,
                          op: "add",
                          part: "address",
                          accused: at,
                        })
                      }
                    >
                      <PlusIcon data-icon="inline-start" aria-hidden />
                      Add address
                    </Button>
                    {g.fields.some((f) => /\.addresses\.1\./.test(f.path)) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void onAct({
                            action: "part",
                            caseId: c.id,
                            op: "remove",
                            part: "address",
                            accused: at,
                          })
                        }
                      >
                        Remove last address
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-body-compact text-muted-foreground">
                None added.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * One detail, in the single filing's own field: its label with the required mark (or
 * "optional"), the control, and, when it needs fixing, why, under it as a field error.
 */
function DetailField({
  field,
  flags,
  value,
  edited,
  onChange,
  onCommit,
  disabled,
  onSkip,
}: {
  field: CaseField;
  flags: Flag[];
  onSkip: (f: Flag) => void;
  value: string;
  edited: boolean;
  onChange: (v: string) => void;
  /** Save this value now. */
  onCommit: (v: string) => void;
  disabled: boolean;
}) {
  const hold = flags.find((f) => f.level === "hold");
  const error = hold && !edited ? hold.message : undefined;
  const checks = flags.filter((f) => f.level === "soft");
  return (
    <FormField
      label={field.label}
      required={field.required}
      optional={!field.required}
      error={error}
      className={cn(field.kind === "textarea" && "sm:col-span-2")}
    >
      {field.kind === "select" ? (
        <NativeSelect
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            onChange(e.target.value);
            onCommit(e.target.value);
          }}
          className={cn("w-full", edited && "[&_select]:border-primary")}
        >
          <NativeSelectOption value="">Select</NativeSelectOption>
          {/* A value the list does not have stays visible until it is changed. */}
          {value && !field.options!.some((o) => o.value === value) ? (
            <NativeSelectOption value={value}>{value}</NativeSelectOption>
          ) : null}
          {field.options!.map((o) => (
            <NativeSelectOption key={o.value} value={o.value}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : field.kind === "textarea" ? (
        <Textarea
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => edited && onCommit(value)}
          rows={2}
          className={cn("field-sizing-content", edited && "border-primary")}
        />
      ) : (
        <Input
          type={field.kind === "date" ? "date" : "text"}
          // Every date on a case has happened: none can be after today.
          max={
            field.kind === "date"
              ? new Date().toISOString().slice(0, 10)
              : undefined
          }
          inputMode={field.inputMode}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => edited && onCommit(value)}
          className={cn(edited && "border-primary")}
        />
      )}
      {checks.map((f) => {
        const k = KIND[kindOf(f)];
        return (
          <span
            key={f.id}
            className={cn("flex items-start gap-1.5 text-caption", k.ink)}
          >
            <k.Icon className="mt-0.5 size-3.5 shrink-0" aria-label={k.name} />
            <span className="min-w-0 flex-1">{f.message}</span>
            <button
              type="button"
              className="shrink-0 font-medium underline"
              disabled={disabled}
              onClick={() => onSkip(f)}
            >
              Skip
            </button>
          </span>
        );
      })}
    </FormField>
  );
}
