"use client";

import * as React from "react";

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
  /** Toggle between the two profiles a real account holds (advocate and litigant). */
  switchProfile: () => void;
  /** Act as this profile. The only way into the demo clerk profile. */
  setProfileRole: (role: ProfileRole) => void;
  /** Grant the advocate profile — the elevation-approved path (from Settings). */
  enableAdvocateProfile: () => void;
};

const ProfileContext = React.createContext<ProfileValue | null>(null);

/** Session-lite keys: sign-in stashes these so the shell opens as the account you are. */
export const PROFILE_ROLE_KEY = "dristi-demo-profile-role";
export const ADVOCATE_AVAILABLE_KEY = "dristi-demo-advocate-available";
export const ACCOUNT_NAME_KEY = "dristi-demo-account-name";

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
  const profileRole: ProfileRole =
    storedRole === "litigant" ||
    storedRole === "advocate" ||
    storedRole === "clerk"
      ? storedRole
      : initialRole;

  const storedAvail = useLocalStorageValue(ADVOCATE_AVAILABLE_KEY);
  const advocateAvailable =
    storedAvail === "true" || storedAvail === "false"
      ? storedAvail === "true"
      : advocateProfileAvailable;

  const accountName = useLocalStorageValue(ACCOUNT_NAME_KEY) || "Anjali Nair";

  const switchProfile = React.useCallback(() => {
    writeLocalStorageValue(
      PROFILE_ROLE_KEY,
      profileRole === "litigant" ? "advocate" : "litigant",
    );
  }, [profileRole]);

  const setProfileRole = React.useCallback((role: ProfileRole) => {
    writeLocalStorageValue(PROFILE_ROLE_KEY, role);
  }, []);

  const enableAdvocateProfile = React.useCallback(() => {
    writeLocalStorageValue(ADVOCATE_AVAILABLE_KEY, "true");
  }, []);

  const value = React.useMemo<ProfileValue>(
    () => ({
      profileRole,
      advocateProfileAvailable: advocateAvailable,
      accountName,
      switchProfile,
      setProfileRole,
      enableAdvocateProfile,
    }),
    [
      profileRole,
      advocateAvailable,
      accountName,
      switchProfile,
      setProfileRole,
      enableAdvocateProfile,
    ],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileValue {
  const value = React.useContext(ProfileContext);
  if (!value) throw new Error("useProfile must be used inside ProfileProvider");
  return value;
}
