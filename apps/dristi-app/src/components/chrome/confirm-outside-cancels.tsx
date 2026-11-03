"use client";

import * as React from "react";

import { onOwnLayer } from "@/components/chrome/discard-guard";

const OPEN_CONFIRM = '[data-slot="alert-dialog-content"][data-state="open"]';

/**
 * **A click outside a confirmation is its Cancel** (stakeholders, 2–3 Nov 2026, "Popup
 * Click-Outside Inventory").
 *
 * A confirmation asks one question with nothing typed, so a click beside it closes it
 * like Cancel does — and always means the safe answer: keep editing, don't remove, don't
 * send. Never the destructive one.
 *
 * The DS alert dialog holds a click outside by design, and its primitive is synced from
 * the DS rather than edited here, so this listens once for the whole app instead. On a
 * press outside the topmost open confirmation it sends that confirmation an Escape, which
 * the alert dialog already treats as Cancel. Radix answers Escape only on the highest
 * layer, so a confirmation over a protected popup ("Discard this draft?" inside a flow)
 * closes alone and the popup underneath stays open.
 *
 * A press on one of the confirmation's own floating layers (a menu, a list, a toast) is
 * not outside it.
 */
export function ConfirmOutsideCancels() {
  React.useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const open = document.querySelectorAll<HTMLElement>(OPEN_CONFIRM);
      const top = open[open.length - 1];
      if (!top) return;
      const target = event.target;
      if (!(target instanceof Node) || top.contains(target) || onOwnLayer(target)) return;
      top.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
  return null;
}
