"use client";

/**
 * The two batch questions that are not a column of the file, each asked where it can be
 * answered (owner, 2026-11-10):
 *
 *  · ADR: a batch detail like the complainants and advocates (PRD BLK-05, PRY-5), so it is
 *    asked with them, on Common details' Complainant step.
 *  · Additional details: a column of the file (PRY-1). A format fills only the cases whose
 *    row left it empty, so it is asked on Check, once the file says how many those are.
 */

import * as React from "react";
import Link from "next/link";
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";

import { detailField, bracketsIn } from "@/lib/filing/detail-fields";
import { formatForFiler, type DetailsFormat } from "@/lib/filing/details-formats";
import { formattingOnly } from "@/lib/bulk/intake";
import { useFiling } from "@/lib/filing/store";
import type { AdrPrayer } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type Adr = AdrPrayer["adr"];

/** The filing's own ADR answers (`adr-prayer-section`), in the same order. */
const ADR_CHOICES: { value: Adr; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "maybe", label: "Maybe" },
];

/** ADR for the whole batch, kept on the setup draft beside its complainants. */
export function BatchAdr() {
  const { draft, update } = useFiling();
  const adr = draft.adr.adr;
  return (
    <Card variant="raised">
      <CardHeader>
        <CardTitle className="text-body font-semibold">Settlement</CardTitle>
        <CardDescription>For every case in this batch. Each case can still be changed on its own.</CardDescription>
      </CardHeader>
      <CardContent>
        <Field className="gap-1.5">
          <FieldLabel>Willing to settle through ADR</FieldLabel>
          <RadioGroup
            value={adr}
            onValueChange={(v) =>
              update((d) => {
                d.adr.adr = v as Adr;
              })
            }
            className="flex gap-6"
          >
            {ADR_CHOICES.map(({ value: v, label }) => (
              <label
                key={v}
                htmlFor={`adr-${v}`}
                className="flex min-h-10 cursor-pointer items-center gap-2 text-body-compact"
              >
                <RadioGroupItem value={v} id={`adr-${v}`} aria-label={label} />
                {label}
              </label>
            ))}
          </RadioGroup>
        </Field>
      </CardContent>
    </Card>
  );
}

/** The blanks of a format no case's details can fill: the parts the filer writes. */
export function writtenBlanks(format: DetailsFormat): string[] {
  return bracketsIn(formatForFiler(format)).filter((name) => !detailField(name));
}

/**
 * Check's Additional details: how many cases bring their own from the file, and what the
 * rest get. Nothing is asked when every case has its own.
 */
export function DetailsFormatChoice({
  formats,
  formatId,
  setFormatId,
  own,
  total,
}: {
  formats: readonly DetailsFormat[];
  /** "" for none. */
  formatId: string;
  setFormatId: (id: string) => void;
  /** Cases whose row has additional details. */
  own: number;
  total: number;
}) {
  const [shown, setShown] = React.useState(false);
  const rest = total - own;
  const format = formats.find((f) => f.id === formatId);
  const blanks = format ? writtenBlanks(format) : [];
  const fact =
    own === total
      ? `All ${total} cases have their own in the file.`
      : own === 0
        ? `None of the ${total} cases have any in the file.`
        : `${own} of ${total} cases have their own in the file.`;

  return (
    <Card variant="raised">
      <CardHeader>
        <CardTitle className="text-body font-semibold">Additional details</CardTitle>
        <CardDescription className="tabular-nums">{fact}</CardDescription>
      </CardHeader>
      {rest > 0 ? (
        <CardContent className="flex flex-col gap-4">
          <Field className="gap-1.5 sm:max-w-96">
            <FieldLabel htmlFor="details-format">
              {own === 0 ? `For all ${total}` : `For the other ${rest}`}
            </FieldLabel>
            <NativeSelect id="details-format" value={formatId} onChange={(e) => setFormatId(e.target.value)}>
              <NativeSelectOption value="">Leave empty</NativeSelectOption>
              {formats.map((f) => (
                <NativeSelectOption key={f.id} value={f.id}>
                  Generate from: {f.name || "Untitled"}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              {format
                ? "Written with each case's own details. Cases with their own text keep it."
                : "Each case's box starts empty and can be written in that case."}{" "}
              <Link
                href="/filings/formats"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-foreground underline underline-offset-3"
              >
                Edit formats
                <ExternalLinkIcon aria-hidden className="size-3" />
                <span className="sr-only">(opens in a new tab)</span>
              </Link>
            </FieldDescription>
          </Field>

          {format ? (
            <>
              {blanks.length ? (
                <div className="flex flex-col gap-2 rounded-lg bg-surface-sunken p-4 text-body-compact">
                  <p className="font-medium">
                    {blanks.length} blank{blanks.length === 1 ? "" : "s"} to write in each of the {rest} cases
                  </p>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                    {blanks.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground">
                    Those cases wait under To check in Case details until the blanks are written.
                  </p>
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="-ml-3 self-start"
                  aria-expanded={shown}
                  aria-controls="format-text"
                  onClick={() => setShown((s) => !s)}
                >
                  {shown ? "Hide the text" : "Show the text"}
                  <ChevronDownIcon
                    data-icon="inline-end"
                    aria-hidden
                    className={cn("transition-transform motion-reduce:transition-none", shown && "rotate-180")}
                  />
                </Button>
                {shown ? (
                  <div
                    id="format-text"
                    className="rounded-lg border border-hairline p-4 text-body-compact [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:mb-2 [&_ul]:list-disc"
                    // Formatting only: paragraphs, breaks, bold, italic and lists (intake's own filter).
                    dangerouslySetInnerHTML={{ __html: formattingOnly(formatForFiler(format)) }}
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
