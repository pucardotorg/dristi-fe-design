"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  FilesIcon,
  PanelLeftOpenIcon,
} from "lucide-react";

import { draftProgress, sectionState, type SectionState } from "@/lib/filing/selectors";
import {
  FILING_STEPS,
  stepFromPathname,
  stepGroups,
  type FilingStep,
} from "@/lib/filing/steps";
import { useFiling } from "@/lib/filing/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TOP_BAR_HEIGHT, useFilingChrome } from "@/components/filing/chrome";
import { useLeaveBlocked } from "@/components/filing/leave-guard";
import {
  UploadedCountBadge,
  UploadedDocsDrawer,
} from "@/components/filing/uploaded-docs-drawer";
import { useCourtText } from "@/components/court/court-provider";

/**
 * A row in the rail. `Button` is the DS control that already meets the 40px metric, so
 * rows are 40px tall rather than the 32px of `SidebarMenuButton` and need no hit-area
 * patch. The current step takes the rail's own brand tint, which is also what colours its
 * icon — "you are here" is one cue, not two competing ones.
 */
const ROW = "h-10 w-full justify-start gap-2 px-2 font-normal";
const ROW_ACTIVE =
  "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
/**
 * Steps listed for orientation with no screen behind them. They keep full contrast — a
 * 50% label is not a readable one — and stay focusable, so the note saying where that
 * work actually happens is reachable by keyboard rather than by hover alone.
 */
const ROW_PLACEHOLDER = "text-muted-foreground";

/** Where each listed-but-screenless step is really carried out. */
const PLACEHOLDER_NOTE: Record<string, string> = {
  affidavit: "composed for you on the preview screen",
  "pay-fees": "paid on the sign screen, after signing",
};

function useActiveStep(): FilingStep | undefined {
  const pathname = usePathname();
  const id = stepFromPathname(pathname);
  return FILING_STEPS.find((s) => !s.placeholder && s.id === id);
}

/* ───────────────────────────── Rows ────────────────────────────────── */

/**
 * Where a section stands, at the end of its row — supporting information, so it stays
 * small and quiet: a check for done, a dashed ring for started, nothing for untouched.
 * The shape carries the meaning and the words are there for a screen reader, so colour
 * is never the only cue.
 */
function SectionMark({ state }: { state: SectionState }) {
  if (state === "untouched") return null;
  return state === "done" ? (
    <>
      <CheckIcon aria-hidden className="ml-auto text-success-ink" />
      <span className="sr-only">, complete</span>
    </>
  ) : (
    <>
      <CircleDashedIcon aria-hidden className="ml-auto text-muted-foreground" />
      <span className="sr-only">, in progress</span>
    </>
  );
}

function StepRow({
  step,
  active,
  onNavigate,
}: {
  step: FilingStep;
  active: boolean;
  onNavigate: () => void;
}) {
  const courtText = useCourtText();
  const { draft, hrefFor } = useFiling();
  const blocked = useLeaveBlocked();
  const Icon = step.icon;

  if (step.placeholder) {
    return (
      <li>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              aria-disabled="true"
              className={cn(ROW, ROW_PLACEHOLDER)}
            >
              <Icon aria-hidden />
              <span className="min-w-0 truncate">{courtText(step.title)}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {courtText(step.title)}: {PLACEHOLDER_NOTE[step.id] ?? "not a screen of its own"}
          </TooltipContent>
        </Tooltip>
      </li>
    );
  }

  const href = hrefFor(step.id);

  const row = (
    <Button asChild variant="ghost" className={cn(ROW, active && ROW_ACTIVE)}>
      <Link
        href={href}
        onClick={(event) => {
          // Sign registers a guard: leaving that step voids the signatures collected on
          // it, so the rail asks before it follows the link rather than after.
          if (blocked(href)) {
            event.preventDefault();
            return;
          }
          onNavigate();
        }}
        aria-current={active ? "page" : undefined}
      >
        <Icon aria-hidden className={active ? undefined : "text-muted-foreground"} />
        <span className="min-w-0 truncate">{courtText(step.title)}</span>
        <SectionMark state={sectionState(draft, step.id)} />
      </Link>
    </Button>
  );

  return <li>{row}</li>;
}

function DocsRow({ onOpen }: { onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={ROW}
    >
      <FilesIcon aria-hidden className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-left">View uploaded documents</span>
      <UploadedCountBadge />
    </Button>
  );
}

/* ───────────────────────────── Rail body ───────────────────────────── */

function StepList({
  onNavigate,
  onOpenDocs,
}: {
  onNavigate: () => void;
  onOpenDocs: () => void;
}) {
  const courtText = useCourtText();
  const active = useActiveStep();

  return (
    <nav aria-label="Filing sections" className="flex flex-col gap-4 px-2">
      <ul className="flex w-full flex-col gap-1">
        <li>
          <DocsRow onOpen={onOpenDocs} />
        </li>
      </ul>

      {stepGroups().map((g) => (
        <div key={g.group} className="flex w-full flex-col gap-1">
          <h2 className="px-2 text-caption font-medium text-muted-foreground">
            {courtText(g.group)}
          </h2>
          <ul className="flex flex-col gap-1">
            {g.steps.map((s) => (
              <StepRow
                key={s.id}
                step={s}
                active={active?.id === s.id}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function ProgressBlock() {
  const { draft } = useFiling();
  const progress = draftProgress(draft);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-caption">
        <span className="font-medium text-foreground">Progress</span>
        <span className="tabular-nums text-muted-foreground">{progress}%</span>
      </div>
      <Progress value={progress} aria-label="Filing progress" className="h-1.5" />
    </div>
  );
}

/* ───────────────────────────── Rail ────────────────────────────────── */

/**
 * The filing's own navigation: progress, the uploaded documents, and every section
 * grouped as in the court form.
 *
 * Composed from primitives rather than the DS `Sidebar` on purpose — the app's main nav
 * is already a `Sidebar`, and its provider owns ⌘B and the `sidebar_state` cookie for the
 * whole page, so a second provider would toggle two rails at once.
 *
 * It does not collapse. The main nav already collapses, and a screen where three separate
 * surfaces can each be open or shut asks the person to manage the furniture instead of the
 * filing (owner, 2026-08-18). From `lg` up it is a fixed column; narrower than that there
 * is no width for it, so it becomes a sheet opened from the "Sections" button.
 */
export function SectionsRail() {
  const { sectionsSheetOpen, setSectionsSheetOpen } = useFilingChrome();
  const [docsOpen, setDocsOpen] = React.useState(false);
  const closeSheet = () => setSectionsSheetOpen(false);

  return (
    <>
      <aside
        aria-label="Sections"
        style={{ top: TOP_BAR_HEIGHT, height: `calc(100svh - ${TOP_BAR_HEIGHT})` }}
        className="sticky hidden w-72 shrink-0 flex-col self-start overflow-y-auto border-r border-hairline bg-sidebar lg:pointer-fine:flex lg:landscape:flex"
      >
        <div className="flex flex-col gap-3 px-4 py-4">
          <span className="text-body font-medium text-foreground">Sections</span>
          <ProgressBlock />
        </div>

        <div className="pb-4">
          <StepList onNavigate={() => undefined} onOpenDocs={() => setDocsOpen(true)} />
        </div>
      </aside>

      <Sheet open={sectionsSheetOpen} onOpenChange={setSectionsSheetOpen}>
        <SheetContent side="left" className="w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-title-s font-semibold">Sections</SheetTitle>
            <SheetDescription className="text-body-compact">
              Every part of this filing, in the order the court form takes them.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <ProgressBlock />
          </div>
          <div className="pb-6">
            <StepList
              onNavigate={closeSheet}
              onOpenDocs={() => {
                closeSheet();
                setDocsOpen(true);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <UploadedDocsDrawer open={docsOpen} onOpenChange={setDocsOpen} />
    </>
  );
}

/**
 * Opens the rail wherever it is a sheet rather than a column: below `lg`, and on an
 * upright tablet of any width, where the main nav, an 18rem rail and the form would
 * share 1024px three ways.
 *
 * A slim bar on the form's own canvas, not a lone button on a white strip: it reads as
 * where you are in the filing (the step count) and as something that opens (the panel
 * glyph and the chevron), the same pair the case file's Browse bar uses.
 */
export function SectionsTrigger() {
  const { sectionsSheetOpen, setSectionsSheetOpen } = useFilingChrome();
  const active = useActiveStep();
  const walked = FILING_STEPS.filter((s) => !s.placeholder);
  const position = active ? walked.findIndex((s) => s.id === active.id) + 1 : 0;

  // The trigger sticks under the top bar so a thumb never has to scroll back up for it.
  // On the phone form it shrinks to its icon while the page rests and grows back the
  // moment a scroll or focus asks for it, reclaiming a scarce line; tablets keep the full
  // button (`sm:`), since they have the width to spare (owner, 2026-09-29).
  const marker = React.useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = React.useState(false);
  const [scrolling, setScrolling] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const measure = () => {
      const el = marker.current;
      const band = el?.nextElementSibling;
      if (el && band) {
        setStuck(el.getBoundingClientRect().top < parseFloat(getComputedStyle(band).top));
      }
    };
    const onScroll = () => {
      measure();
      setScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 1400);
    };
    measure();
    // Scroll events do not bubble; the filing form scrolls in its own pane, not the
    // window, so listen in the capture phase to catch whichever pane actually moves.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", measure);
      clearTimeout(timer);
    };
  }, []);
  // Collapse only when it is stuck and the page is at rest; any scroll, focus or the open
  // sheet keeps it full. `sm:` overrides the collapse, so tablets never shrink.
  const shrink = stuck && !scrolling && !focused && !sectionsSheetOpen;

  return (
    <>
      {/* Sentinel for `measure`: once it scrolls above the sticky offset, the bar is stuck. */}
      <div ref={marker} className="h-0" aria-hidden />
      {/* The bar is transparent and click-through, so only the button is opaque: content
          shows beside the collapsed icon and flows right under the button, never behind a
          band. The one exception is the full-bleed canvas fill below, which covers just the
          gap up to the top bar so that space reads as the page rather than letting a strip of
          content peek through. The gap sits inside the sticky box, so it is identical resting
          or stuck — the button holds its place instead of jumping up to touch the bar. */}
      <div
        style={{ top: TOP_BAR_HEIGHT }}
        className="pointer-events-none sticky z-20 px-6 lg:pointer-fine:hidden lg:landscape:hidden"
      >
        <div aria-hidden className="-mx-6 h-4 bg-muted dark:bg-background" />
        {/* One button that morphs its own width: full-width on the phone form, easing down
            to its icon while the page rests and back on scroll. The label clips in place,
            so the button keeps its full accessible name collapsed. Tablets keep the full
            button (`sm:w-auto`), since they have the width to spare. */}
        <Button
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          aria-expanded={sectionsSheetOpen}
          onClick={() => setSectionsSheetOpen(true)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            "pointer-events-auto justify-start gap-0 overflow-hidden bg-card shadow-raised transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none sm:w-auto",
            shrink ? "w-12" : "w-full"
          )}
        >
          <PanelLeftOpenIcon aria-hidden />
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap pl-2">
            Sections
            {position ? (
              <span className="ml-auto pl-3 text-caption font-normal tabular-nums text-muted-foreground">
                Step {position} of {walked.length}
              </span>
            ) : null}
            <ChevronRightIcon aria-hidden className="text-muted-foreground" />
          </span>
        </Button>
      </div>
    </>
  );
}
