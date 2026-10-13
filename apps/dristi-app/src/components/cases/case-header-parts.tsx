"use client";

import type { ReactNode } from "react";

import { Identifier } from "@/components/chrome/identifier";
import type { PastCaseNumber } from "@/lib/cases/header";
import { PAGE_BACK_COLUMN, PageBackButton } from "@/components/shell/page-back-button";
import { cn } from "@/lib/utils";
import { useCaseReader } from "./case-reader";
import { CaseNumberHistory } from "./case-number-history";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Back to the cases list: the product's one page-level back control.
 *
 * Not for the court. On the court side the top bar's trail is the way back and a page
 * carries no back control of its own (`lib/employee/navigation.ts`), and the court opens
 * a case in a tab of its own, where there is nothing to go back to.
 */
export function CaseBackButton() {
  if (useCaseReader() === "court") return null;
  return (
    <div className={PAGE_BACK_COLUMN}>
      <PageBackButton href="/cases" label="Back to cases" />
    </div>
  );
}

/**
 * The case number with its history icon riding right behind it.
 *
 * `Identifier` holds no room for its copy glyph at rest and opens to it on
 * hover, focus and "Copied", so the icon sits tight against the number and is
 * eased aside by the layout itself. The move lives in `Identifier`, once, for
 * every identifier in the product.
 */
export function CaseNumberLine({
  caseNumber,
  history,
  className,
}: {
  caseNumber: string;
  history: PastCaseNumber[];
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-body-compact font-medium text-muted-foreground",
        className
      )}
    >
      <Identifier
        value={caseNumber}
        label="case number"
      />
      <span className="flex">
        <CaseNumberHistory history={history} />
      </span>
    </span>
  );
}

/**
 * The main stage and any secondary stages, each naming what it is on hover.
 * Secondary stages are not inside the main one: there is no hierarchy, and
 * several can be active at once (PM, Oct 8). So no pointer between them; the
 * main stage's fill against the secondary stages' outline is the only
 * difference, and the tooltip names it.
 */
export function CaseStageBadges({
  stage,
  subStages,
}: {
  stage: ReactNode;
  subStages: string[];
}) {
  return (
    <TooltipProvider>
      <span className="flex flex-wrap items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>{stage}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Case stage</TooltipContent>
        </Tooltip>
        {subStages.map((label) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Badge variant="outline">{label}</Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom">Secondary stage</TooltipContent>
          </Tooltip>
        ))}
      </span>
    </TooltipProvider>
  );
}
