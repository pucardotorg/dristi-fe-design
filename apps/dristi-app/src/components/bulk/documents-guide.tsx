"use client";

/**
 * **How documents go in, case by case, in three short pictures.**
 *
 * Shown once, the first time a filer opens a batch's Documents, and again from "How this
 * works". Skippable from the first frame. The owner asked for an animated walkthrough with
 * a skip in the first brief (2026-11-03), and the prototypes carried one; it gives a
 * long, repetitive step a friendlier start without adding anything to the screen itself.
 *
 * Built on the product's staged overlay: one window, the frames are its stages, so the
 * chrome holds still and only the picture and its words move.
 */

import * as React from "react";
import { CircleCheckIcon, CircleDashedIcon, FileTextIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { StagedOverlay, useStagedFlow } from "@/components/chrome/staged-overlay";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const FRAMES = ["need", "drop", "order"] as const;
type Frame = (typeof FRAMES)[number];

const SCENES: Record<Frame, string> = { need: "need", drop: "drop", order: "order" };

const COPY: Record<Frame, { title: string; body: string }> = {
  need: {
    title: "Each case asks for its own documents",
    body: "Its answers decide them: a notice that came back undelivered asks for the returned envelope instead of proof of delivery.",
  },
  drop: {
    title: "Drop each file into its place",
    body: "Click a slot or drag a file onto it. What the file is called doesn't matter.",
  },
  order: {
    title: "Cases missing something stay on top",
    body: "Work down from the top until every case is complete. Optional papers go in from the case's own Documents.",
  },
};

const SEEN_KEY = "dristi.bulk.documents-guide-seen";

/** Whether this browser has seen the guide. Storage can be blocked; then it simply shows. */
export function guideSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* A blocked store only means the guide shows again next time. */
  }
}

/** A document slot as the Documents step draws it: filled with a tick, or dashed and empty. */
function SlotArt({ label, filled, lift }: { label: string; filled?: boolean; lift?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-12 min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 text-body-compact",
        filled
          ? "border-hairline bg-card text-foreground"
          : "border-dashed border-input bg-card text-muted-foreground",
        lift && "border-primary bg-brand-muted text-brand-muted-foreground",
      )}
    >
      {filled ? (
        <CircleCheckIcon className="size-4 shrink-0 text-success-ink" aria-hidden />
      ) : (
        <CircleDashedIcon className="size-4 shrink-0" aria-hidden />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}

function Picture({ frame }: { frame: Frame }) {
  if (frame === "need")
    return (
      <div className="flex w-full max-w-md flex-col gap-2">
        {[
          ["Harsh V. Bhavsar", ["Cheque", "Return memo", "Proof of delivery"]],
          ["Snehal K. Mistry", ["Cheque", "Return memo", "Returned envelope"]],
        ].map(([name, docs], i) => (
          <div
            key={name as string}
            className="flex flex-col gap-2 rounded-xl border border-hairline bg-card p-3 shadow-raised animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
            style={{ animationDelay: `${i * 160}ms` }}
          >
            <span className="text-body-compact font-medium">{name as string}</span>
            <span className="flex gap-2">
              {(docs as string[]).map((d, j) => (
                <SlotArt key={d} label={d} filled={j < 2} lift={i === 1 && j === 2} />
              ))}
            </span>
          </div>
        ))}
      </div>
    );
  if (frame === "drop")
    return (
      <div className="relative flex w-full max-w-md flex-col items-center gap-6">
        <span className="flex items-center gap-2 rounded-lg border border-hairline bg-card px-3 py-2 font-mono text-body-compact shadow-overlay animate-in fade-in slide-in-from-top-6 fill-mode-both duration-700">
          <FileTextIcon className="size-4 text-muted-foreground" aria-hidden />
          scan_0412.pdf
        </span>
        <span className="flex w-full gap-2">
          <SlotArt label="Cheque" filled />
          <SlotArt label="Return memo" lift />
          <SlotArt label="Notice" />
        </span>
      </div>
    );
  return (
    <div className="flex w-full max-w-md flex-col gap-1.5">
      {[
        ["Pravin D. Solanki", "2 missing", false],
        ["Snehal K. Mistry", "1 missing", false],
        ["Harsh V. Bhavsar", "All 5 added", true],
      ].map(([name, state, done], i) => (
        <span
          key={name as string}
          className="flex items-center gap-3 rounded-lg border border-hairline bg-card px-3 py-2.5 text-body-compact animate-in fade-in slide-in-from-left-2 fill-mode-both duration-500"
          style={{ animationDelay: `${i * 140}ms` }}
        >
          {done ? (
            <CircleCheckIcon className="size-4 text-success-ink" aria-hidden />
          ) : (
            <CircleDashedIcon className="size-4 text-warning-ink" aria-hidden />
          )}
          <span className="min-w-0 flex-1 truncate font-medium">{name as string}</span>
          <span className={done ? "text-muted-foreground" : "text-warning-ink"}>{state as string}</span>
        </span>
      ))}
    </div>
  );
}

export function DocumentsGuide({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const close = () => {
    markSeen();
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      {open ? <GuideBody onClose={close} /> : null}
    </Dialog>
  );
}

function GuideBody({ onClose }: { onClose: () => void }) {
  const flow = useStagedFlow<Frame>({ order: FRAMES, scene: SCENES, arrival: "forward" });
  const at = FRAMES.indexOf(flow.stage);
  const last = at === FRAMES.length - 1;
  const copy = COPY[flow.stage];
  return (
    <StagedOverlay
      outsideCloses
      className="sm:max-w-xl"
      title={copy.title}
      titleRef={flow.titleRef}
      headerKey={flow.stage}
      description={copy.body}
      sceneKey={flow.sceneKey}
      motion={flow.motion}
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="flex items-center gap-1.5" aria-label={`Picture ${at + 1} of ${FRAMES.length}`}>
            {FRAMES.map((f, i) => (
              <span
                key={f}
                aria-hidden
                className={cn("h-1.5 rounded-full transition-all", i === at ? "w-5 bg-primary" : "w-1.5 bg-track")}
              />
            ))}
          </span>
          <span className="flex-1" />
          {last ? null : (
            <Button variant="ghost" onClick={onClose}>
              Skip
            </Button>
          )}
          {at > 0 ? (
            <Button variant="outline" onClick={() => flow.go(FRAMES[at - 1])}>
              Back
            </Button>
          ) : null}
          <Button onClick={() => (last ? onClose() : flow.go(FRAMES[at + 1]))}>
            {last ? "Start adding documents" : "Next"}
          </Button>
        </div>
      }
    >
      <div className="flex min-h-56 items-center justify-center rounded-xl bg-surface-sunken p-6">
        <Picture frame={flow.stage} />
      </div>
    </StagedOverlay>
  );
}
