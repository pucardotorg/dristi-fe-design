import * as React from "react";
import { CircleCheckIcon, InfoIcon, PhoneIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import { pick, type Locale } from "@/lib/onboarding/content";
import { caseDetails, type JoinCase } from "@/lib/join/content";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";
import { RESOLVE_IN_PLACE } from "@/components/chrome/motion";

/**
 * The one case-details block, shared by the summons modal, the join dialog, and the
 * join outcome screen.
 *
 * The legacy dialog showed ten fields in one flat grid, every label the same size.
 * The redesign ranks them by what a summoned person acts on: the parties, then where
 * and when the next hearing is, then the registry identifiers. `compact` retains the
 * case number while dropping the longer reference list. `extended` restores the full
 * registry list (CNR, filing number, court, both sides' advocates) for advocates, who
 * work by those identifiers rather than being intimidated by them. Court is shown to
 * everyone (JOIN-15).
 *
 * It is a flat white panel on the dialog's warm canvas, so it reads as the case set on it
 * (owner, Oct 6: the sunken box did not look like the product's other modals). The
 * next hearing is the first row of the facts, at the facts' own size: as a 20px line
 * under its own floating calendar icon it outranked the case title above it.
 */

/**
 * The flat white panel the join surfaces lay facts on: a light warm hairline and no
 * lift. A shadowed card inside the dialog read as a card on a card; the white on the
 * warm canvas, edged by the hairline, is separation enough (owner, Oct 6).
 */
export const JOIN_PANEL =
  "flex flex-col gap-4 rounded-xl border border-hairline bg-card p-4 sm:p-6";

/**
 * The case's public identity — what the access-code step can show before the code
 * is spent: a lead line, the cause title with its "1 other", and the case number
 * and court. Shared by both join dialogs so the block reads the same in each.
 */
export function CaseIdentity({
  joinCase,
  locale,
  lead,
}: {
  joinCase: JoinCase;
  locale: Locale;
  lead: string;
}) {
  /* Three facts, three rows (owner, Oct 6): run together with dots they read as one
     long line. The same row grid as the full case details, so the step after the
     code shows these facts where this one did. */
  const facts: { label: keyof typeof caseDetails; value: React.ReactNode }[] = [
    {
      label: "caseNumber",
      value: <Identifier value={joinCase.caseNumber} label="case number" />,
    },
    { label: "court", value: joinCase.court },
    { label: "courtroom", value: joinCase.courtroom },
  ];
  return (
    <div className={JOIN_PANEL}>
      <div className="flex flex-col gap-1">
        <p className="text-body-compact text-muted-foreground">{lead}</p>
        <CaseTitleWithOthers joinCase={joinCase} locale={locale} />
      </div>
      <DescriptionList className="border-t border-hairline">
        {facts.map((fact) => (
          <DescriptionRow key={fact.label} className={FACT_ROW}>
            <DescriptionTerm>{pick(caseDetails[fact.label], locale)}</DescriptionTerm>
            <DescriptionDetails>{fact.value}</DescriptionDetails>
          </DescriptionRow>
        ))}
      </DescriptionList>
    </div>
  );
}

/** A label over its value on a phone: two columns there crushed the values and broke
 *  identifiers mid-string. Shared by both fact lists in this file. */
const FACT_ROW = "border-hairline max-sm:grid-cols-1 max-sm:gap-1";

/** An advocate is on record for the accused side. */
export function hasAccusedAdvocate(joinCase: JoinCase) {
  return Boolean(joinCase.accusedAdvocate && joinCase.accusedAdvocate !== "Not available");
}
/**
 * The cause title with its "and 1 other" made explorable — the marker
 * becomes a dotted-underline trigger and the remaining accused list rides a
 * popover. Extracted from the details block so the access-code step can
 * show the same title the same way (Aug 31 round): wherever a join surface
 * prints the title, "1 other" answers who.
 */
export function CaseTitleWithOthers({
  joinCase,
  locale,
}: {
  joinCase: JoinCase;
  locale: Locale;
}) {
  const otherMarker = " and 1 other";
  const otherAccused = joinCase.accused.slice(1);
  const hasOtherAccused =
    joinCase.title.endsWith(otherMarker) && otherAccused.length > 0;
  const titleLead = hasOtherAccused
    ? joinCase.title.slice(0, -otherMarker.length)
    : joinCase.title;

  return (
    <p className="text-body font-semibold text-pretty">
      {titleLead}
      {hasOtherAccused ? (
        <>
          {" and "}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex min-h-10 items-center rounded-sm underline decoration-dotted underline-offset-4 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={pick(caseDetails.otherAccused, locale)}
              >
                1 other
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              <p className="text-caption font-semibold text-muted-foreground">
                {pick(caseDetails.otherAccused, locale)}
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-body-compact">
                {otherAccused.map((accused) => (
                  <li key={accused.id}>{accused.name}</li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </>
      ) : null}
    </p>
  );
}

/** "Friday, 18 September 2026, 10:30 AM" → its parts, or null for any other shape. */
function hearingParts(value: string) {
  const match = /^(\w+), (\d{1,2}) (\w+) (\d{4}),\s*(.+)$/.exec(value);
  if (!match) return null;
  const [, weekday, day, month, year, time] = match;
  return { weekday, day, month, year, time };
}

/**
 * The date a summoned person acts on, set apart by shape rather than weight (owner,
 * 2026-10-12): a calendar tile in the sunken well, the same tile the hearing list
 * uses for the item number, beside the date and time in regular type. Bold under the
 * bold cause title made the card heavy; plain, the date sank into the rows.
 */
function NextHearing({ value, locale }: { value: string; locale: Locale }) {
  const parts = hearingParts(value);
  return (
    <div className="flex items-center gap-4 rounded-lg bg-surface-sunken p-3">
      {parts ? (
        <span
          aria-hidden
          className="flex size-14 shrink-0 flex-col items-center justify-center rounded-md bg-card leading-none"
        >
          <span className="text-caption text-muted-foreground">{parts.month.slice(0, 3)}</span>
          <span className="text-title-s font-semibold tabular-nums">{parts.day}</span>
        </span>
      ) : null}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-body-compact text-muted-foreground">{pick(caseDetails.hearing, locale)}</p>
        {parts ? (
          <>
            <p className="text-body text-foreground tabular-nums">
              {`${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`}
            </p>
            <p className="text-body-compact text-muted-foreground tabular-nums">{parts.time}</p>
          </>
        ) : (
          <p className="text-body text-foreground tabular-nums">{value}</p>
        )}
      </div>
    </div>
  );
}

export function CaseDetails({
  joinCase,
  locale,
  compact = false,
  extended = false,
  outcome,
  className,
}: {
  joinCase: JoinCase;
  locale: Locale;
  compact?: boolean;
  extended?: boolean;
  /**
   * The settled outcome, when the panel is the record of something just done — the
   * product's settled-card pattern (the signing flow's `SettledCard`): a success band
   * across the panel's top with a tick and the outcome line, resolving in place.
   */
  outcome?: string;
  className?: string;
}) {
  /* `idLabel` marks the rows whose value is a registry identifier rather than a
     fact about the case — they carry the identifier face and can be copied. */
  const rows: {
    label: keyof typeof caseDetails;
    value: string;
    idLabel?: string;
  }[] = [
    { label: "caseNumber", value: joinCase.caseNumber, idLabel: "case number" },
    ...(extended
      ? ([
          { label: "cnr", value: joinCase.cnr, idLabel: "CNR" },
          {
            label: "filingNumber",
            value: joinCase.filingNumber,
            idLabel: "registration number",
          },
        ] as const)
      : []),
    { label: "filingDate", value: joinCase.filingDate },
    { label: "court", value: joinCase.court },
    { label: "courtroom", value: joinCase.courtroom },
    { label: "chequeAmount", value: joinCase.chequeAmount },
    { label: "complainant", value: joinCase.complainant },
    { label: "complainantAdvocate", value: joinCase.complainantAdvocate },
    {
      label: "accusedParties",
      value: joinCase.accused.map((party) => party.name).join(", "),
    },
    // JOIN-15: the accused's advocate shows when one is on record; advocates always
    // see the row, "Not available" included.
    ...(extended || hasAccusedAdvocate(joinCase)
      ? ([{ label: "accusedAdvocate", value: joinCase.accusedAdvocate }] as const)
      : []),
  ];
  function valueOf(row: (typeof rows)[number]): React.ReactNode {
    return row.label === "complainantAdvocate" ? (
                  <span className="flex items-center gap-2">
                    <span>{row.value}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={pick(caseDetails.complainantAdvocateContact, locale)}
                        >
                          <InfoIcon aria-hidden />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" collisionPadding={16} className="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <p className="text-body-compact font-semibold">
                            {pick(caseDetails.complainantAdvocateContact, locale)}
                          </p>
                          <p className="text-body-compact text-pretty text-muted-foreground">
                            {pick(caseDetails.complainantAdvocateContactBody, locale)}
                          </p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="self-start">
                          <a href={`tel:${joinCase.complainantAdvocatePhone.replace(/\s/g, "")}`}>
                            <PhoneIcon data-icon="inline-start" aria-hidden />
                            {joinCase.complainantAdvocatePhone}
                          </a>
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </span>
                ) : row.idLabel ? (
                  <Identifier value={row.value} label={row.idLabel} />
                ) : (
                  row.value
                );
  }

  /* One card for every join screen (owner, 2026-10-12: the same information was showing
     in different shapes within one flow). Which case, its number and type on one muted
     line — the type a fact after a separator, not a pill — then when it is next heard,
     in the date tile; the full registry rows only where the case is being reviewed. */
  const content = (
    <>
      <div className="flex flex-col gap-1">
        <CaseTitleWithOthers joinCase={joinCase} locale={locale} />
        <p className="text-body-compact text-muted-foreground">
          <Identifier value={joinCase.caseNumber} label="case number" />
          <span aria-hidden> · </span>
          {pick(caseDetails.caseTypeBadge, locale)}
        </p>
      </div>

      <NextHearing value={joinCase.hearingDate} locale={locale} />

      {compact ? null : (
        <DescriptionList className="border-t border-hairline">
          {rows
            .filter((row) => row.label !== "caseNumber")
            .map((row) => (
              <DescriptionRow
                key={row.label}
                className={cn(FACT_ROW, row.label === "complainantAdvocate" && "sm:items-center")}
              >
                <DescriptionTerm>{pick(caseDetails[row.label], locale)}</DescriptionTerm>
                <DescriptionDetails>{valueOf(row)}</DescriptionDetails>
              </DescriptionRow>
            ))}
        </DescriptionList>
      )}
    </>
  );

  if (!outcome) return <div className={cn(JOIN_PANEL, className)}>{content}</div>;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-hairline bg-card",
        RESOLVE_IN_PLACE,
        className,
      )}
    >
      <div className="flex items-center gap-2 bg-success-muted px-4 py-2.5 text-body-compact text-success-muted-foreground sm:px-6">
        <CircleCheckIcon aria-hidden className="size-4 shrink-0" />
        {/* Spoken: focus lands on the header title, which announces only itself. */}
        <span role="status" className="font-medium">
          {outcome}
        </span>
      </div>
      <div className="flex flex-col gap-4 p-4 sm:p-6">{content}</div>
    </div>
  );
}
