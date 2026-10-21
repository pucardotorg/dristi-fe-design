/**
 * Where a flag sits in the single filing: its section, which part of it ("Cheque 2" is
 * instance 1) and which field, by the key the section's `FormField name` uses: the draft
 * path below the part ("ifsc", "addresses.1.addr.pin", "reps.0.name"). A flag
 * that names no one field (a limitation rule, a missing document) has `name: null` and is
 * shown with its section only.
 */

import type { StepId } from "@/lib/filing/types";

import type { Flag } from "./scrutiny";

/** Which field of a part a flag's handover code is about, when its fix names no path. */
const CODE_FIELD: Record<string, string> = {
  "ACC-2": "name",
  "ACC-4": "entType",
  "ACC-6": "contacts.0.mobile",
  "ACC-7": "contacts.0.email",
  "ACC-8": "addresses.0.addr.line1",
  "ACC-14": "reps.0.name",
  "CHQ-1": "dateOnCheque",
  "CHQ-2": "amount",
  "CHQ-3": "chequeNumber",
  "CHQ-5": "ifsc",
  "CHQ-8": "presentDate",
  "CHQ-9": "returnDate",
  "CHQ-10": "returnReason",
  "LDN-1": "natureDebt",
  "LDN-2": "dispatchDate",
  "LDN-3": "modeService",
  "LDN-4": "tracking",
  "LDN-5": "delivered",
  "LDN-6": "deliveryDate",
  "LDN-7": "returnDate",
  "LDN-8": "nonDeliveryReason",
  "LDN-9": "replied",
  "LDN-10": "paymentStatus",
  "LDN-11": "partAmount",
  "JUR-2": "ifsc",
  "JUR-6a": "drawerPolice",
  "JUR-12": "condonationReason",
};

export type FlagPlace = { step: StepId; instance: number; name: string | null };

export function flagPlace(f: Flag): FlagPlace {
  const path = f.fix && "path" in f.fix ? f.fix.path : null;
  if (path) {
    // "accused.0.addresses.1.addr.pin": accused 0, field "addresses.1.addr.pin";
    // "jurisdiction.ifsc": the one record, field "ifsc".
    const part = /^[a-zA-Z]+\.(\d+)\.(.+)$/.exec(path);
    return part
      ? { step: f.section, instance: Number(part[1]), name: part[2] }
      : { step: f.section, instance: 0, name: path.split(".").slice(1).join(".") || null };
  }
  // "Cheque 2", "Accused 1": the part with that number; otherwise the first.
  const n = /(\d+)$/.exec(f.where)?.[1];
  return {
    step: f.section,
    instance: n ? Number(n) - 1 : 0,
    name: CODE_FIELD[f.field] ?? null,
  };
}

/** The sections a bulk case is walked through: the single filing's, less what the batch does once. */
export const BULK_CASE_STEPS: StepId[] = [
  "complainant",
  "advocate",
  "accused",
  "cheque",
  "demand-notice",
  "jurisdiction",
  "adr-prayer",
  "witnesses",
  "documents",
  "affidavit",
  "preview",
];

/**
 * Where a case opens: the first section, in the filing's order, with something that holds
 * it; else the first with anything to check; else the start of the filing.
 */
export function firstFlaggedStep(flags: Flag[]): StepId {
  const order = (f: Flag) => BULK_CASE_STEPS.indexOf(f.section);
  const shown = flags.filter((f) => order(f) >= 0);
  const pick = (list: Flag[]) => [...list].sort((a, b) => order(a) - order(b))[0];
  return (pick(shown.filter((f) => f.level === "hold")) ?? pick(shown))?.section ?? "complainant";
}
