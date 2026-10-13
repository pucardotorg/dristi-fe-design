"use client";

/**
 * Which section the centre pane shows.
 *
 * These are the *same* components the ordinary e-filing routes render — that is the whole
 * point of D2. What changes is the posture they render in: `FilingMain` drops its page
 * gutters, `FilingFooter` stands down, `SectionTabs` hides add and remove, `FormField`
 * either frames a flagged field or locks it, and the source rail gives up its column.
 * All of that is decided by the correction context, not by a prop threaded through ten
 * section components.
 *
 * Two steps are left out on purpose: `sign` and `pay-fees`. Signing and paying are not
 * corrections, and this brief builds on the assumption that a corrected filing retriggers
 * neither (open question O6 — to be confirmed with product). `preview` is left out too:
 * it is a read of the whole filing, not a place a defect can be cured.
 */

import * as React from "react";

import type { StepId } from "@/lib/filing/types";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FileTextIcon } from "lucide-react";
import { AccusedSection } from "@/components/filing/sections/accused-section";
import { AdrPrayerSection } from "@/components/filing/sections/adr-prayer-section";
import { AdvocateSection } from "@/components/filing/sections/advocate-section";
import { AffidavitSection } from "@/components/filing/sections/affidavit-section";
import { ChequeSection } from "@/components/filing/sections/cheque-section";
import { ComplainantSection } from "@/components/filing/sections/complainant-section";
import { DemandNoticeSection } from "@/components/filing/sections/demand-notice-section";
import { DocumentsSection } from "@/components/filing/sections/documents-section";
import { JurisdictionSection } from "@/components/filing/sections/jurisdiction-section";
import { UploadSection } from "@/components/filing/sections/upload-section";
import { WitnessesSection } from "@/components/filing/sections/witnesses-section";

export const CORRECTABLE_SECTIONS: Partial<Record<StepId, React.ComponentType>> = {
  upload: UploadSection,
  complainant: ComplainantSection,
  advocate: AdvocateSection,
  accused: AccusedSection,
  cheque: ChequeSection,
  "demand-notice": DemandNoticeSection,
  jurisdiction: JurisdictionSection,
  "adr-prayer": AdrPrayerSection,
  witnesses: WitnessesSection,
  documents: DocumentsSection,
  affidavit: AffidavitSection,
};

export function SectionBody({ step }: { step: StepId }) {
  const Section = CORRECTABLE_SECTIONS[step];

  if (!Section) {
    return (
      <Empty className="rounded-xl border border-hairline bg-card py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileTextIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-body font-semibold">
            Nothing to correct here
          </EmptyTitle>
          <EmptyDescription className="text-body-compact">
            Signing and fees are not part of a correction round. Pick a section from the
            list, or open a defect from the queue.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <Section />;
}
