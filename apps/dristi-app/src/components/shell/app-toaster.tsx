"use client";

import * as React from "react";

import { dismissOnPageClick } from "@/components/feedback/notify";
import { Toaster } from "@/components/ui/sonner";

/**
 * The product's toaster: one placement, one set of fills, mounted once per area.
 *
 * ## Why this file exists
 *
 * `components/ui/sonner.tsx` is a synced DS primitive. It maps each variant to a token
 * pair — `--success-bg: var(--success-muted)` and so on — and a local edit there is lost
 * at the next sync and fails the sync gate in the meantime. So the product's own
 * decisions are composed on here instead, and every area mounts this rather than the
 * primitive. One file to change when the treatment changes.
 *
 * ## Placement (owner, 2026-09-16)
 *
 * Bottom centre, 56px up, and centred on the *page column* rather than the window.
 *
 * Sonner's default is 24px into the bottom-*right* corner, which is where a macOS dock, a
 * Windows taskbar and any floating window sit — the toast was landing underneath the
 * furniture, at the furthest point on a wide screen from wherever the eye just was. 40px
 * cleared a standard taskbar and still read low, so it stands at 56.
 *
 * Centring is the part sonner cannot do: its bottom-centre is the viewport's centre, and
 * the viewport starts up to 16rem left of where the work does, so under a wide rail the
 * toast leaned. The horizontal shift is one rule in `globals.css` reading
 * `--chrome-page-inset` off the column this is mounted in — which is why this component
 * belongs inside the shell rather than beside it. On a phone the rail is off-canvas and
 * the window is the page, so neither the shift nor the raise applies; `mobileOffset`
 * keeps the safe area clear instead.
 *
 * ## Fills and edges (owner, 2026-09-16, revised 2026-09-17)
 *
 * The primitive sets `--success-border` to the *same* token as `--success-bg`, so a
 * success or error toast had no edge at all and the neutral one was white on white, held
 * up by nothing but a shadow. That is the real defect, and the edge is what makes the
 * toast an object: a step-3 tint on white is a 1.1:1 surface, which the eye cannot find.
 *
 * The fill was bumped one ramp step first, and that is now reverted. It buys about 0.1 of
 * surface contrast and costs real text contrast — against a step-4 fill the inks fall to
 * 4.24:1 (success), 4.07:1 (error) and 4.37:1 (info), all under the 4.5:1 that this 13px
 * text owes, and the DS's own `check-contrast` would have refused it. So the statuses sit
 * on `--*-muted` with the ink already paired to them, which measures 4.54-4.88:1.
 *
 * The neutral variant sits on `--surface-sunken` rather than `--popover`. On `--popover`
 * it was the page's own white in light mode and its own near-black in dark — a 1.00:1
 * surface both times. It is the variant that carries an acknowledgement, which is what
 * copying an identifier raises, so it is the one most calls land on.
 *
 * **The borders are the one thing still stated as ramp steps here.** The DS names them
 * `--{status}-muted-edge`, but that family arrived after the pin this app builds against,
 * so until `ds:bump` carries it these read `var(--success-7)` and so on. When the pin
 * moves, they become the token name and this file gets shorter.
 *
 * `style` and `toastOptions` are *replacements*, not merges — the primitive spreads
 * `{...props}` after its own, so whatever arrives here wins outright. That is why the
 * whole variable set is restated below rather than only the six values that changed:
 * passing a partial object would drop the rest of the DS's mapping on the floor.
 */
export function AppToaster() {
  /* Feedback toasts (`notify`) leave as soon as the person clicks anywhere on the page
     (lead designer, 2026-10-29). Capture phase, so a click that a page handler stops still
     counts. Error toasts are not in the set and stay until closed. */
  React.useEffect(() => {
    const onPress = () => dismissOnPageClick();
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
