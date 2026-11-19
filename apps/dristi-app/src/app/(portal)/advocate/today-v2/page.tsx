"use client";

import { useSearchParams } from "next/navigation";
import { DashboardHomeV2, type V2Card } from "@/components/advocate/home-v2/dashboard-home-v2";
import { useProfile } from "@/components/shell/profile";

const CARDS = ["launcher", "1", "2", "3", "4", "5"] as const;

/**
 * `/advocate/today-v2`: draft 2 of the advocate Home (owner, 2026-11-18). Draft 1 at
 * `/advocate/today` stays untouched as the reference. `?card=1` shows one card alone.
 */
export default function Page() {
  const { displayName } = useProfile();
  const firstName = displayName.replace(/^Adv\.\s*/, "").split(" ")[0];
  const raw = useSearchParams().get("card");
  const card = (CARDS as readonly string[]).includes(raw ?? "") ? (raw as V2Card) : null;
  return <DashboardHomeV2 firstName={firstName} card={card} />;
}
