"use client";

/**
 * The current person, as this flow needs to know them.
 *
 * DRISTI's session lives in the larger product; this flow only needs a name, mobile,
 * email and bar number to greet the person, mark "you" among the signatories, and prefill
 * the advocate card. Until the real session is wired in, the profile is stored locally
 * and edited from the header avatar. `useProfile()` is the single read point — swap its
 * source for the product session and nothing else changes.
 */

import * as React from "react";

import { useCourt } from "@/components/court/court-provider";
import { ACCOUNT_NAME_KEY, PROFILE_ROLE_KEY } from "@/components/shell/profile";
import { localizeDeep } from "@/lib/court/localize";
import type { CourtId } from "@/lib/court/profiles";

import { getRepository } from "./data";
import { SIGNED_IN_MOBILE_KEY } from "./linked-complaints";
import type { UserProfile } from "./types";

export const EMPTY_PROFILE: UserProfile = { name: "", mobile: "", email: "", barNumber: "" };

/**
 * Sandbox session-lite: while a litigant is signed in (`SIGNED_IN_MOBILE_KEY`, set only
 * for a litigant sign-in), this flow knows them by that mobile and holds no bar number,
 * so "you" is their complainant seat rather than the advocate's. Not written back.
 */
export function asSignedIn(profile: UserProfile, signedInMobile: string | null): UserProfile {
  return signedInMobile ? { ...profile, mobile: signedInMobile, barNumber: "" } : profile;
}

/**
 * The demo's advocate account: the shell's signed-in advocate, shown in each state's own
 * name. The bar number is the one the sample drafts give her.
 */
export const DEMO_ADVOCATE = { name: "Anjali Nair", barNumber: "K/1188/2011" } as const;

/**
 * Sandbox session-lite: an advocate signed in as the demo account is known to this flow by
 * name and bar number with no setup, as a connected session would know them, so every new
 * filing opens with them as Advocate 1 (design feedback #9). Details saved from the header
 * avatar win. Another account, and the litigant and clerk profiles, get nothing. Not
 * written back.
 */
export function asDemoAdvocate(
  profile: UserProfile,
  role: string | null,
  accountName: string | null
): UserProfile {
  if (profile.barNumber.trim()) return profile;
  // The shell opens as the demo advocate when sign-in stashed nothing.
  if ((role ?? "advocate") !== "advocate") return profile;
  if ((accountName || DEMO_ADVOCATE.name) !== DEMO_ADVOCATE.name) return profile;
  return {
    ...profile,
    name: profile.name.trim() || DEMO_ADVOCATE.name,
    barNumber: DEMO_ADVOCATE.barNumber,
  };
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * The stored profile as the signed-in account sees it, in the selected court's terms. A
 * draft opens in those terms (`FilingProvider`), so the profile must too, or on Gujarat
 * the demo advocate's K/ bar number would never match their own G/ row.
 */
function asSession(profile: UserProfile, court: CourtId): UserProfile {
  return localizeDeep(
    asSignedIn(
      asDemoAdvocate(profile, readStored(PROFILE_ROLE_KEY), readStored(ACCOUNT_NAME_KEY)),
      readStored(SIGNED_IN_MOBILE_KEY)
    ),
    court
  );
}

type ProfileContextValue = {
  /** `null` until read from storage. */
  profile: UserProfile | null;
  ready: boolean;
  save: (next: UserProfile) => Promise<void>;
};

const ProfileContext = React.createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [ready, setReady] = React.useState(false);
  const { court } = useCourt();

  React.useEffect(() => {
    let cancelled = false;
    getRepository()
      .getProfile()
      .then((p) => {
        if (cancelled) return;
        setProfile(asSession(p ?? EMPTY_PROFILE, court));
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(asSession(EMPTY_PROFILE, court));
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [court]);

  const save = React.useCallback(async (next: UserProfile) => {
    setProfile(next);
    await getRepository().putProfile(next);
  }, []);

  const value = React.useMemo(() => ({ profile, ready, save }), [profile, ready, save]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

/**
 * The filing profile when one is mounted, `null` otherwise.
 *
 * The chrome is shared by areas that carry this provider and areas that do not, so a
 * control that edits these details has to be able to ask whether there is anything to
 * edit rather than throw.
 */
export function useOptionalProfile(): ProfileContextValue | null {
  return React.useContext(ProfileContext);
}

export function useProfile(): ProfileContextValue {
  const ctx = React.useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside <ProfileProvider>");
  return ctx;
}

/** "AB" for the avatar; "?" until a name is known. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

/** First name for greetings; empty when unknown. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}
