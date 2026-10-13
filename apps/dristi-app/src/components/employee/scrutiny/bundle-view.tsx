"use client";

import * as React from "react";
import { ZoomInIcon, ZoomOutIcon } from "lucide-react";

import { rectStyle } from "@/lib/employee/scrutiny/field";
import type { Rect } from "@/lib/employee/scrutiny/types";
import {
  useLocalStorageValue,
  writeLocalStorageValue,
} from "@/hooks/use-local-storage-value";
import { cn } from "@/lib/utils";
import { GENERATED_PAGES } from "@/components/employee/scrutiny/generated-pages";
import { PageSheet, SHEET_BOX } from "@/components/employee/page-facsimile";
import { useScrutinyCase } from "@/components/employee/scrutiny/scrutiny-case-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ZOOM_STEPS = [50, 67, 80, 100, 125, 150, 200, 300, 400];
const ZOOM_KEY = "employee-scrutiny-zoom";

export interface BundleHandle {
  goToDoc: (docId: string) => void;
}

/**
 * The case bundle, read-only. The officer reads and zooms; there is no tool to draw on a
 * page — annotations are gone from scrutiny (owner, 2026-10-08), so a flag is said in
 * words on the field it is about.
 */
export function BundleView({
  aiOn,
  spot,
  ref,
}: {
  aiOn: boolean;
  /** The AI evidence region for the selected field, if it has one. */
  spot: { doc: string; rect: Rect } | null;
  ref?: React.Ref<BundleHandle>;
}) {
  const { bundle } = useScrutinyCase();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [zoomBase, setZoomBase] = React.useState(880);

  /*
   * Zoom is persisted state, so it lives in localStorage and not in `useState`: the
   * server and the hydration render both see the 100% default, and React re-renders once
   * after hydration if a stored zoom differs. Reading it in an effect instead would be
   * the `react-hooks/set-state-in-effect` cascade the repo rules out.
   */
  const storedZoom = Number(useLocalStorageValue(ZOOM_KEY));
  const zoom = ZOOM_STEPS.includes(storedZoom) ? storedZoom : 100;
  const setZoom = React.useCallback(
    (next: number) => writeLocalStorageValue(ZOOM_KEY, String(next)),
    [],
  );

  /*
   * Zoom. Measure the column at 1× ONLY: once zoomed, a horizontal scrollbar changes
   * `clientWidth`, and measuring then compounds the scale on every step.
   */
  const measureBase = React.useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const cs = getComputedStyle(sc);
    const avail =
      sc.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    setZoomBase(Math.max(320, Math.min(940, Math.round(avail * 0.96))));
  }, []);

  React.useLayoutEffect(() => {
    measureBase();
    let timer: number;
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measureBase, 120);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [measureBase]);

  /** Keep the point under the cursor pinned while the scale changes. */
  const zoomTo = React.useCallback(
    (next: number, cx?: number, cy?: number) => {
      const sc = scrollRef.current;
      if (!sc) return;
      const z0 = zoom / 100;
      const z1 = next / 100;
      const ax = cx ?? sc.clientWidth / 2;
      const ay = cy ?? sc.clientHeight / 2;
      const px = (sc.scrollLeft + ax) / z0;
      const py = (sc.scrollTop + ay) / z0;
      setZoom(next);
      requestAnimationFrame(() => {
        sc.scrollLeft = px * z1 - ax;
        sc.scrollTop = py * z1 - ay;
      });
    },
    [zoom, setZoom],
  );

  const stepZoom = React.useCallback(
    (delta: number, cx?: number, cy?: number) => {
      let i = 0;
      ZOOM_STEPS.forEach((z, n) => {
        if (Math.abs(z - zoom) < Math.abs(ZOOM_STEPS[i] - zoom)) i = n;
      });
      const next =
        ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + delta))];
      zoomTo(next, cx, cy);
    },
    [zoom, zoomTo],
  );

  // ⌘/Ctrl + wheel zooms about the pointer; ⌘/Ctrl +/-/0 from the keyboard.
  React.useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const box = sc.getBoundingClientRect();
      stepZoom(
        event.deltaY < 0 ? 1 : -1,
        event.clientX - box.left,
        event.clientY - box.top,
      );
    };
    sc.addEventListener("wheel", onWheel, { passive: false });
    return () => sc.removeEventListener("wheel", onWheel);
  }, [stepZoom]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        stepZoom(1);
      } else if (event.key === "-") {
        event.preventDefault();
        stepZoom(-1);
      } else if (event.key === "0") {
        event.preventDefault();
        zoomTo(100);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [stepZoom, zoomTo]);

  /* ── navigation ────────────────────────────────────────────────────────── */

  const goToDoc = React.useCallback((docId: string) => {
    document
      .getElementById(`doc-${docId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  React.useImperativeHandle(ref, () => ({ goToDoc }), [goToDoc]);

  /* ── panning (zoomed in) ───────────────────────────────────────────────── */

  const pan = React.useRef<[number, number, number, number] | null>(null);
  const [panning, setPanning] = React.useState(false);

  function onScrollPointerDown(event: React.PointerEvent) {
    const sc = scrollRef.current;
    if (!sc || zoom <= 100) return;
    if ((event.target as HTMLElement).closest("button")) return;
    pan.current = [event.clientX, event.clientY, sc.scrollLeft, sc.scrollTop];
    setPanning(true);
    try {
      sc.setPointerCapture(event.pointerId);
    } catch {
      /* pointer already captured elsewhere */
    }
  }
  function onScrollPointerMove(event: React.PointerEvent) {
    const sc = scrollRef.current;
    if (!sc || !pan.current) return;
    sc.scrollLeft = pan.current[2] - (event.clientX - pan.current[0]);
    sc.scrollTop = pan.current[3] - (event.clientY - pan.current[1]);
  }
  function onScrollPointerUp(event: React.PointerEvent) {
    const sc = scrollRef.current;
    if (!pan.current) return;
    pan.current = null;
    setPanning(false);
    try {
      sc?.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-surface-sunken @container">
      {/* Chrome: white bar, hairline seam. */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-hairline bg-card px-4">
        {/*
         * `flex-1` alone let the tools take everything and collapse this to "C…"; the
         * floor keeps the title readable and the subtitle drops out first.
         */}
        <b className="me-auto min-w-0 flex-1 truncate text-body-compact font-semibold">
          Case bundle
        </b>

        <Tooltip>
          <TooltipTrigger asChild>
            {/* Default size, like every other control on a court screen: the registry
                works on tablets and the DS floor for a control is 40px. */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => stepZoom(-1)}
              disabled={zoom <= ZOOM_STEPS[0]}
              aria-label="Zoom out"
            >
              <ZoomOutIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          className="tabular-nums"
          onClick={() => zoomTo(100)}
          aria-label={`Zoom is ${zoom} percent — reset to 100 percent`}
        >
          {zoom}%
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => stepZoom(1)}
              disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              aria-label="Zoom in"
            >
              <ZoomInIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>
      </div>

      <div
        ref={scrollRef}
        className={cn("flex-1 overflow-auto p-4 pb-12", panning && "cursor-grabbing")}
        onPointerDown={onScrollPointerDown}
        onPointerMove={onScrollPointerMove}
        onPointerUp={onScrollPointerUp}
        onPointerCancel={onScrollPointerUp}
      >
        <div
          className="mx-auto flex flex-col gap-4"
          style={
            {
              width: zoomBase,
              // Digital zoom: no reflow, and real overflow to pan around.
              zoom: zoom / 100,
            } as React.CSSProperties
          }
        >
          {bundle.map((doc) => {
            /* A derived filing draws every page as an illegible facsimile; the authored
               case has real scans and legible generated pages. The facsimile is a
               `size-full` SVG with no intrinsic height, so — unlike an `<img>`, which
               sizes its own box — its page needs an explicit aspect ratio from the kind's
               own `SHEET_BOX`, the same frame the read-only scroller uses. */
            const sheet = doc.kind === "facsimile" ? doc.sheet : undefined;
            const box = sheet ? SHEET_BOX[sheet] : null;
            const Generated = sheet ? undefined : GENERATED_PAGES[doc.id];
            return (
              <div
                className="flex scroll-mt-3 flex-col gap-1.5"
                id={`doc-${doc.id}`}
                key={doc.id}
              >
                {/* The only navigational anchor in a scroll this long, so it reads as
                    one: caption size, but foreground ink at 600 rather than grey. */}
                <div className="text-caption font-semibold text-foreground">
                  <span className="tabular-nums">{doc.no}</span> · {doc.name}
                </div>
                <div
                  className="relative overflow-hidden rounded-xl bg-paper shadow-raised"
                  style={box ? { aspectRatio: `${box.w} / ${box.h}` } : undefined}
                >
                  {doc.kind === "image" && doc.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={doc.src}
                      alt={doc.name}
                      className="block h-auto w-full select-none"
                      draggable={false}
                    />
                  ) : sheet ? (
                    <PageSheet kind={sheet} />
                  ) : Generated ? (
                    <Generated />
                  ) : null}

                  {/* Where AI read the selected field from — a halo, never a mark. */}
                  {aiOn && spot?.doc === doc.id ? (
                    <div
                      className="pointer-events-none absolute z-2 rounded-md border-2 border-primary bg-halo ring-3 ring-halo transition-all"
                      style={rectStyle(spot.rect)}
                      aria-hidden="true"
                    />
                  ) : null}

                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
