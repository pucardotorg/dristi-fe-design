"use client";

import type { ReactNode } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  helpPanel,
  pick,
  ui,
  type HelpEntry,
  type Locale,
  type StepId,
} from "@/lib/onboarding/content";

function renderAnswer(entry: HelpEntry, locale: Locale): ReactNode {
  const answer = pick(entry.a, locale);

  if (!entry.links?.length) return answer;

  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const link of entry.links) {
    const label = pick(link.label, locale);
    const start = answer.indexOf(label, cursor);

    if (start === -1) continue;

    parts.push(answer.slice(cursor, start));
    parts.push(
      <a key={`${link.href}-${start}`} href={link.href}>
        {label}
      </a>,
    );
    cursor = start + label.length;
  }

  parts.push(answer.slice(cursor));
  return parts;
}

/**
 * Reference for the current step — everything the left column no longer carries.
 *
 * The same DS Accordion used by the choices step gives these answers a consistent
 * measured reveal. Keeping it single-open avoids competing long answers in the rail.
 */
export function HelpPanel({ step, locale }: { step: StepId; locale: Locale }) {
  const entries = helpPanel[step];

  return (
    <Card variant="raised" role="region" aria-label={pick(ui.helpTitle, locale)}>
      <CardHeader>
        <h3 className="text-title-s font-semibold text-foreground">
          {pick(ui.helpTitle, locale)}
        </h3>
      </CardHeader>

      <CardContent className="pt-0">
        <Accordion type="single" collapsible>
          {entries.map((entry) => (
            <AccordionItem
              key={pick(entry.q, "en")}
              value={pick(entry.q, "en")}
              className="border-border"
            >
              <AccordionTrigger className="min-h-10 items-center px-3 py-2.5 text-body hover:no-underline">
                <span className="min-w-0 flex-1 text-pretty">
                  {pick(entry.q, locale)}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-3 pt-2 pb-3 text-body text-pretty text-muted-foreground">
                {renderAnswer(entry, locale)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
