"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { CLIENTS, OFFICE_ADVOCATES } from "@/lib/bulk/clients";
import {
  readDetailsFormats,
  serverDetailsFormats,
  subscribeToDetailsFormats,
} from "@/lib/filing/details-formats";
import type { AdrPrayer } from "@/lib/filing/types";
import { Checkbox } from "@/components/ui/checkbox";
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
 * What is the same for every case in a bulk upload: the complainant, the advocates who
 * appear for it, ADR, and the format each case's additional details are generated from.
 * Shared by the Excel upload and the case-documents upload.
 */
export function BatchParties({
  clientId,
  setClientId,
  bars,
  setBars,
  adr,
  setAdr,
  formatId,
  setFormatId,
}: {
  clientId: string;
  setClientId: (id: string) => void;
  bars: string[];
  setBars: React.Dispatch<React.SetStateAction<string[]>>;
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
        <FieldLabel htmlFor="client">Complainant</FieldLabel>
        <NativeSelect
          id="client"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          {CLIENTS.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.complainant.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-body-compact font-medium">
          Advocates
        </legend>
        <span className="text-caption text-muted-foreground">
          You, and advocates from your People page. Tick everyone who appears
          for the complainant.
        </span>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {OFFICE_ADVOCATES.map((a) => {
            const id = `adv-${a.barNumber}`;
            return (
              <li key={a.barNumber}>
                <label
                  htmlFor={id}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-accent"
                >
                  <Checkbox
                    id={id}
                    aria-label={`${a.name}${a.you ? " (you)" : ""}, ${a.barNumber}`}
                    checked={bars.includes(a.barNumber)}
                    // The filing advocate stays on record; the others are optional.
                    disabled={a.you}
                    onCheckedChange={(v) =>
                      setBars((prev) =>
                        v === true
                          ? [...prev, a.barNumber]
                          : prev.filter((b) => b !== a.barNumber),
                      )
                    }
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body-compact">
                      {a.name}
                      {a.you ? (
                        <span className="text-muted-foreground"> (you)</span>
                      ) : null}
                    </span>
                    <span className="text-caption text-muted-foreground tabular-nums">
                      {a.barNumber}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
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
