"use client";

import * as React from "react";

import { type CaseRecord } from "@/lib/cases/types";

/** Landmark id for the in-table peek — triggers point `aria-controls` here. */
export const CASE_PEEK_ID = "case-peek";

/** How long the panel takes to slide out; the record is held this long past close so the
 *  exit can play. Matches the design system SidePanel's 300ms exit. */
const PEEK_EXIT_MS = 300;

type CasePeekContextValue = {
  record: CaseRecord | null;
  now: number;
  /** The row that triggered the peek was already inside the long pending
   *  register — carried through so "Open case file" doesn't reintroduce a
   *  badge the register already established. */
  hideLongPendingFlag: boolean;
  /** True while the panel is sliding out — the record is still set (so the panel stays
   *  mounted) but everything that made room for it steps back. Drives the exit. */
  closing: boolean;
  open: (record: CaseRecord, options?: { hideLongPendingFlag?: boolean }) => void;
  close: () => void;
};

const CasePeekContext = React.createContext<CasePeekContextValue | null>(null);

export function CasePeekProvider({
  now,
  children,
}: {
  now: number;
  children: React.ReactNode;
}) {
  const [record, setRecord] = React.useState<CaseRecord | null>(null);
  const [hideLongPendingFlag, setHideLongPendingFlag] = React.useState(false);
  // `closing` is set the moment a close is asked for; the record is cleared one exit
  // later. Both happen in the close handler — an event, not an effect — so the panel
  // exit and the chrome easing back start on the same tick and stay in step.
  const [closing, setClosing] = React.useState(false);
  const exitTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const open = React.useCallback(
    (next: CaseRecord, options?: { hideLongPendingFlag?: boolean }) => {
      clearTimeout(exitTimer.current);
      setClosing(false);
      setRecord(next);
      setHideLongPendingFlag(options?.hideLongPendingFlag ?? false);
    },
    []
  );
  const close = React.useCallback(() => {
    setClosing((already) => {
      if (already) return already;
      clearTimeout(exitTimer.current);
      exitTimer.current = setTimeout(() => {
        setRecord(null);
        setClosing(false);
      }, PEEK_EXIT_MS);
      return true;
    });
  }, []);

  React.useEffect(() => () => clearTimeout(exitTimer.current), []);

  const value = React.useMemo(
    () => ({ record, now, hideLongPendingFlag, closing, open, close }),
    [record, now, hideLongPendingFlag, closing, open, close]
  );

  return (
    <CasePeekContext.Provider value={value}>{children}</CasePeekContext.Provider>
  );
}

export function useCasePeek() {
  const context = React.useContext(CasePeekContext);
  if (!context) {
    throw new Error("useCasePeek must be used within CasePeekProvider");
  }
  return context;
}
