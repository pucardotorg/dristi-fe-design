"use client";

/**
 * The two batch questions that are not a column of the file, each asked where it can be
 * answered (owner, 2026-11-10):
 *
 *  · ADR: a batch detail like the complainants and advocates (PRD BLK-05, PRY-5), so it is
 *    asked with them, on Common details' Complainant step.
 *  · Facts of the case: a column of the file (PRY-1), asked on Check (`check-step.tsx`).
 */

import * as React from "react";
import { useFiling } from "@/lib/filing/store";
import type { AdrPrayer } from "@/lib/filing/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
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
