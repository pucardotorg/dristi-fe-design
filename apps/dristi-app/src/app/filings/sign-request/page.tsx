import type { Metadata } from "next";
import { Suspense } from "react";

import { SignLinkScreen } from "@/components/filing/sign-link/sign-link-screen";

export const metadata: Metadata = { title: "Sign the complaint" };

/**
 * `/filings/sign-request` — a complaint someone was asked to sign, inside File a case.
 *
 * The SMS link (`/sign`) explains itself to a stranger and asks them to sign in; once
 * they have, the complaint opens here, in the product's shell under File a case, with
 * the signing window over it (owner, 2026-10-09). It also stays listed on their home
 * (`lib/filing/linked-complaints.ts`). A static segment, so it is matched before the
 * `[draftId]` routes beside it.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignLinkScreen inShell />
    </Suspense>
  );
}
