"use client";

import * as React from "react";
import { Link2Icon } from "lucide-react";

import type { Field } from "@/lib/employee/scrutiny/types";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/**
 * The grammar a raised or returned item is read in — label above fact, rows only where
 * they apply.
 *
 * **The workbench's record.** Shared by the change card, the full-filing returned well,
 * and a raised flag, so the same ask never reads as a table in one view and a stack in
 * another. Side-by-side stole width from the note in the fields pane; vertical is the
 * standing layout (owner, 2026-10-28). The send-back dialog still composes facts for
 * scanning — see `SummaryItem` in `review-dialog.tsx`.
 */
export function RecordList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <dl className={cn("flex flex-col gap-2", className)}>{children}</dl>
  );
}

/** One row: a quiet label above the fact. */
export function RecordRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {/* 14px muted, not 12: the owner's standing rule for key-value data (2026-09-11,
          restated 2026-09-18 — *"avoid the use of 12 size copy for these kind of
          things"*). Hierarchy is colour and stack, not size. */}
      <dt className="text-body-compact text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-body-compact leading-snug">{children}</dd>
    </div>
  );
}

/**
 * A filed value, set as an identifier where the field holds one.
 *
 * It lives beside the rows rather than in either screen because the same value is read
 * in three places — the field row, the item's record, the send-back dialog — and a
 * cheque number that is monospaced in one of them and not the others reads as two
 * different numbers.
 */
export function FieldValue({
  field,
  value,
  copyable = true,
}: {
  field: Field;
  value: string;
  /**
   * Off on a value that has been superseded. The rows that show what was filed strike
   * it through, and a strike drawn across the copy pill and its glyph offers a taking
   * of the one value on the row that is no longer the answer — the composer's own
   * `Filed as` declines for the same reason.
   */
  copyable?: boolean;
}) {
  const courtText = useCourtText();
  if (!field.ident) return <>{courtText(value)}</>;
  /* Copyable even in the field row, which is an option rather than a button:
     `Identifier` keeps the click from reaching the row and selecting it. */
  return <Identifier value={value} label={field.label} copyable={copyable} />;
}

/**
 * A fact that is also a way to the related item.
 *
 * `xs` keeps it at the density of the row it sits in; the coarse-pointer floor is what
 * makes that legal on the tablets the registry works on.
 */
export function RecordLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-start underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [@media(pointer:coarse)]:min-h-10"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
      <Link2Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
