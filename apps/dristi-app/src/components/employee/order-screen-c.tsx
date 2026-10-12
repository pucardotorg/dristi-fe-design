"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";

import { useCourtText } from "@/components/court/court-provider";
import { ListingApplicationDialog } from "@/components/employee/listing-application-dialog";
import {
  applicationFiled,
  hearingOverview,
} from "@/components/employee/order-screen";
import {
  HearingCaseHistory,
  HearingCaseOverview,
} from "@/components/employee/hearing-overview-screen";
import { ProceedingsComposer } from "@/components/employee/proceedings-composer";
import { useCourtToday } from "@/components/employee/use-court-today";
import { useHearingSession } from "@/components/employee/use-hearing-session";
import { useOrderDraft } from "@/components/employee/use-order-draft";
import { Button } from "@/components/ui/button";
import { CURRENT_STAFF } from "@/lib/employee/content";
import {
  markHearingEnded,
  markHearingOngoing,
} from "@/lib/employee/hearing-session";
import {
  causeTitle,
  courtCaseStageLabel,
  courtHearingPurposeLabel,
  formatOrderDate,
  partySideLabel,
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
import { proceedingsDraftKey } from "@/lib/employee/order-drafts";
import {
  appearancesFor,
  nextUnhandledListing,
  type OrderDraft,
} from "@/lib/employee/order-draft";

/**
 * Version C of a hearing's order — the proceedings composer (`proceedings-composer.tsx`),
 * the owner's order-screen v14, switched on beside A and B. Its own draft, so switching
 * mid-order never shows one composer's half-made order in another.
 */
export function OrderScreenC({ hearing }: { hearing: CourtHearing }) {
  const router = useRouter();
  const courtText = useCourtText();
  const session = useHearingSession();
  const today = useCourtToday();
  const status = withHearingSession([hearing], session)[0].status;
  const context = React.useMemo(() => composerContextFor(hearing), [hearing]);
  const appearances = React.useMemo(() => appearancesFor(hearing), [hearing]);
  /* C keeps a decision as the decision, not as an item block in the proceedings. */
  const initial = React.useMemo<OrderDraft>(() => {
    const draft = initialOrderDraft(hearing, status, today);
    return {
      ...draft,
      blocks: draft.blocks.filter(
        (block) => !(block.kind === "item" && block.applicationId),
      ),
    };
  }, [hearing, status, today]);
  const [draft, setDraft] = useOrderDraft(proceedingsDraftKey(hearing.id), initial);
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

  return (
    <ProceedingsComposer
      draftKey={proceedingsDraftKey(hearing.id)}
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
          variant="outline"
          className="w-full shrink-0 sm:w-fit"
          onClick={advance}
        >
          {upNext ? "Next case" : "End hearing"}
          <ChevronRightIcon data-icon="inline-end" aria-hidden />
        </Button>
      }
      courtLine={courtText(`Before the ${CURRENT_STAFF.court}`)}
      subLine={`${hearing.caseNumber} · ${causeTitle(hearing)} · Hearing on ${formatOrderDate(today)}`}
      signatory={courtText("Judicial Magistrate of the First Class")}
      context={context}
      today={today}
      purpose={hearing.purpose}
      inHearing
      appearances={appearances}
      applications={listing.map((application) => ({
        id: application.id,
        number: application.number,
        type: listingApplicationLabel(application),
        filed: applicationFiled(application),
        decision: draft.applications[application.id],
        filedBy: partySideLabel(application.filedFor),
        sentence: (decision) => decisionBlock(application, decision, context).text,
      }))}
      onOpenApplication={(id) =>
        setOpenApplication(listing.find((entry) => entry.id === id) ?? null)
      }
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
      draft={draft}
      setDraft={setDraft}
      overview={hearingOverview(hearing)}
      overviewContent={<HearingCaseOverview hearing={hearing} />}
      historyContent={<HearingCaseHistory hearing={hearing} />}
    />
  );
}
