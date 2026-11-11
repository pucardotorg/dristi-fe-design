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
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "brand" | "info";
  title: string;
  titleId?: string;
  description: string;
  /** The panel's own act, on the tile's row at the right (Bulk filing: View all batches). */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <span
          aria-hidden
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl",
            tone === "brand" ? "bg-brand-muted text-brand-muted-foreground" : "bg-info-muted text-info-muted-foreground",
          )}
        >
          <Icon className="size-6" />
        </span>
        {/* Beside the tile from sm up; on a phone there is no room, so it follows the text. */}
        {action ? <div className="max-sm:hidden">{action}</div> : null}
      </div>
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-title-s font-semibold text-foreground">
          {title}
        </h2>
        <p className="text-body text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="sm:hidden">{action}</div> : null}
    </div>
  );
}

const OPTION =
  "group flex w-full items-center gap-4 rounded-xl border border-hairline bg-surface-sunken p-4 text-left transition-colors outline-none hover:border-brand-accent hover:bg-brand-muted focus-visible:ring-3 focus-visible:ring-focus-ring";

/**
 * One destination inside an entry panel, as a card that is itself the act (owner,
 * 2026-11-11: a hairline alone did not set the options apart). At rest the card is a sunken
 * well inside the white panel with a brand-tinted icon, so it reads as something to pick;
 * under the pointer it takes the brand edge and tint. Case types use it, and so do the
 * ways a batch comes in, so both panels share one kind of option. A link with `href`, a
 * button with `onClick`. `soon` greys the icon for a type not built yet.
 */
export function EntryOption({
  href,
  onClick,
  icon: Icon,
  title,
  caption,
  aside,
  soon,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  caption: string;
  aside?: React.ReactNode;
  soon?: boolean;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg max-sm:hidden",
          soon ? "bg-card text-muted-foreground" : "bg-brand-muted text-brand-muted-foreground group-hover:bg-card",
        )}
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
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-muted-foreground"
      />
    </>
  );
  return href ? (
    <Link href={href} className={OPTION}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={OPTION}>
      {body}
    </button>
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
            soon
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
