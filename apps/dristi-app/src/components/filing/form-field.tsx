"use client";

import * as React from "react";
import { InfoIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FieldLock,
  FieldReadOnly,
  useCorrection,
  useCorrectionInstance,
} from "@/components/filing/posture";
import { useFieldPolicy } from "@/components/filing/field-policy";
import { defectState } from "@/lib/tasks/defects";

const SourceFieldLabel = React.createContext("this field");
export function useSourceFieldLabel() { return React.useContext(SourceFieldLabel); }

/** The `*` / "optional" marker after a label. */
export function RequiredMark({ optional }: { optional?: boolean }) {
  if (optional) {
    return <span className="font-normal text-muted-foreground">optional</span>;
  }
  return (
    <>
      <span aria-hidden className="text-destructive">
        *
      </span>
      <span className="sr-only">required</span>
    </>
  );
}

/**
 * Small "i" tooltip beside a label. Keyboard-reachable; the visible label carries meaning.
 * The target is the DS 40px icon button — pulled back with `-my-2` so a label row that
 * carries a tip is still the height of one that doesn't.
 */
export function LabelTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="More about this field"
          className="-my-3 -mr-2.5 -ml-2 align-middle text-muted-foreground"
        >
          <InfoIcon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{children}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Label + control + help text, wired through the DS `Field` so descriptions and errors
 * bind via aria-describedby. `required` adds the asterisk; `optional` adds the muted
 * "optional". Use `asGroup` when the control isn't a single labelled input (segmented,
 * address block).
 *
 * Passing `error` renders `FieldError` and marks the field invalid, which the DS `Input`
 * and `Textarea` read for `aria-invalid`. Other controls need `aria-invalid` themselves —
 * the DS only wires the two that call `useFieldControlProps`.
 */
export function FormField({
  label,
  name,
  required,
  optional,
  tip,
  help,
  helpPlacement = "below",
  error: ownError,
  asGroup = false,
  className,
  children,
}: {
  label: React.ReactNode;
  /**
   * The key this field writes on its record ("ifsc", "age"). Only needed so a scrutiny
   * defect can point at it — see `posture.tsx`; it changes nothing in the ordinary flow.
   */
  name?: string;
  required?: boolean;
  optional?: boolean;
  tip?: React.ReactNode;
  help?: React.ReactNode;
  /** Guidance normally follows the control; "above" puts it between label and control. */
  helpPlacement?: "above" | "below";
  /** What is wrong with the current value. Shown under the control, read out with it. */
  error?: React.ReactNode;
  asGroup?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const correction = useCorrection();
  const instance = useCorrectionInstance();
  // A host's check on this field (bulk filing), when the section has nothing of its own to say.
  const policy = useFieldPolicy();
  const error = ownError ?? (policy && name ? policy.issueAt(instance, name) : null) ?? undefined;
  const defect =
    correction && name ? correction.defectAt(correction.step, instance, name) : null;
  const locked = !!correction && !defect;

  const marker =
    required || optional ? <RequiredMark optional={optional} /> : null;

  const resolved = defect
    ? defectState(defect, correction?.valueOf(defect)) === "resolved"
    : false;
  const active = !!defect && correction?.activeDefect === defect.n;
  const hintId = defect ? `flagged-${defect.n}` : undefined;

  /*
   * A word after the field's name, not a chip on the far side of the row (v3.2).
   *
   * The form is the record now; the work happens in the panel. So this says only which
   * state the field is in, quietly, and keeps the left rule from being colour alone
   * (`foundations/laws`). The sentence beside it is `sr-only` because a screen-reader
   * user gets no rule and no panel adjacency — "read only" on its own would tell them the
   * control is shut and nothing about where to act (`ACCESSIBILITY.md` §4/§5).
   */
  const tag = defect ? (
    <span
      id={hintId}
      className={cn(
        "shrink-0 self-center text-caption font-normal",
        resolved ? "text-success-ink" : "text-muted-foreground"
      )}
    >
      · {resolved ? "corrected" : "flagged"}
      <span className="sr-only">
        {resolved
          ? " by scrutiny, and corrected in the corrections panel"
          : " by scrutiny. Correct it in the corrections panel"}
      </span>
    </span>
  ) : null;

  const labelBody = (
    <>
      {/* One inline run, so on a label that wraps the mark and the tip follow its last
          word instead of standing at the far end of the row, a line away from it. */}
      <span>
        {label}
        {marker ? <> {marker}</> : null}
        {tip ? (
          <>
            {" "}
            <LabelTip>{tip}</LabelTip>
          </>
        ) : null}
      </span>
      {tag}
    </>
  );

  const field = (
    <Field className={cn(asGroup ? "gap-3" : "gap-2", className)} data-invalid={error ? true : undefined}>
      {asGroup ? (
        <FieldTitle className="text-body-compact">{labelBody}</FieldTitle>
      ) : (
        <FieldLabel className="text-body-compact">{labelBody}</FieldLabel>
      )}
      {help && helpPlacement === "above" ? <FieldDescription>{help}</FieldDescription> : null}
      <SourceFieldLabel.Provider value={typeof label === "string" ? label : "this field"}>
        {children}
      </SourceFieldLabel.Provider>
      {help && helpPlacement === "below" ? <FieldDescription>{help}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );

  if (!correction) return field;

  if (defect) {
    /*
     * Flagged: a rule down the left, and nothing else. The rule is neutral until the panel
     * is on this defect, brand while it is, and success once it is corrected — so the one
     * link between the two panes is which field is lit. No inset, no frame: the correction
     * is made in the panel's card (v3.2).
     */
    return (
      <div
        id={`defect-${defect.n}`}
        data-defect-group
        data-defect={defect.n}
        className={cn(
          "scroll-mt-6 border-l-2 pl-3 transition-colors",
          resolved
            ? "border-l-success-ink"
            : active
              ? "border-l-primary"
              : "border-l-border"
        )}
      >
        <FieldReadOnly readOnly hintId={hintId}>
          {field}
        </FieldReadOnly>
      </div>
    );
  }

  /*
   * Untouched by scrutiny: not this round's business, so by default it is not on screen at
   * all — eight flagged fields scattered through the whole form is a needle-in-haystack
   * read. The header's toggle brings the rest back for context, receded to one opacity
   * step; the DS `disabled` treatment is neutralised by the correction screen's centre
   * pane so the two never compound (owner, 2026-08-21).
   */
  if (!correction.showAll) return null;
  return (
    <FieldLock locked={locked}>
      {/* Receded by the correction screen's record pane, for every section alike. */}
      <div>{field}</div>
    </FieldLock>
  );
}
