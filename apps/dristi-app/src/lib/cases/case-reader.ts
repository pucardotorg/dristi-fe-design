/**
 * Who is reading a case — the one thing that differs between the advocate's case view and
 * the court's. (`viewer.ts` is a different question: which of the advocate's own seats is
 * signed in.)
 *
 * Both read the same screen (`components/cases/case-detail.tsx`); the court's is that
 * screen with Share access gone and Generate order in place of Make filings (owner,
 * 2026-10-13). The view is not copied, so this is the switch it reads instead.
 *
 * It also decides where the screen's own links go. Every case link is built as
 * `/cases/<id>…` (`sections.ts` and the helpers that call it); for the court that has to
 * stay inside the court area, so the same path is moved under `/employee`. Nothing else
 * is rebased — a link to anywhere but a case is the same for both readers.
 */

export type CaseReader = "advocate" | "court";

const CASE_PREFIX = "/cases/";

export function rebaseCaseHref(href: string, reader: CaseReader): string {
  return reader === "court" && href.startsWith(CASE_PREFIX) ? `/employee${href}` : href;
}
