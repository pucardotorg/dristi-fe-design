/**
 * Reading and writing a filing draft at the place a scrutiny defect points.
 *
 * A `DefectTarget` is `{ step, instance, field }` or `{ step, slotKey }`; this is the one
 * place that turns that into a value on the draft. Keeping it pure and in `lib/` means
 * the resolution derivation can be tested without rendering the form.
 *
 * Only the steps a defect can currently be raised against are mapped — and `FieldTarget`
 * is typed from that map, so a defect cannot be *authored* against a step the form cannot
 * show. It used to admit `accused`, `witnesses`, `advocate` and `adr-prayer`: those
 * sections have no `name=` on their fields and no `CorrectionInstance` around their
 * repeating records, so a defect pointing at one rendered no frame at all — invisible on
 * the screen, and permanently short of the submit gate. A type that admits a target the
 * form cannot render is not a contract, it is a trap.
 *
 * Widening it is deliberate work, not a keystroke: give the section's `FormField`s their
 * `name=`, wrap a repeating section's records in `CorrectionInstance` and wire
 * `useCorrectionInstanceRequest` (see `cheque-section.tsx` for the pattern), add the row
 * to `rowFor`, then list the fields here. `targets.test.ts` holds the line.
 */

import type { DefectTarget } from "@/lib/tasks/types";
import { rupees, toDisplayDate } from "./format";
import type { FilingDraft, StepId } from "./types";

type Row = Record<string, unknown> & {
  prefilled?: Record<string, boolean>;
  edited?: Record<string, boolean>;
};

/**
 * Every field a scrutiny defect can point at today: the step, and the keys whose
 * `FormField` carries the matching `name=`. This is the single source of truth for the
 * `FieldTarget` type, so the officer's model and the form cannot drift apart silently.
 *
 * A field listed here still has to be *on screen* to be corrected — several jurisdiction
 * fields appear only on one branch of the section's own questions. The frame follows the
 * form; it does not force a hidden field into view.
 */
export const TARGETABLE_FIELDS = {
  cheque: [
    "dateOnCheque",
    "amount",
    "chequeNumber",
    "ifsc",
    "bankName",
    "bankBranch",
    "presentDate",
    "returnDate",
    "returnReason",
  ],
  complainant: ["name", "age", "email"],
  "demand-notice": ["natureDebt", "dispatchDate", "modeService", "tracking"],
  jurisdiction: [
    "deposited",
    "ifsc",
    "payeeBankName",
    "payeeBankBranch",
    "payeePolice",
    "drawerPolice",
    "otherPending",
    "causeDate",
    "filingDate",
    "condonationReason",
  ],
} as const satisfies Partial<Record<StepId, readonly string[]>>;

/** The steps a *field* defect may name. Document defects target the intake step. */
export type TargetableStep = keyof typeof TARGETABLE_FIELDS;

export const TARGETABLE_STEPS = Object.keys(TARGETABLE_FIELDS) as TargetableStep[];

/** Is this a target the form can actually render a frame for? */
export function isTargetable(target: DefectTarget): boolean {
  if (target.kind === "doc") return true;
  const fields: readonly string[] | undefined = TARGETABLE_FIELDS[target.step];
  return !!fields?.includes(target.field);
}

function rowFor(draft: FilingDraft, target: DefectTarget): Row | undefined {
  if (target.kind !== "field") return undefined;
  const i = target.instance ?? 0;
  switch (target.step) {
    case "cheque":
      return draft.cheques[i] as unknown as Row;
    case "complainant":
      return draft.complainants[i] as unknown as Row;
    case "demand-notice":
      return draft.notices[i] as unknown as Row;
    case "jurisdiction":
      return draft.jurisdiction as unknown as Row;
    default:
      return undefined;
  }
}

/** Every intake slot on the draft, by key — cheque and notice groups, parties, supporting. */
export function intakeSlot(draft: FilingDraft, slotKey: string) {
  for (const g of [...draft.intake.cheques, ...draft.intake.notices]) {
    const hit = g.slots.find((s) => s.key === slotKey);
    if (hit) return hit;
  }
  for (const g of draft.intake.parties) {
    const hit = g.slots.find((s) => s.key === slotKey);
    if (hit) return hit;
  }
  return draft.intake.supporting.find((s) => s.key === slotKey);
}

/**
 * What the filing currently holds at this target: the field's value, or — for a document
 * — the id of the file in its slot. `undefined` means the target does not resolve on this
 * draft at all.
 */
export function readTarget(draft: FilingDraft, target: DefectTarget): string | undefined {
  if (target.kind === "doc") return intakeSlot(draft, target.slotKey)?.file?.id;
  const row = rowFor(draft, target);
  if (!row) return undefined;
  const value = row[target.field];
  return typeof value === "string" ? value : undefined;
}

/**
 * Fields the form itself never shows raw. A suggestion that reads "185000" beside a field
 * showing "₹1,85,000" asks the advocate to compare two different notations of the same
 * number, which is exactly the comparison a defect exists to make easy.
 */
const AMOUNT_FIELDS = new Set(["amount", "claimAmount"]);
const DATE_FIELDS = new Set([
  "dateOnCheque",
  "presentDate",
  "returnDate",
  "dispatchDate",
  "deliveryDate",
  "dob",
]);

/**
 * Fields whose value is a unique identifier — a cheque number, an IFSC, the tracking
 * number of a posted notice. These are transcribed character by character, where the
 * amount and the dates beside them are read as quantities.
 */
const ID_FIELDS = new Set(["chequeNumber", "ifsc", "tracking"]);

/** Is the value at this target an identifier rather than a quantity, a date or prose? */
export function isIdentifierTarget(target: DefectTarget): boolean {
  return target.kind === "field" && ID_FIELDS.has(target.field);
}

/**
 * Which control the inset's "Your corrected value" should be (brief §15.2, tier 3): the
 * same kind the flagged field uses, so a corrected date is picked and a corrected amount
 * is typed in rupees rather than both being loose text.
 */
export type TargetControlKind = "amount" | "date" | "text";

export function targetControlKind(target: DefectTarget): TargetControlKind {
  if (target.kind !== "field") return "text";
  if (AMOUNT_FIELDS.has(target.field)) return "amount";
  if (DATE_FIELDS.has(target.field)) return "date";
  return "text";
}

/** A stored value in the notation the form uses for that field. Never a lossy rewrite. */
export function displayTargetValue(target: DefectTarget, value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw || target.kind !== "field") return raw;
  if (AMOUNT_FIELDS.has(target.field)) return rupees(raw) || raw;
  if (DATE_FIELDS.has(target.field)) return toDisplayDate(raw) || raw;
  return raw;
}

/**
 * Write a corrected value at this target. Also clears the machine-read marker the way an
 * ordinary edit does — a value a person has just corrected is no longer "read, unverified"
 * (`foundations/colors`: `prefilled`).
 */
export function writeTarget(draft: FilingDraft, target: DefectTarget, value: string): void {
  if (target.kind !== "field") return;
  const row = rowFor(draft, target);
  if (!row) return;
  row[target.field] = value;
  if (row.edited) row.edited[target.field] = true;
  // A corrected IFSC retires whatever the last registry lookup filled from it.
  if (target.step === "cheque" && target.field === "ifsc") row.ifscFetched = false;
}
