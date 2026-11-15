"use client";

import { ConstructionIcon } from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useReturnFocus } from "@/components/employee/return-focus";

/**
 * The honest end of a row whose next screen is not built yet.
 *
 * Every court-side list opens the thing it names — a scrutiny, a case file, an order to
 * sign. Where that destination does not exist yet, the row used to be left inert: no
 * hover, no cursor, a line that reads as dead. The owner's call (2026-09-15) is the other
 * way round — the row stays clickable like every other, and lands here, on a plain "not
 * built yet" end state, so what is missing is *stated* rather than hidden behind a row
 * that quietly does nothing.
 *
 * It is a dialog because most court detail views are (`approve-copy`, the sign queues,
 * `delay-condonation`…): the row keeps the same `onOpen` interaction its built siblings
 * use, and the only difference is what it opens. When the real screen is built, the row
 * swaps this for it and nothing else about the list changes.
 */
export function NotBuiltDialog({
  item,
  opens,
  open,
  onOpenChange,
}: {
  /** The row's own name (a cause title), so the reader knows which row they landed from. */
  item: string | null;
  /** What the row will open once built — "the case file", "the scheduling flow". */
  opens: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const returnFocus = useReturnFocus();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ChromeDialogContent className="sm:max-w-md" {...returnFocus}>
        {/* Radix needs a titled dialog; the visible title lives in the Empty below, so the
            header is spoken only. */}
        <DialogTitle className="sr-only">Not built yet</DialogTitle>
        <DialogDescription className="sr-only">
          {opens} is not built yet.
        </DialogDescription>
        <Empty className="border-0 p-0 py-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ConstructionIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle className="text-title-s font-semibold">
              Not built yet
            </EmptyTitle>
            <EmptyDescription className="text-body text-pretty">
              {item ? (
                <>
                  <span className="font-medium text-foreground">{item}</span>{" "}
                  would open {opens}.{" "}
                </>
              ) : null}
              That screen hasn&rsquo;t been built yet.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <DialogClose asChild>
              <Button type="button">Back</Button>
            </DialogClose>
          </EmptyContent>
        </Empty>
      </ChromeDialogContent>
    </Dialog>
  );
}
