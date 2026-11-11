"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRightIcon, BanknoteIcon, ChevronRightIcon, FilePlus2Icon } from "lucide-react";

import { CASE_TYPE, PSS_CASE_TYPE } from "@/lib/filing/options";
import { NEW_FILING, NEW_PSS_FILING } from "@/lib/filing/steps";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

/**
 * The panel's anchor: a 48px tile with the act's icon, above its title (owner, 2026-11-11:
 * filing a case is a primary part of the product, so its entry points need a visual anchor
 * before the heading, and the weight of a destination, not a sub-action). Shared with the
 * Bulk filing panel so the two read as a pair.
 */
export function EntryHead({
  icon: Icon,
  tone,
  title,
  titleId,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "brand" | "info";
  title: string;
  titleId?: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <span
        aria-hidden
        className={cn(
          "flex size-12 items-center justify-center rounded-xl",
          tone === "brand" ? "bg-brand-muted text-brand-muted-foreground" : "bg-info-muted text-info-muted-foreground",
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-title-s font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-body text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/**
 * One destination inside an entry panel, as a card that is itself the link: a small icon
 * tile, the name over one muted line, and a chevron. Case types use it, and so does the
 * Bulk filing panel's latest batch, so the two panels share one row.
 */
export function EntryOption({
  href,
  icon: Icon,
  title,
  caption,
  aside,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  caption: string;
  aside?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-hairline bg-card p-4 transition-colors outline-none hover:border-border hover:bg-surface-sunken focus-visible:ring-3 focus-visible:ring-focus-ring"
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-muted-foreground transition-colors group-hover:bg-card group-hover:text-foreground max-sm:hidden"
      >
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* A badge rides on the title's line, so on a phone it never squeezes the name. */}
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-body font-medium text-foreground">{title}</span>
          {aside}
        </span>
        <span className="text-body-compact text-muted-foreground">{caption}</span>
      </span>
      <ChevronRightIcon
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

/** The case types a filing can start from: cheque bounce, and the PSS Act, whose row opens a placeholder until its flow is built. */
export function StartFilingCard() {
  const titleId = React.useId();
  return (
    <Card variant="raised" className="gap-6 p-6">
      <EntryHead
        icon={FilePlus2Icon}
        tone="brand"
        title="New filing"
        titleId={titleId}
        description="File one case, step by step: parties, documents, then the court fee."
      />
      {/* More case types are more cards; the panel keeps its shape. */}
      <ul aria-labelledby={titleId} className="flex flex-col gap-3">
        <li>
          <EntryOption
            href={NEW_FILING}
            icon={BanknoteIcon}
            title={CASE_TYPE.title}
            caption="Dishonoured cheques · about 40 minutes"
          />
        </li>
        <li>
          <EntryOption
            href={NEW_PSS_FILING}
            icon={ArrowLeftRightIcon}
            title={PSS_CASE_TYPE.title}
            caption="Dishonoured electronic fund transfers"
            aside={
              <Badge variant="secondary" className="shrink-0">
                Coming soon
              </Badge>
            }
          />
        </li>
      </ul>
    </Card>
  );
}
