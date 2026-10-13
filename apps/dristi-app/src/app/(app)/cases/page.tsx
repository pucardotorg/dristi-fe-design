import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileCases } from "@/components/cases/profile-cases";
import { CASES, FIXTURE_TODAY } from "@/lib/cases/fixtures";
import { PARTY_CASES } from "@/lib/cases/party-cases";
import { buildCasesHref, parseCasesQuery } from "@/lib/cases/query";

export const metadata: Metadata = {
  title: "Cases",
};

export default async function CasesPage(props: PageProps<"/cases">) {
  const query = parseCasesQuery(await props.searchParams);
  if (query.bucket) {
    redirect(buildCasesHref(query));
  }

  const cases = query.demo === "empty" ? [] : CASES;
  const partyCases = query.demo === "empty" ? [] : PARTY_CASES;

  return (
    <ProfileCases
      query={query}
      officeCases={cases}
      partyCases={partyCases}
      now={new Date(FIXTURE_TODAY).getTime()}
    />
  );
}
