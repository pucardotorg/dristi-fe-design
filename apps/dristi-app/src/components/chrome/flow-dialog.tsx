"use client";

import * as React from "react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { OVERLAY_RISE } from "@/components/chrome/motion";
import {
  useBackCloses,
  useBottomSheet,
  useFlowWindow,
} from "@/components/chrome/flow-window";
import { DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * `ChromeDialogContent` for a step of a workflow (a form, a generated document,
 * signing, payment, a record or a document in full view). A dialog from `sm`
 * up; on a phone, the full window that slides in from the right. See
 * `useFlowWindow` for why.
 *
 * On a phone its Back asks the dialog to close, the same request the close
 * button makes, so whatever the dialog does about that (a discard warning, a
 * step back) still happens. A flow with real steps wires `useBackCloses` itself
 * to walk them and passes `ownBack`, as do the dialogs it chains into.
 *
 * A click outside does not close it (owner, 2026-10-13): a misclick beside a
 * half-done flow lost every step entered. Close, Escape and the phone's Back
 * still do. A window that only shows something — a record, a document — passes
 * `outsideCloses`.
 *
 * Confirmations and notices are not workflows and stay on the plain content,
 * which turns them into bottom sheets on a phone.
 */
export function FlowDialogContent({
  className,
  style,
  children,
  ownBack = false,
  rise = false,
  sheet = false,
  outsideCloses = false,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof ChromeDialogContent> & {
  /** A viewer with nothing to lose: a click outside closes it, as a plain dialog. */
  outsideCloses?: boolean;
  /** The flow handles the phone's Back itself. */
  ownBack?: boolean;
  /**
   * Open with the product's overlay rise (`OVERLAY_RISE`) rather than the DS
   * zoom — the staged overlays' entrance. Only from `sm` up: on a phone the
   * window slides in from the right, and a rise on top of that is two
   * entrances at once.
   */
  rise?: boolean;
  /**
   * On a phone, rise as a bottom sheet (`useBottomSheet`) rather than taking the
   * whole window from the right. For a short flow the person enters from a list
   * and returns to it — Join a Case (owner, Oct 6: "a bottom sheet and not a side
   * peek"). The sheet stops short of the top so it reads as a sheet over the
   * page, scrolls inside the dialog's own layout rather than as one long panel,
   * and the phone's Back still closes it.
   */
  sheet?: boolean;
}) {
  const flow = useFlowWindow();
  const bottomSheet = useBottomSheet();
  // A simple dialog is a plain grid: header, body, DS footer. Stretched to a
  // phone's height that left the footer floating under the last field with its
  // rounded card corners, mid-screen. In the window such a dialog stacks as a
  // column and its footer goes to the bottom edge, squared, clear of the home
  // indicator. Dialogs that lay themselves out (`flex`, `grid-rows-*`) already
  // place their own footer and are left alone.
  const selfLaidOut = /(^|\s)(flex|grid-rows-\S+)(\s|$)/.test(className ?? "");
  const closeRef = React.useRef<HTMLButtonElement>(null);
  useBackCloses(flow.phone && !ownBack, () => closeRef.current?.click());
  const surface = sheet
    ? cn(
        bottomSheet.className,
        /* The sheet's own scroll would carry the header away; the dialog lays
           itself out and scrolls its stage. */
        flow.phone && "max-h-[92dvh] overflow-hidden"
      )
    : cn(
        flow.className,
        flow.phone && !selfLaidOut && "flex flex-col",
        flow.phone &&
          "[&>[data-slot=dialog-footer]]:mt-auto [&>[data-slot=dialog-footer]]:rounded-none [&>[data-slot=dialog-footer]]:pb-[calc(--spacing(6)+env(safe-area-inset-bottom))]"
      );
  return (
    <ChromeDialogContent
      className={cn(rise && !flow.phone && OVERLAY_RISE, className, surface)}
      style={{ ...style, ...(sheet ? bottomSheet.style : flow.style) }}
      onInteractOutside={(event) => {
        onInteractOutside?.(event);
        if (!outsideCloses) event.preventDefault();
      }}
      {...props}
    >
      {children}
      {/* What Back presses. Not shown and not in the tab order: the visible
          close control is the one people and screen readers use. */}
      <DialogClose ref={closeRef} tabIndex={-1} aria-hidden className="hidden" />
    </ChromeDialogContent>
  );
}
