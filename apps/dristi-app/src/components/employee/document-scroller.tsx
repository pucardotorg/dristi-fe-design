"use client";

import * as React from "react";

import { DocumentPreviewActions } from "@/components/cases/document-preview";
import { PageSheet, SHEET_BOX } from "@/components/employee/page-facsimile";
import type { CaseDocumentKind } from "@/lib/employee/case-review";
import type { ZoneRect } from "@/lib/employee/document-zones";
import { cn } from "@/lib/utils";

/**
 * A court file's documents, read the way a bench reads them — one long scroll of pages,
 * not a picker that shows one at a time.
 *
 * This is the scrutiny bundle's grammar (`scrutiny/bundle-view.tsx`) without its tooling:
 * every document is stacked in the order the file lists them, each a facsimile on a lifted
 * paper sheet under a numbered anchor, and the column scrolls through all of them. It is
 * the document surface on both Register cases and Take cognizance (owner, 2026-09-14).
 *
 * **A fact marks its region here.** When a row on the reading is clicked, the caller sets
 * `active` to that document and the region the value was read from; the scroller brings the
 * page to the top of the column and draws a halo over the region — the amount box on a
 * cheque, the address block on an ID — exactly as scrutiny marks its evidence. Where a
 * fact has no region that fits, `zone` is `null` and the whole page is ringed instead.
 *
 * The facsimiles are never legible: a readable page here would be fabricating a court
 * record, the one thing a demo of a file must not do (`page-facsimile.tsx`). The regions
 * are therefore approximate — they point at where a field sits on the *kind* of page, not
 * at a place on a real scan (`document-zones.ts`). A document with a `src` shows that
 * sample scan instead (the scrutiny demo's own), and a fact rings the whole page, since
 * the facsimile's regions do not sit on a real scan.
 *
 * **Every scan opens in Full view** (owner, 2026-10-13), by the product's own document
 * actions — Download and Full view as 40×40 icons on the document's title line
 * (`DocumentPreviewActions`) — and Full view is the case file's: near window size, with
 * the viewer's zoom controls.
 */
export type ScrollerDoc = {
  key: string;
  /** The running number the file gives it. */
  no: number;
  title: string;
  kind: CaseDocumentKind;
  /** A scan to show in place of the facsimile. */
  src?: string;
};

export type ScrollerAbsent = { key: string; title: string };

export type ScrollerActive = {
  doc: string;
  /** The region to mark, or `null` to ring the whole page. */
  zone: ZoneRect | null;
};

export function DocumentScroller({
  docs,
  absent = [],
  active,
  className,
}: {
  docs: ScrollerDoc[];
  absent?: ScrollerAbsent[];
  active: ScrollerActive | null;
  className?: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  /* When a fact selects a document, bring it to the top of the column — moving *this*
     scroll box, never the page. `scrollIntoView` bubbles to every scrollable ancestor, so
     it dragged the whole screen when the aside was already in view (owner, 2026-09-14:
     "cuts off randomly when I scroll up… moves slightly"); scrolling the box by the gap
     between the page's top and the box's top keeps the movement inside the panel. */
  React.useEffect(() => {
    if (!active) return;
    const box = scrollRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-doc="${CSS.escape(active.doc)}"]`);
    if (!box || !el) return;
    /* Two homes, two scrolls. In the desktop dock the box is a fixed-height panel that
       scrolls inside itself: move its own `scrollTop` (set outright — this in-app browser
       ignores a smooth programmatic scroll of a nested box). Where the column simply flows
       down the page — the phone — the box is not its own scroller, so scroll the page to
       the document instead. Either way the movement stays where the reader expects it, and
       never drags the whole screen the way `scrollIntoView` on a scrollable box did. */
    if (box.scrollHeight > box.clientHeight + 4) {
      box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top;
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [active]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        // The gutter is tuned so the white SHEET — the bright edge the eye tracks — lands
        // on the `px-8` (32px) line the "Documents / N filed" header sits on, in both
        // consumers (cognizance, register-case-file). The sheet is inset from this scroll
        // by its own 8px beige mat (`p-2` below), so the scroll runs at `px-6` (24) and
        // 24 + 8 = 32 puts the sheet under the header; the low-contrast mat carries the
        // residual 8px, not the sheet. `px-4` here left the sheet 8px proud of the header
        // — the right-margin stagger the owner caught (owner, 2026-09-16).
        "flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-6 py-4",
        className,
      )}
    >
      {docs.map((doc) => {
        const on = active?.doc === doc.key;
        /* A scan has no facsimile grid for a region to sit in: the whole page is ringed. */
        const zone = on && !doc.src ? active?.zone ?? null : null;
        /* The frame is the kind's own box, not a shared 3:4 page, so a cheque is a wide slip
           and a memo a short one instead of a drawing marooned in white (owner, 2026-09-15). */
        const box = SHEET_BOX[doc.kind];
        return (
          <section
            key={doc.key}
            data-doc={doc.key}
            aria-label={doc.title}
            className="flex scroll-mt-4 flex-col gap-2"
          >
            {/* The one navigational anchor in a long scroll, so it reads as one: caption
                size, foreground ink at 600 rather than grey (scrutiny's own rule). */}
            {/* The document's actions ride its own title line, as `DocumentPreview`'s
                header band carries them — never laid over the scan they would cover. */}
            <div className="flex min-h-10 items-center justify-between gap-2">
              <h3 className="text-caption font-semibold text-foreground">
                <span className="tabular-nums">{doc.no}</span> · {doc.title}
              </h3>
              {doc.src ? (
                <DocumentPreviewActions
                  title={doc.title}
                  source={{ kind: "src", src: doc.src }}
                  className="-my-1 flex-nowrap gap-1"
                />
              ) : null}
            </div>
            {/* The page sits on a beige mat, so it separates from the white rail rather
                than a near-white sheet on white (owner, 2026-09-14). The mat takes the
                warm sunken fill the court side uses for a well; the page keeps its own
                hairline inside it. A whole-page mark rings the mat; a region mark is drawn
                on the page. */}
            <div
              className={cn(
                "rounded-xl bg-surface-sunken p-2 transition-shadow",
                on && !zone && "ring-2 ring-primary",
              )}
            >
              <div
                className="relative w-full overflow-hidden rounded-lg bg-paper ring-1 ring-hairline"
                style={doc.src ? undefined : { aspectRatio: `${box.w} / ${box.h}` }}
              >
                {doc.src ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- a local sample scan at its own size */
                  <img src={doc.src} alt="" className="block h-auto w-full" draggable={false} />
                ) : (
                  <PageSheet kind={doc.kind} />
                )}
                {zone ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute z-2 rounded-md border-2 border-primary bg-halo ring-3 ring-halo transition-all"
                    /* The zone is in the facsimile's drawing grid; the frame shows only the
                       kind's `SHEET_BOX` slice of it, so a zone maps to a per-cent rect of
                       that slice. */
                    style={{
                      left: `${((zone.x - box.x) / box.w) * 100}%`,
                      top: `${((zone.y - box.y) / box.h) * 100}%`,
                      width: `${(zone.w / box.w) * 100}%`,
                      height: `${(zone.h / box.h) * 100}%`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          </section>
        );
      })}

      {absent.length > 0 ? (
        <section className="flex flex-col gap-2" aria-label="Not filed">
          <h3 className="text-caption font-semibold text-muted-foreground">Not filed</h3>
          {absent.map((doc) => (
            <p
              key={doc.key}
              className="flex min-h-12 items-center gap-3 text-body-compact text-muted-foreground"
            >
              <span
                aria-hidden
                className="h-8 w-6 shrink-0 rounded-sm border border-dashed border-input"
              />
              {doc.title}
            </p>
          ))}
        </section>
      ) : null}
    </div>
  );
}
