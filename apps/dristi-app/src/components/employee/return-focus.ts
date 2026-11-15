"use client";

import * as React from "react";

/**
 * Focus back on whatever opened a dialog, when the dialog has no `DialogTrigger`.
 *
 * Radix returns focus to the dialog's own trigger on close. A dialog opened from state — a
 * row's opener, a panel's button — has none, so focus fell to the page body and a keyboard
 * reader lost their place (ACCESSIBILITY.md §5: on close, restore focus to the trigger).
 * The element holding focus as the dialog opens is remembered, and focus goes back to it
 * on close if it is still on the page.
 *
 * Spread the result onto `DialogContent` (or `ChromeDialogContent`).
 */
export function useReturnFocus() {
  const opener = React.useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      const doc = (event.target as Node | null)?.ownerDocument;
      const active = doc?.activeElement;
      opener.current = active instanceof HTMLElement && active !== doc?.body ? active : null;
    },
    onCloseAutoFocus: (event: Event) => {
      const target = opener.current;
      opener.current = null;
      if (target && target.isConnected) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}
