"use client";

import * as React from "react";
import { createPortal } from "react-dom";

/**
 * Where a step's footer goes: a full-width strip under the page, outside the centred
 * column, so Back and the primary action keep the screen's edges as every filing footer does.
 */
export const FooterSlot = React.createContext<HTMLElement | null>(null);

/** A batch step's footer, rendered into the page's full-width footer strip. */
export function BatchFooter({ children }: { children: React.ReactNode }) {
  const slot = React.useContext(FooterSlot);
  return slot ? createPortal(children, slot) : null;
}
