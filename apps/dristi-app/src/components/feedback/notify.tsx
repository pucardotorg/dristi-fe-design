"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { StatusMark } from "./mark";

/**
 * The product's toasts, for quick acts where the page stays put. Call these instead of
 * `toast.success` / `toast.error` / `toast()`.
 *
 * - **success**: access given, a reminder sent, a task archived from a list.
 * - **error**: an act that did not happen, raised from a page. **Stays until closed** and
 *   carries a close button: an error that times out before it is read is the worst case
 *   of the problem this system fixes. A click on the page does not dismiss it.
 *   Inside an open dialog, a failure is never a toast (the dialog blocks the page, so the
 *   toast could not be closed): use `StatusLine` or `OutcomeHeader` there.
 * - **warning**: only where the product already treats it as a warning.
 * - **neutral**: not news (a draft saved, a step not open yet). Pass the act's `icon`.
 *
 * Success, warning and neutral toasts last **2.75s** (the old default was 4s; lead
 * designer, 2026-10-29), show a thin timer, pause while the pointer is over them, and
 * leave as soon as the person presses anywhere on the page outside the toasts
 * (`AppToaster` listens).
 *
 * Missing input is never a toast: point at the field (`StatusFieldError`).
 */

export const TOAST_LIFE_MS = 2750;

type Tone = "success" | "error" | "warning" | "neutral";
type Options = {
  description?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  icon?: React.ComponentProps<typeof StatusMark>["icon"];
  id?: string | number;
};

/* Toasts a page press may dismiss. Errors never join, and leave it if an id is reused. */
const clickAway = new Set<string | number>();

/** Called by `AppToaster` on any pointer press outside the toasts. */
export function dismissOnPageClick() {
  for (const id of clickAway) toast.dismiss(id);
  clickAway.clear();
}

/* Each show gets its own key, so reusing an id restarts the card's timer bar with
   sonner's timer instead of leaving it half drained. */
let shown = 0;

function show(tone: Tone, title: React.ReactNode, options: Options = {}) {
  const persistent = tone === "error";
  const key = ++shown;
  const id = toast.custom(
    (toastId) => (
      <ToastCard
        key={key}
        tone={tone}
        title={title}
        description={options.description}
        action={options.action}
        icon={options.icon}
        persistent={persistent}
        onClose={() => toast.dismiss(toastId)}
      />
    ),
    {
      id: options.id,
      duration: persistent ? Number.POSITIVE_INFINITY : TOAST_LIFE_MS,
      /* The card draws its own surface and shadow; the list item stays bare. */
      style: { boxShadow: "none" },
      onDismiss: (t) => clickAway.delete(t.id),
      onAutoClose: (t) => clickAway.delete(t.id),
    },
  );
  if (persistent) clickAway.delete(id);
  else clickAway.add(id);
  return id;
}

export const notify = {
  success: (title: React.ReactNode, options?: Options) => show("success", title, options),
  error: (title: React.ReactNode, options?: Options) => show("error", title, options),
  warning: (title: React.ReactNode, options?: Options) => show("warning", title, options),
  neutral: (title: React.ReactNode, options?: Options) => show("neutral", title, options),
};

const RAIL: Record<Tone, string> = {
  success: "bg-success",
  error: "bg-destructive",
  warning: "bg-warning",
  neutral: "bg-input",
};

/* Keeps the 36px look of a small button with a 40×40px touch target (ACCESSIBILITY §8). */
const HIT = "relative after:absolute after:-inset-0.5";

function ToastCard({
  tone,
  title,
  description,
  action,
  icon,
  persistent,
  onClose,
}: {
  tone: Tone;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: Options["action"];
  icon?: Options["icon"];
  persistent: boolean;
  onClose: () => void;
}) {
  /* No live-region role here: sonner's list is already the polite live region, and a
     second one inside it makes screen readers announce the toast twice. The list item
     already rises in, so the card does not animate its own entrance. */
  return (
    <div
      /* A custom toast's list item shrink-wraps its content, so the card takes the
         toaster's measure itself; on a phone the item is full width and this clamps. */
      className={cn(
        "relative flex w-(--width) max-w-full items-center gap-2.5 overflow-hidden rounded-lg py-3 pr-3 pl-4 text-popover-foreground shadow-overlay ring-1",
        /* In dark, popover is the page colour: the toast lifts to the raised surface with a
           full border, or it disappears into the page. */
        "bg-popover ring-hairline dark:bg-surface-raised dark:ring-border",
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", RAIL[tone])} />
      {/* One block of text: the mark sits in its middle. With a detail line, it centres on
          the title and the detail's first line. */}
      <span className={description ? "mt-2 self-start" : "self-center"}>
        <StatusMark tone={tone} icon={tone === "neutral" ? icon : undefined} size={24} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body-compact font-semibold text-pretty">{title}</p>
        {description ? <p className="text-body-compact text-pretty text-muted-foreground">{description}</p> : null}
      </div>
      {action ? (
        <Button size="sm" variant="outline" className={cn("shrink-0", HIT)} onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
      {persistent ? (
        <Button size="icon-sm" variant="ghost" className={cn("shrink-0 self-start text-muted-foreground", HIT)} aria-label="Close" onClick={onClose}>
          <XIcon aria-hidden />
        </Button>
      ) : (
        <span
          aria-hidden
          className={cn(
            "fb-drain absolute inset-x-0 bottom-0 h-0.5",
            tone === "neutral" ? "bg-muted-foreground" : tone === "warning" ? "bg-warning" : "bg-success",
          )}
          style={{ ["--fb-life" as string]: `${TOAST_LIFE_MS}ms` }}
        />
      )}
    </div>
  );
}
