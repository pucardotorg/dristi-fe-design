"use client";

import * as React from "react";

import { useCourtText } from "@/components/court/court-provider";
import { ListingApplicationDialog } from "@/components/employee/listing-application-dialog";
import type {
  ComposerApplication,
  ComposerFact,
} from "@/components/employee/order-sections";
import { OrderDataFlags } from "@/components/employee/order-data-flags";
import { GroupedCaseHistory } from "@/components/employee/grouped-case-history";
import { OrderEditorComposer } from "@/components/employee/order-editor";
import type { ApplicationOutcomeSubject } from "@/components/employee/application-outcome-dialog";
import { CausePostingContext } from "@/components/employee/cause-posting";
import { useReaderPostsNextHearing } from "@/components/employee/use-next-hearing-entry";
import { useHearingSession } from "@/components/employee/use-hearing-session";
import { useOrderDraft } from "@/components/employee/use-order-draft";
import {
  courtHearingPurposeLabel,
  formatListingDate,
  partySideLabel,
  type CourtHearing,
  type CourtHearingPurposeId,
} from "@/lib/employee/hearings";
import {
  listingApplicationLabel,
  type ListingApplication,
  type ListingApplicationDecision,
} from "@/lib/employee/listing-applications";
import type { ComposerContext } from "@/lib/employee/order-composer";
import { orderDraftKey, orderInitialDraft } from "@/lib/employee/order-door";
import {
  withCausePosting,
  type Appearance,
  type OrderDraft,
} from "@/lib/employee/order-draft";

/**
 * One way into the order screen, described once.
 *
 * A door says what the order is on and what it opens with; `OrderDoorScreen` draws the
 * order screen from it, and `lib/employee/order-door.ts` turns the opening draft into the
 * one the screen keeps. The hearing door (`order-screen.tsx`), the cognizance door
 * (`cognizance-order-screen.tsx`) and the application door
 * (`application-order-screen.tsx`) are the three today.
 */
export type OrderDoor = {
  /** The draft store's key for this order, before the screen prefixes its own. */
  draftKey: string;
  /** What the order opens on before anyone has touched it. Memoise it. */
  initial: OrderDraft;
  /** Blocks the workflow loaded that cannot be removed or changed into another kind. */
  fixedIds: readonly string[];
  heading: string;
  facts: ComposerFact[];
  /** The paper's heading lines, for Preview. */
  courtLine: string;
  subLine: string;
  /** A line under the header — what the act that opened the order does, say. */
  notice?: React.ReactNode;
  /** The way on or back, at the head of the screen. */
  navAction: React.ReactNode;
  context: ComposerContext;
  today: string;
  /** What the order as paper names. */
  document: { caseNumber: string; matter: string };
  /** Where the order comes from, as the steno's queue says it ("Cognizance"). */
  origin?: string;
  /** Only on a hearing: the roll, the applications on the listing, what it was for. */
  hearing?: OrderDoorHearing;
  /** An order on an application: its Application item in the order data. */
  applicationItem?: ApplicationOutcomeSubject;
  /** The Case history tab, for a door with no listing to build it from. */
  history?: React.ReactNode;
};

export type OrderDoorHearing = {
  hearing: CourtHearing;
  appearances: Appearance[];
  applications: ListingApplication[];
  purpose: CourtHearingPurposeId;
};

/** "By the accused, 28 Aug 2026" — who put an application in, and when. */
export function applicationFiled(application: ListingApplication): string {
  return `By the ${partySideLabel(application.filedFor)}, ${formatListingDate(application.filedOn)}`;
}

/** The order screen behind every door. */
export function OrderDoorScreen({ door }: { door: OrderDoor }) {
  const readerPosts = useReaderPostsNextHearing();
  /* When the reader enters the next hearing, a hearing's order takes it from the cause
     list (owner, 2026-10-15). When the steno enters it, the order's own fields stay
     editable. */
  return (
    <CausePostingContext.Provider value={Boolean(door.hearing) && readerPosts}>
      <OrderDoorBody door={door} />
    </CausePostingContext.Provider>
  );
}

function OrderDoorBody({ door }: { door: OrderDoor }) {
  const courtText = useCourtText();
  const { hearing, context, today } = door;
  const appearances = hearing?.appearances;
  const initial = React.useMemo(
    () => orderInitialDraft(door.initial),
    [door.initial],
  );
  const [stored, setDraft] = useOrderDraft(
    orderDraftKey(door.draftKey),
    initial,
  );
  const draft = useCausePosting(door, stored);
  const [openApplication, setOpenApplication] =
    React.useState<ListingApplication | null>(null);

  const listing = hearing?.applications ?? [];
  const applications: ComposerApplication[] = listing.map((application) => ({
    id: application.id,
    number: application.number,
    type: listingApplicationLabel(application),
    filed: applicationFiled(application),
    decision: draft.applications[application.id],
  }));
  const openById = (id: string) =>
    setOpenApplication(listing.find((entry) => entry.id === id) ?? null);
  const applicationDialog = hearing
    ? (
        decide: (
          id: string,
          decision: ListingApplicationDecision | null,
        ) => void,
      ) => (
        <ListingApplicationDialog
          hearing={hearing.hearing}
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
      )
    : undefined;

  /* The order as one full-page document, its workflow a switch away (owner,
     2026-10-14). */
  return (
    <OrderEditorComposer
      queue={{
        key: door.draftKey,
        heading: door.heading,
        caseNumber: door.document.caseNumber,
        origin:
          door.origin ??
          (hearing
            ? `Hearing · ${courtHearingPurposeLabel(hearing.purpose)}`
            : "Order"),
      }}
      heading={door.heading}
      facts={door.facts}
      navAction={door.navAction}
      frame={{
        courtLine: door.courtLine,
        subLine: door.subLine,
        signatory: courtText("Judicial Magistrate of the First Class"),
      }}
      today={today}
      draft={draft}
      setDraft={setDraft}
      appearances={appearances}
      applications={hearing ? applications : undefined}
      onOpenApplication={hearing ? openById : undefined}
      applicationDialog={applicationDialog}
      historyContent={
        /* ORD-15: the case history with the case's orders in it — grouped, one line per
           process and application, as the cause list's sheet has it (owner,
           2026-10-23). A door with no listing (cognizance, an application) has no
           sittings to draw on, so it brings its own (`door.history`). */
        hearing ? (
          <GroupedCaseHistory hearing={hearing.hearing} />
        ) : (
          door.history
        )
      }
      dataFlagsContent={
        hearing ? <OrderDataFlags hearing={hearing.hearing} /> : undefined
      }
      context={context}
      purpose={hearing?.purpose}
      fixedIds={door.fixedIds}
      applicationItem={door.applicationItem}
    />
  );
}

/**
 * A door's draft with the cause list's posting laid over it, when a hearing is behind the
 * door and the reader enters the next hearing — the posting is set on the cause list, and
 * the order only shows it.
 */
export function useCausePosting(
  door: OrderDoor,
  draft: OrderDraft,
): OrderDraft {
  const session = useHearingSession();
  const readerPosts = useReaderPostsNextHearing();
  return door.hearing && readerPosts
    ? withCausePosting(draft, session.postings[door.draftKey])
    : draft;
}
