"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX2Icon, ChevronRightIcon } from "lucide-react";

import { useCourt, useCourtText } from "@/components/court/court-provider";
import { ListingApplicationDialog } from "@/components/employee/listing-application-dialog";
import {
  OrderComposer,
  type ComposerApplication,
} from "@/components/employee/order-composer";
import { OrderScreenB } from "@/components/employee/order-screen-b";
import { useCourtToday } from "@/components/employee/use-court-today";
import { useHearingSession } from "@/components/employee/use-hearing-session";
import { useOrderDraft } from "@/components/employee/use-order-draft";
import { useOrderLayout } from "@/components/employee/use-order-layout";
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
  markHearingEnded,
  markHearingOngoing,
} from "@/lib/employee/hearing-session";
import {
  causeTitle,
  counselFor,
  courtCaseStageLabel,
  courtHearingPurposeLabel,
  formatListingDate,
  formatOrderDate,
  hearingById,
  partySideLabel,
  withHearingSession,
  type CourtHearing,
} from "@/lib/employee/hearings";
import {
  applicationsForListing,
  listingApplicationLabel,
  type ListingApplication,
  type ListingApplicationDecision,
} from "@/lib/employee/listing-applications";
import type { ComposerBlock } from "@/lib/employee/order-composer";
import { composerContextFor, decisionBlock } from "@/lib/employee/order-context";
import { initialOrderDraft } from "@/lib/employee/order-demo";
import {
  appearancesFor,
  hearingOrderDocument,
  nextUnhandledListing,
  type OrderDraft,
} from "@/lib/employee/order-draft";

/**
 * The order of one listing — a hearing's door onto the order composer (`ORD-05`).
 *
 * Two composers stand behind it for A/B testing (owner, 2026-10-12), switched in Court
 * settings: **A**, the block composer (`order-composer.tsx`), and **B**, the text-box
 * composer (`order-screen-b.tsx`). Each keeps its own draft, so switching mid-order never
 * shows one composer's half-translated version of the other's.
 */
export function OrderScreen({ hearingId }: { hearingId: string }) {
  const [layout] = useOrderLayout();
  const { court } = useCourt();
  /* The listing as this court names it — places, names and numbers voiced for the court
     chosen in settings (`lib/court/localize.ts`). */
  const hearing = localizeDeep(hearingById(hearingId), court);
  if (!hearing) return <OrderMissing />;
  /* Keyed on the listing so advancing to the next case opens a composer at the top of
     itself rather than inheriting this one's transient state. */
  return layout === "text" ? (
    <OrderScreenB key={hearing.id} hearing={hearing} />
  ) : (
    <HearingOrder key={hearing.id} hearing={hearing} />
  );
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

/** "By the accused, 28 Aug 2026" — who put an application in, and when. */
export function applicationFiled(application: ListingApplication): string {
  return `By the ${partySideLabel(application.filedFor)}, ${formatListingDate(application.filedOn)}`;
}

/** The matter's facts for the case file's Overview tab. */
export function hearingOverview(hearing: CourtHearing) {
  const side = (which: "complainant" | "accused") => {
    const counsel = counselFor(hearing, which).map((entry) => entry.name);
    return counsel.length
      ? `${hearing.parties[which]}, represented by ${counsel.join(", ")}`
      : `${hearing.parties[which]}, in person`;
  };
  return [
    { label: "Stage", value: courtCaseStageLabel(hearing.stage) },
    { label: "This hearing", value: courtHearingPurposeLabel(hearing.purpose) },
    { label: "Item", value: String(hearing.item) },
    { label: "Complainant", value: side("complainant") },
    { label: "Accused", value: side("accused") },
  ];
}

/**
 * Set or clear the decision on one application, in the draft's record and in its blocks:
 * the decision is an order item (`APL-07`), so deciding adds its block with the other
 * decisions at the head of the order, changing the decision replaces it in place, and
 * Undo takes it out.
 */
export function decideApplication(
  draft: OrderDraft,
  application: ListingApplication,
  decision: ListingApplicationDecision | null,
  context: ReturnType<typeof composerContextFor>,
): OrderDraft {
  const at = draft.blocks.findIndex(
    (block) => block.kind === "item" && block.applicationId === application.id,
  );
  const without = draft.blocks.filter((_, index) => index !== at);
  let blocks: ComposerBlock[] = [...without];
  if (decision) {
    const block = decisionBlock(application, decision, context);
    if (at >= 0) {
      blocks = [...without.slice(0, at), block, ...without.slice(at)];
    } else {
      /* After the decisions already made, ahead of everything else: an order disposes
         of what is pending before it directs what happens next. */
      let insertAt = 0;
      while (
        insertAt < blocks.length &&
        blocks[insertAt].kind === "item" &&
        (blocks[insertAt] as { applicationId?: string }).applicationId
      ) {
        insertAt += 1;
      }
      blocks = [...blocks.slice(0, insertAt), block, ...blocks.slice(insertAt)];
    }
  }
  return {
    ...draft,
    applications: { ...draft.applications, [application.id]: decision ?? undefined },
    blocks,
  };
}

/**
 * Version A — the block composer, for an order tied to a hearing: with Attendance and
 * Next hearing (`ORD-08`), and the applications standing on the matter.
 */
function HearingOrder({ hearing }: { hearing: CourtHearing }) {
  const router = useRouter();
  const courtText = useCourtText();
  const session = useHearingSession();
  const today = useCourtToday();
  const status = withHearingSession([hearing], session)[0].status;
  const initial = React.useMemo(
    () => initialOrderDraft(hearing, status, today),
    [hearing, status, today],
  );
  const [draft, setDraft] = useOrderDraft(hearing.id, initial);
  const context = React.useMemo(() => composerContextFor(hearing), [hearing]);
  const appearances = React.useMemo(() => appearancesFor(hearing), [hearing]);
  const listing = applicationsForListing(hearing.id);
  const [openApplication, setOpenApplication] =
    React.useState<ListingApplication | null>(null);
  const upNext = nextUnhandledListing(hearing, session);

  function decide(id: string, decision: ListingApplicationDecision | null) {
    const application = listing.find((entry) => entry.id === id);
    if (!application) return;
    setDraft((current) =>
      decideApplication(current, application, decision, context),
    );
  }

  /** End this listing and call the next one on the board — what Next case does. */
  function advance() {
    markHearingEnded(hearing.id);
    if (!upNext) {
      router.push("/employee/hearings");
      return;
    }
    markHearingOngoing(upNext.id);
    router.push(`/employee/hearings/${upNext.id}/order`);
  }

  const applications: ComposerApplication[] = listing.map((application) => ({
    id: application.id,
    number: application.number,
    type: listingApplicationLabel(application),
    filed: applicationFiled(application),
    decision: draft.applications[application.id],
  }));

  return (
    <>
      <OrderComposer
        heading={causeTitle(hearing)}
        facts={[
          { label: "Item", value: String(hearing.item) },
          { label: "Case", value: hearing.caseNumber, identifier: true },
          { label: "Stage", value: courtCaseStageLabel(hearing.stage) },
          { label: "Purpose", value: courtHearingPurposeLabel(hearing.purpose) },
        ]}
        courtLine={courtText(`Before the ${CURRENT_STAFF.court}`)}
        subLine={`${hearing.caseNumber} · ${causeTitle(hearing)} · Hearing on ${formatOrderDate(today)}`}
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
        context={context}
        today={today}
        purpose={hearing.purpose}
        inHearing
        blocks={draft.blocks}
        onBlocks={(update) =>
          setDraft((current) => ({ ...current, blocks: update(current.blocks) }))
        }
        links={draft.links}
        onLinks={(links) => setDraft((current) => ({ ...current, links }))}
        attendance={{
          appearances,
          marks: draft.marks,
          onMark: (id, mark) =>
            setDraft((current) => ({
              ...current,
              marks: { ...current.marks, [id]: mark },
            })),
          onMarkAllPresent: () =>
            setDraft((current) => ({
              ...current,
              marks: Object.fromEntries(
                appearances.map((appearance) => [
                  appearance.id,
                  current.marks[appearance.id] ?? "present",
                ]),
              ),
            })),
        }}
        applications={{
          list: applications,
          onDecide: decide,
          onOpen: (id) =>
            setOpenApplication(listing.find((entry) => entry.id === id) ?? null),
        }}
        nextHearing={{
          next: draft.next,
          purpose: draft.nextPurpose,
          date: draft.nextDate,
          onChange: (change) =>
            setDraft((current) => ({
              ...current,
              next: change.next ?? current.next,
              nextPurpose:
                change.purpose !== undefined ? change.purpose : current.nextPurpose,
              nextDate: change.date !== undefined ? change.date : current.nextDate,
            })),
        }}
        overview={hearingOverview(hearing)}
        panelApplications={listing.map((application) => ({
          id: application.id,
          label: `${listingApplicationLabel(application)} · ${application.number}`,
          detail: applicationFiled(application),
          decided: Boolean(draft.applications[application.id]),
          onOpen: () => setOpenApplication(application),
        }))}
        document={hearingOrderDocument(hearing, draft, today)}
      />
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
    </>
  );
}
