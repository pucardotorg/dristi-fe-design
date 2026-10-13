"use client";

/**
 * **Paper, as the way out when e-signing has not worked — never as its equal.**
 *
 * Every signing window in the product used to offer "upload a physically signed copy" as a
 * second card or a second tab, the same size as e-signing. Paper costs everyone more — a
 * printer, a scan, each party's OTP confirmation, a clerk reading handwriting — so the
 * owner asked for it to be discouraged (2026-10-06):
 *
 * - it is reached from a link under the e-sign route, phrased as the problem it solves
 *   ("Unable to e-sign?"), not from a card beside it;
 * - and before any upload opens, the person picks what went wrong with e-signing.
 *
 * Both pieces live here so every window asks it the same way. Nothing here writes to a
 * record: the owning window decides what the reason unlocks and stores it.
 */

import * as React from "react";

import { PAPER_FALLBACK_REASONS } from "@/lib/filing/options";
import type { PaperFallbackReason } from "@/lib/filing/types";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/**
 * The way onto the paper path, under the e-sign route. A link-weight button keeps it
 * findable for the person who needs it without competing with the route we want taken;
 * it keeps the control's 40px height, so it is still a full touch target.
 */
export function PaperFallbackLink({ onClick }: { onClick: () => void }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-body-compact text-muted-foreground">
      Unable to e-sign?
      <Button type="button" variant="link" className="px-0 underline" onClick={onClick}>
        Upload a physically signed copy
      </Button>
    </p>
  );
}

/**
 * What went wrong with e-signing — one reason, then "Continue to upload" in the window's
 * footer. The owner chose this over rows that each continue on a press (2026-10-07):
 * the reason is picked and seen selected before anything is withdrawn.
 *
 * It is a single choice, so the control is a radio, not a checkbox, set in the DS's
 * choice card (`FieldLabel` around a horizontal `Field`): the whole row is the target,
 * and the picked row takes the DS's own selected border and fill. The question labels
 * the radio group, so a screen reader hears what the rows are a choice between.
 */
export function PaperFallbackQuestion({
  value,
  onChange,
  reasons = PAPER_FALLBACK_REASONS,
}: {
  value: PaperFallbackReason | "";
  onChange: (reason: PaperFallbackReason) => void;
  /** A window with one signer drops "Another party can't e-sign" — there is nobody else. */
  reasons?: readonly { id: PaperFallbackReason; label: string }[];
}) {
  const questionId = React.useId();
  const optionId = React.useId();
  return (
    <div className="flex flex-col gap-3">
      <h3 id={questionId} className="text-body font-semibold">
        What went wrong with e-signing?
      </h3>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as PaperFallbackReason)}
        aria-labelledby={questionId}
        className="gap-2"
      >
        {reasons.map((reason) => {
          const id = `${optionId}-${reason.id}`;
          return (
            <FieldLabel key={reason.id} htmlFor={id} className="bg-card">
              <Field orientation="horizontal" className="gap-3">
                <RadioGroupItem value={reason.id} id={id} />
                {/* Reasons wrap in longer languages rather than clip. */}
                <span className="text-body font-normal text-foreground">{reason.label}</span>
              </Field>
            </FieldLabel>
          );
        })}
      </RadioGroup>
    </div>
  );
}

/** The reasons that make sense for this window — nobody else to wait on with one signer. */
export function paperFallbackReasons(otherSigners: number) {
  return otherSigners > 0
    ? PAPER_FALLBACK_REASONS
    : PAPER_FALLBACK_REASONS.filter((r) => r.id !== "party-cannot-esign");
}
