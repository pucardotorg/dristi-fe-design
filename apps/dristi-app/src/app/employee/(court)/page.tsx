import type { Metadata } from "next";

import { CourtDashboardScreen } from "@/components/employee/court-dashboard-screen";
import { COURT_DASHBOARD } from "@/lib/employee/navigation";

export const metadata: Metadata = { title: COURT_DASHBOARD.label };

/**
 * `/employee` — the magistrate dashboard (Direction 1, "Briefing"): the note's section
 * A2 on one page, each number opening the register or case list it counts.
 *
 * The title comes from `COURT_DASHBOARD` rather than being spelled again, so the rail's
 * row and this page cannot end up calling one destination two things.
 *
 * The screen is a client component throughout: the day it reports is read from the
 * reader's clock, and the stage choice and case lists are interaction. There is no
 * backend behind it — `lib/employee/court-docket.ts` says exactly what the data is.
 */
export default function CourtDashboardPage() {
  return <CourtDashboardScreen />;
}
