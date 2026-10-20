/**
 * The order on one application, as data — shared by the order screen's door
 * (`components/employee/application-order-screen.tsx`) and the workstation's quick order
 * (`components/employee/application-quick-order.tsx`), so the two write the same order.
 *
 * - the draft key every order on an application lives under (`application:<id>`);
 * - the matter the composer reads its people from;
 * - the catalogue item a decision pre-adds (`decisionItem`, owner 2026-10-14);
 * - what Pending orders lists the order as — the meta the order door records;
 * - the quick order's draft in the shape the active composer variant opens on.
 *
 * Pure, so it can be tested; nothing here writes to a store.
 */

import {
  sideLabel,
  type LifecycleApplication,
} from "@/lib/applications/lifecycle";
import { counselFor, partiesLabel, type CaseRecord } from "@/lib/cases/types";

import type { ApplicationOrderDecision } from "./application-order-decision";
import { formatOrderDate, type CourtCounsel } from "./hearings";
import {
  createItemBlock,
  type ComposerContext,
  type ItemBlock,
} from "./order-composer";
import { composerContextFor } from "./order-context";
import { EMPTY_ORDER_DRAFT, type OrderDraft } from "./order-draft";
import { richTextFromPlain } from "./order-text";
import type { PendingOrderMeta } from "./pending-orders";

/** The draft store's key for an application's order, before a variant prefixes its own. */
export function applicationOrderKey(applicationId: string): string {
  return `application:${applicationId}`;
}

function counselOf(record: CaseRecord): CourtCounsel[] {
  return (["complainant", "accused"] as const).flatMap((side) =>
    counselFor(record, side).map((name) => ({ name, side })),
  );
}

/** The matter the order is on: its people, for the catalogue's items. */
export function applicationOrderContext(record: CaseRecord): ComposerContext {
  return composerContextFor({
    caseNumber: record.caseNumber,
    parties: record.parties,
    counsel: counselOf(record),
  });
}

/**
 * The catalogue item a decision pre-adds (owner, 2026-10-14: "pre-add the items in the
 * workflow"), filled from the application: *Accept application* or *Reject application*
 * with its number and type, or *Dismiss application* with its type, who filed it and when.
 */
export function decisionItem(
  application: LifecycleApplication,
  decision: ApplicationOrderDecision,
  context: ComposerContext,
): ItemBlock {
  if (decision === "dismiss") {
    return createItemBlock("dismiss-application", context, {
      applicationId: application.id,
      values: {
        applicationType: application.typeLabel,
        filerType: sideLabel(application.side).toLowerCase(),
        filerName: application.onBehalfOf,
        filingDate: formatOrderDate(application.submittedOn ?? application.createdOn),
      },
    });
  }
  return createItemBlock(
    decision === "accept" ? "accept-application" : "reject-application",
    context,
    {
      applicationId: application.id,
      values: {
        applicationNumber:
          application.applicationNumber ?? application.temporaryId ?? "",
        applicationType: application.typeLabel,
      },
    },
  );
}

/** What Pending orders lists an application's order as — the order door's own meta. */
export function applicationOrderMeta(
  application: LifecycleApplication,
  record: CaseRecord,
  orderHref: string,
): PendingOrderMeta {
  return {
    key: applicationOrderKey(application.id),
    heading: partiesLabel(record),
    caseNumber: record.caseNumber,
    origin: `Application · ${application.typeLabel}`,
    orderHref,
  };
}

/** Typed words as the editor's rich text: a paragraph a line, the first marked as the item's. */
function bodyOf(text: string, itemId: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    html: lines
      .map((line, index) => richTextFromPlain(line, index === 0 ? itemId : undefined).html)
      .join(""),
    text: lines.join("\n"),
  };
}

/**
 * The quick order as the draft the order screen opens on: the decision as its one item,
 * carrying the words as typed, the words also as the order's body, and — for an
 * acceptance that reschedules the hearing (Postpone, Advance) — the date as the order's
 * next hearing, where `application-order-outcome.ts` reads it.
 */
export function quickOrderDraft(
  item: ItemBlock,
  text: string,
  nextDate?: string,
): OrderDraft {
  const words = text.trim();
  const block: ItemBlock = { ...item, text: words, edited: words !== item.text };
  const draft: OrderDraft = {
    ...EMPTY_ORDER_DRAFT,
    blocks: [block],
    ...(nextDate ? { next: "list" as const, nextDate } : {}),
  };
  return { ...draft, body: bodyOf(words, item.id) };
}
