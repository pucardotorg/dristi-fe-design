"use client";

import { usePathname } from "next/navigation";

import { CASE_TYPE } from "@/lib/filing/options";
import { getStep, stepFromPathname } from "@/lib/filing/steps";
import { Breadcrumbs, type Crumb } from "@/components/shell/chrome";
import { useFilingChrome } from "@/components/filing/chrome";
import { useCourtText } from "@/components/court/court-provider";

const CASE_FILING_LABEL = `Case filing under ${CASE_TYPE.short}`;

/**
 * The filings area's trail, published to the app's one breadcrumb.
 *
 * This used to be computed inside a top bar of the area's own — the only bar in the
 * product that was not the shell's, which is why search, the account menu and the trail
 * itself all behaved differently in here than everywhere else. The trail was the only
 * part that was genuinely this area's, so it is the only part that stayed: the same
 * route reading, handed to the shared bar through the same channel every other screen
 * uses.
 *
 * The matter is named once the parties are typed (`draftLabel`) and falls back to what
 * the filing is until then. It is text, not a link — there is no draft overview screen
 * to send anyone to.
 */
export function FilingBreadcrumbs() {
  const courtText = useCourtText();
  const pathname = usePathname();
  const { draftLabel, batchCrumb } = useFilingChrome();

  const parts = pathname.replace(/^\/filings\/?/, "").split("/").filter(Boolean);
  const first = parts[0];
  const stepId = stepFromPathname(pathname);

  // The signing request publishes its own trail, named for the case it holds.
  if (first === "sign-request") return null;

  const crumbs: Crumb[] = [];
  if (first === "new") {
    crumbs.push({ label: "New filing" });
  } else if (first === "bulk") {
    // Bulk filing › the batch › the case open in it (v8). Each level links back up.
    const deeper = parts.length > 1;
    crumbs.push({ label: "Bulk filing", href: deeper ? "/filings/bulk" : undefined });
    const inCase = parts[2] === "cases" && parts[3];
    if (batchCrumb && parts[1] === batchCrumb.id) {
      crumbs.push({
        label: batchCrumb.number,
        href: inCase ? `/filings/bulk/${batchCrumb.id}` : undefined,
        mono: true,
      });
    }
    // A case is opened from Case details, so that list is the level above it (owner,
    // 2026-11-12: the trail, not a Back button, is the way out of a case).
    if (inCase && batchCrumb && parts[1] === batchCrumb.id) {
      crumbs.push({
        label: "Case details",
        href: `/filings/bulk/${batchCrumb.id}?tab=scrutiny&case=${encodeURIComponent(parts[3])}`,
      });
    }
    if ((inCase || parts[1] === "upload") && draftLabel && draftLabel !== "Untitled filing") {
      crumbs.push({ label: draftLabel });
    }
  } else if (first === "formats") {
    crumbs.push({ label: "Additional details formats" });
  } else if (stepId) {
    crumbs.push({
      label:
        draftLabel && draftLabel !== "Untitled filing" ? draftLabel : CASE_FILING_LABEL,
    });
    crumbs.push({ label: courtText(getStep(stepId).title) });
  } else if (first) {
    crumbs.push({ label: CASE_FILING_LABEL });
  }

  return <Breadcrumbs crumbs={crumbs} />;
}
