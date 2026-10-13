"use client";

import { CasesScreen } from "@/components/cases/cases-screen";
import { useProfile } from "@/components/shell/profile";
import { initialBookmarks, type CasesQuery } from "@/lib/cases/query";
import type { CaseRecord } from "@/lib/cases/types";

/**
 * Your cases, for the profile the person is acting as. The advocate and the
 * demo clerk share the office's cases; the litigant has their own (see
 * `lib/cases/party-cases.ts`). Keyed by list so a profile switch starts the
 * screen fresh rather than carrying one list's bookmarks into the other.
 */
export function ProfileCases({
  query,
  officeCases,
  partyCases,
  now,
}: {
  query: CasesQuery;
  officeCases: CaseRecord[];
  partyCases: CaseRecord[];
  now: number;
}) {
  const { profileRole } = useProfile();
  const litigant = profileRole === "litigant";
  const cases = litigant ? partyCases : officeCases;
  return (
    <CasesScreen
      key={litigant ? "party" : "office"}
      query={query}
      cases={cases}
      initialBookmarks={initialBookmarks(cases)}
      now={now}
    />
  );
}
