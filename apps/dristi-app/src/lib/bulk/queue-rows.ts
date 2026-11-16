/**
 * Bulk batches in File a case › Your filings (Tej, 2026-11-16): filers think in "my
 * filings", not in which tool made them, so a batch is listed with the single filings, one
 * row per batch, never one per case. It appears on each tab where it has cases, counting
 * only those, and opens on the step that tab is about.
 *
 * Covered: Drafts (cases still on Case details or Documents, and batches not created
 * yet), Pending signature (ready to sign) and Pending payment (signed). Filed cases stay on
 * the batch's own Filed step for now: whether scrutiny lists a batch's cases as one row or
 * each on its own is still to be settled, since scrutiny runs per case.
 */

import type { BatchSummary } from "./actions.server";
import { NO_URGENCY, type QueueRow, type QueueTab } from "@/lib/filing/queue";
import { toDisplayDate } from "@/lib/filing/format";

const CASE_TYPE = "S138 of NIA";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function batchRows(batches: BatchSummary[]): Partial<Record<QueueTab, QueueRow[]>> {
  const out: Partial<Record<QueueTab, QueueRow[]>> = { drafts: [], pendingSignature: [], pendingPayment: [] };
  for (const b of batches) {
    if (b.clubbedInto) continue;
    const base = {
      parties: b.client || "Batch",
      court: "",
      caseType: CASE_TYPE,
      urgencyAt: NO_URGENCY,
      recencyAt: b.updatedAt.slice(0, 10),
      progress: { savedOn: toDisplayDate(b.updatedAt.slice(0, 10)) },
      haystack: `${b.client} ${b.number} batch bulk`.toLowerCase(),
    };
    const open = (tab: string) => `/filings/bulk/${b.id}${tab ? `?tab=${tab}` : ""}`;
    if (b.notCreated) {
      out.drafts!.push({
        ...base,
        id: `batch:${b.id}`,
        // Where it came from, since the File by column already says it isn't created.
        batch: {
          number: b.number,
          cases:
            b.notCreated.kind === "api"
              ? `${plural(b.total, "case")} from ${b.source.system}`
              : (b.source.reference ?? "Excel upload, no file read yet"),
        },
        info: { lead: "Not created yet", sub: b.notCreated.where.replace(/^stopped/, "Stopped"), tone: "default" },
        action: { label: "Continue", href: b.notCreated.href },
      });
      continue;
    }
    const s = b.states;
    const draft = s.fix + s.check + s.docs;
    if (draft) {
      // What needs the filer, beside how many are in draft: "8 of 12 cases in draft · 2 to fix".
      const needs = [s.fix ? `${s.fix} to fix` : "", s.docs ? `${s.docs} missing ${s.docs === 1 ? "a document" : "documents"}` : ""].filter(Boolean);
      // As a draft's own date reads: past it is the most pressing thing on the tab.
      const today = new Date().toISOString().slice(0, 10);
      const soon = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
      const tone = !b.fileBy ? "default" : b.fileBy < today ? "danger" : b.fileBy <= soon ? "warning" : "default";
      out.drafts!.push({
        ...base,
        id: `batch:${b.id}:drafts`,
        batch: { number: b.number, cases: [`${draft} of ${plural(b.total, "case")} in draft`, ...needs].join(" · ") },
        // File by: the earliest of its cases', as a draft's own date (drawn so; to settle).
        info: b.fileBy
          ? { lead: toDisplayDate(b.fileBy), sub: b.fileBy < today ? `Past it · earliest of ${draft}` : `Earliest of ${draft}`, tone }
          : { lead: "NA", tone: "default" },
        urgencyAt: b.fileBy ?? NO_URGENCY,
        action: { label: "Open batch", href: open(s.fix || s.check ? "" : "documents") },
      });
    }
    if (s.complete)
      out.pendingSignature!.push({
        ...base,
        id: `batch:${b.id}:sign`,
        batch: { number: b.number, cases: `${s.complete} of ${plural(b.total, "case")} ready to sign` },
        info: { lead: "Ready to sign", tone: "default" },
        action: { label: "Open batch", href: open("sign") },
      });
    if (s.signed)
      out.pendingPayment!.push({
        ...base,
        id: `batch:${b.id}:pay`,
        batch: { number: b.number, cases: `${s.signed} of ${plural(b.total, "case")} signed` },
        info: { lead: "To pay", tone: "default" },
        action: { label: "Open batch", href: open("pay") },
      });
  }
  return out;
}
