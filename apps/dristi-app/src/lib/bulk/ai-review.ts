/**
 * AI review of a bulk case: the issues a reader would catch that are not validation —
 * a document that says something different from the case, or a value that is valid but
 * looks wrong next to the others.
 *
 * STAND-IN. There is no model behind this in the demo. Each finding below is produced by a
 * plain rule over the document text (`doc-text.ts`) and the batch, so the screens can be
 * built and tested against the shape the real review returns. `aiFindings` is the one
 * function a model replaces; its output is ordinary scrutiny flags marked `source: "ai"`,
 * always skippable, never a hold.
 *
 * It runs only when AI is on for the court (`aiMode` in `lib/court/profiles.ts`, or
 * `?ai=on|off|unavailable` on the page), the same switch the scrutiny workbench uses.
 */

import type { AiMode } from "@/lib/court/profiles";
import { money, toLongDate } from "@/lib/filing/format";
import type { FilingDraft } from "@/lib/filing/types";

import type { Flag } from "./scrutiny";
import type { Batch, BatchCase } from "./types";

export type { AiMode };

/** Reads `?ai=` the way the scrutiny workbench does; anything else is the court default. */
export function aiModeFrom(raw: string | null | undefined, fallback: AiMode = "on"): AiMode {
  return raw === "on" || raw === "off" || raw === "unavailable" ? raw : fallback;
}

const FIRM = /\b(traders?|trading|enterprises?|industries|pvt|private|ltd|limited|llp|company|agenc(y|ies)|corporation|associates|& co)\b/i;
const digits = (s: string) => s.replace(/\D/g, "");

type Push = (f: Omit<Flag, "id" | "level" | "source"> & { at: string }) => void;

function slotText(bc: BatchCase, d: FilingDraft, key: string): string | null {
  const slot = [...d.intake.cheques, ...d.intake.parties].flatMap((g) => g.slots).find((s) => s.key === key);
  return slot?.file ? bc.docText?.[slot.file.id] ?? null : null;
}

/** What a cheque or return memo says about the cheque, read from its text. */
function chequeFacts(text: string): { number?: string; amount?: number } {
  const number = /cheque\s*no\.?\s*(\d{6})/i.exec(text)?.[1];
  const amount = /(?:rs\.?|₹)\s*([\d,]+)/i.exec(text)?.[1];
  return { number, amount: amount ? Number(digits(amount)) : undefined };
}

/** The issues an AI reviewer would raise on this case. Empty unless `mode` is "on". */
export function aiFindings(bc: BatchCase, batch: Batch, others: Batch[], mode: AiMode): Flag[] {
  if (mode !== "on") return [];
  const d = bc.draft;
  const out: Flag[] = [];
  const push: Push = ({ at, ...f }) => out.push({ ...f, id: `ai-${f.rule}:${at}`, level: "soft", source: "ai" });

  /* ── Documents against the case ── */
  d.cheques.forEach((q, i) => {
    const n = i + 1;
    const where = d.cheques.length > 1 ? `Cheque ${n}` : "Cheque";
    for (const [key, what] of [[`c${n}f`, "cheque"], [`c${n}m`, "return memo"]] as const) {
      const text = slotText(bc, d, key);
      if (!text) continue;
      const seen = chequeFacts(text);
      const amount = Number(digits(q.amount));
      if (seen.number && q.chequeNumber && seen.number !== q.chequeNumber)
        push({ rule: "doc-cheque-number", field: "CHQ-3", section: "cheque", where, at: `${key}.number`, message: `The ${what} shows cheque ${seen.number}; this case says ${q.chequeNumber}.` });
      if (seen.amount && amount && seen.amount !== amount)
        push({ rule: "doc-cheque-amount", field: "CHQ-2", section: "cheque", where, at: `${key}.amount`, message: `The ${what} shows ${money(seen.amount)}; this case says ${money(amount)}.` });
    }
  });
  d.notices.forEach((nt, i) => {
    const text = slotText(bc, d, `c${i + 1}dn`);
    if (!text) return;
    const to = /borrower:\s*(.+)/i.exec(text)?.[1]?.trim();
    const names = d.accused.map((a) => a.name.trim().toLowerCase()).filter(Boolean);
    if (to && names.length && !names.some((n) => to.toLowerCase().includes(n) || n.includes(to.toLowerCase())))
      push({ rule: "doc-notice-addressee", field: "LDN-1", section: "demand-notice", where: "Demand notice", at: `c${i + 1}dn.to`, message: `The demand notice is addressed to ${to}, who is not an accused in this case.` });
    const track = /\b(R[A-Z]\d{6,12}IN)\b/.exec(text)?.[1];
    if (track && nt.tracking && track !== nt.tracking.toUpperCase())
      push({ rule: "doc-notice-tracking", field: "LDN-4", section: "demand-notice", where: "Demand notice", at: `c${i + 1}dn.track`, message: `The notice papers show consignment ${track}; this case says ${nt.tracking}.` });
  });

  /* ── Values that pass validation but look wrong ── */
  d.accused.forEach((a, i) => {
    const where = d.accused.length > 1 ? `Accused ${i + 1}` : "Accused";
    if (a.type === "individual" && FIRM.test(a.name))
      push({ rule: "name-looks-like-firm", field: "ACC-1", section: "accused", where, at: `accused.${i}.type`, message: `"${a.name}" reads like a business, but is filed as an individual.` });
    a.addresses.forEach((b, k) => {
      const city = b.addr.city.trim().toLowerCase();
      const district = b.addr.district.trim().toLowerCase();
      if (city && district && !city.includes(district) && !district.includes(city))
        push({ rule: "city-pincode", field: "ACC-8", section: "accused", where, at: `accused.${i}.addresses.${k}.city`, message: `The city is ${b.addr.city}, but pincode ${b.addr.pin} is in ${b.addr.district} district.` });
    });
    // The same person elsewhere in the batch, with another number.
    const mobile = digits(a.contacts[0]?.mobile ?? "");
    if (mobile) {
      for (const b of [batch, ...others]) {
        for (const x of b.cases) {
          if (x.id === bc.id) continue;
          const twin = x.draft.accused.find((o) => o.name.trim().toLowerCase() === a.name.trim().toLowerCase());
          const other = digits(twin?.contacts[0]?.mobile ?? "");
          if (twin && other && other !== mobile) {
            push({ rule: "same-name-other-mobile", field: "ACC-6", section: "accused", where, at: `accused.${i}.twin`, message: `${a.name} is also accused in ${x.reference}, with a different mobile.` });
            return;
          }
        }
      }
    }
  });
  d.notices.forEach((nt, i) => {
    if (nt.delivered === "yes" && nt.deliveryDate && nt.deliveryDate === nt.dispatchDate)
      push({ rule: "delivered-same-day", field: "LDN-6", section: "demand-notice", where: d.notices.length > 1 ? `Notice ${i + 1}` : "Demand notice", at: `notices.${i}.same-day`, message: `Shown as delivered on ${toLongDate(nt.deliveryDate)}, the day it was sent. Check the delivery date.` });
  });

  return out;
}
