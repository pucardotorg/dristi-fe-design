"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDownIcon,
  ClockIcon,
  FileSearchIcon,
  FileTextIcon,
} from "lucide-react";

import { ApplicationPaymentDialog } from "@/components/cases/application-payment-dialog";
import { ApplicationRecordDialog } from "@/components/cases/application-record-dialog";
import { RaiseApplicationForm } from "@/components/cases/raise-application-form";
import { RestingCard } from "@/components/cases/case-overview-card";
import {
  RECENT_ROW,
  RegisterFilter,
  RegisterSearch,
  RowViewButton,
  useRecentRow,
} from "@/components/cases/register-controls";
import { PartySignatureDialog } from "@/components/cases/party-application";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TABLE_HEAD_ROW,
  tableBodyClass,
  tableRowClass,
} from "@/components/chrome/table-plate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  APPLICATION_TYPE_OPTIONS,
  EXPIRY_NOTICE_DAYS,
  applicationSideLabel,
  HAS_BULK_SIGNING_TOOL,
  expiringSoon,
  applicationNumberLabel,
  applicationsRegister,
  groupActions,
  movesKey,
  parseMoves,
  type ActionEntry,
  type ApplicationMove,
  type ApplicationRecord,
  type ObjectionTask,
  filingNoun,
} from "@/lib/cases/application-record";
import {
  resolveApplicationViewer,
  type ApplicationViewer,
} from "@/lib/cases/application-access";
import {
  FILING_STATUSES,
  applicationsFile,
  quotedOthersTitle,
  type FilingStatus,
  type Submission,
} from "@/lib/cases/applications";
import { FIXTURE_TODAY } from "@/lib/cases/fixtures";
import { isViewer, viewerRepresentation } from "@/lib/cases/viewer";
import { useProfile } from "@/components/shell/profile";
import {
  readSessionValue,
  useSessionValue,
  writeSessionValue,
} from "@/lib/cases/demo-session";
import {
  parseSavedDrafts,
  savedDraftSubmission,
  savedDraftsKey,
} from "@/lib/cases/saved-application-drafts";
import { DocumentSignatureDialog } from "@/components/cases/e-sign-dialog";
import { useCaseReader } from "@/components/cases/case-reader";
import {
  parseSavedDocumentSubmissions,
  savedDocumentRows,
  savedDocumentSubmissionsKey,
} from "@/lib/cases/saved-document-submissions";
import { type CaseRecord } from "@/lib/cases/types";
import { cn } from "@/lib/utils";
import { RegisterTrayCard, useOneOpen } from "@/components/cases/register-card";
import {
  REGISTER_CARDS_ONLY,
  REGISTER_FILTER_ROW,
  REGISTER_ROW_SEARCH,
  REGISTER_TABLE_ONLY,
} from "@/components/cases/register-layout";
import { COLLAPSE_MOTION } from "@/components/cases/motion";
import { Identifier } from "@/components/chrome/identifier";
import { SignReviewDialog } from "@/components/cases/sign-review-dialog";
import { StatusLine } from "@/components/feedback";

/**
 * Applications (§9). One kind of thing, many types. What the viewer still has
 * to do sits above the register as a quiet list, never as an alarm: the work
 * is routine, and the status badges already carry the colour.
 *
 * Everything is for one viewer: the profile the person is acting as, seated
 * on this case (Application Lifecycle PRD, "Users and actions"). The other
 * side's applications appear only once the court has onboarded them.
 */
export function CaseApplications({ record }: { record: CaseRecord }) {
  const { viewer, register } = useFilingsRegister(record);
  const [types, setTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [filers, setFilers] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  /* The open record lives in `?application=`, so a case update can link
     straight to it. */
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const recordOpen = searchParams.get("application");
  const { recentId, markRecent, recentRowRef } = useRecentRow();
  /* Only a record a link opened gets its row marked on close; one the reader
     opened from this list needs no pointing back to (owner, Sept 18). */
  const openedHere = useRef(false);
  function setRecordOpen(id: string | null) {
    const next = new URLSearchParams(searchParams);
    if (id) {
      openedHere.current = true;
      next.set("application", id);
    } else next.delete("application");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }
  const [signing, setSigning] = useState<ApplicationRecord[]>([]);
  const [paying, setPaying] = useState<ApplicationRecord[]>([]);
  /* Several to sign: read them all before one signature covers them. */
  const [reviewing, setReviewing] = useState<ApplicationRecord[]>([]);
  /* The Raise application form, opened over this tab for a draft or an
     objection: the page under it never changes (owner, Sept 24). */
  const [formFor, setFormFor] = useState<{
    key: string;
    resume?: Submission;
    objectTo?: string;
  } | null>(null);

  if (!register) {
    return (
      <ApplicationsPanel>
        <StatusLine tone="error" still title="Applications could not be loaded">
          Refresh the page to try again.
        </StatusLine>
      </ApplicationsPanel>
    );
  }

  if (!viewer) {
    return (
      <ApplicationsPanel>
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileTextIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="text-body font-semibold">
              You are not a party to this case
            </EmptyTitle>
            <EmptyDescription>
              Applications show here for the parties to a case and their
              advocates.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </ApplicationsPanel>
    );
  }

  const needle = query.trim().toLowerCase();
  const rows = register.applications.filter(
    (item) =>
      (types.length === 0 || types.includes(item.type)) &&
      (statuses.length === 0 || statuses.includes(item.status)) &&
      (filers.length === 0 || filers.includes(item.filedById)) &&
      (needle === "" ||
        [item.applicationNumber, item.temporaryId].some((id) =>
          (id ?? "").toLowerCase().includes(needle)
        ))
  );
  /* Needs attention is the viewer's to-do list, not a view of the table, so
     no filter or search narrows it (owner, Sept 18). */
  const actions = groupActions(register.applications, register.objectionTasks);
  const filtered =
    types.length > 0 ||
    statuses.length > 0 ||
    filers.length > 0 ||
    needle !== "";
  const openApplication =
    register.applications.find((item) => item.id === recordOpen) ?? null;
  const canDraft =
    viewer.role === "advocate" ||
    viewer.role === "pip" ||
    viewer.role === "clerk";

  /** The step a filing is waiting on: a draft resumes in its form, the rest
   *  open their dialog. Signing starts from what is signed (owner, Oct 8):
   *  one application opens its record, several open Sign all's review. */
  function act(applications: ApplicationRecord[]) {
    const [lead] = applications;
    if (lead.step === "continue" && lead.source.kind === "application") {
      setFormFor({ key: `draft-${lead.id}`, resume: lead.source });
    } else if (lead.step === "pay") {
      setPaying(applications);
    } else if (lead.step === "sign") {
      if (applications.length === 1) setRecordOpen(lead.id);
      else setReviewing(applications);
    }
  }

  /** Read, so on to the signature. One application signs as many do. */
  function sign(applications: ApplicationRecord[]) {
    setSigning(applications);
  }

  /** Back into its form, filled in, over this tab; finishing it signs it. */
  function edit(application: ApplicationRecord) {
    if (application.source.kind !== "application") return;
    setFormFor({ key: `edit-${application.id}`, resume: application.source });
  }

  /** File objection, over this tab. */
  function object(applicationId: string) {
    setFormFor({ key: `object-${applicationId}`, objectTo: applicationId });
  }

  return (
    <ApplicationsPanel>
      {actions.length > 0 ? (
        <NeedsAction
          caseId={record.id}
          entries={actions}
          onAct={act}
          onObject={object}
          onOpen={setRecordOpen}
        />
      ) : null}

      {/* The controls sit directly on the table they narrow, below Needs
          attention and a step clear of it, so what they act on is read from
          where they are. */}
      <div
        className={cn(
          REGISTER_FILTER_ROW,
          actions.length > 0 && "mt-4"
        )}
      >
        <RegisterFilter
          label="Type"
          values={types}
          onChange={setTypes}
          options={APPLICATION_TYPE_OPTIONS}
        />
        <RegisterFilter
          label="Status"
          values={statuses}
          onChange={setStatuses}
          options={FILING_STATUSES.map((item) => ({
            value: item.id,
            label: item.label,
          }))}
        />
        <RegisterFilter
          label="Filed by"
          values={filers}
          onChange={setFilers}
          options={register.people.map((person) => ({
            value: person.id,
            label: person.name,
          }))}
        />
        {filtered ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setTypes([]);
              setStatuses([]);
              setFilers([]);
              setQuery("");
            }}
          >
            Clear filters
          </Button>
        ) : null}
        {/* On a phone the search leads and the filters follow it (owner, Sept 21). */}
        <div className={REGISTER_ROW_SEARCH}>
          <RegisterSearch
            label="Search by application number"
            value={query}
            onChange={setQuery}
          />
        </div>
      </div>

      {/* The register's count, as Documents has it (owner, Oct 8): as far
          from the filters as from the table. */}
      {rows.length > 0 ? (
        <p
          aria-live="polite"
          className="text-caption font-medium tabular-nums text-muted-foreground"
        >
          {filtered
            ? rows.length === 1
              ? "1 application matches the filters"
              : `${rows.length} applications match the filters`
            : rows.length === 1
              ? "1 application"
              : `${rows.length} applications`}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Empty className="border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {filtered ? (
                <FileSearchIcon aria-hidden />
              ) : (
                <FileTextIcon aria-hidden />
              )}
            </EmptyMedia>
            <EmptyTitle className="text-body font-semibold">
              {filtered ? "No applications match" : "No applications yet"}
            </EmptyTitle>
            <EmptyDescription>
              {filtered
                ? "Try a different filter or clear them."
                : canDraft
                  ? "Use Make filings to raise an application."
                  : "Applications filed on your behalf show here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
          <ApplicationsTable
            rows={rows}
            onOpen={setRecordOpen}
            recentId={recentId}
            recentRowRef={recentRowRef}
          />
      )}

      <ApplicationRecordDialog
        caseId={record.id}
        record={record}
        application={openApplication}
        onOpenLinked={setRecordOpen}
        onAct={(application) => {
          // The record steps aside for the signing or payment dialog.
          openedHere.current = false;
          setRecordOpen(null);
          if (application.step === "sign") sign([application]);
          else act([application]);
        }}
        onEdit={(application) => {
          openedHere.current = false;
          setRecordOpen(null);
          edit(application);
        }}
        onObject={(applicationId) => {
          openedHere.current = false;
          setRecordOpen(null);
          object(applicationId);
        }}
        onOpenChange={(open) => {
          if (open) return;
          if (recordOpen && !openedHere.current) markRecent(recordOpen);
          openedHere.current = false;
          setRecordOpen(null);
        }}
      />
      <SignReviewDialog
        record={record}
        applications={reviewing}
        onOpenChange={(open) => {
          if (!open) setReviewing([]);
        }}
        onSign={(applications) => {
          setReviewing([]);
          sign(applications);
        }}
        onEdit={(application) => {
          setReviewing([]);
          edit(application);
        }}
      />
      <SignAndPayDialogs
        caseId={record.id}
        items={register.applications}
        signing={signing}
        onSigningChange={setSigning}
        paying={paying}
        onPayingChange={setPaying}
        onBack={(batch) => {
          if (batch.length === 1) setRecordOpen(batch[0].id);
          else setReviewing(batch);
        }}
      />
      {formFor ? (
        <RaiseApplicationForm
          key={formFor.key}
          record={record}
          resume={formFor.resume ?? null}
          objectTo={formFor.objectTo}
          inPlace={{ onClose: () => setFormFor(null) }}
        />
      ) : null}
    </ApplicationsPanel>
  );
}

/**
 * Everything this viewer may see filed on the case, with this visit's steps
 * applied: the applications for this tab, the memos and affidavits for
 * Documents. One source, so a step taken on either tab shows on both.
 */
export function useFilingsRegister(record: CaseRecord) {
  const { profileRole, accountName } = useProfile();
  /* On the court's case page the reader is the court, whoever the demo
     profile says is signed in on the advocate side. */
  const court = useCaseReader() === "court";
  /* Signing and paying move a filing on for this visit (demo-session.ts):
     it holds across tabs and pages, and a refresh restores every scenario. */
  const movesRaw = useSessionValue(movesKey(record.id));
  const moves = useMemo(() => parseMoves(movesRaw), [movesRaw]);
  const viewer = useMemo<ApplicationViewer | null>(() => {
    if (court) return { role: "court", side: "complainant" };
    try {
      return resolveApplicationViewer({
        file: applicationsFile(record),
        profile: profileRole,
        accountName,
        isSignedInAdvocate: isViewer,
        fallbackSide: viewerRepresentation(record)[0] ?? "complainant",
      });
    } catch {
      return null;
    }
  }, [record, profileRole, accountName, court]);
  /* What the Raise application form filed during this visit. */
  const savedRaw = useSessionValue(savedDraftsKey(record.id));
  /* What Submit documents filed during this visit, one row per document. */
  const savedDocumentsRaw = useSessionValue(savedDocumentSubmissionsKey(record.id));
  const saved = useMemo(
    () => [
      /* The court's own go on the Documents tab directly, not through the
         parties' filings. */
      ...parseSavedDocumentSubmissions(savedDocumentsRaw)
        .filter((item) => !item.byCourt)
        .flatMap(savedDocumentRows),
      ...parseSavedDrafts(savedRaw).map(savedDraftSubmission),
    ],
    [savedRaw, savedDocumentsRaw]
  );
  const register = useMemo(() => {
    try {
      return applicationsRegister(record, {
        viewer,
        today: FIXTURE_TODAY,
        moves,
        saved,
      });
    } catch {
      return null;
    }
  }, [record, viewer, moves, saved]);
  return { viewer, register };
}

/**
 * Signing and paying, shared by Applications and Documents: the same signing
 * flow as Add witness and Add power of attorney, one signature for the whole
 * batch, then the court fee. Each step moves the filing on for this visit.
 * Paid means submitted (ALC-01): an application goes to the court's review;
 * an objection, a memo or an affidavit ends at Submitted.
 */
export function SignAndPayDialogs({
  caseId,
  items,
  signing,
  onSigningChange,
  paying,
  onPayingChange,
  onBack,
}: {
  caseId: string;
  /** The rows the batch is drawn from, to look each one up when it moves. */
  items: ApplicationRecord[];
  signing: ApplicationRecord[];
  onSigningChange: (next: ApplicationRecord[]) => void;
  paying: ApplicationRecord[];
  onPayingChange: (next: ApplicationRecord[]) => void;
  /** Back from the signing step: reopen what was being read (owner, Oct 8:
   *  Back closed everything). */
  onBack?: (batch: ApplicationRecord[]) => void;
}) {
  /* What is being signed, kept past the close: the dialog's wording
     otherwise flips to "Application signed" as it animates out. */
  const [signed, setSigned] = useState<ApplicationRecord[]>(signing);
  if (signing.length > 0 && signing !== signed) setSigned(signing);
  const count = signed.length;
  const noun = filingNoun(signed);
  /* A document never pays (DSB-19): signed is submitted, onto the record. */
  const documents =
    signed.length > 0 && signed.every((item) => item.source.kind === "document");

  function move(ids: string[], next: (item: ApplicationRecord) => ApplicationMove) {
    /* Read fresh, not from this render: signing then paying writes twice
       before the list re-renders. */
    const key = movesKey(caseId);
    const updated = new Map(parseMoves(readSessionValue(key)));
    for (const id of ids) {
      const item = items.find((entry) => entry.id === id);
      if (item) updated.set(id, next(item));
    }
    writeSessionValue(key, JSON.stringify([...updated]));
  }

  return (
    <>
      {documents ? (
        /* A document signs in e-filing's model and never pays: signed is
           submitted (DSB-19; PM, Oct 26). */
        <DocumentSignatureDialog
          open={signing.length > 0}
          count={count}
          onBack={() => {
            const batch = signing;
            onSigningChange([]);
            onBack?.(batch);
          }}
          onComplete={() => {
            move(
              signing.map((item) => item.id),
              () => ({ status: "submitted", submittedOn: FIXTURE_TODAY })
            );
            onSigningChange([]);
          }}
        />
      ) : (
      <PartySignatureDialog
        open={signing.length > 0}
        onClose={() => onSigningChange([])}
        onBack={
          onBack
            ? () => {
                const batch = signing;
                onSigningChange([]);
                onBack(batch);
              }
            : undefined
        }
        onComplete={() => {
          move(
            signing.map((item) => item.id),
            () => ({ status: "pending-payment" })
          );
          onSigningChange([]);
        }}
        chooseTitle={
          count > 1
            ? `How are these ${count} ${noun} signed?`
            : `How is this ${noun} signed?`
        }
        noun={filingNoun(signed, 1)}
        submitLabel="Submit signed copy"
        /* Signed goes on to the fee, as it does from the Raise application
           form; only an advocate or party in person signs, and both may pay
           (owner, Sept 24: signing stopped short of payment here). */
        proceed={{
          label: "Proceed to payment",
          laterLabel: "Pay later",
          onClick: () => {
            const batch = signing;
            move(
              batch.map((item) => item.id),
              () => ({ status: "pending-payment" })
            );
            onSigningChange([]);
            onPayingChange(batch);
          },
        }}
        confirmation={
          count > 1
            ? {
                title: `${count} ${noun} signed`,
                description: "Pay the court fee to submit them to the court.",
              }
            : {
                title: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} signed`,
                description: "Pay the court fee to submit it to the court.",
              }
        }
      />
      )}
      <ApplicationPaymentDialog
        applications={paying}
        onOpenChange={(open) => {
          if (!open) onPayingChange([]);
        }}
        onPaid={(ids) =>
          move(ids, (item) => ({
            status: submittedStatusFor(item),
            submittedOn: FIXTURE_TODAY,
          }))
        }
      />
    </>
  );
}

/** Where a filing lands once paid: the court's review, or for anything the
 *  court never decides on its own (an objection, an affidavit), Submitted. */
function submittedStatusFor(item: ApplicationRecord): FilingStatus {
  return item.source.kind === "document" || item.source.type === "objection"
    ? "submitted"
    : "pending-review";
}

export function ApplicationsLoading() {
  return (
    <ApplicationsPanel busy>
      <span className="sr-only" role="status">
        Loading applications
      </span>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </ApplicationsPanel>
  );
}

function ApplicationsPanel({
  search,
  busy,
  children,
}: {
  search?: ReactNode;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <RestingCard>
      <CardContent className="flex flex-col gap-4" aria-busy={busy}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-body font-semibold text-foreground">
            Applications
          </h2>
          {search}
        </div>
        {children}
      </CardContent>
    </RestingCard>
  );
}

/**
 * What still needs a step from the viewer (APP-05, §9.2). A sunken well with
 * plain rows: the same surfaces as the rest of the page, so it reads as a
 * short to-do list rather than a warning. The only colour is the status badge.
 */
export function NeedsAction({
  caseId,
  entries,
  onAct,
  onObject = () => {},
  onOpen,
}: {
  caseId: string;
  entries: ActionEntry[];
  onAct: (applications: ApplicationRecord[]) => void;
  /** Only Applications has File objection tasks. */
  onObject?: (applicationId: string) => void;
  onOpen: (id: string) => void;
}) {
  const count = entries.reduce(
    (sum, entry) =>
      sum + (entry.kind === "group" ? entry.applications.length : 1),
    0
  );
  const tray = useOneOpen<string>();
  return (
    <section
      aria-labelledby="applications-needs-action"
      className="flex flex-col gap-2 rounded-xl bg-surface-sunken p-3"
    >
      <div className="flex items-center gap-2 px-1 pb-0.5">
        <h3
          id="applications-needs-action"
          className="text-body-compact font-semibold text-foreground"
        >
          Needs attention
        </h3>
        <Badge variant="secondary" className="tabular-nums">
          {count}
        </Badge>
      </div>
      {/* Under a finger held upright: tray cards, the step waiting under the
          card it belongs to. Rows with their button always showing stacked
          into a column of buttons (owner, Sept 21). */}
      <ul className={cn("flex flex-col gap-2", REGISTER_CARDS_ONLY)}>
        {entries.map((entry) => (
          <li key={entry.key}>
            {entry.kind === "single" ? (
              <TouchActionCard
                caseId={caseId}
                application={entry.application}
                open={tray.isOpen(entry.key)}
                onOpenChange={tray.toggle(entry.key)}
                onAct={onAct}
                onOpen={onOpen}
              />
            ) : entry.kind === "group" ? (
              <TouchActionGroup
                entry={entry}
                open={tray.isOpen(entry.key)}
                onOpenChange={tray.toggle(entry.key)}
                onAct={onAct}
                onOpen={onOpen}
              />
            ) : (
              <TouchObjectionCard
                task={entry.task}
                open={tray.isOpen(entry.key)}
                onOpenChange={tray.toggle(entry.key)}
                onOpen={onOpen}
                onObject={onObject}
              />
            )}
          </li>
        ))}
      </ul>
      <ul className={cn("flex-col gap-2", REGISTER_TABLE_ONLY, "md:pointer-fine:flex md:landscape:flex")}>
        {entries.map((entry) => (
          <li key={entry.key} className="rounded-lg bg-card shadow-raised">
            {entry.kind === "single" ? (
              <ActionRow
                caseId={caseId}
                application={entry.application}
                onAct={onAct}
                onOpen={onOpen}
              />
            ) : entry.kind === "group" ? (
              <ActionGroup
                caseId={caseId}
                entry={entry}
                onAct={onAct}
                onOpen={onOpen}
              />
            ) : (
              <ObjectionRow
                task={entry.task}
                onOpen={onOpen}
                onObject={onObject}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEP_COPY = {
  continue: "Continue draft",
  sign: "Add signature",
  pay: "Complete payment",
} as const;

/**
 * "(expires in 2 days)", only inside the notice window. Muted like the rest
 * of the line, never amber: amber in this list is a court deadline (an
 * objection), and an expiry is the lower priority (owner, Sept 24).
 */
/**
 * A card's title with its status beside it rather than on a row of its own:
 * the badge was a whole line of height for one word (owner, Sept 24).
 */
function CardTitle({
  label,
  badge,
}: {
  label: string;
  badge?: ReactNode;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{label}</span>
      {badge}
    </span>
  );
}

function whenIn(days: number): string {
  return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

/** Muted, with the clock the objection's amber line carries, and no brackets:
 *  it is a deadline, just the lower one (owner, Sept 24). */
function ExpiryNote({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap tabular-nums">
      <ClockIcon className="size-3.5 shrink-0" aria-hidden />
      {text}
    </span>
  );
}

function expiryText(application: ApplicationRecord): string | null {
  if (!expiringSoon(application)) return null;
  return `Expires ${whenIn(application.expiresInDays!)}`;
}

function groupExpiryText(applications: ApplicationRecord[]): string | null {
  const soon = applications.filter(expiringSoon);
  if (soon.length === 0) return null;
  if (soon.length > 1) {
    return `${soon.length} expire within ${EXPIRY_NOTICE_DAYS} days`;
  }
  return `1 expires ${whenIn(soon[0].expiresInDays!)}`;
}

/** Who raised it, when the list is not only the viewer's own filings. */
function filedLine(application: ApplicationRecord): string {
  return application.draftedBy
    ? `${application.filedBy} · Drafted by ${application.draftedBy}`
    : application.filedBy;
}

/** What the step's button does: every step opens over this tab. */
function StepAction({
  application,
  onAct,
}: {
  caseId: string;
  application: ApplicationRecord;
  onAct: (applications: ApplicationRecord[]) => void;
}) {
  if (!application.step) return null;
  /* Every step, a draft's too, opens over the tab it is on (`onAct`), so
     the page under the dialog never changes. */
  const step = STEP_COPY[application.step];
  return (
    <Button type="button" onClick={() => onAct([application])}>
      {step}
    </Button>
  );
}

function TouchActionCard({
  caseId,
  application,
  open,
  onOpenChange,
  onAct,
  onOpen,
  nested = false,
}: {
  caseId: string;
  application: ApplicationRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAct: (applications: ApplicationRecord[]) => void;
  onOpen: (id: string) => void;
  nested?: boolean;
}) {
  return (
    <RegisterTrayCard
      title={
        <CardTitle
          label={application.name}
          badge={
            nested ? null : (
              <Badge variant={application.statusVariant}>
                {application.statusLabel}
              </Badge>
            )
          }
        />
      }
      open={open}
      onOpenChange={onOpenChange}
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpen(application.id)}
          >
            View
          </Button>
          <StepAction caseId={caseId} application={application} onAct={onAct} />
        </>
      }
    >
      {/* Two caption lines, 4px apart: who, then when. The clock is the
          separator on the second line, so it can wrap without stranding a
          middot (owner, Sept 24). Short dates keep it to one line. */}
      <div className="-mt-1 flex flex-col gap-1 text-caption font-normal text-muted-foreground">
        <span>{filedLine(application)}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
          <span>Created {application.createdShort}</span>
          {expiryText(application) ? (
            <ExpiryNote text={expiryText(application)!} />
          ) : null}
        </span>
      </div>
    </RegisterTrayCard>
  );
}

function groupTitle(
  entry: Extract<ActionEntry, { kind: "group" }>
): string {
  const count = entry.applications.length;
  const noun = filingNoun(entry.applications);
  return entry.step === "sign"
    ? `${count} ${noun} need a signature`
    : `${count} ${noun} need payment`;
}

/**
 * A group on a touch screen (owner, Sept 24): tapping the card slides its tray
 * out from under it, and the tray holds the group. Each member is a small
 * white card with its own View and step; the group's one action (Sign all,
 * Pay all) sits under the last of them. The members live inside the group's
 * own tray, so they read as the group's, not as more cards in the list; there
 * is no separate Show each / Hide each.
 */
function TouchActionGroup({
  entry,
  open,
  onOpenChange,
  onAct,
  onOpen,
}: {
  entry: Extract<ActionEntry, { kind: "group" }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAct: (applications: ApplicationRecord[]) => void;
  onOpen: (id: string) => void;
}) {
  const [lead] = entry.applications;
  const count = entry.applications.length;
  const signing = entry.step === "sign";
  /* Bulk signing is only for a filer with the tool set up; everyone else
     signs each on its own card. */
  const bulk = !signing || HAS_BULK_SIGNING_TOOL;

  return (
    <RegisterTrayCard
      title={
        <CardTitle
          label={groupTitle(entry)}
          badge={
            <>
              <Badge variant={lead.statusVariant}>{lead.statusLabel}</Badge>
              {groupExpiryText(entry.applications) ? (
                <span className="text-caption font-normal text-muted-foreground">
                  <ExpiryNote text={groupExpiryText(entry.applications)!} />
                </span>
              ) : null}
            </>
          }
        />
      }
      open={open}
      onOpenChange={onOpenChange}
      tray={
        <>
          <ul className="flex flex-col gap-2" aria-label={groupTitle(entry)}>
            {entry.applications.map((application) => (
              <li key={application.id}>
                <GroupMemberCard
                  application={application}
                  onAct={onAct}
                  onOpen={onOpen}
                />
              </li>
            ))}
          </ul>
          {bulk ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => onAct(entry.applications)}
            >
              {signing ? `Sign all ${count}` : `Pay all ${count}`}
            </Button>
          ) : null}
        </>
      }
    >
    </RegisterTrayCard>
  );
}

/** One application inside a group's tray: what it is, and its two ways in. */
function GroupMemberCard({
  application,
  onAct,
  onOpen,
}: {
  application: ApplicationRecord;
  onAct: (applications: ApplicationRecord[]) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-card p-3">
      <div className="flex flex-col gap-1">
        <p className="text-body-compact font-semibold text-foreground">
          {application.name}
        </p>
        <div className="flex flex-col gap-1 text-caption font-normal text-muted-foreground">
          <span>{filedLine(application)}</span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
            <span>Created {application.createdShort}</span>
            {expiryText(application) ? (
              <ExpiryNote text={expiryText(application)!} />
            ) : null}
          </span>
        </div>
      </div>
      <div className="flex gap-2 [&>*]:flex-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpen(application.id)}
        >
          View<span className="sr-only">: {application.typeLabel}</span>
        </Button>
        {application.step && application.step !== "continue" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => onAct([application])}
          >
            {STEP_COPY[application.step]}
            <span className="sr-only">: {application.typeLabel}</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ActionRow({
  application,
  onAct,
  onOpen,
  nested = false,
}: {
  caseId: string;
  application: ApplicationRecord;
  onAct: (applications: ApplicationRecord[]) => void;
  onOpen: (id: string) => void;
  /** Inside a group the status is already said once, on the group. */
  nested?: boolean;
}) {
  const step = application.step ? STEP_COPY[application.step] : null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1 max-sm:basis-full">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(application.id)}
            className="rounded-sm text-left text-body-compact font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {application.name}
          </button>
          {nested ? null : (
            <Badge variant={application.statusVariant}>
              {application.statusLabel}
            </Badge>
          )}
        </div>
        {/* Who and when, at a note's weight; only the deadline keeps medium
            (owner, Oct 8). */}
        <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-caption font-normal text-muted-foreground">
          <span>{`${filedLine(application)} ·`}</span>
          <span className="tabular-nums">Created {application.created}</span>
          {expiryText(application) ? (
            <>
              <span aria-hidden>·</span>
              <ExpiryNote text={expiryText(application)!} />
            </>
          ) : null}
        </p>
      </div>
      {step ? (
          <Button
            type="button"
            variant={nested ? "ghost" : "outline"}
            size="sm"
            className="max-sm:h-10"
            onClick={() => onAct([application])}
          >
            {step}
            <span className="sr-only">: {application.typeLabel}</span>
          </Button>
      ) : null}
    </div>
  );
}

/** Same step: one entry, one action, with each application still open to
 *  being handled alone (APP-09 to APP-11). */
function ActionGroup({
  caseId,
  entry,
  onAct,
  onOpen,
}: {
  caseId: string;
  entry: Extract<ActionEntry, { kind: "group" }>;
  onAct: (applications: ApplicationRecord[]) => void;
  onOpen: (id: string) => void;
}) {
  const [lead] = entry.applications;
  const signing = entry.step === "sign";
  /* Bulk signing is only for a filer with the tool set up; everyone else signs
     one at a time, so the list opens and the bulk button is not offered. */
  const bulk = !signing || HAS_BULK_SIGNING_TOOL;

  return (
    <Collapsible defaultOpen={!bulk}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 max-sm:basis-full">
          <p className="text-body-compact font-medium text-foreground">
            {groupTitle(entry)}
          </p>
          <Badge variant={lead.statusVariant}>{lead.statusLabel}</Badge>
          {groupExpiryText(entry.applications) ? (
            <span className="text-caption font-medium text-muted-foreground">
              <ExpiryNote text={groupExpiryText(entry.applications)!} />
            </span>
          ) : null}
        </div>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="group/expand max-sm:h-10"
          >
            <span className="group-aria-expanded/expand:hidden">Show all</span>
            <span className="hidden group-aria-expanded/expand:inline">
              Hide
            </span>
            <ChevronDownIcon
              data-icon="inline-end"
              aria-hidden
              className="transition-transform group-aria-expanded/expand:rotate-180"
            />
          </Button>
        </CollapsibleTrigger>
        {bulk ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-sm:h-10"
            onClick={() => onAct(entry.applications)}
          >
            {signing ? "Sign all" : "Pay all"}
          </Button>
        ) : null}
      </div>
      <CollapsibleContent className={COLLAPSE_MOTION}>
        <ul className="border-t border-hairline">
          {entry.applications.map((application) => (
            <li
              key={application.id}
              className="border-b border-hairline last:border-b-0"
            >
              <ActionRow
                caseId={caseId}
                application={application}
                onAct={onAct}
                onOpen={onOpen}
                nested
              />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The File objection task (PRD citizen-side task, ALC-12). The other side's
 * application, the court's date, and the last day to object: midnight the
 * day before (ALC-13). Filing nothing has no consequence, so the row is a
 * plain to-do, not a warning.
 */
function objectionTitle(task: ObjectionTask): string {
  /* "Others" names no ask ("object to others"); the filer's own title
     does, quoted as typed. */
  const { application } = task;
  const type =
    quotedOthersTitle(application.source) ??
    application.typeLabel.toLowerCase();
  /* A litigant or PoA holder is told, not tasked: their advocate files it
     (owner, Sept 24). */
  return task.canFile
    ? `File objection to ${type}`
    : `Your advocate can object to ${type}`;
}

function objectionLine(task: ObjectionTask): string {
  const { application } = task;
  const side = application.side === "accused" ? "the accused" : "the complainant";
  const number = applicationNumberLabel(application);
  return `${number ? `${number} · ` : ""}Filed by ${side}`;
}

/**
 * When the objection is due, the way Pending tasks words a due date: relative
 * first, the date in brackets. The PRD gives Needs attention one deadline, the
 * objection's (midnight the day before the decision, ALC-13); the drafts and
 * unsigned or unpaid filings expire on a timer it does not specify, so they
 * carry none. Two days out or less it turns to warning ink with a clock, the
 * rule the Filings dashboard already uses for "File by". It is never overdue:
 * the task closes when the date passes.
 */
function ObjectionDue({ task }: { task: ObjectionTask }) {
  const days = Math.round(
    (Date.parse(`${task.dueOn}T00:00:00Z`) -
      Date.parse(`${FIXTURE_TODAY}T00:00:00Z`)) /
      86_400_000
  );
  const when =
    days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  /* Amber marks a deadline this reader has to meet; a reminder of their
     advocate's stays muted. */
  const urgent = task.canFile && days <= 2;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium whitespace-nowrap tabular-nums",
        urgent && "font-medium text-warning-ink"
      )}
    >
      {urgent ? <ClockIcon className="size-3.5 shrink-0" aria-hidden /> : null}
      {task.canFile ? "Object" : "Due"} {when}, by {task.due}
    </span>
  );
}

function ObjectionRow({
  task,
  onOpen,
  onObject,
}: {
  task: ObjectionTask;
  onOpen: (id: string) => void;
  onObject: (applicationId: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1 max-sm:basis-full">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(task.application.id)}
            className="rounded-sm text-left text-body-compact font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {objectionTitle(task)}
          </button>
        </div>
        <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-caption font-normal text-muted-foreground tabular-nums">
          <span>{objectionLine(task)} ·</span>
          <ObjectionDue task={task} />
        </p>
      </div>
      {task.canFile ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-sm:h-10"
          onClick={() => onObject(task.application.id)}
        >
          File objection
          <span className="sr-only">: {task.application.typeLabel}</span>
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-sm:h-10"
          onClick={() => onOpen(task.application.id)}
        >
          View
          <span className="sr-only">: {task.application.typeLabel}</span>
        </Button>
      )}
    </div>
  );
}

function TouchObjectionCard({
  task,
  open,
  onOpenChange,
  onOpen,
  onObject,
}: {
  task: ObjectionTask;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: (id: string) => void;
  onObject: (applicationId: string) => void;
}) {
  return (
    <RegisterTrayCard
      title={objectionTitle(task)}
      open={open}
      onOpenChange={onOpenChange}
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpen(task.application.id)}
          >
            View
          </Button>
          {task.canFile ? (
            <Button
              type="button"
              onClick={() => onObject(task.application.id)}
            >
              File objection
            </Button>
          ) : null}
        </>
      }
    >
      <div className="-mt-1 flex flex-col items-start gap-1 text-caption font-normal text-muted-foreground tabular-nums">
        <span>{objectionLine(task)}</span>
        <ObjectionDue task={task} />
      </div>
    </RegisterTrayCard>
  );
}

/**
 * The one line under a status that says what it means for this reader: the
 * court's date for a decision still to come, or whose step a filing is
 * waiting on. Nothing when the badge says it all.
 */
function statusNote(item: ApplicationRecord): string | undefined {
  if (item.waitingOn) return sideNote(item.waitingOn);
  /* The other side's application the viewer may still object to: the date
     that matters to them is the objection's, not the decision's. */
  if (item.objectionInvite) {
    return `Object by ${item.objectionInvite.dueShort}`;
  }
  if (item.status === "pending-decision" && item.decisionShort) {
    return `Decision on ${item.decisionShort}`;
  }
  return undefined;
}

/**
 * Every side note in this register is a plain muted line, no brackets (owner,
 * Oct 8; they were bracketed from Sept 24): "Temporary", "Drafted by Vinod
 * Kumar", "Waiting for Anjali Nair to sign". Inline, a middot parts it.
 */
function sideNote(note: string): string {
  return `${note.charAt(0).toUpperCase()}${note.slice(1)}`;
}

/**
 * For an objection row: what it objects to, so the viewer's own objections
 * and the other side's read apart at a glance (owner, Sept 24).
 */
function objectionTarget(item: ApplicationRecord): string | null {
  if (!item.objectionTo) return null;
  const target = item.objectionTo.number ?? item.objectionTo.typeLabel;
  return `Objects to ${target}`;
}

/**
 * A date never breaks; a note carrying a name may wrap, since names run long
 * and the 64px row has room for a second caption line (owner, Sept 24).
 */
function noteClass(keepWhole = false): string {
  return cn(
    /* The Type column's subline weight: a note, never a second label
       (owner, Oct 8). The cells around it are medium, so it says normal. */
    "text-caption font-normal text-muted-foreground tabular-nums",
    keepWhole && "whitespace-nowrap"
  );
}

/**
 * Whether the row's ID is a stand-in for a number still to come. Only while
 * the court has yet to take it up: an objection, an affidavit or a dismissed
 * application never gets a court number, so for them the ID is simply
 * theirs and calling it temporary would promise a number that never comes.
 */
function awaitingNumber(item: ApplicationRecord): boolean {
  return item.status === "pending-review";
}

/**
 * The number column. The court's number once the application is onboarded;
 * before that the temporary identifier (ALC-02), marked as temporary so it
 * is not mistaken for the number to cite. Drafts have neither.
 */
function ApplicationNumber({
  item,
  copyable = true,
}: {
  item: ApplicationRecord;
  copyable?: boolean;
}) {
  if (item.applicationNumber) {
    return (
      <Identifier
        value={item.applicationNumber}
        label="application number"
        copyable={copyable}
      />
    );
  }
  if (item.temporaryId) {
    return awaitingNumber(item) ? (
      /* Marked temporary on its own muted line under the ID, never beside
         it (owner, Sept 24; brackets dropped Oct 8). */
      <span className="flex flex-col gap-0.5">
        <Identifier
          value={item.temporaryId}
          label="temporary ID"
          copyable={copyable}
        />
        <span className="font-normal text-muted-foreground">Temporary</span>
      </span>
    ) : (
      <Identifier value={item.temporaryId} label="ID" copyable={copyable} />
    );
  }
  return <Dash label="Not allotted" />;
}

function ApplicationsTable({
  rows,
  onOpen,
  recentId,
  recentRowRef,
}: {
  rows: ApplicationRecord[];
  onOpen: (id: string) => void;
  recentId: string | null;
  recentRowRef: (node: HTMLTableRowElement | null) => void;
}) {
  const tray = useOneOpen<string>();
  return (
    <>
    <ul className={cn("flex flex-col gap-3", REGISTER_CARDS_ONLY)}>
      {rows.map((item) => {
        const note = statusNote(item);
        return (
        <li key={item.id}>
          <RegisterTrayCard
            title={
              <CardTitle
                label={item.name}
                badge={
                  <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
                }
              />
            }
            open={tray.isOpen(item.id)}
            onOpenChange={tray.toggle(item.id)}
            className={cn(recentId === item.id && RECENT_ROW)}
            actions={
              <Button type="button" onClick={() => onOpen(item.id)}>
                View application
              </Button>
            }
          >
            <p className="-mt-2 text-caption text-muted-foreground">
              {item.applicationNumber ? (
                <Identifier
                  value={item.applicationNumber}
                  label="application number"
                  copyable={false}
                />
              ) : item.temporaryId ? (
                <>
                  <Identifier
                    value={item.temporaryId}
                    label="temporary ID"
                    copyable={false}
                  />
                  {awaitingNumber(item) ? " · Temporary" : null}
                </>
              ) : objectionTarget(item) ? null : (
                /* An objection never gets a court number; its line says what
                   it objects to instead. */
                "Number not allotted yet"
              )}
              {objectionTarget(item)
                ? `${item.temporaryId ? " · " : ""}${objectionTarget(item)}`
                : null}
            </p>
            {note ? (
              <span className={cn("-mt-2", noteClass(!item.waitingOn))}>
                {note}
              </span>
            ) : null}
            <div className="flex flex-col gap-1 border-t border-hairline pt-3">
              <p className="text-body-compact text-foreground">
                {item.filedBy}
                {item.fromOtherSide ? (
                  <span className="text-caption text-muted-foreground">
                    {` · ${applicationSideLabel(item.side)}`}
                  </span>
                ) : null}
                {item.draftedBy ? (
                  <span className="text-caption text-muted-foreground">
                    {` · Drafted by ${item.draftedBy}`}
                  </span>
                ) : null}
              </p>
              <p className="text-caption tabular-nums text-muted-foreground">
                Created {item.createdShort}
                {item.submittedShort ? ` · Submitted ${item.submittedShort}` : ""}
              </p>
            </div>
          </RegisterTrayCard>
        </li>
        );
      })}
    </ul>
    <div className={REGISTER_TABLE_ONLY}>
    <Table>
      <TableHeader>
        <TableRow className={TABLE_HEAD_ROW}>
          <TableHead className={TABLE_HEAD}>Type</TableHead>
          <TableHead className={TABLE_HEAD}>Number</TableHead>
          <TableHead className={TABLE_HEAD}>Status</TableHead>
          <TableHead className={TABLE_HEAD}>Filed by</TableHead>
          <TableHead className={TABLE_HEAD}>Created on</TableHead>
          <TableHead className={TABLE_HEAD}>Submitted on</TableHead>
          <TableHead className={TABLE_HEAD}>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className={tableBodyClass()}>
        {rows.map((item) => {
          const note = statusNote(item);
          return (
          <TableRow
            key={item.id}
            ref={recentId === item.id ? recentRowRef : undefined}
            className={cn(
              tableRowClass(),
              "cursor-pointer",
              recentId === item.id && RECENT_ROW
            )}
            onClick={() => onOpen(item.id)}
          >
            <TableCell
              className={cn(TABLE_CELL, "font-medium whitespace-normal")}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span>{item.typeLabel}</span>
                {/* Others names no ask; the filer's own title does. One
                    line, so the row keeps its height; the detail view's
                    heading has it whole. */}
                {item.ownTitle ? (
                  <span
                    /* w-0 + min-w-full: fills the column without
                       widening it, so the other columns keep their room. */
                    className="w-0 min-w-full truncate text-caption font-normal text-muted-foreground"
                    title={item.ownTitle}
                  >
                    {item.ownTitle}
                  </span>
                ) : null}
                {objectionTarget(item) ? (
                  <span className="text-caption font-normal text-muted-foreground">
                    {objectionTarget(item)}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell
              className={cn(TABLE_CELL, "text-caption text-muted-foreground")}
            >
              <ApplicationNumber item={item} />
            </TableCell>
            <TableCell className={cn(TABLE_CELL, "whitespace-normal")}>
              <span className="flex flex-col items-start gap-0.5">
                <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
                {note ? (
                  <span className={noteClass(!item.waitingOn)}>{note}</span>
                ) : null}
              </span>
            </TableCell>
            <TableCell className={cn(TABLE_CELL, "min-w-40 whitespace-normal")}>
              {/* Raised by the signer; a clerk's draft says whose it is, so
                  the advocate can find their office's drafts (PRD "view own
                  and associated drafts"). */}
              <span className="flex flex-col gap-0.5">
                <span>{item.filedBy}</span>
                {/* Only the opponent is marked: the viewer knows their own side,
                    and the other side's drafts never reach them (owner, Sept 24). */}
                {item.fromOtherSide ? (
                  <span className={noteClass()}>
                    {applicationSideLabel(item.side)}
                  </span>
                ) : null}
                {item.draftedBy ? (
                  <span className={noteClass()}>
                    {`Drafted by ${item.draftedBy}`}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell className={cn(TABLE_CELL, "tabular-nums")}>
              {item.createdShort}
            </TableCell>
            <TableCell className={cn(TABLE_CELL, "tabular-nums")}>
              {item.submittedShort ?? <Dash label="Not submitted" />}
            </TableCell>
            <TableCell className={TABLE_CELL}>
              {/* View on every row: the table is for finding and opening. The
                  step is taken from the record, after reading it (owner,
                  Sept 24); Needs attention stays the shortcut. */}
              <RowViewButton
                label={item.name}
                onClick={() => onOpen(item.id)}
              />
            </TableCell>
          </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
    </>
  );
}

function Dash({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden className="text-muted-foreground">
        —
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}
