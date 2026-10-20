"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarX2Icon, ChevronRightIcon } from "lucide-react";

import { useCourt, useCourtText } from "@/components/court/court-provider";
import {
  OrderDoorScreen,
  type OrderDoor,
} from "@/components/employee/order-door-screen";
import { useCourtToday } from "@/components/employee/use-court-today";
import { useHearingSession } from "@/components/employee/use-hearing-session";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { localizeDeep } from "@/lib/court/localize";
import { CURRENT_STAFF } from "@/lib/employee/content";
import {
  causeTitle,
  courtCaseStageLabel,
  courtHearingPurposeLabel,
  formatOrderDate,
  hearingById,
  withHearingSession,
  type CourtHearing,
} from "@/lib/employee/hearings";
import { applicationsForListing } from "@/lib/employee/listing-applications";
import { composerContextFor } from "@/lib/employee/order-context";
import { initialOrderDraft } from "@/lib/employee/order-demo";
import {
  appearancesFor,
  nextOngoingListing,
} from "@/lib/employee/order-draft";

/** A hearing's order opens with nothing the drafter cannot remove. */
const NO_FIXED_ITEMS: readonly string[] = [];

/**
 * The order of one listing — a hearing's door onto the order composer (`ORD-05`).
 *
 * The door is described once (`useHearingOrderDoor`) and drawn by `OrderDoorScreen`,
 * which picks composer A, B or C from Court settings.
 */
export function OrderScreen({ hearingId }: { hearingId: string }) {
  const { court } = useCourt();
  /* The listing as this court names it — places, names and numbers voiced for the court
     chosen in settings (`lib/court/localize.ts`). */
  const hearing = localizeDeep(hearingById(hearingId), court);
  if (!hearing) return <OrderMissing />;
  /* Keyed on the listing so advancing to the next case opens a composer at the top of
     itself rather than inheriting this one's transient state. */
  return <HearingOrder key={hearing.id} hearing={hearing} />;
}

function HearingOrder({ hearing }: { hearing: CourtHearing }) {
  const door = useHearingOrderDoor(hearing);
  return <OrderDoorScreen door={door} />;
}

/**
 * A hearing's door: the listing's facts, its roll, the applications on it and the way on
 * to the next case. A finished listing opens on the order the sitting produced
 * (`order-demo.ts`); every other one opens empty.
 */
export function useHearingOrderDoor(hearing: CourtHearing): OrderDoor {
  const courtText = useCourtText();
  const session = useHearingSession();
  const today = useCourtToday();
  const status = withHearingSession([hearing], session)[0].status;
  const initial = React.useMemo(
    () => initialOrderDraft(hearing, status, today),
    [hearing, status, today],
  );
  const context = React.useMemo(() => composerContextFor(hearing), [hearing]);
  const appearances = React.useMemo(() => appearancesFor(hearing), [hearing]);
  const applications = React.useMemo(
    () => applicationsForListing(hearing.id),
    [hearing.id],
  );
  /* Next case (`HRG-10`) opens the next Ongoing hearing and is not a hearing control:
     it ends nothing and starts nothing — those are on the cause list (`HRG-00`). It
     reads the live session, so a hearing started from the cause list in another tab
     enables it without a reload. */
  const upNext = nextOngoingListing(hearing, session);

  return {
    draftKey: hearing.id,
    initial,
    fixedIds: NO_FIXED_ITEMS,
    heading: causeTitle(hearing),
    facts: [
      { label: "Item", value: String(hearing.item) },
      { label: "Case", value: hearing.caseNumber, identifier: true },
      { label: "Stage", value: courtCaseStageLabel(hearing.stage) },
      { label: "Purpose", value: courtHearingPurposeLabel(hearing.purpose) },
    ],
    courtLine: courtText(`Before the ${CURRENT_STAFF.court}`),
    subLine: `${hearing.caseNumber} · ${causeTitle(hearing)} · Hearing on ${formatOrderDate(today)}`,
    navAction: upNext ? (
      <Button asChild variant="outline" className="w-full shrink-0 sm:w-fit">
        <Link
          href={`/employee/hearings/${upNext.id}/order`}
          aria-label={`Next case · Item ${upNext.item}, ${causeTitle(upNext)}`}
        >
          Next case · Item {upNext.item}
          <ChevronRightIcon data-icon="inline-end" aria-hidden />
        </Link>
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline"
        disabled
        className="w-full shrink-0 sm:w-fit"
        aria-label="Next case (no other hearing is ongoing)"
      >
        Next case
        <ChevronRightIcon data-icon="inline-end" aria-hidden />
      </Button>
    ),
    context,
    today,
    document: { caseNumber: hearing.caseNumber, matter: causeTitle(hearing) },
    hearing: { hearing, appearances, applications, purpose: hearing.purpose },
  };
}

export function OrderMissing() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarX2Icon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-title-s font-semibold">
            This listing is not on the board
          </EmptyTitle>
          <EmptyDescription className="text-body">
            The order composer opens a matter from today&rsquo;s cause list.
            This one is not there.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/employee/hearings">
              Back to today&rsquo;s hearings
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

