"use client";

/**
 * ADR, other details & prayer — willingness to settle, anything else the court should
 * know, and the relief being asked for.
 *
 * Source: demo "ADR, Other details & Prayer" screen. The two prayer editors open on the
 * S-138 templates from `options.ts`; they are a starting draft the filer edits, not
 * fixed text, so both are plain rich text bound straight to the draft.
 *
 * Other details can start from a format with the form's values filled in, and refresh
 * them later — see `other-details-field.tsx`.
 */

import * as React from "react";

import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import type { AdrPrayer } from "@/lib/filing/types";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard } from "@/components/filing/form-card";
import { FormField } from "@/components/filing/form-field";
import { OtherDetailsField } from "@/components/filing/other-details-field";
import { RichTextEditor } from "@/components/filing/rich-text-editor";
import { Segmented, type SegmentedOption } from "@/components/filing/segmented";

const ADR_OPTIONS: SegmentedOption<AdrPrayer["adr"]>[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "maybe", label: "Maybe" },
];

const ADR_QUESTION =
  "Is the complainant willing to settle the case outside the court through alternative methods of dispute resolution if the other party(s) agrees?";

const OTHER_DETAILS_QUESTION =
  "Would you like to add any additional details to the complaint?";

const RELIEF_HELP = "Please edit this where required as per the details of the case.";

export function AdrPrayerSection() {
  const { draft, update, hrefFor } = useFiling();
  const adr = draft.adr;
  const { prev, next } = neighbours("adr-prayer");

  const set = <K extends keyof AdrPrayer>(key: K, value: AdrPrayer[K]) =>
    update((d) => {
      d.adr[key] = value;
    });

  return (
    <>
      <FilingMain>
        <FilingPageHeader
          title="ADR, other details & prayer"
          description="Willingness to settle, any additional details for the court, and the relief the complainant is asking for."
        />

        {/* Alternative dispute resolution */}
        <FormCard title="Alternative dispute resolution">
          <FormField asGroup label={ADR_QUESTION}>
            <Segmented
              value={adr.adr}
              onValueChange={(v) => set("adr", v)}
              options={ADR_OPTIONS}
              ariaLabel={ADR_QUESTION}
            />
          </FormField>
        </FormCard>

        {/* Anything else for the court */}
        <FormCard title="Other details">
          <FormField
            asGroup
            label={OTHER_DETAILS_QUESTION}
            tip="Anything the court should know that the form has not already asked for."
            helpPlacement="above"
            help="No need to repeat anything already entered above. Choose a format to start from; what the form already holds is filled in for you."
          >
            <OtherDetailsField
              value={adr.otherDetails}
              formatId={adr.detailsFormat}
              onChange={(html) => set("otherDetails", html)}
              onStart={(formatId, html) =>
                update((d) => {
                  d.adr.detailsFormat = formatId;
                  d.adr.otherDetails = html;
                })
              }
              ariaLabel={OTHER_DETAILS_QUESTION}
            />
          </FormField>
        </FormCard>

        {/* Prayer */}
        <FormCard
          title="Prayer / relief sought"
          description="The standard S-138 prayer. Edit to fit the case."
        >
          <FormField asGroup label="Interim relief" optional helpPlacement="above" help={RELIEF_HELP}>
            <RichTextEditor
              value={adr.interimRelief}
              onChange={(html) => set("interimRelief", html)}
              ariaLabel="Interim relief"
            />
          </FormField>
          <FormField asGroup label="Final relief" helpPlacement="above" help={RELIEF_HELP}>
            <RichTextEditor
              value={adr.finalRelief}
              onChange={(html) => set("finalRelief", html)}
              ariaLabel="Final relief"
            />
          </FormField>
        </FormCard>
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        continueHref={next ? hrefFor(next) : undefined}
      />
    </>
  );
}
