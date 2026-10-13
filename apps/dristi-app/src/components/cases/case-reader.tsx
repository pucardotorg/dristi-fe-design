"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { rebaseCaseHref, type CaseReader } from "@/lib/cases/case-reader";

/**
 * The reader of the case view, for the client components under it (`lib/cases/reader.ts`).
 * Absent means the advocate, so every screen that has always shown a case keeps doing so
 * without wrapping itself in anything.
 */
const CaseReaderContext = React.createContext<CaseReader>("advocate");

export function CaseReaderProvider({
  reader,
  children,
}: {
  reader: CaseReader;
  children: React.ReactNode;
}) {
  return <CaseReaderContext.Provider value={reader}>{children}</CaseReaderContext.Provider>;
}

export function useCaseReader(): CaseReader {
  return React.useContext(CaseReaderContext);
}

/** `next/link`, with a case link kept inside the reader's own area. */
export function CaseLink({ href, ...props }: React.ComponentProps<typeof Link>) {
  const reader = useCaseReader();
  return (
    <Link {...props} href={typeof href === "string" ? rebaseCaseHref(href, reader) : href} />
  );
}

/** The router, with the same rule for the views that move by `replace`. */
export function useCaseRouter() {
  const router = useRouter();
  const reader = useCaseReader();
  return React.useMemo(
    () => ({
      ...router,
      push: (href: string, options?: Parameters<typeof router.push>[1]) =>
        router.push(rebaseCaseHref(href, reader), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(rebaseCaseHref(href, reader), options),
    }),
    [router, reader],
  );
}
