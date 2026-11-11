"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { CASE_TYPE, PSS_CASE_TYPE } from "@/lib/filing/options";
import { NEW_FILING, NEW_PSS_FILING } from "@/lib/filing/steps";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * One case type as a row that is itself the button (owner, 2026-10-09: "keep it as a row
 * button only"). Rows sit in the panel's list as quiet lines, not boxes inside a box
 * (owner, 2026-11-11: the bordered tiles read as undesigned and would not scale): the
 * act's name over one muted line, a chevron, and the hover well. More case types are more
 * rows, so the list grows without changing shape.
 */
function CaseTypeRow({
  href,
  title,
  caption,
  soon,
}: {
  href: string;
  title: string;
  caption: string;
  /** Not built yet: the row still opens its placeholder, and says so. */
  soon?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group -mx-3 flex min-h-16 items-center gap-4 rounded-lg px-3 py-3 transition-colors outline-none hover:bg-surface-sunken focus-visible:ring-3 focus-visible:ring-focus-ring"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-medium">{title}</span>
          <span className="text-body-compact text-muted-foreground">{caption}</span>
        </span>
        {soon ? (
          <Badge variant="secondary" className="shrink-0">
            Coming soon
          </Badge>
        ) : null}
        <ChevronRightIcon
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </li>
  );
}

/** The case types a filing can start from: cheque bounce, and the PSS Act, whose row opens a placeholder until its flow is built. */
export function StartFilingCard() {
  const titleId = React.useId();
  return (
    <Card variant="raised" className="gap-0">
      <CardHeader>
        <CardTitle id={titleId} className="text-body font-semibold">
          New filing
        </CardTitle>
        <CardDescription className="text-body-compact">
          One case, step by step: parties, documents, then the court fee.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-3">
        <ul aria-labelledby={titleId} className="flex flex-col divide-y divide-hairline">
          <CaseTypeRow href={NEW_FILING} title={CASE_TYPE.title} caption="Dishonoured cheques · about 40 minutes" />
          <CaseTypeRow href={NEW_PSS_FILING} title={PSS_CASE_TYPE.title} caption="Dishonoured electronic fund transfers" soon />
        </ul>
      </CardContent>
    </Card>
  );
}
