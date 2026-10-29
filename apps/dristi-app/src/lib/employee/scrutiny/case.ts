import { deriveHistory, deriveScrutinyCase } from "@/lib/employee/scrutiny/derive";
import { caseFromDraft } from "@/lib/employee/scrutiny/from-draft";
import { CASE, HISTORY, HISTORY_ROUND, HISTORY_SUMMARY } from "@/lib/employee/scrutiny/history";
import { mockFiling, SCRUTINY_SIGNING } from "@/lib/employee/scrutiny/mock-filings";
import { findFiling } from "@/lib/employee/scrutiny/queue";
import { returnRoundFor } from "@/lib/employee/scrutiny/returns";
import { CHECKS } from "@/lib/employee/scrutiny/sections";
import type { SigningRules } from "@/lib/filing/config";
import type {
  BundleDoc,
  Filing,
  FlatField,
  ScrutinyCase,
  SectionDef,
} from "@/lib/employee/scrutiny/types";

/** The one hand-authored case — the showcase, with real scans and pixel-mapped regions. */
export const HERO_FILING_NO = CASE.filingNo;

/** Every field, flattened once, tagged with the group and section it came from. */
function flatten(sections: SectionDef[]): FlatField[] {
  return sections.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.fields.map((field) => ({
        ...field,
        group: group.title,
        section: section.title,
        sectionId: section.id,
      })),
    ),
  );
}

function indexBy<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

/**
 * Assemble one filing's workbench.
 *
 * A §138 filing is read off its e-filing draft (`from-draft.ts`), so the officer sees
 * every question the form asked, exactly as the advocate answered it. A Section 25 (PSA)
 * matter has no e-filing form yet, so it is still derived from its queue row
 * (`derive.ts`). Either way the caller gets one `ScrutinyCase` and the workbench renders
 * identically — no screen special-cases where the case came from.
 *
 * `signing` is the selected court's rules: they decide whether the affidavit is read with
 * its oath. The sample filings were generated under Gujarat's, which is the default.
 */
export function buildScrutinyCase(
  filing: Filing,
  signing: SigningRules = SCRUTINY_SIGNING,
): ScrutinyCase {
  const mock = mockFiling(filing.no);
  if (mock) {
    const read = caseFromDraft(mock.draft, {
      signing,
      pages: mock.pages,
      poorScans: mock.poorScans,
    });
    const allFields = flatten(read.sections);
    const fieldById = indexBy(allFields);
    const returned = returnRoundFor(filing.no);
    const history =
      filing.no === HERO_FILING_NO
        ? { history: HISTORY, historySummary: HISTORY_SUMMARY, historyRound: HISTORY_ROUND }
        : deriveHistory(filing, read.party, returned, fieldById);
    return {
      filing,
      party: read.party,
      sections: read.sections,
      allFields,
      fieldById,
      bundle: read.bundle,
      docById: indexBy<BundleDoc>(read.bundle),
      docRow: read.docRow,
      checks: CHECKS,
      ...history,
      returned,
    };
  }

  const derived = deriveScrutinyCase(filing);
  const allFields = flatten(derived.sections);
  return {
    filing,
    party: derived.party,
    sections: derived.sections,
    allFields,
    fieldById: indexBy(allFields),
    bundle: derived.bundle,
    docById: indexBy<BundleDoc>(derived.bundle),
    docRow: derived.docRow,
    checks: derived.checks,
    history: derived.history,
    historySummary: derived.historySummary,
    historyRound: derived.historyRound,
    // No e-filing draft behind a derived matter, so no field a returned item could name.
    returned: null,
  };
}

/** The case behind a route param, or `undefined` when the id names no real filing. */
export function scrutinyCaseFor(
  filingNo: string,
  signing?: SigningRules,
): ScrutinyCase | undefined {
  const filing = findFiling(filingNo);
  return filing ? buildScrutinyCase(filing, signing) : undefined;
}
