"use client";

import { DashboardHome } from "@/components/advocate/dashboard-home";
import { useProfile } from "@/components/shell/profile";

/**
 * `/advocate/today` — the new advocate Home, a dashboard of the day (owner, 2026-11-13 to
 * 11-16). The current `/advocate` (the day's hearings) stays as it is and becomes the
 * Hearings page; this route sits beside it until Home moves over.
 */
export default function Page() {
  const { displayName } = useProfile();
  const firstName = displayName.replace(/^Adv\.\s*/, "").split(" ")[0];
  return <DashboardHome firstName={firstName} />;
}
