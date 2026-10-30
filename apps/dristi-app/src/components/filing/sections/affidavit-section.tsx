"use client";

/**
 * Affidavit — the sworn half of the complaint, composed from the case and left editable.
 *
 * Everything here is generated from what the draft already records: the return reason is
 * quoted from the memo, and the payment and service sentences follow what the demand
 * notice says happened (`affidavitHtml`). That is the starting point, not the answer —
 * this is sworn under BNSS s.225 and only the filer knows whether the standard recitals
 * fit their facts, so it is theirs to change.
 *
 * Until they change it the text keeps tracking the case, so correcting a date three
 * screens back corrects the affidavit too. The moment they edit, it stops tracking and
 * becomes their words — with one control to put the standard text back, because an edit
 * that cannot be undone is an edit people are afraid to make.
 */

import * as React from "react";
import { RotateCcwIcon } from "lucide-react";

import { neighbours } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/filing/confirm-dialog";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard } from "@/components/filing/form-card";
import { SectionNotice } from "@/components/filing/notices";
import { RichTextEditor } from "@/components/filing/rich-text-editor";
import { affidavitBody } from "@/components/filing/sections/preview/derive";

export function AffidavitSection() {
  const { draft, update, hrefFor } = useFiling();
  const { prev, next } = neighbours("affidavit");
  const [resetOpen, setResetOpen] = React.useState(false);

  const edited = draft.affidavit.trim().length > 0;
  const body = affidavitBody(draft);

  return (
    <>
      <FilingMain>
        <FilingPageHeader
          title="Affidavit"
          description="The sworn statement that goes on the record with the complaint."
          actions={
            edited ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResetOpen(true)}
              >
                <RotateCcwIcon data-icon="inline-start" aria-hidden />
                Restore standard text
              </Button>
            ) : null
          }
        />

        {/* Sworn evidence, so what it is gets said before the box, not after. */}
        <SectionNotice variant="warning" title="This is sworn evidence">
          Sworn under Section 225 of the Bharatiya Nagarik Suraksha Sanhita, 2023. Read
          it through and change anything that does not match the case.
        </SectionNotice>

        <FormCard
          title="Affidavit of fact"
          description={
            edited
              ? "Your wording. It no longer follows the rest of the filing."
              : "Written from the case details, and follows them until you edit it."
          }
        >
          <RichTextEditor
            value={body}
            onChange={(html) =>
              update((d) => {
                d.affidavit = html;
              })
            }
            ariaLabel="Affidavit of fact"
            minHeightClassName="min-h-96"
          />
        </FormCard>
      </FilingMain>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        continueHref={next ? hrefFor(next) : undefined}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        icon={RotateCcwIcon}
        title="Restore the standard affidavit?"
        description="Your edits are discarded and the text goes back to the standard wording."
        confirmLabel="Restore"
        onConfirm={() => {
          update((d) => {
            d.affidavit = "";
          });
          setResetOpen(false);
        }}
      />
    </>
  );
}
