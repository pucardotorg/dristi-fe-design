"use client";

/**
 * The batch's complainants and advocates, entered before the Excel file (Bulk filing PRD
 * `BLK-05`) in the single filing's own Complainant, Advocate and Documents sections, so
 * they carry every field and check a single filing has.
 *
 * The sections work on a setup draft that is not a case (`BulkSetupRepository`). Only the
 * complainants' documents are asked for here; each case's own come after the batch is
 * created. When the batch is created, every case gets a copy (`applyParties`), which that
 * case can then change on its own (`BLK-06`).
 */

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ClipboardCheckIcon,
  Columns3Icon,
  FileQuestionIcon,
  FileSpreadsheetIcon,
  ListChecksIcon,
} from "lucide-react";

import { BulkSetupRepository } from "@/lib/bulk/setup-repository";
import { stepFromPathname } from "@/lib/filing/steps";
import { FilingProvider } from "@/lib/filing/store";
import type { StepId } from "@/lib/filing/types";
import { DraftBreadcrumbLabel } from "@/components/filing/chrome";
import { FieldPolicyProvider, type FieldPolicy } from "@/components/filing/field-policy";
import { FilingShell } from "@/components/filing/filing-shell";
import { SectionNotice } from "@/components/filing/notices";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

import { useGujarat } from "./court-guard";

/** The sections the setup walks, in order. */
const SETUP_STEPS: StepId[] = ["complainant", "advocate", "documents"];

/** One of the setup's sections. */
export function setupHref(setupId: string, step: StepId): string {
  return `/filings/bulk/upload/${encodeURIComponent(setupId)}/${step}`;
}

/** The upload's own steps after the sections: the file, matching, review. */
export type UploadStep = "file" | "map" | "values" | "review";

/** One of the upload's own steps. */
export function uploadHref(setupId: string, step: UploadStep = "file", ai?: string | null): string {
  const q = new URLSearchParams();
  if (step !== "file") q.set("step", step);
  if (ai) q.set("ai", ai);
  const query = q.toString();
  return `/filings/bulk/upload/${encodeURIComponent(setupId)}/file${query ? `?${query}` : ""}`;
}

/** Where the upload stands, as its file screen reports it, for the sections rail. */
export type UploadState = {
  /** A file has been read, so matching and review can be reached. */
  read: boolean;
  /** The file is laid out differently from the template, so its columns are matched. */
  matchColumns: boolean;
  /** Some list values are not in the lists, so they are matched. */
  matchValues: boolean;
  /** Reading case documents rather than a sheet (AI). */
  documents: boolean;
};

const UploadStateContext = React.createContext<(s: UploadState) => void>(() => undefined);

/** For the upload's file screen: tell the rail what it has reached. */
export const useReportUploadState = () => React.useContext(UploadStateContext);

export function BulkSetupFlow({
  setupId,
  children,
}: {
  setupId: string;
  children: React.ReactNode;
}) {
  const ready = useGujarat();
  const pathname = usePathname();
  const step = stepFromPathname(pathname);
  const params = useSearchParams();
  const ai = params.get("ai");
  const [upload, setUpload] = React.useState<UploadState>({
    read: false,
    matchColumns: false,
    matchValues: false,
    documents: false,
  });
  const onFile = pathname.endsWith("/file");
  const uploadStep = (onFile ? params.get("step") ?? "file" : null) as UploadStep | null;

  const repository = React.useMemo(() => new BulkSetupRepository(setupId), [setupId]);

  /*
   * Each section's own Continue and Back, so its checks still gate it. The sections'
   * links to the document upload, and the Advocate section's next section (Accused),
   * go to the setup's documents; the documents' next is the upload's file step.
   */
  const hrefFor = React.useCallback(
    (s: StepId) => {
      if (s === "upload" || s === "accused") return setupHref(setupId, "documents");
      if (SETUP_STEPS.includes(s)) return setupHref(setupId, s);
      return uploadHref(setupId, "file", ai);
    },
    [setupId, ai],
  );

  const policy = React.useMemo<FieldPolicy>(
    () => ({
      step,
      issueAt: () => null,
      lockedAt: () => null,
      countFor: () => 0,
      documentGroups: (id) => id.startsWith("complainant-"),
      hostSteps: {
        group: "Upload",
        steps: [
          {
            id: "file",
            title: upload.documents ? "Case documents" : "Excel file",
            icon: FileSpreadsheetIcon,
            href: uploadHref(setupId, "file", ai),
            active: uploadStep === "file",
            done: upload.read && uploadStep !== "file",
          },
          ...(upload.matchColumns
            ? [{ id: "map", title: "Match columns", icon: Columns3Icon, href: uploadHref(setupId, "map", ai), active: uploadStep === "map", disabled: !upload.read }]
            : []),
          ...(upload.matchValues
            ? [{ id: "values", title: "Match values", icon: ListChecksIcon, href: uploadHref(setupId, "values", ai), active: uploadStep === "values", disabled: !upload.read }]
            : []),
          {
            id: "review",
            title: "Review",
            icon: ClipboardCheckIcon,
            href: uploadHref(setupId, "review", ai),
            active: uploadStep === "review",
            disabled: !upload.read,
          },
        ],
      },
    }),
    [step, upload, uploadStep, setupId, ai],
  );

  if (!ready) return null;

  return (
    <FilingProvider
      draftId={setupId}
      repository={repository}
      hrefFor={hrefFor}
      steps={SETUP_STEPS}
      fallback={
        <div
          role="status"
          aria-live="polite"
          className="flex flex-1 items-center justify-center py-16 text-body-compact text-muted-foreground"
        >
          <Spinner className="mr-2 size-4" />
          Opening the upload…
        </div>
      }
      notFound={
        <div className="flex flex-1 items-center justify-center px-4 py-16">
          <Empty className="max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileQuestionIcon aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-body font-semibold">
                This upload has expired
              </EmptyTitle>
              <EmptyDescription className="text-body">
                An upload that was not finished is kept only in the browser tab it was
                started in. Start a new one.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/filings/bulk/upload">Start a new upload</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      }
    >
      <DraftBreadcrumbLabel label={ai === "on" ? "Upload cases" : "Upload Excel"} />
      <UploadStateContext.Provider value={setUpload}>
        <FieldPolicyProvider value={policy}>
          <FilingShell banner={<SetupBar />}>{children}</FilingShell>
        </FieldPolicyProvider>
      </UploadStateContext.Provider>
    </FilingProvider>
  );
}

/** Above every section: what this part of the upload is for. */
function SetupBar() {
  return (
    <div className="bg-muted px-6 pt-6 lg:px-12 dark:bg-background">
      <div className="flex w-full max-w-4xl flex-col gap-3">
        <Link
          href="/filings/bulk"
          className="flex w-fit items-center gap-1 text-body-compact text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          Bulk filing
        </Link>
        <SectionNotice variant="neutral">
          The complainants and advocates, and their documents, are entered once and go on
          every case in the file. Once the batch is created, each case can change them on
          its own.
        </SectionNotice>
      </div>
    </div>
  );
}
