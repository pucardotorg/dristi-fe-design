"use client";

/**
 * Preview — everything the filing contains, twice over.
 *
 * "Synopsis" is the readable summary, one card per section, each with a Review control
 * that takes you to that section to change it. "Court document" is the same filing as the
 * court will receive it (shared with Sign — see ./preview/court-document).
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PencilLineIcon,
  PrinterIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { joinDot } from "@/lib/filing/format";
import { CASE_TYPE, COURT } from "@/lib/filing/options";
import { useProfile } from "@/lib/filing/profile";
import { sectionComplete, signatories } from "@/lib/filing/selectors";
import { neighbours, type StepId } from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import type { FilingDraft } from "@/lib/filing/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Dialog } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilingFooter } from "@/components/filing/filing-footer";
import { FilingPageHeader } from "@/components/filing/filing-page-header";
import { FilingMain } from "@/components/filing/filing-shell";
import { FormCard } from "@/components/filing/form-card";
import { CourtDocument } from "@/components/filing/sections/preview/court-document";
import {
  INTERIM_RELIEF_SUMMARY,
  NOT_PROVIDED,
  accusedSummaries,
  adrLabel,
  advocateSummaries,
  amountClaimedText,
  chequeSummaries,
  complainantSummary,
  documentSummary,
  finalReliefSummary,
  jurisdictionSummary,
  noticeSummary,
  totalChequeText,
  witnessSummaries,
} from "@/components/filing/sections/preview/derive";
import { useCourtText } from "@/components/court/court-provider";

/* ───────────────────────────── Key-value rows ──────────────────────── */

type Row = { term: string; value: React.ReactNode };

function KeyValues({ rows }: { rows: Row[] }) {
  return (
    <DescriptionList>
      {rows.map((r, i) => (
        /* Phone: the label over its value, the way every fact on a phone card reads in
           this product. Side by side, a 7rem label column left an address five lines
           of a 150px column. From `sm` up the two columns stand as designed. */
        <DescriptionRow
          key={`${r.term}-${i}`}
          className="max-sm:grid-cols-1 max-sm:gap-0.5 max-sm:border-hairline max-sm:py-2.5"
        >
          <DescriptionTerm className="text-body-compact text-muted-foreground max-sm:text-caption">
            {r.term}
          </DescriptionTerm>
          <DescriptionDetails className="text-body-compact font-medium text-foreground tabular-nums">
            {r.value}
          </DescriptionDetails>
        </DescriptionRow>
      ))}
    </DescriptionList>
  );
}

/** A named sub-record inside a card — "Advocate 1", "Cheque 2". */
function SubBlock({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-caption font-medium text-muted-foreground">{title}</p>
      <KeyValues rows={rows} />
    </div>
  );
}

/** Opens the read-only panel for a section. Changing anything happens in the section. */
function ReviewButton({ section, onClick }: { section: string; onClick: () => void }) {
  return (
    <>
      <Button type="button" variant="outline" onClick={onClick} className="max-sm:hidden">
        <PencilLineIcon data-icon="inline-start" aria-hidden />
        Review
        <span className="sr-only"> {section}</span>
      </Button>
      {/* Phone: the DS small button, so a long section title keeps its line. */}
      <Button type="button" variant="outline" size="sm" onClick={onClick} className="h-10 sm:hidden">
        <PencilLineIcon data-icon="inline-start" aria-hidden />
        Review
        <span className="sr-only"> {section}</span>
      </Button>
    </>
  );
}

/**
 * Whether a section has everything the court needs, said once per card. Only the
 * unfinished ones take colour — nine green ticks would drown the one status that matters.
 */
function SectionState({ complete }: { complete: boolean }) {
  return complete ? (
    <span className="flex items-center gap-1 text-caption font-medium text-muted-foreground">
      <CheckIcon className="size-3.5" aria-hidden />
      Complete
    </span>
  ) : (
    <span className="flex items-center gap-1 text-caption font-medium text-warning-ink">
      <TriangleAlertIcon className="size-3.5" aria-hidden />
      Incomplete
    </span>
  );
}

/** The status marker and the Review control as one action cluster in the card header. */
function CardActions({
  complete,
  section,
  onEdit,
}: {
  complete: boolean;
  section: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <SectionState complete={complete} />
      <ReviewButton section={section} onClick={onEdit} />
    </div>
  );
}

/* ───────────────────────────── Edit panel data ─────────────────────── */

/**
 * "Don't ask me again" for the Review question, kept per browser rather than per draft:
 * it is a preference about how this person works, not a fact about one complaint.
 */
const SKIP_REVIEW_PROMPT = "dristi:filing:skip-review-prompt";

function skipReviewPrompt(): boolean {
  try {
    return localStorage.getItem(SKIP_REVIEW_PROMPT) === "1";
  } catch {
    return false;
  }
}

function rememberSkipReviewPrompt(): void {
  try {
    localStorage.setItem(SKIP_REVIEW_PROMPT, "1");
  } catch {
    /* private mode — the question simply gets asked again next time */
  }
}

type PanelKey =
  | "complainant"
  | "advocate"
  | "accused"
  | "cheque"
  | "demand"
  | "jurisdiction"
  | "adr"
  | "witnesses"
  | "documents";

/** A section of the filing, as this screen names it and navigates to it. */
type EditPanel = {
  title: string;
  step: StepId;
  /** What was actually entered — rows the person has not filled are left out. */
  fields: { label: string; value: string }[];
};

/** Drop the rows that would only say "Not provided" — an empty panel says that once. */
function entered(rows: { label: string; value: string }[]) {
  return rows.filter((r) => r.value.trim() && r.value !== NOT_PROVIDED);
}

/** The panel behind each card's Edit — what was entered, beside what it was read from. */
function buildPanels(draft: FilingDraft): Record<PanelKey, EditPanel> {
  const complainant = complainantSummary(draft.complainants[0]);
  const advocates = advocateSummaries(draft);
  const accused = accusedSummaries(draft);
  const cheques = chequeSummaries(draft);
  const notice = noticeSummary(draft.notices[0]);
  const jurisdiction = jurisdictionSummary(draft);
  const witnesses = witnessSummaries(draft);
  const documents = documentSummary(draft);

  return {
    complainant: {
      title: "Complainant",
      step: "complainant",
      fields: entered([
        { label: "Name", value: complainant.name },
        { label: "Type", value: complainant.type },
        { label: "CIN or PAN", value: complainant.cinPan },
        { label: "Mobile", value: complainant.mobile },
        { label: "Email", value: complainant.email },
        { label: "Present address", value: complainant.presentAddress },
        { label: "Permanent address", value: complainant.permanentAddress },
        { label: "Power of attorney", value: complainant.poa },
      ]),
    },
    advocate: {
      title: "Advocates",
      step: "advocate",
      fields: entered(
        advocates.flatMap((a) => [
          { label: a.label, value: a.nameWithBar },
          { label: "Appearing for", value: a.appearingFor },
        ])
      ),
    },
    accused: {
      title: "Accused",
      step: "accused",
      fields: entered(
        accused.flatMap((a) => [
          { label: a.label, value: joinDot(a.name, a.type) },
          { label: "Address", value: a.address },
        ])
      ),
    },
    cheque: {
      title: "Cheque & return memo",
      step: "cheque",
      fields: entered(
        cheques.flatMap((c) => [
          { label: c.label, value: joinDot(c.amount, c.number) },
          { label: "Drawer’s bank", value: c.drawerBank },
          { label: "Returned", value: c.returned },
        ])
      ),
    },
    demand: {
      title: "Demand notice & debt",
      step: "demand-notice",
      fields: entered([
        { label: "Nature of debt", value: notice.nature },
        { label: "Dispatched", value: notice.dispatched },
        { label: "Delivered", value: notice.delivered },
        { label: "Payment received", value: notice.payment },
        // Statutory, not entered: S-138 gives the drawer 15 days from the notice.
        { label: "Demand", value: "Pay within 15 days" },
      ]),
    },
    jurisdiction: {
      title: "Jurisdiction & limitation",
      step: "jurisdiction",
      fields: entered([
        { label: "Cheque presented by", value: jurisdiction.presentedBy },
        { label: "Bank", value: jurisdiction.bank },
        { label: "IFSC", value: jurisdiction.ifsc },
        { label: "Police station", value: jurisdiction.police },
        { label: "Cause of action", value: jurisdiction.causeDate },
        { label: "Complaint filing", value: jurisdiction.filingDate },
      ]),
    },
    adr: {
      title: "ADR, other details & prayer",
      step: "adr-prayer",
      fields: entered([
        { label: "Open to settlement (ADR)", value: adrLabel(draft) },
        { label: "Interim relief", value: INTERIM_RELIEF_SUMMARY },
        { label: "Final relief", value: finalReliefSummary(draft) },
      ]),
    },
    witnesses: {
      title: "Witnesses",
      step: "witnesses",
      fields: entered(
        witnesses.flatMap((w) => [
          { label: w.label, value: w.name },
          { label: "Will prove", value: w.prove },
        ])
      ),
    },
    documents: {
      title: "Documents",
      step: "documents",
      fields: entered([
        {
          label: "Uploaded",
          value: documents.uploaded.length
            ? `${documents.uploaded.length} of ${documents.total} required documents attached`
            : "Nothing attached yet",
        },
        {
          label: "Pending",
          value: documents.remaining
            ? `${documents.remaining} required document${documents.remaining === 1 ? "" : "s"} still to upload`
            : "All required documents uploaded",
        },
      ]),
    },
  };
}

/* ───────────────────────────── Source files ────────────────────────── */

/* ───────────────────────────── Incomplete sections ─────────────────── */

/**
 * The count of what is left, which opens into the sections themselves. A count alone
 * says something is missing without saying where; each row here goes straight to that
 * section, without the Review question — naming the section is already the choice.
 */
function IncompleteSections({
  sections,
}: {
  sections: { key: string; title: string; href: string }[];
}) {
  const count = sections.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className="text-muted-foreground">
          <TriangleAlertIcon data-icon="inline-start" aria-hidden />
          {count} section{count === 1 ? "" : "s"} incomplete
          <ChevronDownIcon data-icon="inline-end" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80 gap-2 p-2">
        <PopoverHeader className="px-2 pt-2">
          <PopoverTitle className="text-body-compact font-semibold">
            Still to complete
          </PopoverTitle>
          <PopoverDescription className="text-caption">
            Open a section to finish it.
          </PopoverDescription>
        </PopoverHeader>
        <ul className="flex flex-col">
          {sections.map((s) => (
            <li key={s.key}>
              <Button
                asChild
                variant="ghost"
                className="h-10 w-full justify-start gap-2 px-2 font-normal"
              >
                <Link href={s.href}>
                  <span className="min-w-0 flex-1 truncate text-left">{s.title}</span>
                  <ChevronRightIcon aria-hidden className="text-muted-foreground" />
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/* ───────────────────────────── Screen ──────────────────────────────── */

export function PreviewSection() {
  const courtText = useCourtText();
  const { draft, hrefFor } = useFiling();
  const { prev, next } = neighbours("preview");
  const router = useRouter();
  const [view, setView] = React.useState("synopsis");
  /** The section Review was pressed on, while the question about leaving is open. */
  const [editKey, setEditKey] = React.useState<PanelKey | null>(null);
  /** Ticked in the question itself — remembered for this browser, not this draft. */
  const [dontAsk, setDontAsk] = React.useState(false);

  const complainant = complainantSummary(draft.complainants[0]);
  const advocates = advocateSummaries(draft);
  const accused = accusedSummaries(draft);
  const cheques = chequeSummaries(draft);
  const notice = noticeSummary(draft.notices[0]);
  const jurisdiction = jurisdictionSummary(draft);
  const witnesses = witnessSummaries(draft);
  const documents = documentSummary(draft);

  const panels = buildPanels(draft);
  const panel = editKey ? panels[editKey] : null;

  /**
   * **Review is a way out of this screen, so it says so before it takes you.**
   *
   * It used to open a read-only peek beside the document — a third place a section's
   * values could be read, which could not be edited and therefore always ended in
   * "Open full section" anyway (owner, 2026-09-24). Now it asks once, and a person who
   * does not want to be asked again says so in the question itself.
   */
  const goTo = React.useCallback(
    (key: PanelKey) => router.push(hrefFor(panels[key].step)),
    [router, hrefFor, panels]
  );

  const review = (key: PanelKey) => {
    if (skipReviewPrompt()) {
      goTo(key);
      return;
    }
    setDontAsk(false);
    setEditKey(key);
  };

  const confirmReview = () => {
    const key = editKey;
    if (dontAsk) rememberSkipReviewPrompt();
    setEditKey(null);
    if (key) goTo(key);
  };

  // Completeness per section, from the same rule the sidebar counts with.
  const done = (key: PanelKey) => sectionComplete(draft, panels[key].step);
  const readyToSign = sectionComplete(draft, "preview");
  // Signing as an advocate means taking the oath in the same step, so the way there says so.
  const { profile } = useProfile();
  const yourOathAhead = signatories(draft, profile).advocates.some((s) => s.you);
  const incomplete = (Object.keys(panels) as PanelKey[]).filter((k) => !done(k));

  /** The browser's print dialog — which is also how a PDF is saved. */
  const printFile = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <>
      <FilingMain>
        <FilingPageHeader
          title="Preview"
          description={
            <>
              Check everything you have filed. Use{" "}
              <strong className="font-semibold text-foreground">Review</strong> on any
              section to open it and change what it holds.
            </>
          }
        />

        <Tabs value={view} onValueChange={setView} className="gap-6">
          <div className="flex flex-col items-start justify-between gap-2 border-b border-hairline sm:flex-row sm:items-end">
            <TabsList variant="line" aria-label="Preview format" className="order-2 p-0 group-data-horizontal/tabs:h-10 sm:order-none">
              <TabsTrigger value="synopsis" className="h-10 px-3 group-data-horizontal/tabs:after:-bottom-px">Complaint</TabsTrigger>
              <TabsTrigger value="document" className="h-10 px-3 group-data-horizontal/tabs:after:-bottom-px">Complaint PDF</TabsTrigger>
            </TabsList>
            <Button type="button" variant="outline" onClick={printFile} className="sm:mb-2">
              <PrinterIcon data-icon="inline-start" aria-hidden />
              Print or save as PDF
            </Button>
          </div>

          {/* ── Synopsis ── */}
          <TabsContent value="synopsis" className="flex flex-col gap-6">
            {/* No status badge here: the card captions below say it per section, and the
                footer says it once for the filing. */}
            <FormCard title="Filing summary">
              <KeyValues
                rows={[
                  { term: "Offence", value: CASE_TYPE.offence },
                  { term: "Court", value: courtText(COURT.name) },
                  { term: "Total cheque amount", value: totalChequeText(draft) },
                  { term: "Amount claimed", value: amountClaimedText(draft) },
                ]}
              />
            </FormCard>

            <FormCard
              title="Complainant"
              action={
                <CardActions
                  complete={done("complainant")}
                  section="complainant"
                  onEdit={() => review("complainant")}
                />
              }
            >
              <KeyValues
                rows={[
                  { term: "Name", value: complainant.name },
                  { term: "Type", value: complainant.type },
                  ...(complainant.cinPan
                    ? [{ term: "CIN or PAN", value: complainant.cinPan }]
                    : []),
                  { term: "Mobile", value: complainant.mobile },
                  { term: "Email", value: complainant.email },
                  { term: "Present address", value: complainant.presentAddress },
                  { term: "Permanent address", value: complainant.permanentAddress },
                  { term: "Power of attorney", value: complainant.poa },
                ]}
              />
            </FormCard>

            <FormCard
              title="Advocates"
              action={
                <CardActions
                  complete={done("advocate")}
                  section="advocates"
                  onEdit={() => review("advocate")}
                />
              }
            >
              {advocates.length ? (
                advocates.map((a) => (
                  <SubBlock
                    key={a.key}
                    title={a.label}
                    rows={[
                      { term: "Name", value: a.name },
                      { term: "Bar registration", value: a.bar },
                      { term: "Appearing for", value: a.appearingFor },
                    ]}
                  />
                ))
              ) : (
                <p className="text-body-compact text-muted-foreground">
                  No advocate added. The complainant appears as a party in person.
                </p>
              )}
            </FormCard>

            <FormCard
              title="Accused"
              action={
                <CardActions
                  complete={done("accused")}
                  section="accused"
                  onEdit={() => review("accused")}
                />
              }
            >
              {accused.map((a) => (
                <SubBlock
                  key={a.key}
                  title={a.label}
                  rows={[
                    { term: "Name", value: a.name },
                    { term: "Type", value: a.type },
                    { term: "Address", value: a.addressWithPolice },
                  ]}
                />
              ))}
            </FormCard>

            <FormCard
              title="Cheque & return memo"
              action={
                <CardActions
                  complete={done("cheque")}
                  section="cheque and return memo"
                  onEdit={() => review("cheque")}
                />
              }
            >
              {cheques.map((c) => (
                <SubBlock
                  key={c.key}
                  title={c.label}
                  rows={[
                    { term: "Amount", value: c.amount },
                    { term: "Cheque no. / date", value: c.numberAndDate },
                    { term: "Drawer’s bank", value: c.drawerBank },
                    { term: "Returned", value: c.returned },
                  ]}
                />
              ))}
            </FormCard>

            <FormCard
              title="Demand notice & debt"
              action={
                <CardActions
                  complete={done("demand")}
                  section="demand notice and debt"
                  onEdit={() => review("demand")}
                />
              }
            >
              <KeyValues
                rows={[
                  { term: "Nature of debt", value: notice.nature },
                  { term: "Notice dispatched", value: notice.dispatched },
                  { term: "Delivered", value: notice.delivered },
                  { term: "Reply received", value: notice.replied },
                  { term: "Payment received", value: notice.payment },
                ]}
              />
            </FormCard>

            <FormCard
              title="Jurisdiction & limitation"
              action={
                <CardActions
                  complete={done("jurisdiction")}
                  section="jurisdiction and limitation"
                  onEdit={() => review("jurisdiction")}
                />
              }
            >
              <KeyValues
                rows={[
                  { term: "Cheque presented by", value: jurisdiction.presentedBy },
                  { term: "Police station", value: jurisdiction.police },
                  { term: "Cause of action", value: jurisdiction.causeDate },
                  { term: "Complaint filing date", value: jurisdiction.filingDate },
                  {
                    term: "Within limitation",
                    value: jurisdiction.inTime ? (
                      <Badge variant="success">
                        <CheckIcon aria-hidden />
                        Yes, in time
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        <TriangleAlertIcon aria-hidden />
                        {jurisdiction.delayText}
                      </Badge>
                    ),
                  },
                ]}
              />
            </FormCard>

            <FormCard
              title="ADR, other details & prayer"
              action={
                <CardActions
                  complete={done("adr")}
                  section="ADR, other details and prayer"
                  onEdit={() => review("adr")}
                />
              }
            >
              <KeyValues
                rows={[
                  { term: "Open to settlement (ADR)", value: adrLabel(draft) },
                  { term: "Interim relief", value: INTERIM_RELIEF_SUMMARY },
                  { term: "Final relief", value: finalReliefSummary(draft) },
                ]}
              />
            </FormCard>

            <FormCard
              title="Witnesses"
              action={
                <CardActions
                  complete={done("witnesses")}
                  section="witnesses"
                  onEdit={() => review("witnesses")}
                />
              }
            >
              {witnesses.map((w) => (
                <SubBlock
                  key={w.key}
                  title={w.label}
                  rows={[
                    { term: w.term, value: w.name },
                    { term: "Will prove", value: w.prove },
                  ]}
                />
              ))}
            </FormCard>

            <FormCard
              title="Documents"
              action={
                <CardActions
                  complete={done("documents")}
                  section="documents"
                  onEdit={() => review("documents")}
                />
              }
              contentClassName="gap-0"
            >
              {documents.lines.map((line, i) => (
                <p
                  key={i}
                  className="flex items-start gap-3 border-b border-hairline py-3 text-body-compact last:border-b-0"
                >
                  <span className="flex h-5 shrink-0 items-center">
                    <CheckIcon className="size-4 text-success-ink" aria-hidden />
                  </span>
                  {line}
                </p>
              ))}
              {documents.remaining ? (
                <p className="flex items-start gap-3 border-t border-hairline py-3 text-body-compact">
                  <span className="flex h-5 shrink-0 items-center">
                    <TriangleAlertIcon className="size-4 text-warning-ink" aria-hidden />
                  </span>
                  {documents.remaining} required document
                  {documents.remaining === 1 ? "" : "s"} still to upload
                </p>
              ) : null}
              {!documents.lines.length && !documents.remaining ? (
                <p className="py-3 text-body-compact text-muted-foreground">
                  No documents added yet.
                </p>
              ) : null}
            </FormCard>
          </TabsContent>

          {/* ── Court document ── */}
          <TabsContent value="document">
            <CourtDocument draft={draft} />
          </TabsContent>
        </Tabs>
      </FilingMain>

      {/* ── Review takes you to the section ── */}
      <Dialog
        open={!!panel}
        onOpenChange={(open) => {
          if (!open) setEditKey(null);
        }}
      >
        <ChromeDialogContent mobileSheet className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open the {panel?.title ?? ""} section?</DialogTitle>
            <DialogDescription>
              Changes are made in the section itself. You will come back here from its
              Continue.
            </DialogDescription>
          </DialogHeader>

          <Field orientation="horizontal">
            <Checkbox
              id="skip-review-prompt"
              checked={dontAsk}
              onCheckedChange={(checked) => setDontAsk(checked === true)}
            />
            <FieldLabel htmlFor="skip-review-prompt" className="font-normal">
              Don&rsquo;t ask me again
            </FieldLabel>
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditKey(null)}>
              Stay here
            </Button>
            <Button type="button" onClick={confirmReview}>
              Open section
            </Button>
          </DialogFooter>
        </ChromeDialogContent>
      </Dialog>

      <FilingFooter
        backHref={prev ? hrefFor(prev) : undefined}
        continueHref={next ? hrefFor(next) : undefined}
        continueLabel={yourOathAhead ? "Continue to sign and oath" : "Continue to sign"}
        showSaveState={false}
        status={
          readyToSign ? (
            <span className="inline-flex items-center gap-2 text-body-compact text-success-ink">
              <CheckIcon className="size-4" aria-hidden />
              Reviewed
            </span>
          ) : (
            <IncompleteSections
              sections={incomplete.map((k) => ({
                key: k,
                title: courtText(panels[k].title),
                href: hrefFor(panels[k].step),
              }))}
            />
          )
        }
      />
    </>
  );
}
