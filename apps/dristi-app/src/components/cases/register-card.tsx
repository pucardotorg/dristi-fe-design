"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { COLLAPSE_MOTION } from "@/components/cases/motion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PANEL_CLASS } from "@/components/shell/panel";
import { cn } from "@/lib/utils";

/**
 * A register row as a touch card whose actions wait in a tray (owner, Sept 21).
 *
 * The advocate Home hearing card is the reference, as it is for the Pending
 * tasks cards: the card is the trigger and sits above its tray; the tray is
 * inset from both edges and squared at the top, so it reads as sliding out from
 * under the card. A list of these stays a list to scan, and only the row in
 * hand shows what can be done with it. A card with its button always showing
 * made every row shout, and a card with no button at all hid the way in.
 *
 * The title is the one control on the face, its hit area stretched over the
 * card. Anything else interactive on the face needs `relative z-10`.
 */
export function RegisterTrayCard({
  title,
  children,
  actions,
  tray,
  open,
  onOpenChange,
  marked = false,
  leading,
  className,
  cardRef,
}: {
  title: React.ReactNode;
  /** The face, under the title. */
  children?: React.ReactNode;
  /** The tray: buttons, each `flex-1`. */
  actions?: React.ReactNode;
  /**
   * A tray that holds more than a row of buttons: the members of a grouped
   * card, stacked, with the group's own action under them. Replaces `actions`.
   */
  tray?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The record this card stands for is open or was just closed. */
  marked?: boolean;
  /** Before the title on its line: a checkbox. It sits above the title's stretched
   *  hit area, so it takes its own taps. */
  leading?: React.ReactNode;
  className?: string;
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="min-w-0">
      <div
        ref={cardRef}
        className={cn(
          PANEL_CLASS,
          "relative z-10 flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors has-[[data-tray-title]:active]:bg-accent has-[[data-tray-title]:focus-visible]:border-ring has-[[data-tray-title]:focus-visible]:ring-3 has-[[data-tray-title]:focus-visible]:ring-focus-ring",
          (open || marked) && "border-border",
          className
        )}
      >
        <div className="flex items-start gap-3">
          {leading ? (
            <span className="relative z-10 flex shrink-0 items-center">{leading}</span>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                data-tray-title
                className="cursor-pointer rounded-sm p-0 text-left text-body-compact font-semibold break-words text-foreground outline-none after:absolute after:inset-0 after:rounded-xl"
              >
                {title}
              </button>
            </CollapsibleTrigger>
          </div>
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
              open && "rotate-180"
            )}
          />
        </div>
        {children}
      </div>
      <CollapsibleContent className={cn(COLLAPSE_MOTION, "mx-3")}>
        {tray ? (
          <div className="flex flex-col gap-2 rounded-b-xl bg-secondary p-3">
            {tray}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-b-xl bg-secondary p-3 [&>*]:flex-1">
            {actions}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** One tray open at a time in a list: a second would push the first off a phone. */
export function useOneOpen<Id extends string>() {
  const [openId, setOpenId] = React.useState<Id | null>(null);
  return {
    isOpen: (id: Id) => openId === id,
    toggle: (id: Id) => (open: boolean) => setOpenId(open ? id : null),
  };
}
