"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import {
  ACCOUNT_NAME_KEY,
  ADVOCATE_AVAILABLE_KEY,
  PROFILE_ROLE_KEY,
} from "@/components/shell/profile";
import { SignInBlock } from "@/components/sign-in-block";
import type { CaseSummary, Locale } from "@/lib/onboarding/content";

/**
 * `/join/<token>` — the summons URL.
 * `/join`         — reached any other way. No token, so no modal on load.
 *
 * The modal opens 1s after landing and only when a token is present, per the Jul 31
 * decision: someone who found the site through search goes straight to sign-in.
 */

/** Stand-in for the pre-registration summary endpoint. Summary only — the complaint
 *  and annexures stay behind sign-in, because a summons link travels on WhatsApp. */
const DEMO_CASE: CaseSummary = {
  accusedName: "Rajan Krishnan Nair",
  caseNumber: "CC 847/2026",
  cnr: "KL-0423-CC-0847-2026",
  court: "Court of the Judicial First Class Magistrate I · Court No. 3",
  courtAddress: "District Court Complex",
  hearingDate: "Friday, 18 September 2026, 10:30 AM",
  complainant: "South Indian Bank Ltd.",
  chequeAmount: "₹1,85,000",
  chequeNumber: "004512",
};

function JoinFlow() {
  const params = useParams<{ token?: string[] }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = params?.token?.[0];

  const [locale, setLocale] = React.useState<Locale>("en");
  const [open, setOpen] = React.useState(false);

  // Auth succeeded — cross into the product.
  //
  // Every permutation of this screen (sign in / create account × litigant / advocate)
  // lands on the shared shell now, because that is where the product lives: pending
  // tasks, filings, the join landing. The original portals (/home, /advocate) still
  // exist — team case-access management lives there and nothing is deleted — but they
  // are no longer where the front door opens.
  //
  // The one exception is a summons token. That journey — the auto join-modal armed
  // with the served case, the accused/advocate split the QR cannot make — is built
  // into those portals and works; it keeps routing there until the summons journey is
  // ported onto the shell like the manual join was. Two litigant registration flags
  // (deferred ID, incomplete profile) ride only the portal route for the same reason:
  // the reminders they arm live there today.
  const goHome = React.useCallback(
    (options?: {
      idSkipped?: boolean;
      profileIncomplete?: boolean;
      role?: "litigant" | "advocate";
    }) => {
      const advocate = options?.role === "advocate";
      // Session-lite: remember the role + whether an advocate profile exists, so the
      // shell opens as this account. A base litigant has no advocate profile until they
      // elevate (Settings); an advocate account has one.
      window.localStorage.setItem(
        PROFILE_ROLE_KEY,
        advocate ? "advocate" : "litigant",
      );
      window.localStorage.setItem(
        ADVOCATE_AVAILABLE_KEY,
        advocate ? "true" : "false",
      );
      // The account's name is fixed here; switching profile later changes the role,
      // not the person. (Two demo accounts: advocate = Anjali, litigant = Rajan.)
      window.localStorage.setItem(
        ACCOUNT_NAME_KEY,
        advocate ? "Anjali Nair" : "Rajan K. Nair",
      );

      if (!token) {
        // Land on the role home, not the task list. Pending Tasks stays a nav
        // destination; a fresh sign-in belongs on a home.
        router.push(advocate ? "/advocate" : "/home");
        return;
      }

      const query = new URLSearchParams();
      query.set("token", token);
      if (searchParams.get("nocase") === "1") query.set("nocase", "1");
      if (!advocate && options?.idSkipped) query.set("noid", "1");
      if (!advocate && options?.profileIncomplete)
        query.set("profile", "missing");
      if (locale !== "en") query.set("lang", locale);
      const qs = query.toString();
      router.push(`${advocate ? "/advocate" : "/home"}${qs ? `?${qs}` : ""}`);
    },
    [token, searchParams, locale, router],
  );

  // `?nocase=1` exercises the no-data path — the flow must stay usable when the token
  // is expired or the case is not yet in CIS. Derived, never held in state, so there is
  // no render where the summary is silently wrong.
  const caseSummary = React.useMemo(() => {
    if (!token) return undefined;
    return searchParams.get("nocase") === "1" ? undefined : DEMO_CASE;
  }, [token, searchParams]);

  // Keep the document language honest — screen readers pick the voice from it, and the
  // Malayalam copy read out in an English voice is worse than no audio at all.
  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  React.useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => setOpen(true), 1000);
    return () => window.clearTimeout(timer);
  }, [token]);

  return (
    <>
      <SignInBlock
        locale={locale}
        onLocaleChange={setLocale}
        onSeekHelp={() => setOpen(true)}
        onSignedIn={(role) => goHome({ role })}
        onRegistered={(result) => goHome(result)}
        // The token is the only thing that tells us this person was served. It changes
        // the explainer's headline, never its availability: the modal is one tap away
        // for everyone, and it runs on fallbacks when there is no case to show.
        summoned={Boolean(token)}
      />
      <OnboardingModal
        open={open}
        onOpenChange={setOpen}
        caseSummary={caseSummary}
        locale={locale}
        onLocaleChange={setLocale}
      />
    </>
  );
}

export function JoinPage() {
  return (
    <React.Suspense>
      <JoinFlow />
    </React.Suspense>
  );
}
