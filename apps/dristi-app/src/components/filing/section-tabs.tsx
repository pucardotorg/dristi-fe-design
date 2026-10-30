"use client";

import * as React from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInCorrection } from "@/components/filing/posture";

export type SectionTab = {
  id: string;
  label: string;
  /** Secondary text after the label (a name, an amount). */
  meta?: string;
  /** Drives the status dot; never colour alone — an sr-only word accompanies it. */
  status: "complete" | "attention";
  removable?: boolean;
};

/**
 * Tab strip for repeated entities (Complainant 1, 2…; Cheque 1, 2…). The DS Tabs line
 * variant carries the strip; remove is a sibling icon button so it is its own control.
 */
export function SectionTabs({
  tabs,
  activeId,
  onSelect,
  onRemove,
  addLabel,
  onAdd,
  trailing,
  addAfterTabs = false,
  className,
}: {
  tabs: SectionTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
  addLabel?: string;
  onAdd?: () => void;
  /** Right-aligned extra control (e.g. "View source document"). */
  trailing?: React.ReactNode;
  /** Add sits right after the last tab rather than at the row's far end (bulk filing). */
  addAfterTabs?: boolean;
  className?: string;
}) {
  /* Adding a cheque or removing a complainant is an edit, not a correction (brief D3). */
  const inCorrection = useInCorrection();
  const canEditList = !inCorrection;

  /* One row that scrolls sideways, never a wrapping block: past a handful of
     entries a wrapped strip overran the form beneath it, so the tabs stay on a
     single scrollable line and Add stays pinned outside the scroll (owner,
     Sept 2). The active tab is kept in view as it changes. */
  const listRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[data-state="active"]');
    if (!list || !active) return;
    // Adjust only this strip's horizontal scroll — never scrollIntoView, which
    // would also nudge the dialog body vertically. The measured element is the
    // tab's wrapper (trigger + its remove button), not the trigger alone: the
    // trigger-only rect left the X clipped and the strip visibly short of the
    // tab's true edge. First and last tab snap the strip home instead of
    // stopping a rect-adjustment shy of the end.
    const cell = active.parentElement ?? active;
    if (cell === list.firstElementChild) {
      list.scrollLeft = 0;
      return;
    }
    if (cell === list.lastElementChild) {
      list.scrollLeft = list.scrollWidth;
      return;
    }
    const l = list.getBoundingClientRect();
    const a = cell.getBoundingClientRect();
    if (a.left < l.left) list.scrollLeft -= l.left - a.left + 8;
    else if (a.right > l.right) list.scrollLeft += a.right - l.right + 8;
  }, [activeId]);

  return (
    <div
      className={cn(
        // Phone: the strip and Add keep the rule; the trailing control goes under it
        // edge to edge, the first thing in the form it is about. Alone in a corner it
        // read as a stray chip (owner, Sept 22). From `sm` up it is one row.
        "flex flex-wrap items-center gap-x-2 sm:flex-nowrap sm:border-b sm:border-hairline",
        className
      )}
    >
      <div className="flex w-full min-w-0 items-center gap-2 border-b border-hairline sm:contents">
      <Tabs
        value={activeId}
        onValueChange={onSelect}
        className={cn("min-w-0", addAfterTabs ? "flex-initial" : "flex-1")}
      >
        <TabsList
          ref={listRef}
          variant="line"
          // w-full overrides the primitive's w-fit so the strip is bounded by
          // the row and its overflow scrolls, instead of stretching the modal.
          // justify-start overrides the primitive's centering: a strip with one
          // or two tabs otherwise floats them mid-row, orphaned from the form
          // below (owner, Sept 3).
          className="w-full min-w-0 flex-nowrap justify-start gap-1 overflow-x-auto"
        >
          {tabs.map((t) => (
            <div key={t.id} className="flex shrink-0 items-center">
              <TabsTrigger
                value={t.id}
                className="h-10 flex-none gap-2 rounded-b-none text-body-compact"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    t.status === "complete" ? "bg-success" : "bg-warning-ink"
                  )}
                />
                <span className="sr-only">
                  {t.status === "complete" ? "Complete:" : "Needs attention:"}
                </span>
                {t.label}
                {t.meta ? (
                  <span className="font-normal text-muted-foreground">{t.meta}</span>
                ) : null}
              </TabsTrigger>
              {t.removable && onRemove && canEditList ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${t.label}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(t.id)}
                >
                  <XIcon aria-hidden />
                </Button>
              ) : null}
            </div>
          ))}
        </TabsList>
      </Tabs>
      {addLabel && onAdd && canEditList ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAdd}
          className="shrink-0 text-primary"
        >
          <PlusIcon data-icon="inline-start" aria-hidden />
          {addLabel}
        </Button>
      ) : null}
      </div>
      {trailing ? (
        <div className="flex w-full items-center pt-4 sm:ml-auto sm:w-auto sm:pt-0 [&>*]:w-full sm:[&>*]:w-auto">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
