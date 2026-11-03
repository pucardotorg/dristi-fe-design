"use client";

import * as React from "react";

import { dismissOnPageClick } from "@/components/ui/notify";
import { Toaster } from "@/components/ui/sonner";

/**
 * The toaster `notify` draws into: one placement and one set of fills, mounted once per
 * product area instead of the `Toaster` primitive (which stays upgradeable).
 *
 * - **Placement:** bottom centre of the viewport, 56px up (sonner's default bottom-right
 *   corner sits under a dock or taskbar); 64px on a phone, clear of the browser bar.
 * - **Width:** 380px, enough for a full-sentence title on two lines at most.
 * - **Click-away:** any press on the page outside the toasts dismisses every toast except
 *   errors (lead designer, 2026-10-29). Presses on the toasts themselves are left alone.
 * - **Elevation:** the overlay shadow, not sonner's own.
 *
 * `notify` cards draw their own surface, rail and mark. The variables below only matter
 * for a direct `toast.success` / `toast.error` call, which the system retires: each status
 * sits on its `-muted` fill with the ink already paired to it, edged with its step-7 ramp
 * colour so the toast reads as an object rather than a 1.1:1 tint.
 *
 * `style` and `toastOptions` replace the primitive's own rather than merge, so the whole
 * variable set is restated here.
 */
export function FeedbackToaster() {
  /* Feedback toasts (`notify`) leave as soon as the person presses anywhere on the page
     (lead designer, 2026-10-29). Capture phase, so a press that a page handler stops still
     counts. A press on the toasts themselves is left alone, or an Undo would dismiss its
     own toast before its click lands. Error toasts are not in the set and stay until
     closed. */
  React.useEffect(() => {
    const onPress = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest?.("[data-sonner-toaster]")) return;
      dismissOnPageClick();
    };
    document.addEventListener("pointerdown", onPress, true);
    return () => document.removeEventListener("pointerdown", onPress, true);
  }, []);

  return (
    <Toaster
      position="bottom-center"
      offset={{ bottom: "56px" }}
      // 24px sat against the phone browser's own bar and under the thumb; 64
      // clears both (owner, Sept 21).
      mobileOffset={{ bottom: "64px" }}
      style={
        {
          /* Neutral — the acknowledgement variant, and the one copying uses. */
          "--normal-bg": "var(--surface-sunken)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",

          "--success-bg": "var(--success-muted)",
          "--success-text": "var(--success-muted-foreground)",
          "--success-border": "var(--success-7)",

          "--error-bg": "var(--destructive-muted)",
          "--error-text": "var(--destructive-muted-foreground)",
          "--error-border": "var(--destructive-7)",

          /* Mapped but never called today. Kept in step with the two that are, so the
             first `toast.warning` does not arrive looking like a different product. */
          "--warning-bg": "var(--warning-muted)",
          "--warning-text": "var(--warning-muted-foreground)",
          "--warning-border": "var(--warning-7)",

          "--info-bg": "var(--info-muted)",
          "--info-text": "var(--info-muted-foreground)",
          "--info-border": "var(--info-7)",

          "--border-radius": "var(--radius)",

          /* The feedback toast's measure: wide enough for a full-sentence title on two
             lines at most. Sonner's default is 356px. */
          "--width": "380px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: { toast: "cn-toast" },
        /* A toast is an overlay, so it takes the sanctioned overlay elevation. Sonner
           ships `0 4px 12px rgba(0,0,0,.1)`, which is not one of ours and sits wrong
           against the panels underneath. Inline, because the primitive's own rule
           carries the same specificity as anything this file could add in CSS. */
        style: { boxShadow: "var(--shadow-overlay)" },
      }}
    />
  );
}
