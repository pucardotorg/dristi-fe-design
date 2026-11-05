"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useFieldPolicy } from "@/components/filing/field-policy";
import { useInCorrection } from "@/components/filing/posture";

/**
 * Title block for a filing screen. `eyebrow` is the small primary label used on the
 * intake step ("Documents"); `actions` sits to the right of the title on wide screens.
 *
 * No breadcrumb here — the top bar carries the one the app has, so the trail is stated
 * once and in the same place on every screen.
 */
export function FilingPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  /* The correction screen owns the page's one `h1`; a section title under it is an `h2`. */
  const Heading = useInCorrection() ? "h2" : "h1";
  const underTitle = useFieldPolicy()?.underTitle ?? null;
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {eyebrow ? (
            <p className="text-caption font-medium text-primary">{eyebrow}</p>
          ) : null}
          <Heading className="text-title font-semibold tracking-tight text-foreground">
            {title}
          </Heading>
          {description ? (
            <p className="max-w-3xl text-body text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {underTitle}
    </div>
  );
}
