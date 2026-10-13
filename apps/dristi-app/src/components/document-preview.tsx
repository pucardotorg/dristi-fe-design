"use client";

import * as React from "react";
import NextImage from "next/image";
import { FileTextIcon, Maximize2Icon } from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pick, type Locale } from "@/lib/onboarding/content";
import { idUpload } from "@/lib/join/content";
import { cn } from "@/lib/utils";

/**
 * Shared thumbnail-plus-preview treatment for every uploaded document in the app —
 * registration verification, the application summary, and the profile upgrade all show
 * the same interaction the Add-ID dialog established: a small preview that opens a
 * larger viewer. One file, so the affordance cannot drift between screens.
 *
 * The viewer is a centred dialog, not a takeover: it sizes itself to the document's
 * own orientation (a landscape ID gets a wide dialog, a portrait scan a tall one), and
 * zooming is direct manipulation — pinch on a phone, trackpad pinch on a laptop —
 * with no button chrome between the person and the photo.
 */

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;

/**
 * What the thumbnail and viewer actually read off a document: its MIME type.
 * A structural type so a document already on the record — known only by a
 * served URL, never held as a `File` — gets the same treatment as a fresh
 * upload (the Sept 3 edit-litigant ID row is the first such caller).
 */
export type PreviewableDoc = { type: string };

/** Object URL for a File, revoked automatically when the file changes or unmounts. */
export function useObjectUrl(file: File | null) {
  const url = React.useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  React.useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

export function DocumentThumbnailButton({ file, url, locale, onOpen, className }: {
  file: PreviewableDoc;
  url: string;
  locale: Locale;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn("group relative flex items-center justify-center overflow-hidden bg-cover bg-center outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      style={file.type.startsWith("image/") && url ? { backgroundImage: `url(${JSON.stringify(url)})` } : undefined}
      aria-label={pick(idUpload.expandPreview, locale)}
      onClick={onOpen}
    >
      {file.type === "application/pdf" || !url ? <FileTextIcon className="size-5 text-muted-foreground" aria-hidden /> : null}
      <span className="absolute inset-0 bg-foreground/0 transition-colors group-hover:bg-foreground/15" />
      <Maximize2Icon className="absolute inset-0 m-auto size-4 text-background opacity-0 drop-shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
    </button>
  );
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function DocumentPreviewDialog({ open, onOpenChange, file, url, locale, copy }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: PreviewableDoc | null;
  url: string;
  locale: Locale;
  /** Header copy override — the defaults speak about IDs, which is wrong for other
   *  document kinds (vakalatnama, supporting letters). */
  copy?: { title: string; description: string; alt: string };
}) {
  const isPdf = file?.type === "application/pdf";
  const [transform, setTransform] = React.useState({ scale: 1, x: 0, y: 0 });
  const pointers = React.useRef(new Map<number, { x: number; y: number }>());
  const gesture = React.useRef<{ dist: number; scale: number } | null>(null);
  const pan = React.useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    // A reopened viewer always starts fitted — a leftover zoom level from the last
    // document reads as a broken image, not a saved preference.
    if (!nextOpen) setTransform({ scale: 1, x: 0, y: 0 });
    onOpenChange(nextOpen);
  }

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      gesture.current = { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), scale: transform.scale };
      pan.current = null;
    } else if (pts.length === 1 && transform.scale > 1) {
      pan.current = { x: event.clientX, y: event.clientY, tx: transform.x, ty: transform.y };
    }
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && gesture.current) {
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scale = clamp(gesture.current.scale * (dist / gesture.current.dist), ZOOM_MIN, ZOOM_MAX);
      setTransform((t) => (scale === 1 ? { scale: 1, x: 0, y: 0 } : { ...t, scale }));
    } else if (pts.length === 1 && pan.current) {
      setTransform((t) => ({ ...t, x: pan.current!.tx + event.clientX - pan.current!.x, y: pan.current!.ty + event.clientY - pan.current!.y }));
    }
  }

  function pointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    gesture.current = null;
    pan.current = null;
  }

  // Trackpad pinches arrive as ctrl+wheel — same gesture, same response.
  function wheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) return;
    setTransform((t) => {
      const scale = clamp(t.scale * (event.deltaY < 0 ? 1.08 : 0.92), ZOOM_MIN, ZOOM_MAX);
      return scale === 1 ? { scale: 1, x: 0, y: 0 } : { ...t, scale };
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Sized by the document, not a fixed frame: the image's own aspect ratio sets
          the dialog's shape, capped by the viewport on both axes. */}
      <ChromeDialogContent lang={locale} className={cn("flex max-h-[90dvh] flex-col gap-4 overflow-hidden p-4 sm:p-6", isPdf ? "h-[85dvh] w-[calc(100vw-2rem)] max-w-3xl" : "w-fit min-w-[min(20rem,calc(100vw-2rem))] max-w-[min(calc(100vw-2rem),72rem)]")}>
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>{copy?.title ?? pick(idUpload.previewTitle, locale)}</DialogTitle>
          {/* One line on desktop: the nowrap description sets the dialog's minimum
              width (the dialog is w-fit), so a narrow portrait scan can never squeeze
              this sentence into an awkward break. Phones still wrap — the screen is
              genuinely narrower than the sentence. */}
          <DialogDescription className="text-pretty sm:text-nowrap">{copy?.description ?? pick(idUpload.previewDescription, locale)}</DialogDescription>
        </DialogHeader>
        {url && isPdf ? (
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-surface-sunken p-2">
            <iframe src={url} title={copy?.alt ?? pick(idUpload.previewAlt, locale)} className="h-full w-full rounded-md bg-surface" />
          </div>
        ) : url ? (
          <div
            className="min-h-0 touch-none overflow-hidden rounded-lg bg-surface-sunken"
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerEnd}
            onPointerCancel={pointerEnd}
            onWheel={wheel}
          >
            <NextImage
              src={url}
              alt={copy?.alt ?? pick(idUpload.previewAlt, locale)}
              width={1600}
              height={1600}
              unoptimized
              draggable={false}
              className="mx-auto block h-auto max-h-[70dvh] w-auto max-w-full rounded-lg object-contain select-none"
              style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
            />
          </div>
        ) : null}
      </ChromeDialogContent>
    </Dialog>
  );
}

/**
 * Inline value for a description-list row: small thumbnail plus the filename, so an
 * uploaded document sits in the same label/value layout as every other field.
 */
export function DocumentRowValue({ file, locale, className }: {
  file: File;
  locale: Locale;
  className?: string;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const url = useObjectUrl(file);
  return (
    <>
      <span className={cn("flex min-w-0 items-center gap-3", className)}>
        <DocumentThumbnailButton file={file} url={url} locale={locale} onOpen={() => setPreviewOpen(true)} className="size-12 shrink-0 rounded-md bg-surface" />
        <span className="min-w-0 truncate">{file.name}</span>
      </span>
      <DocumentPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} file={file} url={url} locale={locale} />
    </>
  );
}
