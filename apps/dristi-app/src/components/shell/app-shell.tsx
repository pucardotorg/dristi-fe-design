"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  ChromeRailFolds,
  RAIL_WIDTH,
  RAIL_WIDTH_ICON,
} from "@/components/chrome/app-chrome";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/shell/app-sidebar";
import {
  ChromeContext,
  focusNavTrigger,
  type ChromeValue,
  type Crumb,
} from "@/components/shell/chrome";
import { AppSearchProvider } from "@/components/shell/app-search";
import { FeedbackToaster } from "@/components/ui/feedback-toaster";
import { ProfileProvider } from "@/components/shell/profile";
import { RailThemeProvider } from "@/components/shell/rail-theme";
import { TopBar } from "@/components/shell/top-bar";

/**
 * Which part of the app a path belongs to. The main nav is expanded on list/dashboard
 * screens and collapsed inside a flow (a task's pay/sign/fix, a filing draft), where
 * the page needs the width for a document and its actions.
 */
function areaOf(pathname: string): "list" | "flow" {
  if (pathname.startsWith("/tasks")) {
    return pathname.replace(/^\/tasks\/?/, "") ? "flow" : "list";
  }
  if (pathname.startsWith("/filings")) {
    // `/filings/new` and `/filings/bulk` are dashboard screens, not drafts. A case open
    // inside a bulk batch is a draft like any other: the rail holds for every section of
    // it, rather than folding only where a source panel needs the width (round-3 audit).
    const parts = pathname.replace(/^\/filings\/?/, "").split("/");
    if (parts[0] === "bulk") return parts[2] === "cases" && parts[3] ? "flow" : "list";
    return parts[0] && parts[0] !== "new" ? "flow" : "list";
  }
  return "list";
}

/**
 * The narrowest window that keeps the labelled rail beside the page.
 *
 * Measured, not picked from the Tailwind ladder (there is no step here): with the 16rem
 * rail open, 1366 leaves a 1110px column and 1280 a 1024px one, which is where list
 * toolbars wrap to a second line and a bulk batch's documents grid scrolls sideways. At
 * 1440 the column is 1184px and every list fits on one line. Below it the rail starts as
 * its icon strip and opens over the page on request.
 *
 * Twice, once per language, and the two must agree: `NARROW_GAP` is the CSS half and
 * `DESK_QUERY` the JS half. Tailwind's `max-[1440px]:` is `width < 1440px`, the exact
 * complement of `min-width: 1440px`.
 */
const DESK_QUERY = "(min-width: 1440px)";
const NARROW_GAP =
  "max-[1440px]:[&_[data-slot=sidebar-gap]]:w-(--sidebar-width-icon) motion-reduce:[&_[data-slot=sidebar-gap]]:transition-none";

function subscribeDesk(onChange: () => void) {
  const query = window.matchMedia(DESK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Is the window wide enough for the labelled rail to sit beside the page?
 *
 * `true` on the server: the server cannot know, and the page column's width does not
 * depend on the answer (see `NARROW_GAP`), only what the rail draws inside its strip —
 * which `AppSidebar` keeps blank until the client has answered.
 */
function useDeskWidth(): boolean {
  return React.useSyncExternalStore(
    subscribeDesk,
    () => window.matchMedia(DESK_QUERY).matches,
    () => true,
  );
}

const noSubscription = () => () => {};

/** `false` only while hydrating server HTML; a shell mounted by a client navigation is `true` at once. */
function useHydrated(): boolean {
  return React.useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

/**
 * Layers that portal out of the rail but belong to it — its account popover, a tooltip,
 * a dialog opened from its menu. Pointer and focus there are not "outside".
 */
const RAIL_LAYERS =
  "[data-slot=sidebar-container], [data-radix-popper-content-wrapper], [role=dialog], [role=alertdialog]";

/**
 * Put the overlaid rail away when attention leaves it: a press anywhere else, focus moving
 * into the page, or Escape. It is not modal — the press still lands where it was aimed.
 * Escape inside a layer of its own (the account popover) closes that layer first; Escape
 * from the rail itself returns the keyboard to the bar's expand control.
 */
function useOverlayDismiss(open: boolean, close: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) =>
      target instanceof Element && !target.closest(RAIL_LAYERS);
    const onPointerDown = (event: PointerEvent) => {
      if (outside(event.target)) close();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (outside(event.target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      // Not gated on `defaultPrevented`: a rail row's tooltip is a Radix layer even while
      // the open rail hides it, and it claims the first Escape for itself.
      if (event.key !== "Escape") return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "[data-radix-popper-content-wrapper], [role=dialog], [role=alertdialog]",
        )
      )
        return;
      // Escape from inside the rail returns the keyboard to the control that opened it.
      const fromRail =
        target instanceof Element && target.closest("[data-slot=sidebar-container]");
      close();
      if (fromRail) focusNavTrigger("expand");
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);
}

/**
 * The app shell: the main navigation rail on the left, and a column holding the top bar
 * and the screen. One `SidebarProvider` for the whole area — the primitive binds ⌘B and
 * the `sidebar_state` cookie at the provider, so a second one would leave both toggling
 * two rails at once.
 *
 * Nav width follows the route and the window. On a desk: labels on the list, the icon
 * rail inside an act flow, and a toggle holds for as long as the person stays in that
 * area. Below `DESK_QUERY`: the icon rail everywhere, opened over the page on request
 * and put away on navigation, a press outside it, or Escape.
 *
 * `topBar` lets an area bring its own bar (the filings flow has a draft breadcrumb and
 * a sections-rail toggle no other area needs) while everything else — rail, theme,
 * profile, fold behaviour — stays the one shell. This is the unification seam: an area
 * customises the bar, never the rail.
 */
export function AppShell({
  children,
  topBar,
}: {
  children: React.ReactNode;
  topBar?: React.ReactNode;
}) {
  const pathname = usePathname();
  const area = areaOf(pathname);
  const desk = useDeskWidth();
  const hydrated = useHydrated();

  // The open state is keyed by where it was chosen. On a desk it holds for the area, as
  // before: a person who folds the rail on a list keeps it folded on that list. Narrower,
  // the open rail is an overlay over the page, so it is keyed by the page: any navigation
  // puts it away. Crossing the width line changes the key either way, so a choice made
  // in one layout never carries into the other.
  const key = desk ? `desk:${area}` : `narrow:${pathname}`;
  const [nav, setNav] = React.useState<{ key: string; open: boolean }>({
    key,
    open: desk && area === "list",
  });
  const navOpen = nav.key === key ? nav.open : desk && area === "list";
  const navOverlay = !desk;
  const setNavOpen = React.useCallback(
    (open: boolean) => setNav({ key, open }),
    [key],
  );
  const foldNav = React.useCallback(() => setNavOpen(false), [setNavOpen]);
  const unfoldNav = React.useCallback(() => setNavOpen(true), [setNavOpen]);
  const overlayOpen = navOverlay && navOpen;
  useOverlayDismiss(overlayOpen, foldNav);

  const [crumbs, setCrumbs] = React.useState<Crumb[]>([]);
  const [crumbRoot, setCrumbRoot] = React.useState<Crumb | null>(null);

  const chrome = React.useMemo<ChromeValue>(
    () => ({
      crumbs,
      setCrumbs,
      crumbRoot,
      setCrumbRoot,
      navOpen,
      navOverlay,
      foldNav,
      unfoldNav,
    }),
    [crumbs, crumbRoot, navOpen, navOverlay, foldNav, unfoldNav],
  );

  return (
    <TooltipProvider>
      <ProfileProvider>
        <ChromeContext.Provider value={chrome}>
          {/*
           * The width: the DS ships 3rem, which leaves a 40px row only 4px a side. 3.5rem
           * made the gutters even but still read tight — the strip was a slot the icons
           * were wedged into. 4rem gives each square 12px of air, which is what lets it
           * read as a rail rather than a margin.
           *
           * The rail's inks all come from the selected rail theme now — see
           * `rail-theme.tsx`, where each plate names its complete, contrast-checked
           * palette outright instead of borrowing a scope.
           */}
          <RailThemeProvider>
            <AppSearchProvider>
              <ChromeRailFolds overlay={navOverlay}>
                <SidebarProvider
                  open={navOpen}
                  onOpenChange={setNavOpen}
                  /* Below the desk width the rail's place in the layout is the icon
                     strip whatever its state: open, it lies over the page instead of
                     pushing it. Written as a media query on the primitive's spacer, not
                     from `desk`, so the page column has its final width in the server
                     HTML — before hydration can say which side of the line this is. */
                  className={NARROW_GAP}
                  style={
                    { "--sidebar-width-icon": RAIL_WIDTH_ICON } as React.CSSProperties
                  }
                >
                  <AppSidebar overlayOpen={overlayOpen} hydrated={hydrated} />
                  {/* Not `SidebarInset`: that primitive is itself a `<main>`, and the screens
                  below already own that landmark. */}
                  <div
                    className="flex min-h-svh min-w-0 flex-1 flex-col bg-background"
                    /* The column's left inset, for chrome that is fixed to the window and
                       has to centre on the page instead — see `chromePageInset`. This shell
                       has not migrated onto `ChromeShell` yet, so it publishes the same
                       property itself rather than inheriting it. */
                    style={
                      {
                        "--chrome-page-inset":
                          navOpen && !navOverlay ? RAIL_WIDTH : RAIL_WIDTH_ICON,
                      } as React.CSSProperties
                    }
                  >
                    {topBar ?? <TopBar />}
                    <div className="flex min-h-0 flex-1">{children}</div>
                    {/* One toaster per area, mounted with the column it centres on rather
                        than by each layout — five layouts mounted one and the whole
                        /filings tree silently had none. */}
                    <FeedbackToaster />
                  </div>
                </SidebarProvider>
              </ChromeRailFolds>
            </AppSearchProvider>
          </RailThemeProvider>
        </ChromeContext.Provider>
      </ProfileProvider>
    </TooltipProvider>
  );
}
