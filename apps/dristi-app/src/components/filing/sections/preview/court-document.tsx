/**
 * The complaint as the court will read it — a paper sheet rendered from the draft.
 *
 * Shared by Preview ("Court document" tab) and Sign (the document being signed), so both
 * screens print exactly the same paper. Every fact on the sheet comes from the draft: a
 * detail the person has not entered prints as "Not provided" rather than as a stand-in.
 */

import * as React from "react";

import { toLongDate } from "@/lib/filing/format";
import { CASE_TYPE, COURT, RETURN_REASONS } from "@/lib/filing/options";
import type { FilingDraft } from "@/lib/filing/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { PANEL_CLASS } from "@/components/filing/form-card";
import {
  INTERIM_RELIEF_SUMMARY,
  NOT_PROVIDED,
  accusedSummaries,
  adrLabel,
  advocateSummaries,
  chequeSummaries,
  complainantSummary,
  documentSummary,
  finalReliefSummary,
  htmlToParagraphs,
  jurisdictionSummary,
  leadAdvocateName,
  affidavitBody,
  noticeSummary,
  optionLabel,
  orNot,
  witnessSummaries,
} from "./derive";
import { useCourtText } from "@/components/court/court-provider";

/* ───────────────────────────── Sheet primitives ────────────────────── */

function DocTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full table-fixed border-collapse">{children}</table>
    </div>
  );
}

function DocGroupRow({
  children,
  span = 3,
}: {
  children: React.ReactNode;
  span?: number;
}) {
  return (
    <tr>
      <td
        colSpan={span}
        className="border border-paper-border bg-paper-muted px-3 py-2 text-body-compact font-semibold text-paper-muted-foreground"
      >
        {children}
      </td>
    </tr>
  );
}

function DocCell({
  label,
  children,
  span,
}: {
  label?: string;
  children: React.ReactNode;
  span?: number;
}) {
  return (
    <td colSpan={span} className="border border-paper-border px-3 py-2 align-top">
      {label ? (
        <span className="block text-caption font-medium text-paper-muted-foreground">
          {label}
        </span>
      ) : null}
      <span className="block break-words text-body-compact">{children}</span>
    </td>
  );
}

function DocSection({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 text-body font-semibold">{children}</h3>;
}

function DocSub({ children }: { children: React.ReactNode }) {
  return <h4 className="mt-6 text-body-compact font-semibold">{children}</h4>;
}

/** "+1 other" / "+3 others" appended to a case-title party name when more than one is on that side. */
function othersSuffix(count: number): string {
  const extra = count - 1;
  if (extra <= 0) return "";
  return ` +${extra} other${extra > 1 ? "s" : ""}`;
}

function DocP({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mt-3 text-body-compact leading-relaxed", className)}>{children}</p>
  );
}

/* ───────────────────────────── The document ────────────────────────── */

export function CourtDocument({ draft }: { draft: FilingDraft }) {
  const courtText = useCourtText();
  const complainant = complainantSummary(draft.complainants[0]);
  const advocates = advocateSummaries(draft);
  const accused = accusedSummaries(draft);
  const cheques = chequeSummaries(draft);
  const notice = noticeSummary(draft.notices[0]);
  const jurisdiction = jurisdictionSummary(draft);
  const witnesses = witnessSummaries(draft);
  const documents = documentSummary(draft);

  const longDate = (iso: string) => orNot(toLongDate(iso));

  const firstAccused = accused[0];
  const otherDetails = htmlToParagraphs(draft.adr.otherDetails);
  const interimRelief = htmlToParagraphs(draft.adr.interimRelief);
  const finalRelief = htmlToParagraphs(draft.adr.finalRelief);

  return (
    <Card className={cn(PANEL_CLASS, "gap-0 p-6 font-sans text-foreground sm:p-8")}>
      {/* Court and cause title */}
      <div className="flex flex-col gap-1 text-center">
        <p className="text-caption font-medium tracking-wide text-paper-muted-foreground">
          In the {courtText(COURT.name)}
        </p>
        {/* No registration-number line: a draft has no number until registration, in
            any state (owner, 2026-10-09). */}
      </div>

      {/* Parties — age is printed only when it was collected. */}
      <div className="mt-4 flex items-start justify-between gap-4 py-1">
        <div className="min-w-0">
          <p className="text-body-compact font-semibold break-words">
            {complainant.name}
            {othersSuffix(draft.complainants.length)}
          </p>
          <p className="mt-1 text-caption font-medium leading-relaxed text-paper-muted-foreground">
            {complainant.age ? (
              <>
                Aged {complainant.age} years,
                <br />
              </>
            ) : null}
            R/o {complainant.presentAddress}
          </p>
        </div>
        <p className="shrink-0 text-body-compact italic">… Complainant</p>
      </div>

      <p className="py-1 text-center text-body-compact italic">Versus</p>

      <div className="flex items-start justify-between gap-4 py-1">
        <div className="min-w-0">
          <p className="text-body-compact font-semibold break-words">
            {firstAccused ? firstAccused.heading : NOT_PROVIDED}
            {othersSuffix(accused.length)}
          </p>
          <p className="mt-1 text-caption font-medium leading-relaxed text-paper-muted-foreground">
            R/o {firstAccused ? firstAccused.address : NOT_PROVIDED}
          </p>
        </div>
        <p className="shrink-0 text-body-compact italic">… Accused</p>
      </div>

      {/* Legal heading — the case type's own long-form proceeding title. */}
      <h2 className="mt-4 text-center text-body font-semibold uppercase">
        {CASE_TYPE.proceedingTitleLong}
      </h2>

      {/* ── Synopsis ── */}
      <DocSection>Synopsis</DocSection>
      <DocTable>
        <tbody>
          <DocGroupRow>Parties</DocGroupRow>
          <tr>
            <DocCell label="Complainant name">{complainant.name}</DocCell>
            <DocCell label="Accused name">
              {firstAccused ? firstAccused.heading : NOT_PROVIDED}
            </DocCell>
            <DocCell label="Complainant’s advocate name">
              {leadAdvocateName(draft)}
            </DocCell>
          </tr>

          <DocGroupRow>Cheque details</DocGroupRow>
          <tr>
            <DocCell label="Date on cheque">
              {longDate(draft.cheques[0]?.dateOnCheque ?? "")}
            </DocCell>
            <DocCell label="Amount">{cheques[0]?.amount ?? NOT_PROVIDED}</DocCell>
            <DocCell label="Cheque number">{cheques[0]?.number ?? NOT_PROVIDED}</DocCell>
          </tr>
          <tr>
            <DocCell label="Bank name">{cheques[0]?.bankName ?? NOT_PROVIDED}</DocCell>
            <DocCell label="Bank branch" span={2}>
              {cheques[0]?.bankBranch ?? NOT_PROVIDED}
            </DocCell>
          </tr>

          <DocGroupRow>Dishonour</DocGroupRow>
          <tr>
            <DocCell label="Date of presentation">
              {longDate(draft.cheques[0]?.presentDate ?? "")}
            </DocCell>
            <DocCell label="Date on return memo">
              {longDate(draft.cheques[0]?.returnDate ?? "")}
            </DocCell>
            <DocCell label="Return reason">
              {cheques[0]?.returnReason ?? NOT_PROVIDED}
            </DocCell>
          </tr>
          <tr>
            <DocCell label="Bank branch (complainant)" span={3}>
              {jurisdiction.bank}
            </DocCell>
          </tr>

          <DocGroupRow>Demand notice</DocGroupRow>
          <tr>
            <DocCell label="Date of dispatch of demand notice">
              {longDate(draft.notices[0]?.dispatchDate ?? "")}
            </DocCell>
            <DocCell label="Mode of service">{notice.mode}</DocCell>
            <DocCell label="Whether delivered?">{notice.deliveredYesNo}</DocCell>
          </tr>
          <tr>
            <DocCell label="Date of delivery">
              {longDate(draft.notices[0]?.deliveryDate ?? "")}
            </DocCell>
            <DocCell label="Has the accused replied to the demand notice?" span={2}>
              {notice.replied}
            </DocCell>
          </tr>

          <DocGroupRow>Cause of action</DocGroupRow>
          <tr>
            <DocCell label="Date of cause of action">
              {longDate(jurisdiction.causeDateIso)}
            </DocCell>
            <DocCell label="Jurisdiction invoked under Section 142(2)">
              {jurisdiction.depositedByPayee
                ? `${jurisdiction.bankBranch}, the complainant’s bank branch`
                : "Drawer (accused) bank branch"}
            </DocCell>
            <DocCell label="Any other complaint pending between the same parties?">
              {jurisdiction.otherPending}
            </DocCell>
          </tr>

          <DocGroupRow>Prayer / relief sought</DocGroupRow>
          <tr>
            <DocCell span={3}>
              {finalReliefSummary(draft)}. {INTERIM_RELIEF_SUMMARY}.
            </DocCell>
          </tr>
        </tbody>
      </DocTable>

      {/* ── 1. Party details ── */}
      <DocSection>1. Party details</DocSection>

      <DocSub>1.1. Complainant</DocSub>
      <DocTable>
        <tbody>
          <DocGroupRow>Complainant 1</DocGroupRow>
          <tr>
            <DocCell label="Complainant type">{complainant.type}</DocCell>
            <DocCell label="Full name">{complainant.name}</DocCell>
            <DocCell label="Mobile number">{complainant.mobile}</DocCell>
          </tr>
          <tr>
            <DocCell label="Email address">{complainant.email}</DocCell>
            <DocCell label="Permanent address">{complainant.permanentAddress}</DocCell>
            <DocCell label="Present address">{complainant.presentAddress}</DocCell>
          </tr>
          <tr>
            <DocCell label="PoA for complainant 1" span={3}>
              {complainant.poa}
            </DocCell>
          </tr>
        </tbody>
      </DocTable>

      <DocSub>1.2. Advocate (complainant)</DocSub>
      {advocates.length ? (
        <DocTable>
          <tbody>
            {advocates.map((a) => (
              <React.Fragment key={a.key}>
                <DocGroupRow span={2}>
                  {a.forAll
                    ? "Advocate for all complainants"
                    : `Advocate for ${a.appearingFor}`}
                </DocGroupRow>
                <tr>
                  <DocCell label="Full name">{a.name}</DocCell>
                  <DocCell label="Bar registration">{a.bar}</DocCell>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </DocTable>
      ) : (
        <DocP className="text-paper-muted-foreground">
          No advocate has been added. The complainant appears as a party in person.
        </DocP>
      )}

      <DocSub>1.3. Accused</DocSub>
      <DocTable>
        <tbody>
          {accused.map((a) => (
            <React.Fragment key={a.key}>
              <DocGroupRow>{a.label}</DocGroupRow>
              <tr>
                <DocCell label={a.isEntity ? "Type of entity" : "Type"}>{a.type}</DocCell>
                <DocCell label="Full name">{a.name}</DocCell>
                <DocCell label="Address">{a.address}</DocCell>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </DocTable>

      {/* ── 2. Case details ── */}
      <DocSection>2. Case details</DocSection>

      <DocSub>2.1. Cheque and return memo details</DocSub>
      <DocTable>
        <tbody>
          {cheques.map((c, i) => (
            <React.Fragment key={c.key}>
              <DocGroupRow>{c.label}</DocGroupRow>
              <tr>
                <DocCell label="Date on cheque">
                  {longDate(draft.cheques[i].dateOnCheque)}
                </DocCell>
                <DocCell label="Amount">{c.amount}</DocCell>
                <DocCell label="Cheque number">{c.number}</DocCell>
              </tr>
              <tr>
                <DocCell label="Bank name">{c.bankName}</DocCell>
                <DocCell label="Bank branch" span={2}>
                  {c.bankBranch}
                </DocCell>
              </tr>
              <tr>
                <DocCell label="Date of presentation">
                  {longDate(draft.cheques[i].presentDate)}
                </DocCell>
                <DocCell label="Date of return">
                  {longDate(draft.cheques[i].returnDate)}
                </DocCell>
                <DocCell label="Return reason">
                  {orNot(optionLabel(RETURN_REASONS, draft.cheques[i].returnReason))}
                </DocCell>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </DocTable>

      <DocSub>2.2. Demand notice details</DocSub>
      <DocTable>
        <tbody>
          {draft.notices.map((n, i) => {
            const s = noticeSummary(n);
            return (
              <React.Fragment key={n.id}>
                <DocGroupRow>Demand notice {i + 1}</DocGroupRow>
                <tr>
                  <DocCell label="Nature of debt or other liability" span={3}>
                    {s.nature}
                  </DocCell>
                </tr>
                <tr>
                  <DocCell label="Date of dispatch of demand notice">
                    {longDate(n.dispatchDate)}
                  </DocCell>
                  <DocCell label="Mode of service">{s.mode}</DocCell>
                  <DocCell label="Whether delivered?">{s.deliveredYesNo}</DocCell>
                </tr>
                <tr>
                  <DocCell label="Date of delivery">{longDate(n.deliveryDate)}</DocCell>
                  <DocCell label="Has the accused replied to the demand notice?">
                    {s.replied}
                  </DocCell>
                  <DocCell label="Has the drawer made full or part payment due under the cheque?">
                    {s.paidYesNo}
                  </DocCell>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </DocTable>

      <DocSub>2.3. Jurisdiction and limitation</DocSub>
      <DocTable>
        <tbody>
          <tr>
            <DocCell
              label="Was the cheque delivered for collection at a bank account?"
              span={3}
            >
              {jurisdiction.depositedByPayee ? "Yes" : "No"}
            </DocCell>
          </tr>
          {jurisdiction.depositedByPayee ? (
            <>
              <DocGroupRow>Payee (complainant) bank details</DocGroupRow>
              <tr>
                <DocCell label="IFSC code">{jurisdiction.ifsc}</DocCell>
                <DocCell label="Bank name">{jurisdiction.bankName}</DocCell>
                <DocCell label="Bank branch">{jurisdiction.bankBranch}</DocCell>
              </tr>
            </>
          ) : null}
          <tr>
            <DocCell label="Police station" span={3}>
              {jurisdiction.police}
            </DocCell>
          </tr>
          <DocGroupRow>
            Other cheque dishonour complaints between the same parties
          </DocGroupRow>
          <tr>
            <DocCell
              label="Is there any other cheque dishonour complaint pending between the same parties?"
              span={3}
            >
              {jurisdiction.otherPending}
            </DocCell>
          </tr>
          {jurisdiction.otherCases.map((c, i) => (
            <tr key={`${c.court}-${c.caseNumber}-${i}`}>
              <DocCell label="Court">{orNot(c.court)}</DocCell>
              <DocCell label="Case number" span={2}>
                {orNot(c.caseNumber)}
              </DocCell>
            </tr>
          ))}
          <tr>
            <DocCell label="Date of cause of action">
              {longDate(jurisdiction.causeDateIso)}
            </DocCell>
            <DocCell label="Date of complaint filing">
              {longDate(jurisdiction.filingDateIso)}
            </DocCell>
            <DocCell label="Duration of delay">{jurisdiction.delayText}</DocCell>
          </tr>
          {jurisdiction.condonationReason ? (
            <tr>
              <DocCell label="Reason for praying condonation of delay" span={3}>
                {jurisdiction.condonationReason}
              </DocCell>
            </tr>
          ) : null}
        </tbody>
      </DocTable>

      <DocSub>2.4. ADR, prayer and other details</DocSub>
      <DocTable>
        <tbody>
          <tr>
            <DocCell
              label="Would you like to settle the case outside the court through alternative methods of dispute resolution?"
              span={3}
            >
              {adrLabel(draft)}
            </DocCell>
          </tr>
          <tr>
            <DocCell label="Any additional details" span={3}>
              {otherDetails.length ? otherDetails.join(" ") : NOT_PROVIDED}
            </DocCell>
          </tr>
        </tbody>
      </DocTable>
      <p className="mt-4 text-body-compact font-semibold">Interim relief</p>
      {interimRelief.length ? (
        interimRelief.map((p, i) => <DocP key={i}>{p}</DocP>)
      ) : (
        <DocP className="text-paper-muted-foreground">{NOT_PROVIDED}</DocP>
      )}
      <p className="mt-4 text-body-compact font-semibold">Final relief</p>
      {finalRelief.length ? (
        finalRelief.map((p, i) => (
          <DocP key={i} className={i > 0 ? "ml-4" : undefined}>
            {p}
          </DocP>
        ))
      ) : (
        <DocP className="text-paper-muted-foreground">{NOT_PROVIDED}</DocP>
      )}

      {/* ── 3. Evidence ── */}
      <DocSection>3. Evidence</DocSection>

      <DocSub>3.1. List of witnesses</DocSub>
      <DocTable>
        <tbody>
          {witnesses.map((w) => (
            <React.Fragment key={w.key}>
              <DocGroupRow>{w.label}</DocGroupRow>
              <tr>
                <DocCell label={w.term === "Designation" ? "Designation" : "Full name"}>
                  {w.name}
                </DocCell>
                <DocCell label="What will this witness prove?" span={2}>
                  {w.prove}
                </DocCell>
              </tr>
              <tr>
                <DocCell label="Mobile number">{w.mobile}</DocCell>
                <DocCell label="Email id">{w.email}</DocCell>
                <DocCell label="Address">{w.address}</DocCell>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </DocTable>

      <DocSub>3.2. List of documents</DocSub>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-32" />
          </colgroup>
          <thead>
            <tr>
              <th className="border border-paper-border bg-paper-muted px-3 py-2 text-left text-body-compact font-semibold text-paper-muted-foreground">
                S. no.
              </th>
              <th className="border border-paper-border bg-paper-muted px-3 py-2 text-left text-body-compact font-semibold text-paper-muted-foreground">
                Document name
              </th>
              <th className="border border-paper-border bg-paper-muted px-3 py-2 text-left text-body-compact font-semibold text-paper-muted-foreground">
                Natively digital
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.uploaded.length ? (
              documents.uploaded.map((d, i) => (
                <tr key={d.id}>
                  <DocCell>{i + 1}.</DocCell>
                  <DocCell>
                    {d.name}
                    {d.file ? (
                      <span className="mt-0.5 block text-caption text-paper-muted-foreground">
                        {d.file.name}
                      </span>
                    ) : null}
                  </DocCell>
                  <DocCell>{d.digital ? "Yes" : "No"}</DocCell>
                </tr>
              ))
            ) : (
              <tr>
                <DocCell span={3}>No documents have been uploaded yet.</DocCell>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <DocP>
        Signed on {jurisdiction.filingDateIso ? toLongDate(jurisdiction.filingDateIso) : "__"}.
        Please see Page __ for the signatures.
      </DocP>

      {/* ── 4. Affidavit ── */}
      <DocSection>4. Affidavit</DocSection>
      {/*
        The same text the Affidavit step shows and the filer may have edited — rendered
        from one expression rather than regenerated here, because a sworn document that
        disagrees with the form it came from is the worst outcome available.
      */}
      <div
        className="flex flex-col gap-3 [&_p]:text-body-compact [&_p]:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: affidavitBody(draft) }}
      />

      <h4 className="mt-8 text-body-compact font-semibold">Complainant</h4>
      <DocP>
        I confirm that I have read and understood all the documents I am submitting
        through this filing, including the:
        <br />
        1. Complaint
        <br />
        2. Affidavit of fact
      </DocP>
      <h4 className="mt-6 text-body-compact font-semibold">Advocate</h4>
      <DocP>
        I confirm the identity of the party, and that the party has read and fully
        understood the contents of the affidavit.
      </DocP>
      <DocP>
        I confirm that the complaint has been properly drafted and presented in accordance
        with legal requirements.
      </DocP>
      <DocP className="text-center">***</DocP>
      <DocP className="text-paper-muted-foreground">
        Please turn over the page to see the documents uploaded by the complainant.
      </DocP>
    </Card>
  );
}
