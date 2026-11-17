"use client";

import * as React from "react";

/** Height of the top bar — sticky rails hang below it and read the same number. */
export const TOP_BAR_HEIGHT = "3.5rem";

export type Crumb = {
  label: string;
  href?: string;
  /**
   * Set where the label *is* an identifier — a case number, a filing number — so the
   * bar gives it the same monospaced face the screens do. It travels as a flag rather
   * than as a node because crumbs reach the chrome through `JSON.stringify`.
   */
  mono?: boolean;
};

export type ChromeValue = {
  /** Breadcrumb after the area root, e.g. [task title, "Pay"]. */
  crumbs: Crumb[];
  setCrumbs: (crumbs: Crumb[]) => void;
  /**
   * The trail's first crumb, when the screen knows better than the route does — a screen
   * reached through a door in another area roots its trail at that door. Null leaves the
   * top bar to name the area from the path, which is right for a screen reached directly.
   */
  crumbRoot: Crumb | null;
  setCrumbRoot: (root: Crumb | null) => void;
  /** Whether the main nav shows its labels (true) or only its icon rail (false). */
  navOpen: boolean;
  /**
   * Whether the open nav lies over the page rather than beside it — true below the desk
   * width, where the rail starts as its icon strip and opens only on request.
   */
  navOverlay: boolean;
  /** Collapse the main nav to its icon rail — used when a side panel opens. */
  foldNav: () => void;
  /** Bring the labels back — used when the panel that folded it closes. */
  unfoldNav: () => void;
};

export const ChromeContext = React.createContext<ChromeValue | null>(null);

/**
 * The main nav's two fold controls: the bar's expand control and the rail's collapse
 * control. Exactly one is on screen at a time, and each hands the keyboard to the other.
 */
export type NavTriggerRole = "expand" | "collapse";
export const navTriggerAttr = (role: NavTriggerRole) => ({ "data-nav-trigger": role });

/**
 * Put the keyboard on one of the fold controls once the rail has drawn the new state.
 *
 * Named rather than "whichever takes focus": the control being left can still accept
 * focus for a moment (a just-hidden element is blurred only on the browser's next style
 * pass), so a first-come search hands focus straight back to it. And retried for a few
 * frames, because the fold is not always committed by the next one — Escape is heard by
 * a document listener, outside React's own events, and its update lands later.
 */
export function focusNavTrigger(role: NavTriggerRole, frames = 4) {
  requestAnimationFrame(() => {
    const control = document.querySelector<HTMLElement>(
      `[data-nav-trigger="${role}"]`,
    );
    control?.focus();
    if (document.activeElement !== control && frames > 1) {
      focusNavTrigger(role, frames - 1);
    }
  });
}

/**
 * State the app chrome shares with the screens: what the breadcrumb should say, and a
 * way to fold the nav rail when a screen needs the width.
 */
export function useChrome(): ChromeValue {
  const ctx = React.useContext(ChromeContext);
  if (!ctx) throw new Error("useChrome must be used inside <AppShell>");
  return ctx;
}

/**
 * Publishes a screen's crumbs to the top bar. Rendered inside the screen — the top bar
 * sits above the screen's data, so it cannot read it itself.
 */
export function Breadcrumbs({ crumbs, root }: { crumbs: Crumb[]; root?: Crumb | null }) {
  const { setCrumbs, setCrumbRoot } = useChrome();
  const key = JSON.stringify(crumbs);
  const rootKey = JSON.stringify(root ?? null);
  React.useEffect(() => {
    setCrumbs(JSON.parse(key));
    return () => setCrumbs([]);
  }, [key, setCrumbs]);
  React.useEffect(() => {
    setCrumbRoot(JSON.parse(rootKey));
    return () => setCrumbRoot(null);
  }, [rootKey, setCrumbRoot]);
  return null;
}
