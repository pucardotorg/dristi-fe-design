"use client";

import * as React from "react";
import { MaximizeIcon, MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/* The states board's canvas: drag or scroll to pan, ctrl/⌘ + scroll or the buttons to zoom.
   `jumps` are anchors the toolbar can fly to; children register them with `useAnchor`. */

type Cam = { x: number; y: number; z: number };

const AnchorContext = React.createContext<(id: string, node: HTMLElement | null) => void>(() => {});

export function useAnchor(id: string) {
  const register = React.useContext(AnchorContext);
  return React.useCallback((node: HTMLElement | null) => register(id, node), [register, id]);
}

export function Canvas({
  jumps,
  children,
}: {
  jumps: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  const viewport = React.useRef<HTMLDivElement>(null);
  const anchors = React.useRef<Record<string, HTMLElement | null>>({});
  const drag = React.useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [cam, setCam] = React.useState<Cam>({ x: 40, y: 80, z: 0.5 });

  const zoomAt = React.useCallback((factor: number, px?: number, py?: number) => {
    setCam((c) => {
      const rect = viewport.current?.getBoundingClientRect();
      const ox = px ?? (rect ? rect.width / 2 : 0);
      const oy = py ?? (rect ? rect.height / 2 : 0);
      const z = Math.min(2, Math.max(0.06, c.z * factor));
      const k = z / c.z;
      return { z, x: ox - (ox - c.x) * k, y: oy - (oy - c.y) * k };
    });
  }, []);

  React.useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
      else setCam((c) => ({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const register = React.useCallback((id: string, node: HTMLElement | null) => {
    anchors.current[id] = node;
  }, []);

  const jump = (id: string) => {
    const t = anchors.current[id];
    if (!t) return;
    const z = 0.4;
    setCam({ z, x: 40 - t.offsetLeft * z, y: 90 - t.offsetTop * z });
  };

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-muted dark:bg-background"
      onScroll={(e) => {
        e.currentTarget.scrollTop = 0;
        e.currentTarget.scrollLeft = 0;
      }}
    >
      <div
        ref={viewport}
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("a,button,input,select,textarea,[role=dialog]")) return;
          drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setCam((c) => ({ ...c, x: d.cx + e.clientX - d.x, y: d.cy + e.clientY - d.y }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        style={{
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: `${24 * cam.z}px ${24 * cam.z}px`,
          backgroundPosition: `${cam.x}px ${cam.y}px`,
        }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})` }}
        >
          <AnchorContext.Provider value={register}>{children}</AnchorContext.Provider>
        </div>
      </div>

      <nav
        aria-label="Board"
        className="absolute top-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-card p-2 shadow-raised ring-1 ring-hairline"
      >
        <span className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {jumps.map((j) => (
            <Button key={j.id} variant="ghost" size="sm" className="shrink-0" onClick={() => jump(j.id)}>
              {j.label}
            </Button>
          ))}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.25)}>
            <MinusIcon />
          </Button>
          <span className="w-12 text-center text-caption tabular-nums text-muted-foreground">
            {Math.round(cam.z * 100)}%
          </span>
          <Button variant="outline" size="icon-sm" aria-label="Zoom in" onClick={() => zoomAt(1.25)}>
            <PlusIcon />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Fit to start" onClick={() => setCam({ x: 40, y: 80, z: 0.5 })}>
            <MaximizeIcon />
          </Button>
        </span>
      </nav>
    </div>
  );
}
