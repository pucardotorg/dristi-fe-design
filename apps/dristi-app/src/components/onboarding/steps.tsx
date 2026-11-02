"use client";

import * as React from "react";
import { ExternalLinkIcon, InfoIcon, PhoneIcon, TriangleAlertIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useCourt } from "@/components/court/court-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  choices,
  dateStep,
  help,
  join,
  papers,
  pick,
  summaryFields,
  ui,
  type CaseSummary,
  type Locale,
} from "@/lib/onboarding/content";
import { StatusLine } from "@/components/feedback";

/**
 * Step bodies.
 *
 * Spacing follows the DS ladder: gap-2 within a field, gap-4 within a section,
 * gap-6 between step blocks. Grouped information uses the Card primitive so the
 * muted stage and its content panels keep distinct semantic roles in both themes.
 */

type StepProps = {
  locale: Locale;
  caseSummary?: CaseSummary;
};

/* ------------------------------------------------------------- 1 · papers */

export function PapersStep({ locale, caseSummary }: StepProps) {
  const [notMeOpen, setNotMeOpen] = React.useState(false);
  // The summons the person was sent, as their state's court wrote it (`/summons`).
  const { court } = useCourt();
  const hasCase = Boolean(caseSummary && Object.keys(caseSummary).length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex flex-col gap-3">
          <p className="text-body text-pretty text-foreground">
            {pick(papers.body, locale)}
          </p>
          <p className="text-body text-pretty text-muted-foreground">
            {pick(papers.reassurance, locale)}
          </p>
        </div>
        <div className="flex flex-col items-start lg:items-end">
          <Button asChild variant="outline">
            <a href={`/summons?court=${court}`} target="_blank" rel="noreferrer">
              {pick(papers.originalSummons, locale)}
              <ExternalLinkIcon data-icon="inline-end" aria-hidden />
            </a>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {!hasCase && (
          <Alert variant="info">
            <InfoIcon aria-hidden />
            <AlertTitle>{pick(ui.missingCase, locale)}</AlertTitle>
            <AlertDescription>
              {pick(ui.missingCaseBody, locale)}
            </AlertDescription>
          </Alert>
        )}

        <Card variant="raised">
          <CardContent>
            <DescriptionList>
              {summaryFields.map((field) => {
                const value = caseSummary?.[field.key];
                return (
                  <DescriptionRow key={field.key} className="border-hairline">
                    <DescriptionTerm className="text-body">
                      {pick(field.label, locale)}
                    </DescriptionTerm>
                    <DescriptionDetails
                      className={
                        value
                          ? "text-body font-medium"
                          : "text-body text-muted-foreground"
                      }
                    >
                      {value ?? pick(field.fallback, locale)}
                    </DescriptionDetails>
                  </DescriptionRow>
                );
              })}
            </DescriptionList>
          </CardContent>
        </Card>

      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="link"
          className="h-10 self-start px-0 text-body"
          aria-expanded={notMeOpen}
          onClick={() => setNotMeOpen((v) => !v)}
        >
          {pick(ui.notMe, locale)}
        </Button>
        {notMeOpen && (
          <StatusLine tone="warning">{pick(ui.notMeBody, locale)}</StatusLine>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 2 · choices */

export function ChoicesStep({ locale }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <p className="max-w-prose text-body text-pretty text-foreground">
          {pick(choices.intro, locale)}
        </p>

        {/* Title and one-line summary always visible; detail opens one path at a time.
            The first path starts open, matching the reviewed designer treatment. */}
        <Card variant="raised" size="sm">
          <CardContent>
            <Accordion type="single" collapsible defaultValue="pay">
              {choices.cards.map((card, index) => (
                <AccordionItem
                  key={card.id}
                  value={card.id}
                  className="border-border"
                >
                  <AccordionTrigger className="min-h-10 items-start gap-3 px-2 hover:no-underline">
                    <Badge
                      variant="outline"
                      className="size-6 p-0 tabular-nums"
                    >
                      {index + 1}
                    </Badge>
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5 pr-4 text-left">
                      <span className="text-body font-medium text-pretty text-foreground">
                        {pick(card.title, locale)}
                      </span>
                      <span className="text-body font-normal text-pretty text-muted-foreground">
                        {pick(card.summary, locale)}
                      </span>
                    </span>
                  </AccordionTrigger>

                  <AccordionContent className="px-2 pt-2 pb-4">
                    <div className="flex flex-col gap-4">
                      <p className="text-body text-pretty text-foreground">
                        {pick(card.detail, locale)}
                      </p>
                      {"note" in card && card.note && (
                        <Alert variant={card.noteTone}>
                          {card.noteTone === "warning" ? (
                            <TriangleAlertIcon aria-hidden />
                          ) : (
                            <InfoIcon aria-hidden />
                          )}
                          <AlertDescription>
                            {pick(card.note, locale)}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 3 · date */

export function DateStep({ locale, caseSummary }: StepProps) {
  const { hearingDate, court, courtAddress } = caseSummary ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Card variant="raised">
          <CardContent>
            <div className="flex flex-col gap-2">
              <p className="text-body text-muted-foreground">
                {pick(dateStep.dateLabel, locale)}
              </p>
              <p className="text-title-l font-semibold text-pretty text-foreground">
                {hearingDate ?? pick(dateStep.noDate, locale)}
              </p>
              {(court || courtAddress) && (
                <p className="text-body text-pretty text-muted-foreground">
                  {court}
                  {court && courtAddress ? ", " : ""}
                  {courtAddress}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <ul className="flex max-w-prose list-disc flex-col gap-2 pl-6 text-body text-pretty text-foreground">
          <li>{pick(dateStep.attendBody, locale)}</li>
          <li>{pick(dateStep.cantCome, locale)}</li>
        </ul>
      </div>

    </div>
  );
}

/* --------------------------------------------------------------- 4 · help */

export function HelpStep({ locale }: StepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-prose flex-col gap-3">
        <p className="text-body text-pretty text-foreground">
          {pick(help.body, locale)}
        </p>
        <p className="text-body text-pretty text-muted-foreground">
          {pick(help.proofNote, locale)}
        </p>
      </div>

      {/* One number. The one that gets a lawyer into this court for you. */}
      <Card variant="raised">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-title-s font-semibold text-pretty text-foreground">
              {pick(help.primary.name, locale)}
            </p>
            <p className="text-body text-pretty text-muted-foreground">
              {pick(help.primary.detail, locale)}
            </p>
          </div>
          <Button asChild variant="outline" className="w-full sm:w-fit">
            <a href={help.primary.href}>
              <PhoneIcon className="size-4" aria-hidden />
              {pick(help.primary.linkLabel, locale)}
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- 5 · join */

export function JoinStep({
  locale,
  onFinish,
}: StepProps & { onFinish: () => void }) {
  return (
    <div className="flex max-w-prose flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="text-body text-pretty text-foreground">
          {pick(join.body, locale)}
        </p>
        <p className="text-body text-pretty text-muted-foreground">
          {pick(join.safety, locale)}
        </p>
      </div>

      <Button
        size="lg"
        className="hidden self-start sm:inline-flex"
        onClick={onFinish}
      >
        {pick(join.cta, locale)}
      </Button>
    </div>
  );
}
