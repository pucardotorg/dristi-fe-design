"use client";

/**
 * What is still empty on the screen, and the way to it.
 *
 * Every required `FormField` reports whether it is empty. The footer counts them ("3
 * required fields still needed") and the count is a button: pressed, each empty required
 * field shows the field error "Required" and the first is scrolled to and focused. The
 * preview's "sections incomplete" rows open a section with `?missing=1`, which does the
 * same on arrival (owner, 2026-11-10).
 *
 * Nothing is marked before it is asked for, so a half-filled section does not open red.
 * The count is of the fields on screen: a branch not taken asks for nothing.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFieldPolicy } from "@/components/filing/field-policy";

/**
 * TEMPORARY (owner, 2026-11-10): the missing-fields and missing-documents guides in the
 * single filing, on trial until the owner says to remove them. Bulk filing keeps the
 * documents guide through `FieldPolicy.guideMissing` either way.
 */
export const TRY_GUIDE_IN_SINGLE_FILING = true;

type MissingFields = {
  revealed: boolean;
  count: number;
  report: (id: string, empty: boolean | null) => void;
  reveal: () => void;
};

const Ctx = React.createContext<MissingFields | null>(null);

/** Put the first empty required field in the middle of the screen, focused. */
function goToFirst() {
  const first = Array.from(document.querySelectorAll<HTMLElement>("[data-missing-field]")).find(
    (el) => el.getClientRects().length > 0,
  );
  if (!first) return;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  first.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  const control = first.querySelector<HTMLElement>(
    'input:not([type=hidden]):not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  control?.focus({ preventScroll: true });
}

function Provider({ children }: { children: React.ReactNode }) {
  const empties = React.useRef(new Set<string>());
  const [count, setCount] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);

  const report = React.useCallback((id: string, empty: boolean | null) => {
    const set = empties.current;
    const had = set.has(id);
    if (empty && !had) set.add(id);
    else if (!empty && had) set.delete(id);
    else return;
    setCount(set.size);
  }, []);

  const reveal = React.useCallback(() => {
    setRevealed(true);
    // After the errors render, so the scroll lands on the field as it will look.
    requestAnimationFrame(() => requestAnimationFrame(goToFirst));
  }, []);

  // Opened from the preview's list of incomplete sections: show what is left at once.
  // Read once and kept: the effect runs twice in development, and the first run tidies
  // the address.
  const arrived = React.useRef<boolean | null>(null);
  React.useEffect(() => {
    const url = new URL(window.location.href);
    arrived.current ??= url.searchParams.has("missing");
    if (!arrived.current) return;
    if (url.searchParams.has("missing")) {
      url.searchParams.delete("missing");
      window.history.replaceState(window.history.state, "", url);
    }
    // A frame on, once the section's fields have reported themselves.
    const frame = requestAnimationFrame(reveal);
    return () => cancelAnimationFrame(frame);
  }, [reveal]);

  const value = React.useMemo(() => ({ revealed, count, report, reveal }), [revealed, count, report, reveal]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Around a filing's sections; a fresh count and an unrevealed screen per section. */
export function MissingFieldsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // A host (bulk filing) has its own checks under the fields; the trial is the single filing's.
  const host = useFieldPolicy();
  if (host || !TRY_GUIDE_IN_SINGLE_FILING) return <>{children}</>;
  return <Provider key={pathname}>{children}</Provider>;
}

export function useMissingFields() {
  return React.useContext(Ctx);
}

/**
 * A required field reporting itself. `empty` is `null` where the field can't tell (a
 * group of controls with no single value): it is then left out of the count.
 * Returns whether to show the field as missing now.
 */
export function useMissingField(empty: boolean | null): { missing: boolean; flagged: boolean } {
  const ctx = React.useContext(Ctx);
  const id = React.useId();
  const report = ctx?.report;
  React.useEffect(() => {
    if (!report) return;
    report(id, empty);
    return () => report(id, null);
  }, [report, id, empty]);
  const missing = !!ctx && empty === true;
  return { missing, flagged: missing && ctx.revealed };
}

/** The footer's count, as the way to what it counts. */
export function MissingFieldsButton() {
  const ctx = React.useContext(Ctx);
  if (!ctx || ctx.count === 0) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={ctx.reveal}
      className="-ml-2 h-auto min-h-10 px-2 text-body-compact font-normal text-foreground"
    >
      <TriangleAlertIcon className="text-warning-ink" data-icon="inline-start" aria-hidden />
      <span className="underline decoration-muted-foreground underline-offset-4">
        {ctx.count} required field{ctx.count === 1 ? "" : "s"} still needed
      </span>
    </Button>
  );
}

/**
 * Whether a field's one control is empty, read from its `value`, so most fields need
 * nothing passed. `null` when the child is not a single control with a string value.
 */
export function inferEmpty(children: React.ReactNode): boolean | null {
  const only = React.Children.toArray(children);
  if (only.length !== 1 || !React.isValidElement(only[0])) return null;
  const v = (only[0].props as { value?: unknown }).value;
  return typeof v === "string" ? v.trim() === "" : null;
}
