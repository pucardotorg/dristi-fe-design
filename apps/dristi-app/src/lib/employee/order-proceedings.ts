/**
 * Version C of the order composer — the owner's order-screen v14 (2026-10-13), brought in
 * beside A and B. The page is the proceedings as they happen: paragraphs typed as the
 * hearing goes, with order items set between them as boxes of their own; attendance,
 * applications and the next date are one tap each and write their own lines. Preview order
 * is the order in words.
 *
 * This module is the screen's logic, kept pure so it can be tested: the templates a
 * hearing starts from, an order item's sentence as words around locked values, citations
 * and [blanks] in the typed text, what is left before signing, and what signing does. It
 * runs on the app's own catalogue (`order-templates.ts`) and item model
 * (`order-composer.ts`) rather than the prototype's copy of them.
 */

import {
  blockGaps,
  createItemBlock,
  createTextBlock,
  fieldWording,
  type ComposerBlock,
  type ComposerContext,
  type ItemBlock,
} from "./order-composer";
import {
  formatOrderDate,
  type CourtHearingPurposeId,
} from "./hearings";
import type { ListingApplicationDecision } from "./listing-applications";
import type { Appearance, OrderDraft } from "./order-draft";
import { orderTemplate, type OrderTemplateId } from "./order-templates";
import { processCount } from "./process-variables";

/* ─────────────────────────────── an item's words ───────────────────────────── */

/** One piece of an order item's sentence: words, or the value of one of its fields. */
export type WordPart = string | { k: string };

/** What a value piece shows: its wording, or the hole it leaves. */
export type ValuePiece =
  | { text: string; missing?: false }
  | { missing: true; label: string };

/**
 * The catalogue's sentence for an item as words and value pieces, the way the item writes
 * it by default. Each bracketed token is the field its slot names; a conditional clause
 * whose field is unanswered is left out (`VAR-13`); a derived field with nothing to derive
 * from writes nothing.
 */
export function itemDefaultParts(
  block: ItemBlock,
  context: ComposerContext,
): WordPart[] {
  const template = orderTemplate(block.type);
  if (!template.botd.trim()) return [];
  const byKey = new Map(template.fields.map((field) => [field.key, field]));
  let botd = template.botd;
  let skip = 0;
  if (template.conditional) {
    const field = byKey.get(template.conditional.field);
    if (field && !fieldWording(block, field, context)) {
      botd = botd.replace(template.conditional.clause, "");
      botd = botd.charAt(0).toUpperCase() + botd.slice(1);
      skip = (template.conditional.clause.match(/\[[^\]]+\]/g) ?? []).length;
    }
  }
  const parts: WordPart[] = [];
  let at = skip;
  let last = 0;
  for (const match of botd.matchAll(/\[[^\]]+\]/g)) {
    const key = template.slots[at++] ?? "";
    const field = byKey.get(key);
    const before = botd.slice(last, match.index);
    last = (match.index ?? 0) + match[0].length;
    if (field?.derived && !fieldWording(block, field, context)) {
      parts.push(before);
      continue;
    }
    parts.push(before, { k: key });
  }
  parts.push(botd.slice(last));
  return mergeWords(parts);
}

function mergeWords(parts: WordPart[]): WordPart[] {
  const out: WordPart[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (!part) continue;
      const previous = out[out.length - 1];
      if (typeof previous === "string") {
        out[out.length - 1] = (previous + part).replace(/ {2,}/g, " ");
        continue;
      }
    }
    out.push(part);
  }
  return out;
}

const keysOf = (parts: readonly WordPart[]) =>
  parts.filter((part): part is { k: string } => typeof part !== "string").map((part) => part.k);

/**
 * The item's sentence as it stands: the drafter's own wording when it still carries every
 * value the default does (words around values may change; values may not), otherwise the
 * default.
 */
export function itemParts(
  block: ItemBlock,
  context: ComposerContext,
): WordPart[] {
  const fallback = itemDefaultParts(block, context);
  const wording = block.wording;
  if (!wording) return fallback;
  const have = keysOf(wording);
  return keysOf(fallback).every((key) => have.includes(key)) ? [...wording] : fallback;
}

/** One value piece of an item: its wording, or the field's label as the hole. */
export function itemValuePiece(
  block: ItemBlock,
  key: string,
  context: ComposerContext,
): ValuePiece {
  const field = orderTemplate(block.type).fields.find((entry) => entry.key === key);
  if (!field) return { text: "" };
  const text = fieldWording(block, field, context);
  return text ? { text } : { missing: true, label: field.label };
}

/** The item's sentence in plain words; an unanswered value shows as `[Its label]`. */
export function itemSentence(block: ItemBlock, context: ComposerContext): string {
  return itemParts(block, context)
    .map((part) => {
      if (typeof part === "string") return part;
      const piece = itemValuePiece(block, part.k, context);
      return piece.missing ? `[${piece.label}]` : piece.text;
    })
    .join("")
    .replace(/ {2,}/g, " ")
    .trim();
}

export function samePartList(a: readonly WordPart[], b: readonly WordPart[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** An item's still-unanswered fields — what the box's "n to fill" counts. */
export function itemGapCount(block: ItemBlock, context: ComposerContext): number {
  return blockGaps({ ...block, edited: false, text: block.text || "." }, context).length;
}

/* ──────────────────────────── citations and blanks ─────────────────────────── */

/** A document cited in the typed text: `@{docId}` in the stored words. */
export const CITATION = /@\{([^}\s]+)\}/g;
/** A blank left in typed words for later: `[witness]`. */
export const BLANK = /\[[^\]\n]+\]/g;

export type ParaPart = string | { ref: string };

export function paraParts(text: string): ParaPart[] {
  const parts: ParaPart[] = [];
  let last = 0;
  for (const match of text.matchAll(CITATION)) {
    if ((match.index ?? 0) > last) parts.push(text.slice(last, match.index));
    parts.push({ ref: match[1] });
    last = (match.index ?? 0) + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function paraText(parts: readonly ParaPart[]): string {
  return parts.map((part) => (typeof part === "string" ? part : `@{${part.ref}}`)).join("");
}

/** The ids of every document cited across the typed text. */
export function citedIds(blocks: readonly ComposerBlock[]): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.kind !== "text") continue;
    for (const match of block.text.matchAll(CITATION)) ids.add(match[1]);
  }
  return [...ids];
}

/** The [blanks] still in a paragraph's words (citations do not count). */
export function blanksIn(text: string): string[] {
  return text.replace(CITATION, "").match(BLANK) ?? [];
}

/* ─────────────────────────────── what is left ──────────────────────────────── */

/** The order item that closes the case, if one stands in the order. Only one may. */
export function closingItem(blocks: readonly ComposerBlock[]): ItemBlock | undefined {
  return blocks.find(
    (block): block is ItemBlock =>
      block.kind === "item" && Boolean(orderTemplate(block.type).closing),
  );
}

/** Whether the order still lists the case again: not closed, not "not listed again". */
export function nextApplies(draft: Pick<OrderDraft, "blocks" | "next">): boolean {
  return draft.next !== "none" && !closingItem(draft.blocks);
}

export type FinishStep =
  | { kind: "attendance"; label: string }
  | { kind: "item"; id: string; label: string }
  | { kind: "blanks"; id: string; label: string }
  | { kind: "next"; field: "date" | "purpose"; label: string };

/** Everything still to fill, in page order, and how many holes that is. */
export function proceedingsToFill(input: {
  appearances: readonly Appearance[];
  draft: OrderDraft;
  context: ComposerContext;
}): { count: number; steps: FinishStep[] } {
  const { appearances, draft, context } = input;
  const steps: FinishStep[] = [];
  let count = 0;
  const unmarked = appearances.filter((entry) => !draft.marks[entry.id]).length;
  if (unmarked) {
    steps.push({ kind: "attendance", label: `Attendance: ${unmarked} not marked` });
    count += unmarked;
  }
  for (const block of draft.blocks) {
    if (block.kind === "item") {
      const gaps = itemGapCount(block, context);
      if (gaps) {
        steps.push({ kind: "item", id: block.id, label: orderTemplate(block.type).label });
        count += gaps;
      }
      continue;
    }
    const blanks = blanksIn(block.text).length;
    if (blanks) {
      steps.push({ kind: "blanks", id: block.id, label: "Words to fill" });
      count += blanks;
    }
  }
  if (nextApplies(draft)) {
    if (!draft.nextDate) {
      steps.push({ kind: "next", field: "date", label: "Next hearing date" });
      count += 1;
    }
    if (!draft.nextPurpose) {
      steps.push({ kind: "next", field: "purpose", label: "Next hearing purpose" });
      count += 1;
    }
  }
  return { count, steps };
}

/* ───────────────────────────────── templates ───────────────────────────────── */

type TemplateBlock =
  | { kind: "text"; text: string }
  | { kind: "item"; type: OrderTemplateId; values?: Record<string, string> };

/** A starting page for the proceedings: typed words with [blanks], and order items. */
export type ProceedingsTemplate = {
  id: string;
  name: string;
  /** By hearing purpose, or a common situation. */
  group: "purpose" | "situation";
  /** The hearing purposes it is suggested for. */
  purposes: readonly CourtHearingPurposeId[];
  blocks: readonly TemplateBlock[];
};

const T = (text: string): TemplateBlock => ({ kind: "text", text });
const I = (type: OrderTemplateId, values?: Record<string, string>): TemplateBlock => ({
  kind: "item",
  type,
  values,
});
const purpose = (
  id: string,
  name: string,
  blocks: TemplateBlock[],
  purposes: CourtHearingPurposeId[] = [],
): ProceedingsTemplate => ({ id, name, group: "purpose", purposes, blocks });
const situation = (
  id: string,
  name: string,
  blocks: TemplateBlock[],
  purposes: CourtHearingPurposeId[] = [],
): ProceedingsTemplate => ({ id, name, group: "situation", purposes, blocks });

/**
 * One template per hearing purpose in the catalogue's "Hearing purpose → actions" table,
 * built from that purpose's likely order items; then the common situations. The next
 * hearing's purpose is never preset by a template (catalogue #3).
 */
export const PROCEEDINGS_TEMPLATES: readonly ProceedingsTemplate[] = [
  purpose("condonation", "Condonation of delay", [T("Heard on the petition to condone the delay. Delay [condoned].")], ["delay-condonation"]),
  purpose("admission", "Admission", [T("Heard the counsel for the complainant on admission."), I("cognizance"), I("issue-of-summons")], ["admission"]),
  purpose("delay-admission", "Delay condonation and admission", [T("Delay condoned. Heard on admission."), I("cognizance"), I("issue-of-summons")], ["delay-condonation"]),
  purpose("cognizance", "Cognizance", [I("cognizance"), I("issue-of-summons")], ["cognizance"]),
  purpose("appearance", "Appearance", [T("Accused appeared. Copies of the complaint and documents furnished to the accused."), I("bail")], ["appearance"]),
  purpose("bail", "Bail", [T("Heard on bail."), I("bail")], ["bail"]),
  purpose("plea", "Plea", [T("Particulars of the offence read over and explained to the accused. The accused pleaded [not guilty].")], ["plea"]),
  purpose("evidence", "Evidence of complainant", [T("[Witness] examined. Exts. [P1 to P5] marked.")], ["evidence-of-complainant"]),
  purpose("examination", "Examination of the accused", [T("Statement of the accused under Section 351 BNSS recorded. The accused [denies the incriminating circumstances].")], ["examination-of-accused-351"]),
  purpose("defence", "Evidence of the accused", [T("[DW1] examined. Exts. [D1] marked."), I("witness-batta")]),
  purpose("arguments", "Arguments", [T("Heard both sides.")], ["arguments"]),
  purpose("judgement", "Judgement", [I("judgement")], ["judgement"]),
  purpose("reports", "For reports", [T("Report from [forensics / ADR] awaited.")], ["for-reports"]),
  purpose("adr", "ADR", [I("referral-to-adr")]),
  purpose("mediation", "Mediation", [T("Mediation report received. The parties have [settled]."), I("case-settlement")]),
  purpose("warrant", "Warrant", [T("Warrant against the accused returned [unexecuted]."), I("issue-of-warrants")]),
  purpose("execution", "Execution", [I("issue-of-attachment")]),
  purpose("review", "Review application", [T("Heard on the review application.")]),
  situation("witness-absent", "Witness absent: fresh summons", [T("Summons to [witness] returned unserved."), I("issue-of-summons"), T("Complainant to furnish the correct and complete address of the witness before the next date.")], ["evidence-of-complainant"]),
  situation("adjourn", "Adjournment with last chance", [T("Adjourned at the request of the [party]."), I("cost"), T("Last chance granted to the party seeking adjournment. No further adjournment will be granted.")], ["evidence-of-complainant"]),
  situation("unserved", "Summons to accused unserved", [T("Summons to the accused returned unserved."), I("issue-of-summons"), T("Complainant to furnish the correct and complete address of the accused before the next date.")]),
  situation("accused-absent", "Accused absent: warrant", [T("Accused absent despite service."), I("issue-of-warrants"), I("cost", { payer: "accused" })]),
  situation("plea-143a", "Plea and interim compensation", [T("Particulars of the offence explained to the accused. The accused pleaded [not guilty]."), T("The accused is directed to pay interim compensation of twenty per cent of the cheque amount to the complainant under Section 143A of the Negotiable Instruments Act, 1881, within sixty days.")]),
  situation("application", "Application disposal", [T("Heard both sides on [the application].")]),
];

export function suggestedTemplates(purposeId: CourtHearingPurposeId | undefined): ProceedingsTemplate[] {
  return PROCEEDINGS_TEMPLATES.filter((template) =>
    purposeId ? template.purposes.includes(purposeId) : false,
  );
}

/** A template's blocks, made for this case: items take the case's own defaults. */
export function templateBlocks(
  template: Pick<ProceedingsTemplate, "blocks">,
  context: ComposerContext,
): ComposerBlock[] {
  return template.blocks.map((block) =>
    block.kind === "text"
      ? createTextBlock(block.text)
      : createItemBlock(block.type, context, { values: block.values }),
  );
}

/** A saved template from the proceedings as they stand: the words, and the item types. */
export function templateFromBlocks(
  blocks: readonly ComposerBlock[],
): TemplateBlock[] {
  return blocks.flatMap((block): TemplateBlock[] => {
    if (block.kind === "item") return [{ kind: "item", type: block.type }];
    const text = block.text.replace(CITATION, "").trim();
    return text ? [{ kind: "text", text }] : [];
  });
}

/* ──────────────────────────────── typed dates ──────────────────────────────── */

export type TypedDate =
  | { kind: "empty" }
  | { kind: "date"; iso: string }
  | { kind: "past" }
  | { kind: "bad" };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * A date as a typist types it — `12.11`, `12/11/26`, `12 Nov`, `2026-11-12`, `1211`.
 * With no year it is the next such day to come. Days already gone are refused.
 */
export function parseTypedDate(raw: string, today: string): TypedDate {
  const typed = raw.trim().toLowerCase();
  if (!typed) return { kind: "empty" };
  let day: number;
  let month: number;
  let year: number | null = null;
  let match: RegExpMatchArray | null;
  if ((match = typed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    year = +match[1];
    month = +match[2];
    day = +match[3];
  } else if ((match = typed.match(/^(\d{1,2})[./\-\s](\d{1,2})(?:[./\-\s](\d{2,4}))?$/))) {
    day = +match[1];
    month = +match[2];
    year = match[3] ? +match[3] : null;
  } else if ((match = typed.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*([a-z]{3,})\.?,?(?:\s*(\d{2,4}))?$/))) {
    day = +match[1];
    month = MONTHS.indexOf(match[2].slice(0, 3)) + 1;
    year = match[3] ? +match[3] : null;
  } else if ((match = typed.match(/^(\d{2})(\d{2})(\d{4})?$/))) {
    day = +match[1];
    month = +match[2];
    year = match[3] ? +match[3] : null;
  } else {
    return { kind: "bad" };
  }
  if (!month || month > 12 || !day || day > 31) return { kind: "bad" };
  if (year !== null && year < 100) year += 2000;
  const [ty, tm, td] = today.split("-").map(Number);
  const now = Date.UTC(ty, tm - 1, td);
  if (year === null) {
    year = ty;
    if (Date.UTC(year, month - 1, day) < now) year += 1;
  }
  const at = new Date(Date.UTC(year, month - 1, day));
  if (at.getUTCMonth() !== month - 1) return { kind: "bad" };
  if (at.getTime() < now) return { kind: "past" };
  return {
    kind: "date",
    iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/* ─────────────────────────────── filling a blank ───────────────────────────── */

export type BlankOption = { value: string; detail?: string };

/**
 * What usually goes in a blank, drawn from the case: the witnesses, the parties, the
 * applications, the usual words. Matched on the blank's own words.
 */
export function blankOptions(
  label: string,
  input: {
    context: ComposerContext;
    applications: readonly { number: string; type: string; filedBy: string }[];
  },
): BlankOption[] {
  const words = label.toLowerCase();
  const witnesses = input.context.people.filter((person) => person.kind === "witness");
  if (/witness|\bpw|\bdw/.test(words)) {
    return witnesses.map((person) => ({
      value: `${person.role}, ${person.name}`,
      detail: person.examined ? "Examined" : "Not examined yet",
    }));
  }
  if (/party/.test(words)) {
    const name = (kind: "complainant" | "accused") =>
      input.context.people.find((person) => person.kind === kind)?.name;
    return [
      { value: "complainant", detail: name("complainant") },
      { value: "accused", detail: name("accused") },
    ];
  }
  if (/guilty/.test(words)) return [{ value: "not guilty" }, { value: "guilty" }];
  if (/condoned/.test(words)) return [{ value: "condoned" }, { value: "not condoned" }];
  if (/settled/.test(words)) return [{ value: "settled" }, { value: "not settled" }];
  if (/executed/.test(words)) return [{ value: "unexecuted" }, { value: "executed" }];
  if (/application/.test(words)) {
    return input.applications.map((application) => ({
      value: `application ${application.number} for ${application.type.toLowerCase()}`,
      detail: `Filed by the ${application.filedBy}`,
    }));
  }
  if (/forensics|adr/.test(words)) return [{ value: "forensics" }, { value: "ADR" }];
  if (/denies/.test(words)) {
    return [
      { value: "denies the incriminating circumstances" },
      { value: "admits the incriminating circumstances" },
    ];
  }
  return [];
}

/* ──────────────────────────────── on signing ───────────────────────────────── */

const listOf = (items: readonly string[]) =>
  items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

const TASK_ITEMS: readonly OrderTemplateId[] = ["cost", "witness-batta", "mandatory-submissions"];

/** What signing sets in motion, in one sentence, for the confirmation. */
export function signingConsequences(input: {
  draft: OrderDraft;
  context: ComposerContext;
  applications: readonly { id: string; number: string }[];
}): string {
  const { draft, context } = input;
  const said: string[] = [];
  const decided = input.applications
    .filter((application) => draft.applications[application.id])
    .map((application) => application.number);
  if (decided.length) said.push(`decides ${listOf(decided)}`);
  for (const block of draft.blocks) {
    if (block.kind !== "item" || !block.recipients) continue;
    const person = context.people.find((entry) => entry.id === block.recipients?.person);
    const count = processCount(person, block.recipients);
    if (count) {
      const noun = orderTemplate(block.type).label.replace(/^Issue of /, "").toLowerCase();
      said.push(`issues ${count} ${noun} ${count === 1 ? "process" : "processes"}`);
    }
  }
  const tasks = draft.blocks.filter(
    (block) => block.kind === "item" && TASK_ITEMS.includes(block.type),
  ).length;
  if (tasks) said.push(`creates ${tasks} ${tasks === 1 ? "task" : "tasks"} for the parties`);
  if (closingItem(draft.blocks)) said.push("closes the case");
  else if (nextApplies(draft) && draft.nextDate) said.push(`lists the case on ${formatOrderDate(draft.nextDate)}`);
  return said.length ? `Once signed, it ${listOf(said)}.` : "Nothing else happens on signing.";
}

/** The word a decision goes by on this screen. */
export function decisionWord(decision: ListingApplicationDecision): string {
  return decision === "allowed" ? "Accepted" : "Rejected";
}
