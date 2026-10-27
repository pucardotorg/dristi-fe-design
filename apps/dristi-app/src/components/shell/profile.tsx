"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { VIEWER_CLERK_NAME } from "@/lib/cases/viewer";

import {
  useLocalStorageValue,
  writeLocalStorageValue,
} from "@/hooks/use-local-storage-value";

/**
 * Which profile the person is currently acting as.
 *
 * This is not the same question as *who is signed in*. One account can hold both a
 * litigant profile and an advocate profile — the same human, filing their own cheque
 * case on Monday and appearing for a client on Tuesday — and the rail's foot is where
 * they move between the two. Accounts are not shared between people, so this is
 * deliberately not a list of teammates; the sandbox's "viewing as" control in the top
 * bar is a separate thing that answers a separate question (what does the permission
 * model show someone else?).
 *
 * The state is held here rather than in the tasks store because it outranks any one
 * area: switching profile re-frames the whole product, not just the task list. Nothing
 * persists it yet — there is no session to persist it into — so a reload returns to the
 * advocate profile, which is the one the built screens serve.
 *
 * **Clerk is a demo profile.** A clerk is a different person from the advocate, so on a
 * real account this is not a profile the same human switches to. It sits here because
 * the Application Lifecycle PRD gives the clerk (or junior advocate) its own rights on
 * applications (drafts and pays, never signs), and the owner asked to be able to act as
 * one (Sept 24). The clerk acts in the signed-in advocate's office, as
 * `VIEWER_CLERK_NAME`, and is picked from the rail's "Viewing as" people, not from the
 * account's own profiles: he is someone else, not another profile of Anjali.
 */
export type ProfileRole = "litigant" | "advocate" | "clerk";

export type ProfileValue = {
  profileRole: ProfileRole;
  /** Whether this account holds an advocate profile at all. A base litigant does NOT —
   *  the switcher offers no Advocate option until they elevate (Settings → request). */
  advocateProfileAvailable: boolean;
  /** The person signed in. FIXED per account — switching profile changes the role, not
   *  the name (the same human is advocate on one profile and litigant on the other). */
  accountName: string;
  /** Who the screen greets and names: the account, or the demo clerk while acting
   *  as him (he is someone else, so not `accountName`). */
  displayName: string;
  /** Toggle between the two profiles a real account holds (advocate and litigant). */
  switchProfile: () => void;
  /** Act as this profile. The only way into the demo clerk profile. */
  setProfileRole: (role: ProfileRole) => void;
  /** Demo "Viewing as": become another person without signing in again, the way a
   *  sign-in as them would (owner, 2026-10-27). An advocate holds an advocate and a
   *  litigant profile; a litigant holds only the litigant one. */
  viewAsPerson: (name: string, kind: "advocate" | "litigant") => void;
  /** Grant the advocate profile — the elevation-approved path (from Settings). */
  enableAdvocateProfile: () => void;
};

const ProfileContext = React.createContext<ProfileValue | null>(null);

/** Session-lite keys: sign-in stashes these so the shell opens as the account you are. */
export const PROFILE_ROLE_KEY = "dristi-demo-profile-role";
export const ADVOCATE_AVAILABLE_KEY = "dristi-demo-advocate-available";
export const ACCOUNT_NAME_KEY = "dristi-demo-account-name";
/** The advocate picked under "Viewing as"; empty when acting as the account itself. */
export const VIEWING_AS_NAME_KEY = "dristi-demo-viewing-as-name";
/* (Earlier "Viewing as" borrowed only a name under this key; it now becomes the person,
   so the key is only cleared, never written.) */

export function ProfileProvider({
  children,
  advocateProfileAvailable = true,
  initialRole = "advocate",
}: {
  children: React.ReactNode;
  advocateProfileAvailable?: boolean;
  initialRole?: ProfileRole;
}) {
  // Session-lite: the role + advocate-availability + name the sign-in stashed.
  // Read via `useSyncExternalStore`, so SSR and the hydration render agree on the
  // defaults and the stored value takes over right after — no effect, no second
  // setState pass. A base litigant has no advocate profile until elevated.
  const storedRole = useLocalStorageValue(PROFILE_ROLE_KEY);
  // Nobody signed in on the litigant home: show it as the demo's summoned litigant
  // (Rajan, no advocate profile) rather than the advocate default. Display only;
  // nothing is stored, so the other homes keep their own defaults (owner, 2026-10-27).
  const pathname = usePathname();
  const unsignedLitigantHome = storedRole === null && (pathname ?? "").startsWith("/home");
  const profileRole: ProfileRole =
    storedRole === "litigant" ||
    storedRole === "advocate" ||
    storedRole === "clerk"
      ? storedRole
      : unsignedLitigantHome
        ? "litigant"
        : initialRole;

  const storedAvail = useLocalStorageValue(ADVOCATE_AVAILABLE_KEY);
  const advocateAvailable =
    storedAvail === "true" || storedAvail === "false"
      ? storedAvail === "true"
      : unsignedLitigantHome
        ? false
        : advocateProfileAvailable;

  const accountName =
    useLocalStorageValue(ACCOUNT_NAME_KEY) ||
    (unsignedLitigantHome ? "Rajan K. Nair" : "Anjali Nair");
  // Switching the account's own profile, or into the demo clerk, leaves whoever was
  // picked under "Viewing as": the screen is the account's (or the clerk's) again.
  const switchProfile = React.useCallback(() => {
    writeLocalStorageValue(VIEWING_AS_NAME_KEY, "");
    writeLocalStorageValue(
      PROFILE_ROLE_KEY,
      profileRole === "litigant" ? "advocate" : "litigant",
    );
  }, [profileRole]);

  const setProfileRole = React.useCallback((role: ProfileRole) => {
    writeLocalStorageValue(VIEWING_AS_NAME_KEY, "");
    writeLocalStorageValue(PROFILE_ROLE_KEY, role);
  }, []);

  // Picking someone under "Viewing as" is signing in as them: their name, the
  // profiles they hold, and the main one of those in use (owner, 2026-10-27).
  const viewAsPerson = React.useCallback(
    (name: string, kind: "advocate" | "litigant") => {
      writeLocalStorageValue(VIEWING_AS_NAME_KEY, "");
      writeLocalStorageValue(ACCOUNT_NAME_KEY, name);
      writeLocalStorageValue(ADVOCATE_AVAILABLE_KEY, kind === "advocate" ? "true" : "false");
      writeLocalStorageValue(PROFILE_ROLE_KEY, kind);
    },
    [],
  );

  const enableAdvocateProfile = React.useCallback(() => {
    writeLocalStorageValue(ADVOCATE_AVAILABLE_KEY, "true");
  }, []);

  const value = React.useMemo<ProfileValue>(
    () => ({
      profileRole,
      advocateProfileAvailable: advocateAvailable,
      accountName,
      displayName: profileRole === "clerk" ? VIEWER_CLERK_NAME : accountName,
      switchProfile,
      setProfileRole,
      viewAsPerson,
      enableAdvocateProfile,
    }),
    [
      profileRole,
      advocateAvailable,
      accountName,
      switchProfile,
      setProfileRole,
      viewAsPerson,
      enableAdvocateProfile,
    ],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

/** Where each profile's Home is. The clerk's is the advocate home, greeting him by
 *  name (owner, 2026-10-22), not a home of his own. */
const PROFILE_HOME_PATH: Record<ProfileRole, string> = {
  litigant: "/home",
  advocate: "/advocate",
  clerk: "/advocate",
};

/** Where a wrong home sends each profile: the same place switching to it lands, so
 *  the clerk goes to Cases, as the account menu takes him (owner, 2026-09-24). */
const HAND_OVER_TO: Record<ProfileRole, string> = {
  litigant: "/home",
  advocate: "/advocate",
  clerk: "/cases",
};

const subscribeNothing = () => () => {};

/**
 * Keeps a role's home and the profile in step (owner, 2026-10-27). Each home used to
 * draw itself whatever profile was on, so an old tab, the back button or a link could
 * show the litigant home under "Anjali · Advocate". Now a home whose profile is not
 * the one in use hands over to that profile's home, query and all (the summons token
 * included). Before anyone signs in nothing is stored and nothing moves. Returns true
 * while it is handing over, so the page can stay blank rather than flash the wrong home.
 */
export function useHomeFollowsProfile(home: "litigant" | "advocate"): boolean {
  const stored = useLocalStorageValue(PROFILE_ROLE_KEY);
  // False through hydration, true after: the stored role is only real from then on.
  const hydrated = React.useSyncExternalStore(subscribeNothing, () => true, () => false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const role =
    stored === "litigant" || stored === "advocate" || stored === "clerk" ? stored : null;
  const homeOfRole = role === null ? null : PROFILE_HOME_PATH[role];
  const mismatch = hydrated && homeOfRole !== null && homeOfRole !== PROFILE_HOME_PATH[home];

  React.useEffect(() => {
    if (!hydrated) return;
    // Nobody signed in: each home shows its own default, nothing is redirected.
    if (role === null) return;
    if (PROFILE_HOME_PATH[role] === PROFILE_HOME_PATH[home]) return;
    const query = searchParams.toString();
    router.replace(`${HAND_OVER_TO[role]}${query ? `?${query}` : ""}`);
  }, [hydrated, role, home, router, searchParams]);

  return mismatch;
}

export function useProfile(): ProfileValue {
  const value = React.useContext(ProfileContext);
  if (!value) throw new Error("useProfile must be used inside ProfileProvider");
  return value;
}
