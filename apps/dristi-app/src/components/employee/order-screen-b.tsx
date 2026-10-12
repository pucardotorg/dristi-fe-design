"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { ListingApplicationDialog } from "@/components/employee/listing-application-dialog";
import { applicationFiled } from "@/components/employee/order-screen";
import {
  bodyFromBlocks,
  OrderTextComposer,
} from "@/components/employee/order-text-composer";
import { useCourtToday } from "@/components/employee/use-court-today";
import { useHearingSession } from "@/components/employee/use-hearing-session";
import { useOrderDraft } from "@/components/employee/use-order-draft";
import { Button } from "@/components/ui/button";
import {
  markHearingEnded,
  markHearingOngoing,
} from "@/lib/employee/hearing-session";
import {
  causeTitle,
  courtCaseStageLabel,
  courtHearingPurposeLabel,
  withHearingSession,
  type CourtHearing,
} from "@/lib/employee/hearings";
import {
  applicationsForListing,
  listingApplicationLabel,
  type ListingApplication,
} from "@/lib/employee/listing-applications";
import {
  composerContextFor,
  decisionBlock,
} from "@/lib/employee/order-context";
import { initialOrderDraft } from "@/lib/employee/order-demo";
import { textDraftKey } from "@/lib/employee/order-drafts";
import {
  appearancesFor,
  attendanceRecital,
  buildOrderDocument,
  nextListingRecital,
  nextUnhandledListing,
  type OrderDraft,
} from "@/lib/employee/order-draft";

/**
 * Version B of a hearing's order — the text-box composer (`order-text-composer.tsx`),
 * switched on in Court settings for A/B testing.
 */
export function OrderScreenB({ hearing }: { hearing: CourtHearing }) {
  const router = useRouter();
  const session = useHearingSession();
  const today = useCourtToday();
  const status = withHearingSession([hearing], session)[0].status;
  const appearances = React.useMemo(() => appearancesFor(hearing), [hearing]);
  const context = React.useMemo(() => composerContextFor(hearing), [hearing]);
  const initial = React.useMemo<OrderDraft>(() => {
    const draft = initialOrderDraft(hearing, status, today);
    return {
      ...draft,
      body: bodyFromBlocks(draft.blocks, {
        attendance: attendanceRecital(appearances, draft.marks),
        next: nextListingRecital(draft),
      }),
    };
  }, [hearing, status, today, appearances]);
  const [draft, setDraft] = useOrderDraft(textDraftKey(hearing.id), initial);
  const listing = applicationsForListing(hearing.id);
  const [openApplication, setOpenApplication] =
    React.useState<ListingApplication | null>(null);
  const upNext = nextUnhandledListing(hearing, session);

  function advance() {
    markHearingEnded(hearing.id);
    if (!upNext) {
      router.push("/employee/hearings");
      return;
    }
    markHearingOngoing(upNext.id);
    router.push(`/employee/hearings/${upNext.id}/order`);
  }

  const paragraphs = (draft.body?.text ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <OrderTextComposer
      heading={causeTitle(hearing)}
      facts={[
        { label: "Item", value: String(hearing.item) },
        { label: "Case", value: hearing.caseNumber, identifier: true },
        { label: "Stage", value: courtCaseStageLabel(hearing.stage) },
        { label: "Purpose", value: courtHearingPurposeLabel(hearing.purpose) },
      ]}
      navAction={
        <Button
          type="button"
          className="w-full shrink-0 sm:w-fit"
          variant="outline"
          onClick={advance}
        >
          {upNext ? "Next hearing" : "End hearing"}
        </Button>
      }
      context={context}
      today={today}
      purpose={hearing.purpose}
      inHearing
      draft={draft}
      setDraft={setDraft}
      appearances={appearances}
      applications={listing.map((application) => ({
        id: application.id,
        number: application.number,
        type: listingApplicationLabel(application),
        filed: applicationFiled(application),
        decision: draft.applications[application.id],
      }))}
      onOpenApplication={(id) =>
        setOpenApplication(listing.find((entry) => entry.id === id) ?? null)
      }
      decisionFor={(id, decision) =>
        decisionBlock(
          listing.find((entry) => entry.id === id) as ListingApplication,
          decision,
          context,
        )
      }
      showNextHearing
      applicationDialog={(decide) => (
        <ListingApplicationDialog
          hearing={hearing}
          application={openApplication}
          onOpenChange={setOpenApplication}
          onAllow={(application) => decide(application.id, "allowed")}
          onDismiss={(application) => decide(application.id, "dismissed")}
          onReturnFocus={() =>
            window.document
              .getElementById(`order-application-${openApplication?.id ?? ""}`)
              ?.focus()
          }
        />
      )}
      document={{
        ...buildOrderDocument({
          caseNumber: hearing.caseNumber,
          matter: causeTitle(hearing),
          day: today,
          blocks: [],
        }),
        paragraphs,
      }}
    />
  );
}
