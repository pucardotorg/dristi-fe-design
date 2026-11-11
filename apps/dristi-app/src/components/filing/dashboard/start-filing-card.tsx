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
  title,
  titleId,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
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
            // One brand tint for every entry: colour here marks "a place to start", not which
          // kind of filing it is (info blue beside brand blue meant nothing).
          "bg-brand-muted text-brand-muted-foreground",
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

/* An inset grouped list: the options sit in one recessed tray (the passive container) and
   each option is a white row inside it (the bright thing to pick). No drawn outlines, no
   card nested in a card; the brand shows on the icon and under the pointer. */
export const OPTION_TRAY = "flex flex-col gap-2 rounded-xl bg-surface-sunken p-2";
const OPTION =
  "group flex w-full items-center gap-4 rounded-lg bg-card px-4 py-3 text-left shadow-raised transition-colors outline-none hover:bg-brand-muted focus-visible:ring-3 focus-visible:ring-focus-ring";

/**
 * One destination inside an entry panel, as a white row in the panel's tray that is itself
 * the act. Case types use it, and so do the ways a batch comes in. A link with `href`, a
 * button with `onClick`. `soon` greys the icon and puts "Coming soon" where the chevron
 * would be, so the name never wraps around a badge.
 */
export function EntryOption({
  href,
  onClick,
  icon: Icon,
  title,
  caption,
  soon,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  caption: string;
  soon?: boolean;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg max-sm:hidden",
          soon ? "bg-muted text-muted-foreground" : "bg-brand-muted text-brand-muted-foreground group-hover:bg-card",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-medium text-foreground">{title}</span>
        <span className="text-body-compact text-muted-foreground">{caption}</span>
      </span>
      {soon ? (
        <Badge variant="secondary" className="shrink-0">
          Coming soon
        </Badge>
      ) : (
        <ChevronRightIcon
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-muted-foreground"
        />
      )}
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
    <Card variant="raised" aria-labelledby={titleId} className="gap-6 p-6">
      <EntryHead
        icon={FilePlus2Icon}
        title="New filing"
        titleId={titleId}
        description="File one case, step by step: parties, documents, then the court fee."
      />
      {/* More case types are more cards; the panel keeps its shape. */}
      <ul aria-labelledby={titleId} className={OPTION_TRAY}>
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
          />
        </li>
      </ul>
    </Card>
  );
}
