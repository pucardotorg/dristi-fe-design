"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftRightIcon,
  ChevronRightIcon,
  CreditCardIcon,
  FilePlusIcon,
} from "lucide-react";

import { CASE_TYPE, PSS_CASE_TYPE } from "@/lib/filing/options";
import { NEW_FILING, NEW_PSS_FILING } from "@/lib/filing/steps";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PANEL_CLASS } from "@/components/filing/form-card";

/**
 * One case type as a row that is itself the button (owner, 2026-10-09: "keep it as a row
 * button only"). The registration role card's frame: a bordered row with a hover fill,
 * its name over one muted line, and a chevron saying it goes somewhere.
 */
function CaseTypeRow({
  href,
  icon: Icon,
  title,
  caption,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  caption: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-lg border border-border p-4 transition-colors outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-muted-foreground transition-colors group-hover:bg-card group-hover:text-foreground"
        >
          <Icon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-body-compact font-medium">{title}</span>
          <span className="text-body-compact text-muted-foreground">
            {caption}
          </span>
        </span>
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
    <Card className={cn(PANEL_CLASS, "gap-0")}>
      <CardHeader className="flex flex-row items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand-muted-foreground"
        >
          <FilePlusIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardTitle id={titleId} className="text-body font-semibold">
            Start a new filing
          </CardTitle>
          <CardDescription className="text-body-compact">
            Step by step: parties, documents, then the court fee.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <ul aria-labelledby={titleId} className="flex flex-col gap-2">
          <CaseTypeRow
            href={NEW_FILING}
            icon={CreditCardIcon}
            title={CASE_TYPE.title}
            caption="Dishonoured cheques · about 40 minutes"
          />
          <CaseTypeRow
            href={NEW_PSS_FILING}
            icon={ArrowLeftRightIcon}
            title={PSS_CASE_TYPE.title}
            caption="Coming soon"
          />
        </ul>
      </CardContent>
    </Card>
  );
}
