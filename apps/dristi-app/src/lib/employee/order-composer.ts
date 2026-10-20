/**
 * The order as a stack of blocks — what both order screens edit.
 *
 * **Blocks, not one body of text** (owner, 2026-10-12). From 2026-09-15 the order was a
 * single passage that order items appended their words into, and from then on nothing
 * mapped a sentence back to the item that wrote it. The owner's combined design takes
 * Varun's shape for this part: every piece of the order is a block of its own — free text,
 * or an order item — and an order item holds **its variables on top and its text below**.
 *
 * **The coupling between the two is loose, on purpose.** The fields are the item's data
 * and the workflow runs on them (`VAR-08`); the text is what people read. Until the text is
 * typed into, it is written from the fields and follows them. Once it is typed into, it is
 * the drafter's: a field change no longer rewrites it, a value can be taken out of the
 * sentence and still be held in the field, and **Reset wording** writes it from the fields
 * again. That is `VAR-09` (the divergence stands, the system does not block it) with the
 * text following the fields for as long as nobody has touched it.
 *
 * **No bracket reaches a signed order** (`VAR-11`). A field left empty shows in the text
 * as its own name in brackets, a bracket typed into any block is counted as words to fill,
 * and every one of those — with every required field left unanswered — is a gap that
 * holds the order back from the signing list (`SGN-04`).
 *
 * Pure: no React, so the rules are tested under node.
 */

import {
  courtHearingPurposeLabel,
  formatOrderDate,
  type CourtHearingPurposeId,
} from "./hearings";
import {
  hasTemplateText,
  orderTemplate,
  type OrderField,
  type OrderTemplateId,
} from "./order-templates";
import {
  defaultProcessRecipients,
  defaultDestinations,
  recipientGaps,
  stationsFor,
  stepsFor,
  type CasePerson,
  type ProcessRecipients,
} from "./process-variables";

export type TextBlock = { id: string; kind: "text"; text: string };

export type ItemBlock = {
  id: string;
  kind: "item";
  type: OrderTemplateId;
  /** Every field's answer, by field key. Empty string is unanswered. */
  values: Readonly<Record<string, string>>;
  /** Process order items only: who it goes to and how. */
  recipients?: ProcessRecipients;
  text: string;
  /** Typed into by hand — field changes no longer rewrite `text`. */
  edited: boolean;
  /** The application this item answers, for an item reached from one. */
  applicationId?: string;
  /**
   * Version C only (`order-proceedings.ts`): the item's sentence as the drafter reworded
   * it — words around locked values, `{ k }` standing for each value. Absent while the
   * sentence is the catalogue's own.
   */
  wording?: readonly (string | { k: string })[];
};

export type ComposerBlock = TextBlock | ItemBlock;

/** What the defaults and the people pickers are read from. */
export type ComposerContext = {
  people: readonly CasePerson[];
  /** Whether the accused has joined the case — it moves the process default (`AUT-05/06`). */
  accusedJoined: boolean;
};

/* ──────────────────────────────────── ids ──────────────────────────────────── */

let counter = 0;

/** A fresh block id. Never reused inside a session, so a removed block's id stays dead. */
export function nextBlockId(prefix = "block"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/* ─────────────────────────────── field answers ─────────────────────────────── */

const RUPEES = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function upperFirst(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** The one person a process item is addressed to, once chosen. */
function addressee(
  block: ItemBlock,
  context: ComposerContext,
): CasePerson | undefined {
  const id = block.recipients?.person;
  return id ? context.people.find((person) => person.id === id) : undefined;
}

/**
 * One field's answer as the order words it, or `""` when there is none.
 *
 * Dates in the order's register ("12 November 2026"), amounts in rupees with Indian
 * grouping, parties and purposes lower-cased because they sit mid-sentence.
 */
export function fieldWording(
  block: ItemBlock,
  field: OrderField,
  context: ComposerContext,
): string {
  if (field.kind === "recipients") return addressee(block, context)?.name ?? "";
  if (field.key === "recipientType") {
    return addressee(block, context)?.kind ?? "";
  }
  if (field.key === "payeeType") return "witness";

  const value = block.values[field.key]?.trim() ?? "";
  if (!value) return "";
  switch (field.kind) {
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatOrderDate(value) : value;
    case "amount": {
      const amount = Number(value);
      return Number.isFinite(amount) ? `₹${RUPEES.format(amount)}` : value;
    }
    case "purpose":
      return lowerFirst(
        courtHearingPurposeLabel(value as CourtHearingPurposeId),
      );
    case "witness":
      return (
        context.people.find((person) => person.id === value)?.name ?? value
      );
    default:
      return value;
  }
}

/** Whether a field has been answered. Derived fields answer themselves. */
export function fieldAnswered(
  block: ItemBlock,
  field: OrderField,
  context: ComposerContext,
): boolean {
  if (field.kind === "recipients") {
    return block.recipients
      ? recipientGaps(block.recipients, addressee(block, context)).length === 0
      : false;
  }
  return fieldWording(block, field, context) !== "";
}

/* ─────────────────────────────── the sentence ──────────────────────────────── */

/**
 * The item's sentence, written from its fields.
 *
 * Each bracketed token takes the field its slot names. An unanswered field shows as its
 * own label in brackets — "[Date by which it must be paid]" — so the hole reads as what is
 * missing rather than as the catalogue's internal token. A derived field with nothing to
 * derive from (the party type of nobody) writes nothing, so the sentence shows only the
 * one hole that matters. A conditional field left empty drops its clause (`VAR-13`).
 *
 * An order item with no template writes nothing (`ITM-05`).
 */
export function writeItemText(
  block: ItemBlock,
  context: ComposerContext,
): string {
  const template = orderTemplate(block.type);
  if (!hasTemplateText(template)) return "";
  const byKey = new Map(template.fields.map((field) => [field.key, field]));

  let botd = template.botd;
  if (template.conditional) {
    const field = byKey.get(template.conditional.field);
    if (field && !fieldWording(block, field, context)) {
      botd = upperFirst(botd.replace(template.conditional.clause, ""));
    }
  }
  /* The slots index the full template's tokens; a dropped clause takes its token with
     it, so the slots it held are skipped by counting them out of the clause. */
  const dropped =
    botd === template.botd
      ? 0
      : (template.conditional?.clause.match(/\[[^\]]+\]/g) ?? []).length;
  let at = dropped;

  const written = botd.replace(/\[[^\]]+\]/g, (token) => {
    const field = byKey.get(template.slots[at++] ?? "");
    if (!field) return token;
    const wording = fieldWording(block, field, context);
    if (wording) return wording;
    return field.derived ? "" : `[${field.label}]`;
  });
  return written.replace(/ {2,}/g, " ").trim();
}

/** The block with its text written again from its fields, unless it has been typed into. */
function rewrite(block: ItemBlock, context: ComposerContext): ItemBlock {
  return block.edited
    ? block
    : { ...block, text: writeItemText(block, context) };
}

/* ────────────────────────────── making blocks ──────────────────────────────── */

/**
 * A new order item, with everything the system can work out already answered (`AUT-01`):
 * a process item's recipients, channels and party taking steps; the witness for batta
 * where the case has exactly one; and whatever the caller already knows — the application
 * it was reached from (`VAR-03`).
 */
export function createItemBlock(
  type: OrderTemplateId,
  context: ComposerContext,
  preset: {
    values?: Record<string, string>;
    applicationId?: string;
    id?: string;
  } = {},
): ItemBlock {
  const template = orderTemplate(type);
  const values: Record<string, string> = {};
  let recipients: ProcessRecipients | undefined;

  if (template.fields.some((field) => field.kind === "recipients")) {
    recipients = defaultProcessRecipients(
      type,
      context.people,
      context.accusedJoined,
    );
    values.steps = stepsFor(context.people, recipients.person);
  }
  if (template.fields.some((field) => field.kind === "witness")) {
    const witnesses = context.people.filter(
      (person) => person.kind === "witness",
    );
    if (witnesses.length === 1) values.witness = witnesses[0].id;
  }
  Object.assign(values, preset.values);
  /* A party choice is either/or, so it opens on an answer rather than none (owner,
     2026-10-13): each unanswered party field takes the first side no other party field
     of the item has taken — a cost is paid by one side to the other, not to itself. The
     side directed to take a process's steps is left alone: it follows the person the
     process is addressed to. */
  for (const field of template.fields) {
    if (field.kind !== "side" || !field.required || field.derived) continue;
    if (field.key === "steps" || values[field.key]) continue;
    const options = field.options ?? [];
    const taken = template.fields
      .filter((other) => other.kind === "side" && other.key !== field.key)
      .map((other) => values[other.key]);
    values[field.key] =
      options.find((option) => !taken.includes(option.value))?.value ??
      options[0]?.value ??
      "";
  }

  const block: ItemBlock = {
    id: preset.id ?? nextBlockId("item"),
    kind: "item",
    type,
    values,
    recipients,
    text: "",
    edited: false,
    applicationId: preset.applicationId,
  };
  return { ...block, text: writeItemText(block, context) };
}

/* ──────────────────────────────── changing blocks ──────────────────────────── */

export function setItemValue(
  block: ItemBlock,
  key: string,
  value: string,
  context: ComposerContext,
): ItemBlock {
  return rewrite(
    { ...block, values: { ...block.values, [key]: value } },
    context,
  );
}

/**
 * New delivery answers for a process item — a person, their addresses, the channels, the
 * station.
 *
 * Choosing a different person brings every destination on their record with them —
 * addresses, mobiles, emails (`AUT-07`). The
 * police station and the party taking steps follow the person and addresses while they
 * still hold what the system worked out (`AUT-04`, `AUT-02`); once the drafter has chosen
 * either themselves it is left alone.
 */
export function setItemRecipients(
  block: ItemBlock,
  next: ProcessRecipients,
  context: ComposerContext,
): ItemBlock {
  const previous = block.recipients ?? {
    person: "",
    destinations: [],
    channels: [],
    policeStations: {},
  };
  let recipients = next;
  const samePerson = recipients.person === previous.person;
  if (!samePerson) {
    recipients = {
      ...recipients,
      destinations: defaultDestinations(block.type, context.people, recipients.person),
    };
  }
  /* One station per selected postal address. A station the drafter chose for an address
     is kept while the person stays the same; any other address gets the one its locality
     resolves to (`AUT-04`). */
  const auto = stationsFor(
    context.people,
    recipients.person,
    recipients.destinations,
  );
  recipients = {
    ...recipients,
    policeStations: Object.fromEntries(
      Object.keys(auto).map((id) => [
        id,
        (samePerson ? recipients.policeStations[id] : undefined) ||
          auto[id] ||
          "",
      ]),
    ),
  };
  const autoSteps = stepsFor(context.people, previous.person);
  const values =
    (block.values.steps ?? "") === autoSteps
      ? { ...block.values, steps: stepsFor(context.people, recipients.person) }
      : block.values;
  return rewrite({ ...block, recipients, values }, context);
}

/* ──────────────────────────────────── gaps ─────────────────────────────────── */

export type BlockGap = { key: string; label: string };

const BRACKET = /\[[^\]]+\]/g;

/**
 * What still has to be answered in one block before the order can go to the signing list.
 *
 * - Every required field without an answer, and a process item's recipients, channels and
 *   police station (`VAR-06`, `PRC-03`).
 * - Every bracket left in the text (`VAR-11`). While the text follows its fields those are
 *   exactly the unanswered fields — including an optional one, whose bracket would still
 *   reach the order — so they are counted once, as fields. Once the text is the drafter's,
 *   the brackets in it are counted on their own.
 * - An order item whose text is empty: a template-less item writes nothing (`ITM-05`), and
 *   an order item with no words is not yet part of the order.
 */
export function blockGaps(
  block: ComposerBlock,
  context: ComposerContext,
): BlockGap[] {
  if (block.kind === "text") {
    return (block.text.match(BRACKET) ?? []).map((token, index) => ({
      key: `bracket-${index}`,
      label: token,
    }));
  }
  const template = orderTemplate(block.type);
  const gaps: BlockGap[] = [];
  for (const field of template.fields) {
    if (field.derived) continue;
    if (field.kind === "recipients") {
      for (const gap of block.recipients
        ? recipientGaps(block.recipients, addressee(block, context))
        : ["Addressed to"]) {
        gaps.push({ key: `recipients-${gap}`, label: gap });
      }
      continue;
    }
    const answered = fieldAnswered(block, field, context);
    const inText = template.slots.includes(field.key);
    const dropsClause = template.conditional?.field === field.key;
    if (
      !answered &&
      (field.required || (!block.edited && inText && !dropsClause))
    ) {
      gaps.push({ key: field.key, label: field.label });
    }
  }
  if (block.edited) {
    (block.text.match(BRACKET) ?? []).forEach((token, index) =>
      gaps.push({ key: `bracket-${index}`, label: token }),
    );
  }
  if (!block.text.trim()) gaps.push({ key: "text", label: "Order text" });
  return gaps;
}

/** The label a block goes by — its order item's name, or "Text". */
export function blockLabel(block: ComposerBlock): string {
  return block.kind === "text" ? "Text" : orderTemplate(block.type).label;
}

/* ──────────────────────────────── the order ────────────────────────────────── */

/**
 * The order's paragraphs, in order: the attendance lines, every block that has words, and
 * the next-hearing lines. What the paper prints and what the signing list reads.
 */
export function orderParagraphs(input: {
  opening?: readonly string[];
  blocks: readonly ComposerBlock[];
  closing?: readonly string[];
}): string[] {
  return [
    ...(input.opening ?? []),
    ...input.blocks.map((block) => block.text.trim()).filter(Boolean),
    ...(input.closing ?? []),
  ];
}
