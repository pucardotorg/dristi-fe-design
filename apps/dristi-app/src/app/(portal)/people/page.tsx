"use client";

import * as React from "react";

import { UsersIcon } from "lucide-react";

import { PeoplePage } from "@/components/access/people-page";
import { useLocale } from "@/components/shell/locale";
import { ProfileScopedEmpty } from "@/components/shell/profile-scoped-empty";

/** People — the office. Opening a person goes to their own page. */
export default function Page() {
  const { locale } = useLocale();
  return (
    <ProfileScopedEmpty
      title="No one has access yet"
      description="People you share your cases with — advocates and office staff — appear here."
      icon={<UsersIcon aria-hidden />}
    >
      <PeoplePage locale={locale} />
    </ProfileScopedEmpty>
  );
}
