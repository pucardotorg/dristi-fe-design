"use client";

import * as React from "react";
import { Link2Icon } from "lucide-react";

import type { Field } from "@/lib/employee/scrutiny/types";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";
import { useCourtText } from "@/components/court/court-provider";

/**
 * The grammar a raised item is read in — one label column, one value column, rows only
 * where they apply.
 *
 * **The workbench's record.** It was the send-back dialog's too, on the argument that
 * one data type gets one rendering (ui-craft §2). That held while the dialog listed two
 * or three items and broke at twenty: a label column is the fastest way to *find* a
 * value in one record and the slowest way to *scan* many, because the names end up
 * outweighing the facts (owner, 2026-09-18). The two surfaces still share the
 * vocabulary — the same facts under the same names — and the dialog composes them for
 * scanning instead; see `SummaryItem` in `review-dialog.tsx`.
 *
 * The two columns collapse to one below `22rem` of container width, so a record stays
 * legible when the fields pane is dragged to its floor. `@container` is declared by the
 * caller, on whatever box actually constrains the rows.
 */
export function RecordList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-x-3 gap-y-2 @[22rem]:grid-cols-[minmax(6rem,8rem)_1fr]",
        className,
      )}
    >
      {children}
    </dl>
  );
}

/** One row: a quiet label, then the fact. */
export function RecordRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {/* 14px muted, not 12: the owner's standing rule for key-value data (2026-09-11,
          restated 2026-09-18 on this dialog — *"avoid the use of 12 size copy for these
          kind of things"*). Hierarchy here is colour and column, not size, so the label
          and its value are one size and the whole record reads as one table. */}
      <dt className="text-body-compact text-muted-foreground">{label}</dt>
      <dd className="-mt-1 min-w-0 text-body-compact leading-snug @[22rem]:mt-0">
        {children}
      </dd>
    </>
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
