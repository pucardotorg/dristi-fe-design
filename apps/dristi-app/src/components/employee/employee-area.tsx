"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { ChromeShell } from "@/components/chrome/app-chrome";
import { CourtSearchProvider } from "@/components/employee/court-search";
import { EmployeeNav } from "@/components/employee/employee-nav";
import { EmployeeTopBar } from "@/components/employee/employee-top-bar";
import { ApplicationOrderTriggers } from "@/components/employee/application-order-triggers";
import { AppToaster } from "@/components/shell/app-toaster";

/**
 * Which part of the bench's side a path belongs to — `AppShell`'s own `areaOf`, one
 * route deep here. The rail is open everywhere except the order composer, which now
 * reads a case file beside the order and needs the width a full rail takes from the
 * page (owner, 2026-09-22), and the application workstation, whose three columns need
 * the same width (owner, 2026-10-08: the side nav "in a collapsed state").
 */
function railAreaOf(pathname: string): "rail" | "flow" {
  return /^\/employee\/hearings\/[^/]+\/order(?:\/|$)/.test(pathname) ||
    /^\/employee\/applications\/[^/]+(?:\/|$)/.test(pathname)
    ? "flow"
    : "rail";
}

/**
 * The court-staff area wrapper.
 *
 * Court staff do not get the citizen `AppShell` — the rail there is the advocate's product
 * (pending tasks, filings, join a case) and none of it is the bench's. What the two halves
 * of the app *do* share is their chrome, and that now lives in one place:
 * `components/chrome` owns the frame — rail plate, row metrics, bar height, seams — and
 * each area pours its own content into it. `/employee` consumes it here; the advocate's
 * shell migrates onto the same frame next.
 *
 * Two regions, layered the DS way: the charcoal rail down the left, and the white page
 * beside it. The mark sits at the head of the rail, where the page origin is, and the bar
 * runs across the page at every width — see `EmployeeTopBar` for what it carries and what
 * it deliberately does not.
 *
 * `main` is a flex column so a screen that wants to pin a footer (the order composer)
 * can fill the remaining height. Screens that don't opt in still start at the top.
 *
 * There is no sign-in in front of this: `/employee` is the entry point.
 */
export function EmployeeArea({ children }: { children: React.ReactNode }) {
  /* Keyed by area rather than by the exact path, the same reasoning `AppShell` gives
     for its own version: "Next hearing" moves the typist from one order's URL to
     another without leaving the order composer, and a toggle they made themselves
     should hold across that move rather than snapping back to the route's default on
     every hearing. */
  const area = railAreaOf(usePathname());
  const [nav, setNav] = React.useState<{ area: string; open: boolean }>({
    area,
    open: area === "rail",
  });
  const navOpen = nav.area === area ? nav.open : area === "rail";
  const setNavOpen = React.useCallback(
    (open: boolean) => setNav({ area, open }),
    [area],
  );

  return (
    /* The search is the area's, not the rail's: the rail is where it is *opened* from,
       but ⌘K works on any court screen and the dialog portals out of the rail's tree.
       Wrapping here is also what lets a screen offer its own way in later without the
       rail having to hand the opener down. */
    <CourtSearchProvider>
    {/* The rail folds to a 4rem strip. The prop is the shell's rather than the rail's
        because the page column's overlays measure their left edge from it too, and one of
        them is portalled out of this tree — see `ChromeShell`. */}
    <ChromeShell
      rail={<EmployeeNav />}
      topBar={<EmployeeTopBar />}
      railCollapsible="icon"
      open={navOpen}
      onOpenChange={setNavOpen}
    >
      {/* **The beige canvas, once, for the whole area** (owner, 2026-09-12: *"this base
          change that we added for the surface, can you add it to all other pages also"*).
          It was per-screen while it was an experiment; it is the default now (`ui-craft`
          §1.0), so it belongs to the area's own column rather than to each screen that
          remembers to ask for it. The top bar and the rail keep their own fills, so the
          tint reads as the surface the work sits on. Dark keeps `bg-background`, because
          `muted` sits above `card` there and a tinted canvas would invert the depth. */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted dark:bg-background">
        {children}
      </main>
      {/* Inside the page column, so it inherits the column's `--chrome-page-inset` and
          centres on the bench's workspace rather than on the window. */}
      <AppToaster />
      {/* A triggered order decides the applications in its workflow, wherever it was
          signed or completed (owner, 2026-10-14). */}
      <ApplicationOrderTriggers />
    </ChromeShell>
    </CourtSearchProvider>
  );
}
