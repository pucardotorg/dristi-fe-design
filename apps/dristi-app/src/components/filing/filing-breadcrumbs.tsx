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
  const { draftLabel } = useFilingChrome();

  const first = pathname.replace(/^\/filings\/?/, "").split("/").filter(Boolean)[0];
  const stepId = stepFromPathname(pathname);

  // The signing request publishes its own trail, named for the case it holds.
  if (first === "sign-request") return null;

  const crumbs: Crumb[] = [];
  if (first === "new") {
    crumbs.push({ label: "New filing" });
  } else if (first === "bulk") {
    crumbs.push({ label: "Bulk filing" });
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
