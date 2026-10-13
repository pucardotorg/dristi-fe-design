import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { PSS_CASE_TYPE } from "@/lib/filing/options";
import { FILINGS_HOME } from "@/lib/filing/steps";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: PSS_CASE_TYPE.title };

/** Honest stub: the PSS Act case type is listed, but its filing flow is not built yet. */
export default function PssFilingPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-12 sm:px-6">
      <h1 className="text-title font-semibold tracking-tight text-foreground">
        {PSS_CASE_TYPE.title}
      </h1>
      <p className="text-body text-muted-foreground">
        Filing a complaint under {PSS_CASE_TYPE.offence} is coming to DRISTI. It is not
        available yet — file it at the court counter for now.
      </p>
      <Button asChild variant="outline" className="w-fit">
        <Link href={FILINGS_HOME}>
          <ArrowLeftIcon data-icon="inline-start" aria-hidden />
          Back to dashboard
        </Link>
      </Button>
    </main>
  );
}
