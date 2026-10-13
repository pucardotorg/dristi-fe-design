"use client";

import * as React from "react";

import { useCourtText } from "@/components/court/court-provider";
import { ListingApplicationDialog } from "@/components/employee/listing-application-dialog";
import {
  OrderComposer,
  type ComposerApplication,
  type ComposerFact,
} from "@/components/employee/order-composer";
import { OrderTextComposer } from "@/components/employee/order-text-composer";
import { ProceedingsComposer } from "@/components/employee/proceedings-composer";
import { useOrderDraft } from "@/components/employee/use-order-draft";
import { useOrderLayout } from "@/components/employee/use-order-layout";
import {
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
import type {
  ComposerBlock,
  ComposerContext,
} from "@/lib/employee/order-composer";
import { decisionBlock } from "@/lib/employee/order-context";
import {
  variantDocument,
  variantDraftKey,
  variantInitialDraft,
} from "@/lib/employee/order-door";
import type { Appearance, OrderDraft } from "@/lib/employee/order-draft";
import type { OrderLayout } from "@/lib/employee/order-layout";

/**
 * One way into the order screen, described once — whatever composer variant is on.
 *
 * A door says what the order is on and what it opens with. It knows nothing about the
 * variants: `OrderDoorScreen` reads Court settings and draws A, B or C from it, and
 * `lib/employee/order-door.ts` turns the one opening draft into each variant's own.
 * The hearing door (`order-screen.tsx`) and the cognizance door
 * (`cognizance-order-screen.tsx`) are the two today.
 */
export type OrderDoor = {
  /** The draft store's key for this order, before a variant prefixes its own. */
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
  /** One variant's own way on, where it differs (B on a hearing, as it shipped). */
  variantNavAction?: Partial<Record<OrderLayout, React.ReactNode>>;
  context: ComposerContext;
  today: string;
  /** What the order as paper names. */
  document: { caseNumber: string; matter: string };
  /** The case file's Overview facts, and the court's own overview and history. */
  overview: { label: string; value: string }[];
  overviewContent?: React.ReactNode;
  historyContent?: React.ReactNode;
  /** Only on a hearing: the roll, the applications on the listing, what it was for. */
  hearing?: OrderDoorHearing;
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

/**
 * Set or clear the decision on one application, in the draft's record and in its blocks:
 * the decision is an order item (`APL-07`), so deciding adds its block with the other
 * decisions at the head of the order, changing the decision replaces it in place, and
 * Undo takes it out. Version A's; B and C keep their own.
 */
export function decideApplication(
  draft: OrderDraft,
  application: ListingApplication,
  decision: ListingApplicationDecision | null,
  context: ComposerContext,
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
    applications: {
      ...draft.applications,
      [application.id]: decision ?? undefined,
    },
    blocks,
  };
}

/**
 * The order screen behind every door: A, B or C by the Court settings toggle
 * (`order-layout.ts`), each on its own draft so switching mid-order never shows one
 * composer's half-made order in another.
 */
export function OrderDoorScreen({ door }: { door: OrderDoor }) {
  const [variant] = useOrderLayout();
  const courtText = useCourtText();
  const { hearing, context, today } = door;
  const appearances = hearing?.appearances;
  const initial = React.useMemo(
    () => variantInitialDraft(variant, door.initial, appearances),
    [variant, door.initial, appearances],
  );
  const [draft, setDraft] = useOrderDraft(
    variantDraftKey(variant, door.draftKey),
    initial,
  );
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
  const document = variantDocument(
    variant,
    { ...door.document, day: today },
    draft,
    appearances,
  );
  const navAction = door.variantNavAction?.[variant] ?? door.navAction;

  /** Version A's decide: the decision goes into the blocks as an order item. */
  function decideA(id: string, decision: ListingApplicationDecision | null) {
    const application = listing.find((entry) => entry.id === id);
    if (!application) return;
    setDraft((current) =>
      decideApplication(current, application, decision, context),
    );
  }

  if (variant === "text") {
    return (
      <OrderTextComposer
        heading={door.heading}
        facts={door.facts}
        notice={door.notice}
        navAction={navAction}
        context={context}
        today={today}
        purpose={hearing?.purpose}
        inHearing={Boolean(hearing)}
        draft={draft}
        setDraft={setDraft}
        fixedIds={door.fixedIds}
        appearances={appearances}
        applications={hearing ? applications : undefined}
        onOpenApplication={hearing ? openById : undefined}
        decisionFor={
          hearing
            ? (id, decision) =>
                decisionBlock(
                  listing.find(
                    (entry) => entry.id === id,
                  ) as ListingApplication,
                  decision,
                  context,
                )
            : undefined
        }
        showNextHearing={Boolean(hearing)}
        applicationDialog={applicationDialog}
        document={document}
      />
    );
  }

  if (variant === "proceedings") {
    return (
      <ProceedingsComposer
        draftKey={variantDraftKey(variant, door.draftKey)}
        heading={door.heading}
        facts={door.facts}
        notice={door.notice}
        navAction={navAction}
        courtLine={door.courtLine}
        subLine={door.subLine}
        signatory={courtText("Judicial Magistrate of the First Class")}
        context={context}
        today={today}
        purpose={hearing?.purpose}
        inHearing={Boolean(hearing)}
        appearances={appearances}
        applications={
          hearing
            ? listing.map((application, index) => ({
                ...applications[index],
                filedBy: partySideLabel(application.filedFor),
                sentence: (decision) =>
                  decisionBlock(application, decision, context).text,
              }))
            : undefined
        }
        onOpenApplication={openById}
        applicationDialog={applicationDialog}
        draft={draft}
        setDraft={setDraft}
        fixedIds={door.fixedIds}
        showNextHearing={Boolean(hearing)}
        overview={door.overview}
        overviewContent={door.overviewContent}
        historyContent={door.historyContent}
      />
    );
  }

  return (
    <>
      <OrderComposer
        heading={door.heading}
        facts={door.facts}
        courtLine={door.courtLine}
        subLine={door.subLine}
        notice={door.notice}
        navAction={navAction}
        context={context}
        today={today}
        purpose={hearing?.purpose}
        inHearing={Boolean(hearing)}
        blocks={draft.blocks}
        onBlocks={(update) =>
          setDraft((current) => ({
            ...current,
            blocks: update(current.blocks),
          }))
        }
        fixedIds={door.fixedIds}
        links={draft.links}
        onLinks={(links) => setDraft((current) => ({ ...current, links }))}
        attendance={
          appearances
            ? {
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
              }
            : undefined
        }
        applications={
          hearing
            ? {
                list: applications,
                onDecide: decideA,
                onOpen: openById,
              }
            : undefined
        }
        nextHearing={
          hearing
            ? {
                next: draft.next,
                purpose: draft.nextPurpose,
                date: draft.nextDate,
                onChange: (change) =>
                  setDraft((current) => ({
                    ...current,
                    next: change.next ?? current.next,
                    nextPurpose:
                      change.purpose !== undefined
                        ? change.purpose
                        : current.nextPurpose,
                    nextDate:
                      change.date !== undefined
                        ? change.date
                        : current.nextDate,
                  })),
              }
            : undefined
        }
        overview={door.overview}
        overviewContent={door.overviewContent}
        historyContent={door.historyContent}
        panelApplications={
          hearing
            ? listing.map((application) => ({
                id: application.id,
                /* Type, number and filing each on a line of their own — never a type
                   and a number wrapping together. */
                label: listingApplicationLabel(application),
                number: application.number,
                detail: applicationFiled(application),
                decided: Boolean(draft.applications[application.id]),
                onOpen: () => setOpenApplication(application),
              }))
            : undefined
        }
        document={document}
      />
      {applicationDialog?.(decideA)}
    </>
  );
}
