"use client";

/**
 * One defect, worked on in the panel (brief v3.2).
 *
 * v2.1 put a layer under the flagged field *and* a row in the queue, so every defect spoke
 * twice and all of the officer's evidence was expanded before anyone had decided they
 * needed it. v3 gave each side one job: the form is the record, and this card — in the
 * panel — is the only place a correction is made. That is why nothing here is repeated on
 * the form, and why the form's control is no longer editable at all.
 *
 * The card is three things, top to bottom:
 *
 *   1. **What it is** — the field, and where it lives.
 *   2. **Why it was flagged** — the officer's comment.
 *   3. **The fix** — the field's own control (or *Replace this document*), Save, and
 *      *Keep as filed* for a value the advocate believes is already right.
 *
 * The officer says what is wrong; the advocate makes the fix. There is no proposed value
 * to accept or reject, no voice note, no marked page, and no reply to scrutiny (owner,
 * 2026-10-08).
 * Keeping the filed value asks for no reason — the gate must not force an edit to a value
 * the advocate believes is correct (owner, 2026-10-08).
 *
 * Resolution is derived from the filing (D6), never self-certified: a field counts once
 * its value differs from what scrutiny saw, or once it is kept as filed. What is typed
 * stays in the card until Save correction writes it to the filing, so nothing counts as
 * corrected before Save (owner, 2026-10-12).
 */

import * as React from "react";
import { CircleCheckIcon, CircleDashedIcon, RefreshCwIcon, Undo2Icon } from "lucide-react";

import { targetControlKind } from "@/lib/filing/targets";
import { defectState, resolutionLabel } from "@/lib/tasks/defects";
import type { Defect } from "@/lib/tasks/types";
import type { StoredFileRef } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { DateField } from "@/components/filing/date-field";
import { PrefixInput, TextField } from "@/components/filing/inputs";

/* ───────────────────────────── What it can do ───────────────────────────── */

export type DefectActions = {
  /** Write the advocate's value at this defect's target. */
  setValue: (value: string) => void;
  /** Leave the filed value standing. Field defects only. */
  keep?: () => void;
  /** Put the filing back the way scrutiny saw it and forget the resolution. */
  undo?: () => void;
  /** Document defects: open the file picker for the flagged slot. */
  replace?: () => void;
};

/* ───────────────────────── Why it was flagged ───────────────────────── */

/** The label above the officer's material — what it *is*, quietly. A sentence-case
 *  label in the DS's label role; the uppercase, tracked eyebrow it replaces broke the
 *  type rules (owner, 2026-10-12). */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-body-compact font-medium text-muted-foreground">{children}</p>;
}

/**
 * The officer's reason: the typed comment.
 *
 * The comment sits under its own eyebrow — *Scrutiny officer's comment* over the words —
 * because an unlabelled sentence inside a card reads as system copy, and system copy is
 * what people have learned not to read (owner, 2026-08-21). It gets a sunken well of its
 * own for the same reason: it is quoted material, not the card talking.
 *
 * Who exactly wrote it is still not shown — only scrutiny flags a filing, so a name says
 * nothing the label does not.
 */
function WhyFlagged({ defect }: { defect: Defect }) {
  return (
    <div className="flex flex-col gap-4">
      {defect.note.trim() ? (
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Scrutiny officer&apos;s comment</Eyebrow>
          <p className="rounded-md bg-surface-sunken p-3 text-body-compact text-foreground">
            {defect.note}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────── The fix ───────────────────────── */

/** The control the field itself uses, so a date is picked and an amount is in rupees. */
function OwnValue({
  defect,
  value,
  onChange,
  focusTarget,
}: {
  defect: Defect;
  value: string;
  onChange: (value: string) => void;
  focusTarget: boolean;
}) {
  const id = `own-${defect.n}`;
  const kind = targetControlKind(defect.target);
  const mark = focusTarget ? "" : undefined;
  return (
    <Field className="gap-2">
      {/* Labelled with the field's own name. "Your value" named nothing — this is the
          only control here, and the thing it holds is the cheque's date. */}
      <FieldLabel htmlFor={id} className="text-body-compact">
        {defect.target.label}
      </FieldLabel>
      {kind === "date" ? (
        <DateField id={id} value={value} onChange={onChange} />
      ) : kind === "amount" ? (
        <PrefixInput
          id={id}
          prefix="₹"
          value={value}
          onChange={onChange}
          inputMode="numeric"
          data-defect-focus={mark}
        />
      ) : (
        <TextField id={id} value={value} onChange={onChange} data-defect-focus={mark} />
      )}
    </Field>
  );
}

/* ───────────────────────── The card ───────────────────────── */

export function DefectCard({
  defect,
  value,
  actions,
  index,
  total,
  onFocusCapture,
  onBlurCapture,
  className,
  file,
}: {
  /** Document defects: the copy the slot holds now — the filed one, or its replacement. */
  file?: StoredFileRef;
  defect: Defect;
  /** What the filing currently holds at this defect's target. */
  value: string | undefined;
  actions: DefectActions;
  /** Its place in the run — "2 of 8". */
  index: number;
  total: number;
  onFocusCapture?: () => void;
  onBlurCapture?: (event: React.FocusEvent<HTMLElement>) => void;
  className?: string;
}) {
  const resolved = defectState(defect, value) === "resolved";
  const isDoc = defect.target.kind === "doc";

  /*
   * What the advocate is typing stays in the card until Save correction writes it to the
   * filing (owner, 2026-10-12: a field was marked corrected on the first keystroke, before
   * Save). Resolution is still read from the filing — it just only changes on Save.
   */
  const [draft, setDraft] = React.useState(value ?? "");
  const [lastValue, setLastValue] = React.useState(value);
  if (value !== lastValue) {
    // The filing moved under the card (Undo, another device): show what it holds now.
    setLastValue(value);
    setDraft(value ?? "");
  }
  /* Save is for a value that differs from what the filing holds; Keep while it is still
     the one scrutiny saw. */
  const dirty = !isDoc && draft.trim() !== (value ?? "").trim();
  const atReturn = !isDoc && draft.trim() === (defect.valueAtReturn ?? "").trim();

  /**
   * Is the advocate mid-act inside the editing area?
   *
   * The thing this exists to prevent: resolution is *live* — a field defect counts as
   * resolved on the first keystroke that changes the value — and a card that collapsed the
   * moment it resolved unmounted the input under the advocate's fingers, so exactly one
   * character ever landed (owner, 2026-08-21). So the collapse waits for the act to end:
   * touching anything in `[data-own-value]` engages the card, and it disengages only when
   * focus leaves the card entirely or Save finishes the act. `relatedTarget` is checked
   * against the card root, not the editing area, so moving from the input to its own Save
   * button (or out to the evidence) never counts as leaving.
   */
  const [engaged, setEngaged] = React.useState(false);

  const root = React.useRef<HTMLDivElement>(null);

  const watch = {
    ref: root,
    onFocusCapture: (event: React.FocusEvent<HTMLElement>) => {
      const el = event.target as HTMLElement;
      if (el.closest?.("[data-own-value]")) setEngaged(true);
      onFocusCapture?.();
    },
    onBlurCapture: (event: React.FocusEvent<HTMLElement>) => {
      const to = event.relatedTarget as HTMLElement | null;
      if (!root.current?.contains(to)) setEngaged(false);
      onBlurCapture?.(event);
    },
  };

  /** The act finished — the card may collapse now. */
  const finish = () => setEngaged(false);

  /* Collapsing removes whatever held focus, and losing focus to `<body>` strands a
     keyboard user — so it lands on the collapsed card itself. */
  const collapsed = resolved && !engaged;
  const wasCollapsed = React.useRef(collapsed);
  React.useLayoutEffect(() => {
    if (collapsed && !wasCollapsed.current) {
      if (!root.current?.contains(document.activeElement)) {
        root.current?.focus({ preventScroll: true });
      }
    }
    wasCollapsed.current = collapsed;
  }, [collapsed]);

  /* ── Resolved, and the act has ended: report what was decided, offer the way back ── */
  if (collapsed) {
    return (
      <div
        data-defect-card
        tabIndex={-1}
        className={cn(
          "overflow-hidden rounded-lg border border-hairline bg-card shadow-raised outline-none",
          className
        )}
        {...watch}
      >
        <div className="flex items-start gap-2.5 p-4">
          <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success-ink" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-body-compact font-semibold text-foreground">
              {defect.target.label}
            </p>
            <p className="text-body-compact text-success-ink">{resolutionLabel(defect, value)}</p>
            {/* Which file now stands in for the flagged one, so the replacement is
                visibly done (owner, 2026-10-12). */}
            {isDoc && file ? (
              <p className="truncate text-body-compact text-muted-foreground">
                {file.name}
              </p>
            ) : null}
          </div>
          {actions.undo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => actions.undo?.()}
              className="-my-1 shrink-0 text-muted-foreground"
            >
              <Undo2Icon data-icon="inline-start" aria-hidden />
              Undo
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  /* ── Open ── */
  return (
    <div
      data-defect-card
      className={cn(
        "overflow-hidden rounded-lg border border-hairline bg-card shadow-raised",
        className
      )}
      {...watch}
    >
      <div className="flex items-start gap-2.5 px-4 pt-4">
        <CircleDashedIcon className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-body font-semibold text-foreground">{defect.target.label}</h3>
          <p className="text-body-compact text-muted-foreground">
            {defect.target.kind === "field" && defect.target.instanceLabel
              ? defect.target.instanceLabel
              : defect.target.sectionLabel}
          </p>
        </div>
        <span className="shrink-0 text-body-compact tabular-nums text-muted-foreground">
          {index} of {total}
        </span>
      </div>

      <div className="flex flex-col gap-3.5 p-4">
        <WhyFlagged defect={defect} />

        <div data-own-value className="flex flex-col gap-3 border-t border-hairline pt-4">
          {isDoc ? (
            <>
              {file ? (
                <p className="text-body-compact text-muted-foreground">
                  On file: <span className="text-foreground">{file.name}</span>
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={actions.replace}
                data-defect-focus
                className="w-fit"
              >
                <RefreshCwIcon data-icon="inline-start" aria-hidden />
                Replace this document
              </Button>
              <p className="text-body-compact text-muted-foreground">
                Replacing the scan does not re-read it — no other field changes.
              </p>
            </>
          ) : (
            <>
              <OwnValue defect={defect} value={draft} onChange={setDraft} focusTarget />
              {/* The act's own full stop. Resolution is derived, so this button changes
                  no data — it ends the act, which is what lets the card collapse to its
                  one-line report. Without it the only way to finish was to click
                  somewhere else, which nobody trusts as "saved". */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    actions.setValue(draft);
                    finish();
                  }}
                  disabled={!dirty || atReturn}
                  className="flex-1"
                >
                  Save correction
                </Button>
                {/* Never forced to edit a value the advocate believes is right. Only
                    offered while the value is still the one scrutiny saw. */}
                {!atReturn ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      // Typed back to the filed value after a save: put it back first.
                      if (dirty) actions.setValue(draft);
                      actions.keep?.();
                      finish();
                    }}
                    className="shrink-0 text-muted-foreground"
                  >
                    Keep as filed
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
