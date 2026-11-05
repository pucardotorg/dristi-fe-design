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
  ClipboardCheckIcon,
  Columns3Icon,
  FileQuestionIcon,
  FileSpreadsheetIcon,
  ListChecksIcon,
} from "lucide-react";

import { advocatesMissing } from "@/lib/bulk/parties";
import { CLIENTS } from "@/lib/bulk/clients";
import { BulkSetupRepository, prefillKnownComplainant } from "@/lib/bulk/setup-repository";
import { complainantName } from "@/lib/bulk/parties";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { stepFromPathname } from "@/lib/filing/steps";
import { FilingProvider, useFiling } from "@/lib/filing/store";
import type { StepId } from "@/lib/filing/types";
import { DraftBreadcrumbLabel } from "@/components/filing/chrome";
import { FieldPolicyProvider, type FieldPolicy } from "@/components/filing/field-policy";
import { FilingShell } from "@/components/filing/filing-shell";
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

import { BulkSteps, StageRow, type BulkStepId, type Stage, type StepMark } from "./bulk-steps";
import { useGujarat } from "./court-guard";

/** The sections the setup walks, in order. */
const SETUP_STEPS: StepId[] = ["complainant", "advocate", "documents"];

/** One of the setup's sections. */
export function setupHref(setupId: string, step: StepId): string {
  return `/filings/bulk/upload/${encodeURIComponent(setupId)}/${step}`;
}

/** The upload's own steps after the sections: the file, matching, review. */
export type UploadStep = "format" | "file" | "map" | "values" | "review";

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
  /** Template or own file, once chosen (`format-choice.tsx`). */
  format: "template" | "own" | null;
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
    format: null,
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
      // The parties are entered by hand here, once for the batch: no document is read, so
      // no source rail beside the form (owner, 2026-11-04).
      sources: false,
      partyInPerson: false,
      // No side panel in this flow, so the page sits in the middle of the screen (v8).
      centered: true,
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
        <SetupPolicy policy={policy}>
          <FilingShell
            rail={false}
            banner={<SetupSteps setupId={setupId} step={step} uploadStep={uploadStep} upload={upload} ai={ai} />}
          >
            {children}
          </FilingShell>
        </SetupPolicy>
      </UploadStateContext.Provider>
    </FilingProvider>
  );
}

/**
 * The setup's policy, with the Advocate section held until every advocate is a registered
 * one. A single filing lets the section wait for preview; here one empty advocate would
 * reach every case as the same fix (bulk audit, 2026-11-04).
 */
function SetupPolicy({ policy, children }: { policy: FieldPolicy; children: React.ReactNode }) {
  const { draft } = useFiling();
  const hold = policy.step === "advocate" ? advocatesMissing(draft.advocates) : null;
  const picker = React.useMemo(() => (policy.step === "complainant" ? <SavedComplainant /> : null), [policy.step]);
  const value = React.useMemo(
    () => ({ ...policy, holdContinue: hold, underTitle: picker ?? policy.underTitle }),
    [policy, hold, picker],
  );
  return <FieldPolicyProvider value={value}>{children}</FieldPolicyProvider>;
}

/**
 * "Fill from a saved complainant" (v8): an institution files for the same complainant
 * batch after batch, so the one it filed for last is picked in one move. Every field it
 * fills stays editable below.
 */
function SavedComplainant() {
  const { draft, update } = useFiling();
  const [busy, setBusy] = React.useState(false);
  const first = draft.complainants[0];
  const current = first ? CLIENTS.find((c) => c.complainant.name === complainantName(first))?.id ?? "" : "";
  return (
    <Field className="gap-1.5 sm:max-w-96">
      <FieldLabel htmlFor="saved-complainant">Fill from a saved complainant</FieldLabel>
      <NativeSelect
        id="saved-complainant"
        value={current}
        disabled={busy}
        onChange={async (e) => {
          const id = e.target.value;
          if (!id) return;
          setBusy(true);
          const next = structuredClone(draft);
          await prefillKnownComplainant(next, id);
          update((d) => {
            d.complainants = next.complainants;
            d.intake.parties = next.intake.parties;
          });
          setBusy(false);
        }}
      >
        <NativeSelectOption value="">Choose</NativeSelectOption>
        {CLIENTS.map((c) => (
          <NativeSelectOption key={c.id} value={c.id}>
            {c.complainant.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FieldDescription>Every field it fills can still be changed below.</FieldDescription>
    </Field>
  );
}

/**
 * Above every screen of the upload: the batch's steps, then where this screen sits in its
 * step. Before the batch exists only Common details and Cases can be reached; the rest
 * open once it is created. Matching shows only for a file that needs it.
 */
function SetupSteps({
  setupId,
  step,
  uploadStep,
  upload,
  ai,
}: {
  setupId: string;
  step: StepId | null;
  uploadStep: UploadStep | null;
  upload: UploadState;
  ai: string | null;
}) {
  const inCases = uploadStep !== null;
  const marks: Record<BulkStepId, StepMark> = {
    common: { status: inCases ? "complete" : "current", href: setupHref(setupId, "complainant") },
    cases: { status: inCases ? "current" : "upcoming", href: uploadHref(setupId, "file", ai) },
    details: { status: "upcoming" },
    documents: { status: "upcoming" },
    sign: { status: "upcoming" },
    pay: { status: "upcoming" },
  };
  const commonStages: Stage[] = [
    { id: "complainant", title: "Complainant", href: setupHref(setupId, "complainant") },
    { id: "advocate", title: "Advocate", href: setupHref(setupId, "advocate") },
    { id: "documents", title: "Documents for every case", href: setupHref(setupId, "documents") },
  ];
  const caseStages: Stage[] = [
    { id: "format", title: "Choose a format", href: uploadHref(setupId, "format", ai), done: !!upload.format },
    { id: "file", title: upload.documents ? "Case documents" : "Excel file", href: uploadHref(setupId, "file", ai), done: upload.read },
    ...(upload.matchColumns ? [{ id: "map", title: "Match columns", href: upload.read ? uploadHref(setupId, "map", ai) : undefined }] : []),
    ...(upload.matchValues ? [{ id: "values", title: "Match values", href: upload.read ? uploadHref(setupId, "values", ai) : undefined }] : []),
    { id: "review", title: "Check", href: upload.read ? uploadHref(setupId, "review", ai) : undefined },
  ];
  const stages = inCases ? caseStages : commonStages;
  const current = inCases
    ? uploadStep === "file" && !upload.format && !upload.read
      ? "format"
      : uploadStep
    : (step ?? "complainant");
  const at = stages.findIndex((x) => x.id === current);
  return (
    <BulkSteps
      marks={marks}
      second={
        <StageRow
          label={inCases ? "Step 2 · Cases" : "Step 1 · Common details"}
          stages={stages.map((x, i) => ({ ...x, done: x.done ?? i < at }))}
          current={current ?? ""}
        />
      }
    />
  );
}
