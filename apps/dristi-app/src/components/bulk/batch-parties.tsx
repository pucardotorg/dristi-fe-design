"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import {
  readDetailsFormats,
  serverDetailsFormats,
  subscribeToDetailsFormats,
} from "@/lib/filing/details-formats";
import type { AdrPrayer } from "@/lib/filing/types";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type Adr = AdrPrayer["adr"];

/** The filing's own ADR answers (`adr-prayer-section`), in the same order. */
const ADR_CHOICES: { value: Adr; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "maybe", label: "Maybe" },
];

/**
 * What is the same for every case in a bulk upload besides its complainants and advocates
 * (set on the upload's own Complainant and Advocate sections): ADR, and the format each
 * case's additional details are generated from.
 */
export function BatchParties({
  adr,
  setAdr,
  formatId,
  setFormatId,
}: {
  adr: Adr;
  setAdr: (v: Adr) => void;
  /** "" for none. */
  formatId: string;
  setFormatId: (id: string) => void;
}) {
  const formats = React.useSyncExternalStore(
    subscribeToDetailsFormats,
    readDetailsFormats,
    serverDetailsFormats,
  );
  return (
    <>
      <Field className="gap-1.5">
        <FieldLabel>Willing to settle through ADR</FieldLabel>
        <RadioGroup
          value={adr}
          onValueChange={(v) => setAdr(v as Adr)}
          className="flex gap-6"
        >
          {ADR_CHOICES.map(({ value: v, label }) => (
            <label
              key={v}
              htmlFor={`adr-${v}`}
              className="flex min-h-10 cursor-pointer items-center gap-2 text-body-compact"
            >
              <RadioGroupItem
                value={v}
                id={`adr-${v}`}
                aria-label={label}
              />
              {label}
            </label>
          ))}
        </RadioGroup>
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor="details-format">Additional details</FieldLabel>
        <NativeSelect
          id="details-format"
          value={formatId}
          onChange={(e) => setFormatId(e.target.value)}
        >
          <NativeSelectOption value="">Only what the sheet has</NativeSelectOption>
          {formats.map((f) => (
            <NativeSelectOption key={f.id} value={f.id}>
              Generate from: {f.name || "Untitled"}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldDescription>
          Each case gets the format&apos;s text with its own details filled in. A case
          whose sheet row has additional details keeps them. Every case can still be
          edited on its own.{" "}
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
    </>
  );
}
