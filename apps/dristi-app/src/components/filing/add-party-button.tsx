"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useInCorrection } from "@/components/filing/posture";

/**
 * "Add another complainant" / "Add another accused" under the last card of a party's form,
 * outside any card, as "Add another advocate" sits on the Advocate page (Gujarat HC,
 * design feedback #13: the tab row's Add was a long scroll up from the foot of a party's
 * form). Who is on the filing is already in the tabs and the Sections list, so this lists
 * no one.
 *
 * Adding opens the new party's tab; this then puts focus on that tab and returns to the
 * top of the form, so the new party starts from its first field.
 */
export function AddPartyButton({
  label,
  onAdd,
}: {
  label: string;
  onAdd: () => void;
}) {
  /* Adding a party is an edit, not a correction — the tab row's Add hides there too. */
  const inCorrection = useInCorrection();
  const ref = React.useRef<HTMLButtonElement>(null);
  if (inCorrection) return null;

  const add = () => {
    const button = ref.current;
    onAdd();
    // After the new tab renders. The filing scrolls in its own pane, so scroll whichever
    // ancestor does.
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('[data-section-tabs] [role="tab"][data-state="active"]')
        ?.focus({ preventScroll: true });
      let pane = button?.parentElement ?? null;
      while (pane && !(pane.scrollHeight > pane.clientHeight && /(auto|scroll)/.test(getComputedStyle(pane).overflowY))) {
        pane = pane.parentElement;
      }
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      (pane ?? document.scrollingElement)?.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
  };

  return (
    <Button ref={ref} type="button" variant="outline" className="w-fit" onClick={add}>
      <PlusIcon data-icon="inline-start" aria-hidden />
      {label}
    </Button>
  );
}
