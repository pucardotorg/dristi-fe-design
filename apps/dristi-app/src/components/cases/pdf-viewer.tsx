"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { DOCUMENT_GROUND } from "@/components/cases/document-ground";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
/** Page width at 100%, in px, when the well is wider than this. */
const READING_WIDTH = 820;

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

/** Same worker the filing flow loads, copied to public/vendor at dev/build. */
function pdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
      return lib;
    });
  }
  return pdfjsPromise;
}

/** Splits the `file.pdf#page=3` form the fixtures use into its two halves. */
export function parsePdfSrc(src: string): { url: string; page?: number } {
  const [url, hash = ""] = src.split("#");
  const page = Number.parseInt(/(?:^|&)page=(\d+)/.exec(hash)?.[1] ?? "", 10);
  return { url, page: Number.isNaN(page) ? undefined : page };
}

export function isPdfSrc(src: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(src);
}

/** A picture rather than a PDF: a replaced file can be either. */
export function isImageSrc(src: string): boolean {
  return /\.(?:png|jpe?g)(?:$|[?#])/i.test(src);
}

/**
 * A file chosen in this visit, as a src the viewers can read: its object
 * URL, with its own name after the hash so PDF and picture tell apart.
 */
export function localFileSrc(file: File): string {
  return `${URL.createObjectURL(file)}#${encodeURIComponent(file.name)}`;
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

/**
 * The app's own PDF surface: pages on a sunken well, in the app's theme,
 * instead of the browser's built-in viewer in an iframe. It zooms by pinch and
 * by ctrl/cmd + scroll; the two buttons are the same zoom for keyboard and
 * single-pointer users (WCAG 2.5.1). Download and full view stay with the
 * caller, so every place a document shows decides its own actions.
 */
export function PdfViewer({
  src,
  title,
  initialPage = 1,
  pages,
  thumbnail = false,
  className,
}: {
  src: string;
  /** Names the document for assistive tech. */
  title: string;
  /** 1-based page to open at. */
  initialPage?: number;
  /** Show only these pages (1-based, inclusive), for a document that is a
   *  span inside a compiled file. The whole file when absent. */
  pages?: { from: number; to: number };
  /** A still picture of the first page shown: no zoom, no scroll, no focus.
   *  For a preview tile whose own link opens the document. */
  thumbnail?: boolean;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  /* Held with the src it came from, so a new src reads as "loading" at once
     without resetting state from inside the effect. */
  const [loaded, setLoaded] = useState<{
    src: string;
    doc: PDFDocumentProxy | null;
  } | null>(null);
  const doc = loaded?.src === src ? loaded.doc : null;
  const failed = loaded?.src === src && loaded.doc === null;
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  /** Page 1's width over height; the placeholder shape for unrendered pages. */
  const [aspect, setAspect] = useState(1 / Math.SQRT2);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => Promise<void>) | null = null;
    (async () => {
      try {
        const lib = await pdfjs();
        const task = lib.getDocument({ url: src });
        destroy = () => task.destroy();
        const next = await task.promise;
        if (cancelled) return;
        const first = await next.getPage(1);
        const base = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setAspect(base.width / base.height);
        setLoaded({ src, doc: next });
      } catch {
        if (!cancelled) setLoaded({ src, doc: null });
      }
    })();
    return () => {
      cancelled = true;
      void destroy?.();
    };
  }, [src]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* A trackpad pinch arrives as a wheel event with ctrlKey set, the same as
     ctrl/cmd + scroll. Registered by hand because React's wheel listener is
     passive and cannot stop the browser zooming the whole page. */
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((current) => clampZoom(current * Math.exp(-event.deltaY / 300)));
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  /* Once per document, and only after the pages have a measured width:
     before that every holder is zero tall and there is nowhere to scroll. */
  const ready = Boolean(doc) && width > 0;
  const openedAt = useRef<string | null>(null);
  useEffect(() => {
    const node = scrollRef.current;
    if (!ready || !node || thumbnail || openedAt.current === src) return;
    openedAt.current = src;
    if (initialPage <= 1) return;
    const target = node.querySelector<HTMLElement>(
      `[data-page="${initialPage}"]`
    );
    if (target) node.scrollTop = target.offsetTop - 16;
  }, [ready, src, initialPage, thumbnail]);

  const firstPage = Math.max(1, pages?.from ?? 1);
  const lastPage = thumbnail
    ? firstPage
    : Math.min(doc?.numPages ?? 0, pages?.to ?? Infinity);

  /* Fit the well, up to a comfortable reading width: a page stretched across
     a wide dialog is harder to read, not easier. p-4 each side. */
  const pageWidth = thumbnail
    ? width
    : Math.max(0, Math.min(width - 32, READING_WIDTH) * zoom);

  return (
    <div
      className={cn(
        "relative min-h-0 overflow-hidden rounded-xl",
        DOCUMENT_GROUND,
        className
      )}
    >
      <div
        ref={scrollRef}
        role={thumbnail ? undefined : "document"}
        aria-label={thumbnail ? undefined : title}
        aria-hidden={thumbnail ? true : undefined}
        tabIndex={thumbnail ? undefined : 0}
        className={cn(
          "absolute inset-0 outline-none",
          thumbnail
            ? "overflow-hidden"
            : "overflow-auto overscroll-contain rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50"
        )}
      >
        {failed ? (
          <p className="p-6 text-body-compact text-muted-foreground">
            This document could not be shown. Try downloading it instead.
          </p>
        ) : !doc ? (
          <div
            role="status"
            className="flex h-full items-center justify-center gap-2 text-body-compact text-muted-foreground"
          >
            <Spinner aria-hidden />
            Loading document
          </div>
        ) : (
          <div
            className={cn(
              "flex w-max min-w-full flex-col items-center",
              thumbnail ? undefined : "gap-4 p-4"
            )}
          >
            {Array.from(
              { length: Math.max(0, lastPage - firstPage + 1) },
              (_, index) => firstPage + index
            ).map((number) => (
              <PdfPage
                key={number}
                doc={doc}
                number={number}
                width={pageWidth}
                aspect={aspect}
                root={scrollRef}
              />
            ))}
          </div>
        )}
      </div>

      {doc && !thumbnail ? <ZoomControl zoom={zoom} onZoom={setZoom} /> : null}
    </div>
  );
}

/** The well's zoom: out, the level (press to reset), in. */
function ZoomControl({
  zoom,
  onZoom,
}: {
  zoom: number;
  onZoom: (next: (current: number) => number) => void;
}) {
  return (
    <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-lg border border-hairline bg-card p-0.5 shadow-raised">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Zoom out"
        disabled={zoom <= MIN_ZOOM}
        onClick={() => onZoom((current) => clampZoom(current - ZOOM_STEP))}
      >
        <MinusIcon aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="w-12 tabular-nums"
        aria-label={`Zoom ${Math.round(zoom * 100)} percent. Reset to fit`}
        onClick={() => onZoom(() => 1)}
      >
        {Math.round(zoom * 100)}%
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Zoom in"
        disabled={zoom >= MAX_ZOOM}
        onClick={() => onZoom((current) => clampZoom(current + ZOOM_STEP))}
      >
        <PlusIcon aria-hidden />
      </Button>
    </div>
  );
}

/**
 * A document the app sets out itself (an application composed from its
 * details, not a file) in the PdfViewer's own frame: the same well, margin,
 * reading width, scrolling and zoom, so it reads as one kind of thing with
 * the PDFs beside it (owner, Sept 24: "is this not a doc?").
 */
export function ComposedDocumentViewer({
  title,
  children,
  className,
}: {
  /** Names the document for assistive tech. */
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* Pinch and ctrl/cmd + scroll zoom the page, as on a PDF. */
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom((current) => clampZoom(current * Math.exp(-event.deltaY / 300)));
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  /* The PDF page's width at 100%: the well less p-4 each side, up to the
     reading width. Zoom scales the laid-out page, so past 100% it scrolls
     sideways as a PDF page does. */
  const pageWidth = Math.max(0, Math.min(width - 32, READING_WIDTH));

  return (
    <div
      className={cn(
        "relative min-h-0 overflow-hidden rounded-xl",
        DOCUMENT_GROUND,
        className
      )}
    >
      <div
        ref={scrollRef}
        role="document"
        aria-label={title}
        tabIndex={0}
        className="absolute inset-0 overflow-auto overscroll-contain rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="flex w-max min-w-full flex-col items-center p-4">
          <div style={{ width: pageWidth || undefined, zoom }}>{children}</div>
        </div>
      </div>
      <ZoomControl zoom={zoom} onZoom={setZoom} />
    </div>
  );
}

/**
 * One page. It holds its shape from the start and only draws once it nears the
 * viewport, so a two-hundred-page case file opens as fast as a one-page order.
 * While a zoom gesture runs the old bitmap stretches; the sharp one replaces
 * it once the width settles.
 */
function PdfPage({
  doc,
  number,
  width,
  aspect,
  root,
}: {
  doc: PDFDocumentProxy;
  number: number;
  width: number;
  aspect: number;
  root: React.RefObject<HTMLDivElement | null>;
}) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [near, setNear] = useState(false);
  const [ratio, setRatio] = useState(aspect);

  useEffect(() => {
    const node = holderRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { root: root.current, rootMargin: "100% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [root]);

  const draw = useCallback(
    async (signal: { cancelled: boolean }) => {
      const canvas = canvasRef.current;
      if (!canvas || width <= 0) return;
      const page = await doc.getPage(number);
      if (signal.cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.width / base.height);
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({
        scale: (width / base.width) * density,
      });
      const buffer = document.createElement("canvas");
      buffer.width = Math.ceil(viewport.width);
      buffer.height = Math.ceil(viewport.height);
      const context = buffer.getContext("2d");
      if (!context) return;
      await page.render({ canvas: buffer, canvasContext: context, viewport })
        .promise;
      if (signal.cancelled) return;
      canvas.width = buffer.width;
      canvas.height = buffer.height;
      canvas.getContext("2d")?.drawImage(buffer, 0, 0);
    },
    [doc, number, width]
  );

  useEffect(() => {
    if (!near) return;
    const signal = { cancelled: false };
    const timer = window.setTimeout(() => {
      draw(signal).catch(() => undefined);
    }, 120);
    return () => {
      signal.cancelled = true;
      window.clearTimeout(timer);
    };
  }, [near, draw]);

  return (
    <div
      ref={holderRef}
      data-page={number}
      className="shrink-0 overflow-hidden rounded-sm bg-paper shadow-raised"
      style={{ width, height: width / ratio }}
    >
      <canvas
        ref={canvasRef}
        aria-label={`Page ${number}`}
        role="img"
        className="block size-full"
      />
    </div>
  );
}
