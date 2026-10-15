/**
 * Adding the same order items to many orders at once — the steno's bulk act on Pending
 * orders' Order data to fill (owner, 2026-10-15).
 *
 * Each item is added the way the order data panel adds it (`createItemBlock`), and the
 * same rules that panel applies are applied per order: an item already in the order is
 * not added twice, and an item the catalogue forbids beside what the order already holds
 * (`combinationConflict`) is left out with its reason. Items with details of their own
 * are added unfilled; the order's completion check asks for them before it goes out.
 */

import type { ComposerContext } from "./order-composer";
import { createItemBlock } from "./order-composer";
import type { OrderDraft } from "./order-draft";
import {
  browsableTemplates,
  combinationConflict,
  orderTemplate,
  unavailableReason,
  type OrderTemplate,
  type OrderTemplateId,
} from "./order-templates";

/** What the bulk modal offers: everything the order data panel offers outside a hearing. */
export function bulkOrderItems(): OrderTemplate[] {
  return browsableTemplates().filter(
    (template) => unavailableReason(template, { hearingOngoing: false }) === null,
  );
}

/** Whether an item asks for details of its own, which bulk adding leaves to fill. */
export function itemAsksDetails(type: OrderTemplateId): boolean {
  return orderTemplate(type).fields.some((field) => !field.derived);
}

export type BulkItemsResult = {
  draft: OrderDraft;
  added: OrderTemplateId[];
  skipped: { type: OrderTemplateId; reason: string }[];
};

export function addItemsToDraft(
  draft: OrderDraft,
  types: readonly OrderTemplateId[],
  context: ComposerContext,
): BulkItemsResult {
  let blocks = draft.blocks;
  const added: OrderTemplateId[] = [];
  const skipped: BulkItemsResult["skipped"] = [];
  for (const type of types) {
    const existing = blocks.flatMap((block) =>
      block.kind === "item"
        ? [{ type: block.type, applicationId: block.applicationId }]
        : [],
    );
    if (existing.some((entry) => entry.type === type && !entry.applicationId)) {
      skipped.push({ type, reason: "Already in this order" });
      continue;
    }
    const conflict = combinationConflict(type, existing);
    if (conflict) {
      skipped.push({ type, reason: conflict });
      continue;
    }
    blocks = [...blocks, createItemBlock(type, context)];
    added.push(type);
  }
  return {
    draft: added.length ? { ...draft, blocks } : draft,
    added,
    skipped,
  };
}

/**
 * Sentences that only record who came — "Complainant present.", "Accused absent;
 * counsel for the accused present." Skipped at the head of the preview (owner,
 * 2026-10-15): the column is for what the order does, and attendance has its own place.
 */
const ATTENDANCE =
  /^(?:the\s+)?(?:complainant|accused|counsel|advocate|petitioner|respondent|witness)[^.]*\b(?:present|absent|appeared|appear|not appeared|represented)\b[^.]*\.?$/i;

/** The first few words of an order's text after any opening attendance, for the list. */
export function orderTextPreview(text: string, words = 10): string {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=\.)\s+/);
  let start = 0;
  while (start < sentences.length && ATTENDANCE.test(sentences[start])) start += 1;
  const body = sentences.slice(start).join(" ") || text;
  const all = body.trim().split(/\s+/).filter(Boolean);
  if (all.length === 0) return "";
  return all.length > words ? `${all.slice(0, words).join(" ")}…` : all.join(" ");
}
