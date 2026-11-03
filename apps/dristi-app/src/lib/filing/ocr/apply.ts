/**
 * Move a slot's extracted fields onto the draft, and take them back off when the upload
 * goes. Intake cheque group n ↔ draft.cheques[n-1]; notice group n ↔ draft.notices[n-1]; party group n
 * ↔ draft.complainants[n-1] — by the group's position, never by parsing the slot key
 * (keys can carry a "-2" suffix after a remove/add).
 *
 * Writing rule: only into fields that are empty or still machine-owned
 * (`prefilled[k] && !edited[k]`), and every write sets `prefilled[k]` — including
 * tracking, mode of service and delivery date, which are NoticeFields.
 */

import { blankCheque, blankComplainant, blankNotice } from "../blank";
import type { Address, ExtractedField, FilingDraft, Intake, IntakeSlot } from "../types";

/* ───────────────────────────── Locate ───────────────────────────── */

type SlotLocation = {
  slot: IntakeSlot;
  kind: "cheque" | "notice" | "party" | "supporting";
  index: number;
};

export function locateSlot(intake: Intake, key: string): SlotLocation | null {
  for (let i = 0; i < intake.cheques.length; i++) {
    const slot = intake.cheques[i].slots.find((s) => s.key === key);
    if (slot) return { slot, kind: "cheque", index: i };
  }
  for (let i = 0; i < intake.notices.length; i++) {
    const slot = intake.notices[i].slots.find((s) => s.key === key);
    if (slot) return { slot, kind: "notice", index: i };
  }
  for (let i = 0; i < intake.parties.length; i++) {
    const slot = intake.parties[i].slots.find((s) => s.key === key);
    if (slot) return { slot, kind: "party", index: i };
  }
  const slot = intake.supporting.find((s) => s.key === key);
  return slot ? { slot, kind: "supporting", index: -1 } : null;
}

function ensure<T>(arr: T[], index: number, make: () => T): T {
  while (arr.length <= index) arr.push(make());
  return arr[index];
}

/* ───────────────────────────── Marked writes ───────────────────────────── */

type Marked<K extends string> = Record<K, string> & {
  prefilled: Partial<Record<K, boolean>>;
  edited: Partial<Record<K, boolean>>;
};

/** Empty, or machine-owned and untouched. */
function writable<K extends string>(obj: Marked<K>, key: K): boolean {
  return !obj[key] || (!!obj.prefilled[key] && !obj.edited[key]);
}

/** Write a marked field when allowed; returns whether it wrote. */
function put<K extends string>(obj: Marked<K>, key: K, f: ExtractedField | undefined): boolean {
  if (!f || !f.value) return false;
  if (!writable(obj, key)) return false;
  (obj as Record<K, string>)[key] = f.value;
  obj.prefilled[key] = true;
  return true;
}

/** Take a marked field back if it is still ours (same value, machine-owned, unedited). */
function take<K extends string>(obj: Marked<K>, key: K, f: ExtractedField | undefined): boolean {
  if (!f || !f.value) return false;
  if (!obj.prefilled[key] || obj.edited[key]) return false;
  if (obj[key] !== f.value) return false;
  (obj as Record<K, string>)[key] = "";
  delete obj.prefilled[key];
  return true;
}

/* ───────────────────────────── Apply ───────────────────────────── */

export function applyExtraction(draft: FilingDraft, slotKey: string): void {
  const loc = locateSlot(draft.intake, slotKey);
  const fields = loc?.slot.extract?.fields;
  if (!loc || !fields) return;
  const f = (k: string) => fields[k];

  switch (loc.slot.docType) {
    case "cheque-front": {
      if (loc.kind !== "cheque") return;
      const c = ensure(draft.cheques, loc.index, blankCheque);
      put(c, "dateOnCheque", f("dateOnCheque"));
      put(c, "amount", f("amount"));
      put(c, "chequeNumber", f("chequeNumber"));
      const wroteIfsc = put(c, "ifsc", f("ifsc"));
      if (wroteIfsc) c.ifscFetched = false;
      put(c, "bankName", f("bankName"));
      put(c, "bankBranch", f("bankBranch"));
      return;
    }
    case "return-memo": {
      if (loc.kind !== "cheque") return;
      const c = ensure(draft.cheques, loc.index, blankCheque);
      put(c, "presentDate", f("presentDate"));
      put(c, "returnDate", f("returnDate"));
      put(c, "returnReason", f("returnReason"));
      // The memo also carries the cheque's own number and amount — only when nothing has them yet.
      if (!c.chequeNumber) put(c, "chequeNumber", f("chequeNumber"));
      if (!c.amount) put(c, "amount", f("amount"));
      return;
    }
    case "demand-notice": {
      if (loc.kind !== "notice") return;
      const n = ensure(draft.notices, loc.index, blankNotice);
      put(n, "dispatchDate", f("dispatchDate"));
      return;
    }
    case "dispatch-proof": {
      if (loc.kind !== "notice") return;
      const n = ensure(draft.notices, loc.index, blankNotice);
      if (!n.dispatchDate) put(n, "dispatchDate", f("dispatchDate"));
      put(n, "tracking", f("tracking"));
      put(n, "modeService", f("modeService"));
      return;
    }
    case "delivery-proof": {
      if (loc.kind !== "notice") return;
      const n = ensure(draft.notices, loc.index, blankNotice);
      if (put(n, "deliveryDate", f("deliveryDate"))) n.delivered = "yes";
      return;
    }
    case "id-proof": {
      if (loc.kind !== "party") return;
      const c = ensure(draft.complainants, loc.index, blankComplainant);
      let wrote = false;
      wrote = put(c, "name", f("name")) || wrote;
      wrote = put(c, "age", f("age")) || wrote;
      if (!c.edited.res) {
        const res: Address = c.res;
        const resFree = (k: keyof Address) => !res[k] || !!c.prefilled.res;
        let wroteRes = false;
        const pairs: Array<[keyof Address, string]> = [
          ["line1", "address"],
          ["pin", "pin"],
          ["district", "district"],
          ["state", "state"],
        ];
        for (const [k, fk] of pairs) {
          const v = f(fk)?.value;
          if (v && resFree(k)) {
            res[k] = v;
            wroteRes = true;
          }
        }
        if (wroteRes) {
          c.prefilled.res = true;
          wrote = true;
        }
      }
      if (wrote) c.toReview = true;
      return;
    }
    default:
      return;
  }
}

/* ───────────────────────────── Clear ───────────────────────────── */

export function clearExtraction(draft: FilingDraft, slotKey: string): void {
  const loc = locateSlot(draft.intake, slotKey);
  const fields = loc?.slot.extract?.fields;
  if (!loc || !fields) return;
  const f = (k: string) => fields[k];

  switch (loc.slot.docType) {
    case "cheque-front": {
      const c = loc.kind === "cheque" ? draft.cheques[loc.index] : undefined;
      if (!c) return;
      take(c, "dateOnCheque", f("dateOnCheque"));
      take(c, "amount", f("amount"));
      take(c, "chequeNumber", f("chequeNumber"));
      if (take(c, "ifsc", f("ifsc"))) c.ifscFetched = false;
      take(c, "bankName", f("bankName"));
      take(c, "bankBranch", f("bankBranch"));
      return;
    }
    case "return-memo": {
      const c = loc.kind === "cheque" ? draft.cheques[loc.index] : undefined;
      if (!c) return;
      take(c, "presentDate", f("presentDate"));
      take(c, "returnDate", f("returnDate"));
      take(c, "returnReason", f("returnReason"));
      take(c, "chequeNumber", f("chequeNumber"));
      take(c, "amount", f("amount"));
      return;
    }
    case "demand-notice": {
      const n = loc.kind === "notice" ? draft.notices[loc.index] : undefined;
      if (!n) return;
      take(n, "dispatchDate", f("dispatchDate"));
      return;
    }
    case "dispatch-proof": {
      const n = loc.kind === "notice" ? draft.notices[loc.index] : undefined;
      if (!n) return;
      take(n, "dispatchDate", f("dispatchDate"));
      take(n, "tracking", f("tracking"));
      take(n, "modeService", f("modeService"));
      return;
    }
    case "delivery-proof": {
      const n = loc.kind === "notice" ? draft.notices[loc.index] : undefined;
      if (!n) return;
      take(n, "deliveryDate", f("deliveryDate"));
      return;
    }
    case "id-proof": {
      const c = loc.kind === "party" ? draft.complainants[loc.index] : undefined;
      if (!c) return;
      take(c, "name", f("name"));
      take(c, "age", f("age"));
      if (c.prefilled.res && !c.edited.res) {
        const pairs: Array<[keyof Address, string]> = [
          ["line1", "address"],
          ["pin", "pin"],
          ["district", "district"],
          ["state", "state"],
        ];
        for (const [k, fk] of pairs) {
          const v = f(fk)?.value;
          if (v && c.res[k] === v) c.res[k] = "";
        }
        delete c.prefilled.res;
      }
      if (!Object.values(c.prefilled).some(Boolean)) c.toReview = false;
      return;
    }
    default:
      return;
  }
}
