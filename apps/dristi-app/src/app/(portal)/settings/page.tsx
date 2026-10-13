"use client";

import * as React from "react";

import type { SubmittedId } from "@/components/home/add-id-dialog";
import {
  ProfileSettings,
  type AdvocateRequestDetails,
} from "@/components/home/profile-settings";
import { useLocale } from "@/components/shell/locale";
import { useProfile } from "@/components/shell/profile";
import { VIEWER_CLERK_NAME } from "@/lib/cases/viewer";

/**
 * Settings on the new shell. Profile role + switch come from the shell's ProfileProvider;
 * the id-upload and advocate-request (elevate) state is local demo state until a real
 * account service lands. This is where a litigant elevates to an advocate profile.
 */
export default function Page() {
  const { locale } = useLocale();
  const {
    profileRole,
    advocateProfileAvailable,
    accountName,
    setProfileRole,
    enableAdvocateProfile,
  } = useProfile();

  const [idSubmitted, setIdSubmitted] = React.useState(true);
  const [submittedId, setSubmittedId] = React.useState<SubmittedId | null>(null);
  const [advocateRequest, setAdvocateRequest] =
    React.useState<AdvocateRequestDetails | null>(null);

  // The demo clerk is someone else (see `profile.tsx`): his name, as the rail shows it.
  const profileName = profileRole === "clerk" ? VIEWER_CLERK_NAME : accountName;

  return (
    <ProfileSettings
      locale={locale}
      profileName={profileName}
      idSubmitted={idSubmitted}
      submittedId={submittedId}
      advocateRequest={advocateRequest}
      profileRole={profileRole}
      advocateProfileAvailable={advocateProfileAvailable}
      onIdSubmitted={(submission) => {
        setSubmittedId(submission);
        setIdSubmitted(true);
      }}
      onProfileCompleted={() => {}}
      onAdvocateRequest={(details) => {
        setAdvocateRequest(details);
        // Demo: the approval lands a moment later, and the advocate profile becomes
        // switchable. In production this waits on the Bar Council verification.
        window.setTimeout(() => enableAdvocateProfile(), 3000);
      }}
      onSwitchProfile={setProfileRole}
    />
  );
}
