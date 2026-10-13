"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { HomeScreen } from "@/components/home/home-screen";
import { SECOND_LANGUAGE } from "@/lib/locale-config";
import type { Locale } from "@/lib/onboarding/content";

/**
 * `/home` — the signed-in litigant home.
 *
 * Query params carry the demo context across the auth boundary:
 *   `token`    — the summons token; its presence arms the auto join-modal.
 *   `nocase=1` — token present but no case behind it (expired / not yet in CIS).
 *   `noid=1`   — registration finished without an ID upload; shows the reminder.
 *   `profile=missing` — registration finished with an incomplete address profile.
 *   `lang=hi`  — locale continuity from the sign-in screen (the configured second language).
 *   `join=manual` — open the manual join dialog.
 *   `join=handoff&as=self|poa` — continue a join an advocate account started as a
 *                  litigant or PoA holder; the case is already found and verified.
 *   `link=pending` — this account's number was entered for a party by someone joining
 *                  a case; ask "Are you {party}?" before linking it (JOIN-64).
 */
function HomePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const lang = searchParams.get("lang");

  return (
    <HomeScreen
      summoned={Boolean(token)}
      hasCase={searchParams.get("nocase") !== "1"}
      idSkipped={searchParams.get("noid") === "1"}
      profileIncomplete={searchParams.get("profile") === "missing"}
      openManualJoin={searchParams.get("join") === "manual"}
      joinHandoff={
        searchParams.get("join") === "handoff"
          ? searchParams.get("as") === "poa"
            ? "poa"
            : "self"
          : undefined
      }
      pendingLink={searchParams.get("link") === "pending"}
      initialLocale={lang === SECOND_LANGUAGE ? (SECOND_LANGUAGE as Locale) : "en"}
    />
  );
}

export default function Page() {
  return (
    <React.Suspense>
      <HomePage />
    </React.Suspense>
  );
}
