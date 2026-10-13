import type { Metadata } from "next";
import { Suspense } from "react";

import { SignLinkScreen } from "@/components/filing/sign-link/sign-link-screen";

export const metadata: Metadata = { title: "Sign the complaint" };

/**
 * The signing link — what each party not at the filer's keyboard receives by SMS when a
 * complaint is sent for signature. `?draft=<id>&as=<signatory id>`; the query is read on
 * the client, so the page needs a Suspense boundary to be prerendered.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <SignLinkScreen />
    </Suspense>
  );
}
