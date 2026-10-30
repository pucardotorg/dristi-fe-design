"use client";

import * as React from "react";
import { CircleXIcon } from "lucide-react";

import { FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { StatusMark, type MarkTone } from "./mark";

/**
 * Feedback inside a page or an open dialog.
 *
 * - `StatusLine`: one shape for every inline note (success, error, warning, info,
 *   neutral). A white line with a straight rail in its tone, flush left and clipped by the
 *   corner radius, never bending with it. It replaces the success and failure uses of
 *   `Banner`, `Alert` and `SectionNotice`.
 * - `StatusField*`: the field error. The field's red ring grows in, the line opens its own
 *   room, and the cross and the words drop in together from under the field. A repeat press
 *   shakes the field once and plays the line again (`useRefusal`).
 * - `StatusBadge*`: a mark inside a pill, concentric with the pill's rounded end.
 * - `landingClass`: the row a dialog acted on glows once when the dialog closes onto it.
 */

const RAIL: Record<MarkTone, string> = {
  success: "bg-success",
  error: "bg-destructive",
  danger: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-input",
};

export function StatusLine({
  tone,
  title,
  children,
  action,
  icon,
  still,
  role,
  className,
}: {
  tone: MarkTone;
  title?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ComponentProps<typeof StatusMark>["icon"];
  /** Every line after the first in one screen arrives without motion. */
  still?: boolean;
  /** Announced when it appears after an act: `alert` for a failure, `status` otherwise.
      A `still` line (already true when the screen opened) is not a live region. */
  role?: "status" | "alert";
  className?: string;
}) {
  return (
    <div
      role={still ? undefined : (role ?? (tone === "error" ? "alert" : "status"))}
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-lg bg-card py-3 pr-3 pl-4 ring-1 ring-hairline",
        !still && "fb-rise",
        className,
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", RAIL[tone])} />
      {/* With a title, the mark centres on the title and the body's first line. */}
      <span className={title ? "mt-1.5 self-start" : "self-center"}>
        <StatusMark tone={tone} icon={icon} size={24} still={still} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title ? <p className="text-body-compact font-semibold">{title}</p> : null}
        <div className={cn("text-body-compact text-pretty", title ? "text-muted-foreground" : "font-semibold")}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * Count refused presses. Pass `attempt` to `StatusFieldControl` and `StatusFieldError`:
 * the first refusal reveals the line, each repeat shakes the field and replays the line,
 * so a repeat press is never met with nothing. Call `reset` once the input is valid.
 */
export function useRefusal() {
  const [attempt, setAttempt] = React.useState(0);
  const refuse = React.useCallback(() => setAttempt((n) => n + 1), []);
  const reset = React.useCallback(() => setAttempt(0), []);
  return { attempt, refuse, reset };
}

/**
 * Wrap the refused control. On every refusal it takes focus; its red ring (from the DS
 * `aria-invalid` state, which the caller sets) grows in the first time; each repeat
 * refusal shakes it once. The control is never remounted (that would drop what was
 * typed and the focus); the animation is restarted on the wrapper instead.
 */
export function StatusFieldControl({
  attempt,
  children,
  className,
}: {
  attempt: number;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  /* The attempt this wrapper last saw: mounting at attempt 3 (a remounted stage) is not a
     new refusal and must not shake or steal focus. */
  const seen = React.useRef(attempt);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || attempt === seen.current) return;
    seen.current = attempt;
    if (attempt < 1) return;
    el.querySelector<HTMLElement>("input, textarea, select, button, [tabindex]")?.focus();
    if (attempt < 2) return;
    el.classList.remove("fb-shake");
    void el.offsetWidth; // restart the animation from its first frame
    el.classList.add("fb-shake");
  }, [attempt]);
  return (
    <div ref={ref} className={cn("fb-field", className)}>
      {children}
    </div>
  );
}

/** The field error line. It stays light: a 14px outline cross, no disc. */
export function StatusFieldError({
  attempt,
  children,
  still,
  className,
}: {
  /** From `useRefusal`; a new attempt replays the line. Omit for an error shown on load. */
  attempt?: number;
  children: React.ReactNode;
  /** Every error after the first in one form appears without motion. */
  still?: boolean;
  className?: string;
}) {
  const line = (
    <FieldError className={cn("flex items-center gap-1.5 pt-0.5 text-destructive-ink", !still && "fb-drop", className)}>
      <CircleXIcon className="size-3.5 shrink-0" strokeWidth={2.4} aria-hidden />
      <span>{children}</span>
    </FieldError>
  );
  return still ? (
    line
  ) : (
    <div key={attempt} className="fb-reveal">
      <div>{line}</div>
    </div>
  );
}

/**
 * The class for a badge that carries a mark: 4px padding plus the badge's 1px border puts a
 * 14px mark 5px from the top, the bottom and the end of the 24px pill, so it is concentric
 * with the rounded end. Pair with `<StatusMark size={14} … />` (ds-requests #25).
 */
export const BADGE_WITH_MARK = "gap-1.5 pl-1";

/** The row a dialog acted on, for one glow when the dialog closes back onto the list. */
export const LANDING = "fb-land";
