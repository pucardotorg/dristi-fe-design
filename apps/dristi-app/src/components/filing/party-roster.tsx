"use client";

import * as React from "react";
import { CheckIcon, CircleDashedIcon, PlusIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormCard } from "@/components/filing/form-card";
import { useInCorrection } from "@/components/filing/posture";

export type RosterParty = {
  id: string;
  /** The party's name, or "Complainant 2" until one is typed. */
  name: string;
  complete: boolean;
  /** Something has been entered for this party. */
  started: boolean;
};

/** Up to two initials from a typed name; the party's number until there is one. */
function initials(party: RosterParty, index: number): string {
  if (!party.started) return String(index + 1);
  const words = party.name.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w));
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "").slice(0, 2))
    .toUpperCase() || String(index + 1);
}

/**
 * Who is on the filing so far, with Add under them, where the form ends (Gujarat HC,
 * design feedback #13: the tab row's Add was a long scroll up from the foot of a party's
 * form). Chosen by the owner from seven variations on 2026-10-30.
 *
 * Each party's state uses the Sections list's words and marks — a tick for complete, a
 * dashed ring once started — so one mark means one thing across the filing. Adding opens
 * the new party's tab; this then puts focus on that tab and returns to the top of the form,
 * so the new party starts from its first field.
 */
export function PartyRoster({
  title,
  parties,
  addLabel,
  onAdd,
}: {
  title: string;
  parties: RosterParty[];
  addLabel: string;
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
    <FormCard title={title}>
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {parties.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-lg bg-surface-sunken p-3">
              <Avatar aria-hidden>
                <AvatarFallback className="bg-brand-muted text-caption font-semibold text-brand-muted-foreground">
                  {initials(p, i)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 break-words text-body font-medium text-foreground">{p.name}</span>
              {p.complete ? (
                <span className="flex shrink-0 items-center gap-1 text-caption text-success-ink">
                  <CheckIcon aria-hidden className="size-4" />
                  Complete
                </span>
              ) : p.started ? (
                <span className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
                  <CircleDashedIcon aria-hidden className="size-4" />
                  In progress
                </span>
              ) : (
                <span className="shrink-0 text-caption text-muted-foreground">Not started</span>
              )}
            </li>
          ))}
        </ul>
        <Button ref={ref} type="button" variant="ghost" className="-ml-2 w-fit text-primary" onClick={add}>
          <PlusIcon data-icon="inline-start" aria-hidden />
          {addLabel}
        </Button>
      </div>
    </FormCard>
  );
}
