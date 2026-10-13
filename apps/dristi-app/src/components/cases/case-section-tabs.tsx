"use client";

import type { ReactNode } from "react";
import { CaseLink as Link } from "@/components/cases/case-reader";
import { useCaseRouter } from "@/components/cases/case-reader";
import { HourglassIcon } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { OverflowTabsList } from "@/components/chrome/overflow-tabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  CASE_NAV_SECTIONS,
  caseSectionHref,
  isCaseSection,
  isNavSection,
  type CaseSection,
} from "@/lib/cases/sections";
import { cn } from "@/lib/utils";

const STRIP_LABEL = "Case file sections";

/** The scrolling gutter the row sits in, and the rule under it. Exported so
 *  a tab row inside a section (Notice/Process Status's people) is this row. */
export const STRIP_ROW = "overflow-x-auto border-b border-hairline";

/**
 * What this file sets on a destination, either side of the branch below: the
 * control height and no flex-grow, so labels keep their own widths. Type
 * stays the primitive's own compact size, as on every other tab strip.
 */
export const STRIP_ITEM = "h-10 flex-none px-3 text-body-compact";

/** The line `TabsList` and its triggers, as the strip sets them. */
export const STRIP_LIST =
  "h-10 w-full justify-start rounded-none p-0 group-data-horizontal/tabs:h-10";
export const STRIP_TRIGGER = cn(
  STRIP_ITEM,
  "group-data-horizontal/tabs:after:-bottom-px"
);

/**
 * `TabsTrigger`'s own resting appearance, for the branch that cannot use
 * `TabsTrigger`. Copied from the primitive rather than reinterpreted — focus
 * ring included — so a reader cannot tell which branch drew the row. Only the
 * selected-state classes are left out, because in that branch nothing is.
 */
const STRIP_LINK = cn(
  STRIP_ITEM,
  "relative inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent py-0.5 font-medium whitespace-nowrap text-muted-foreground transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring"
);

/**
 * In-file section nav. Line TabsList (underline), not the pill track —
 * case peek uses the same chrome; the cases list keeps default because
 * those are mutually exclusive populations. Height only on TabsList
 * (h-10). Nine destinations will not fit a phone width, so the row
 * scrolls rather than crushing labels (RESPONSIVE).
 *
 * The primitive hangs the mark at after:bottom-[-5px] for a padded
 * track. overflow-x-auto clips that hang (x-scroll forces y-clip), so
 * catching it with pb-1 leaves a gap above the divider. Sit the mark
 * at after:-bottom-px so it meets the divider.
 *
 * Two renderings, because a section can be routable without being in the
 * strip (`UNLISTED_SECTIONS` — Hearings today). Arriving at one of those, the
 * strip has no tab to mark, and a `Tabs` whose value matches no trigger is
 * not a cosmetic gap: no trigger carries `aria-selected="true"`, so the
 * widget tells a screen-reader user they are on none of nine tabs while the
 * page plainly shows them somewhere, and Radix still labels the visible panel
 * with an `aria-labelledby` pointing at a trigger id that was never rendered.
 * Both are WAI-ARIA 1.2 defects (ACCESSIBILITY 2, 3).
 *
 * So an unlisted section drops the tab widget and the row renders as what it
 * has been all along — links to the rest of the case file, none of them
 * current. Navigation with no current item is ordinary; a tablist with no
 * selected tab is not. It is also the way back: every other section is one
 * click away, in the same place and the same order as on every other screen,
 * and the section you are on names itself in its own heading below.
 *
 * The row is the same row either way — same gutter, same metrics, same
 * resting and focus treatment, off the constants above — so nothing shifts
 * when you cross the branch.
 */
export function CaseSectionTabs({
  caseId,
  section,
  children,
}: {
  caseId: string;
  section: CaseSection;
  children: ReactNode;
}) {
  const router = useCaseRouter();

  if (!isNavSection(section)) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div className={STRIP_ROW}>
          {/* `gap-1` and the transparent fill are the line TabsList's own
              metrics, so both rows land on the same grid. */}
          <nav
            aria-label={STRIP_LABEL}
            className="inline-flex h-10 w-max min-w-full items-center justify-start gap-1"
          >
            {CASE_NAV_SECTIONS.map((item) => (
              <Link
                key={item.value}
                href={caseSectionHref(caseId, item.value)}
                className={STRIP_LINK}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {children}
      </div>
    );
  }

  return (
    <Tabs
      value={section}
      onValueChange={(value) => {
        if (!isCaseSection(value)) return;
        router.replace(caseSectionHref(caseId, value), { scroll: false });
      }}
      className="flex min-w-0 flex-col gap-4"
    >
      <div className={STRIP_ROW}>
        {/* The sections that fit stay in the row; the rest fold under More
            (owner, Sept 21), so nine destinations never scroll sideways. */}
        <OverflowTabsList
          aria-label={STRIP_LABEL}
          value={section}
          onSelect={(value) => {
            if (!isCaseSection(value)) return;
            router.replace(caseSectionHref(caseId, value), { scroll: false });
          }}
          className={STRIP_LIST}
          triggerClassName={STRIP_TRIGGER}
          items={CASE_NAV_SECTIONS.map((item) => ({
            value: item.value,
            label: item.label,
          }))}
        />
      </div>

      {/* Panels for the strip's own members only. An unlisted section never
          reaches here — it took the branch above. */}
      {CASE_NAV_SECTIONS.map((item) => (
        <TabsContent
          key={item.value}
          value={item.value}
          className="outline-none"
        >
          {item.value === section ? children : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function SectionPending({ label }: { label: string }) {
  return (
    <Empty className="border border-dashed border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HourglassIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-title-s font-semibold">
          {label} is not designed yet
        </EmptyTitle>
        <EmptyDescription>
          The case header is in place. This section of the file still needs to
          be built.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
