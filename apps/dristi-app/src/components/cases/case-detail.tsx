import { Suspense } from "react";

import {
  ApplicationsLoading,
  CaseApplications,
} from "@/components/cases/case-applications";
import { CaseComplaint } from "@/components/cases/case-complaint";
import {
  CaseDocuments,
  DocumentsLoading,
} from "@/components/cases/case-documents";
import { CaseBailProvider } from "@/components/cases/case-bail-flow";
import { CaseBreadcrumbs } from "@/components/cases/case-breadcrumbs";
import { CaseFile } from "@/components/cases/case-file";
import { CaseHeader } from "@/components/cases/case-header";
import { CaseLinkedHearing } from "@/components/cases/case-linked-hearing";
import { CaseHearingsSection } from "@/components/cases/hearings-register";
import { CaseOrders, OrdersLoading } from "@/components/cases/case-orders";
import { CaseOverview } from "@/components/cases/case-overview";
import { CaseParties } from "@/components/cases/case-parties";
import { CaseProcessStatus } from "@/components/cases/case-process-status";
import { CaseTimeline } from "@/components/cases/case-timeline";
import {
  CaseSectionTabs,
  SectionPending,
} from "@/components/cases/case-section-tabs";
import { hearingRecords } from "@/lib/cases/hearing-record";
import { parseCaseFileDoc, parseCaseFileView } from "@/lib/cases/case-file";
import {
  complaintTree,
  parseComplaintPart,
} from "@/lib/cases/complaint";
import { FIXTURE_TODAY } from "@/lib/cases/fixtures";
import { partiesLabel, type CaseRecord } from "@/lib/cases/types";
import { parseSelectedId } from "@/lib/cases/parties";
import {
  CASE_SECTIONS,
  parseCaseOrigin,
  parseCaseSection,
} from "@/lib/cases/sections";
import { type CaseReader } from "@/lib/cases/case-reader";
import type { AccessCase } from "@/lib/access/content";
import { CaseReaderProvider } from "@/components/cases/case-reader";
import { CaseOfficeAccessProvider } from "@/components/cases/case-office-access";
import { viewerAccess } from "@/lib/cases/viewer";

/**
 * One case, as its reader sees it — the advocate at `/cases/[caseId]`, the court at
 * `/employee/cases/[caseId]`. One screen for both (owner, 2026-10-13: the same code,
 * conditional on who the user is); `reader` is the only thing that differs, and what it
 * changes is set out in `lib/cases/case-reader.ts`.
 *
 * One branch per member of `CASE_SECTIONS`, in strip order, with Hearings
 * last — it keeps its route and its screen but no longer has a tab, so it is
 * reached from Overview's "View hearing details", the pending-task rows, the
 * case-peek drawer, and the case-history entries that point at it.
 *
 * The `SectionPending` fallback is unreachable while every member is built;
 * it stays as the landing for the next section added to the registry ahead of
 * its screen, and it reads its label off the registry rather than printing
 * the raw slug.
 */
export function CaseDetail({
  record,
  searchParams,
  reader = "advocate",
  orderHref,
}: {
  record: CaseRecord;
  searchParams: Record<string, string | string[] | undefined>;
  /** Who is reading (`lib/cases/case-reader.ts`). The advocate unless the court says so. */
  reader?: CaseReader;
  /** The court's order screen for this case, behind its Generate order. */
  orderHref?: string;
}) {
  const caseId = record.id;

  const section = parseCaseSection(searchParams.section);
  const docId = parseCaseFileDoc(searchParams.doc);
  const view = parseCaseFileView(searchParams.view);
  const partId = parseComplaintPart(
    searchParams.part,
    complaintTree(record.id)
  );
  const origin = parseCaseOrigin(searchParams.from);
  /* A `?selected=` naming nobody — a stale link from an earlier layout, a
     hand-edited URL — falls back to the first litigant. Retired params like
     `?tab=` and `?side=` are simply unread. */
  const participantId = parseSelectedId(searchParams.selected);

  const accessCase: AccessCase = {
    id: record.id,
    title: partiesLabel(record),
    caseNumber: record.caseNumber,
    court: record.court,
    nextHearing: record.nextHearing?.on ?? "—",
    viewerAccess: viewerAccess(record).kind,
  };

  return (
    <CaseReaderProvider reader={reader}>
    <CaseOfficeAccessProvider office={reader === "advocate" && accessCase.viewerAccess === "office"}>
    <CaseBailProvider accessCase={accessCase}>
      {/* The trail reads Cases › the number and stops there. The section tabs switch
          views of this one page, and a breadcrumb names pages, not tabs — moving
          between tabs must not move the trail (owner, Sept 9). */}
      {/* The court's trail is its own top bar's, read off the path
          (`lib/employee/navigation.ts`); this one publishes to the advocate's. */}
      {reader === "advocate" ? (
        <CaseBreadcrumbs caseId={record.id} caseNumber={record.caseNumber} />
      ) : null}
      {/* No "Back to cases" row: the trail above already carries that link. */}
      {/* The Pending tasks page's ground, so the white cards stand off it
          (owner, Sept 18). Dark keeps its own background. */}
      <div className="flex min-w-0 flex-1 flex-col gap-6 bg-muted p-6 md:p-8 dark:bg-background">
        <CaseHeader
          record={record}
          hideLongPendingFlag={origin === "long-pending"}
          orderHref={orderHref}
        />

      <CaseSectionTabs caseId={caseId} section={section}>
        {section === "overview" ? (
          /* The bond lifecycle renders inside Overview's own Pending-tasks
             card, as one of its rows — see BondTaskRow (Aug 31 round). */
          <CaseOverview
            record={record}
            now={new Date(FIXTURE_TODAY).getTime()}
          />
        ) : section === "case-file" ? (
          <CaseFile record={record} docId={docId} view={view} />
        ) : section === "complaint" ? (
          <CaseComplaint record={record} partId={partId} />
        ) : section === "notice-process-status" ? (
          <CaseProcessStatus record={record} />
        ) : section === "hearings" ? (
          <CaseHearingsSection
            caseId={record.id}
            hearings={hearingRecords(record)}
          />
        ) : section === "orders-and-notifications" ? (
          <Suspense fallback={<OrdersLoading />}>
            <CaseOrders record={record} />
          </Suspense>
        ) : section === "applications" ? (
          <Suspense fallback={<ApplicationsLoading />}>
            <CaseApplications record={record} />
          </Suspense>
        ) : section === "documents" ? (
          <Suspense fallback={<DocumentsLoading />}>
            <CaseDocuments record={record} />
          </Suspense>
        ) : section === "parties" ? (
          <CaseParties record={record} selectedId={participantId} />
        ) : section === "case-history" ? (
          <CaseTimeline record={record} />
        ) : (
          <SectionPending
            label={
              CASE_SECTIONS.find((item) => item.value === section)?.label ??
              section
            }
          />
        )}
      </CaseSectionTabs>
      <CaseLinkedHearing record={record} />
      </div>
    </CaseBailProvider>
    </CaseOfficeAccessProvider>
    </CaseReaderProvider>
  );
}
