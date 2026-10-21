/**
 * What a bulk case's papers should show, for matching them on the Documents tab.
 *
 * A case's details are not listed here: a bulk case is read and changed in the single
 * filing's own sections (`components/bulk/case-flow.tsx`), the one complete view of it.
 */

import { MODE_OF_SERVICE, RETURN_REASONS } from "@/lib/filing/options";
import type { FilingDraft } from "@/lib/filing/types";

export type FieldOption = { value: string; label: string };

/** A case fact for the Documents tab: what the papers for this case should show. */
export type CaseFact = { label: string; value: string };

const labelIn = (options: FieldOption[], v: string) =>
  options.find((o) => o.value === v)?.label ?? v;
const shortDate = (iso: string) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

/**
 * The facts a filer matches papers against, per cheque and notice: number, amount, bank,
 * dates, return reason, how the notice went and whether it arrived. Blanks are left out.
 */
export function caseFacts(d: FilingDraft): CaseFact[] {
  const out: CaseFact[] = [];
  const many = (label: string, i: number, n: number) =>
    n > 1 ? `${label} ${i + 1}` : label;
  d.cheques.forEach((q, i) => {
    const c = many("Cheque", i, d.cheques.length);
    out.push({
      label: c,
      value: [
        q.chequeNumber,
        q.amount ? `₹${Number(q.amount).toLocaleString("en-IN")}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
    out.push({
      label: "Drawn on",
      value: [q.bankName, q.bankBranch].filter(Boolean).join(", ") || q.ifsc,
    });
    out.push({ label: "Dated", value: shortDate(q.dateOnCheque) });
    out.push({
      label: "Returned",
      value: [
        shortDate(q.returnDate),
        q.returnReason ? labelIn(RETURN_REASONS, q.returnReason) : "",
      ]
        .filter(Boolean)
        .join(", "),
    });
  });
  d.notices.forEach((n, i) => {
    out.push({
      label: many("Notice", i, d.notices.length),
      value: [
        shortDate(n.dispatchDate),
        n.modeService ? labelIn(MODE_OF_SERVICE, n.modeService) : "",
        n.tracking,
      ]
        .filter(Boolean)
        .join(" · "),
    });
    out.push({
      label: "Delivered",
      value:
        n.delivered === "yes"
          ? shortDate(n.deliveryDate) || "Yes"
          : n.delivered === "no"
            ? "No"
            : "",
    });
  });
  return out.filter((f) => f.value);
}
