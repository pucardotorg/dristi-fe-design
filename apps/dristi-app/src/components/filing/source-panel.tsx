"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowUpRightIcon,
  FileTextIcon,
  FileUpIcon,
  MaximizeIcon,
  UploadIcon,
} from "lucide-react";

import { useFilePreview } from "@/lib/filing/files";
import type { DocExtract, ExtractBox, StoredFileRef } from "@/lib/filing/types";
import { useRoomForLabelledNav, useSourceDock } from "@/hooks/use-min-width";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TOP_BAR_HEIGHT } from "@/components/filing/chrome";
import { useChrome } from "@/components/shell/chrome";
import { useSourceRailSlot } from "@/components/filing/filing-shell";
import { useInCorrection } from "@/components/filing/posture";
import { useSourcesOff, useSourcesOnDemand } from "@/components/filing/field-policy";
import { Lightbox } from "@/components/filing/lightbox";

export type SourceChip = { label: string; active: boolean; onClick: () => void };

/** Highlight box over the document image, in percentages of the image box. */
export type SourceRegion = { left: string; top: string; width: string; height: string };

/** Pixel box from document reading → percentage region (with a little breathing room). */
export function regionFromBox(
  box: ExtractBox | undefined,
  page: DocExtract["page"] | undefined,
  pad = 0.01
): SourceRegion | undefined {
  if (!box || !page || !page.width || !page.height) return undefined;
  const l = Math.max(0, box.x0 / page.width - pad);
  const t = Math.max(0, box.y0 / page.height - pad);
  const r = Math.min(1, box.x1 / page.width + pad);
  const b = Math.min(1, box.y1 / page.height + pad);
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  return { left: pct(l), top: pct(t), width: pct(r - l), height: pct(b - t) };
}

export type SourcePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * What the panel is showing: the document itself ("Identity proof", "Cheque"). This
   * is the rail's resting subject — it holds whether or not a field has been asked about.
   */
  title: string;
  /**
   * The one field being explained ("Full name"), set *only* when the person asked about
   * it from the form. Absent means nobody asked: the rail is then the document and says
   * so, rather than naming whichever field happened to be read first (owner, 2026-09-23).
   */
  field?: string;
  eyebrow?: string;
  /** "Value used in this field" — editable when `onValueChange` is given. */
  value?: string;
  onValueChange?: (value: string) => void;
  chips?: SourceChip[];
  /** The uploaded document to show; `null` when nothing was uploaded for this field yet. */
  file: StoredFileRef | null;
  imageAlt: string;
  region?: SourceRegion;
  note?: string;
  /** Where "Replace" / "Upload" go — the intake step of this draft. */
  uploadHref: string;
};

/**
 * Whether the source rail is showing.
 *
 * From `xl` it is simply a column of the layout — always there, never collapsed, because
 * the document is the point of these screens and one more thing to open and shut is one
 * too many (owner, 2026-08-18). Below `xl` there is no room for a permanent column, so it
 * is a sheet that stays shut until "View source document" asks for it.
 */
export function useSourceOpenState(): [boolean, (open: boolean) => void] {
  const wide = useSourceDock();
  const inCorrection = useInCorrection();
  const onDemand = useSourcesOnDemand();
  const off = useSourcesOff();
  const docked = wide && !inCorrection && !onDemand;
  const [sheetOpen, setSheetOpen] = React.useState(false);
  return [!off && (docked || sheetOpen), setSheetOpen];
}

/**
 * "Where did this value come from?" — the uploaded document with the read region
 * highlighted, plus the value box to correct a misread.
 *
 * From `xl` it is a permanent column of the shell beside the form, so the form is pushed
 * rather than covered and the sticky footer keeps its own width. Below `xl` there is no
 * room for a permanent column, so it is a sheet.
 *
 * With nothing uploaded it stays in place as an empty state rather than disappearing: a
 * person who skipped intake has no other way of learning that these fields can be read
 * off a document, and the rail is where that offer belongs (owner, 2026-08-18). What it
 * must not do is imply a document is there — so the empty state names the gap and offers
 * the upload, and no chip, filename or preview is drawn for a file that does not exist.
 */
export function SourcePanel(props: SourcePanelProps) {
  // Hooks run before the early return below, in the same order every render.
  const off = useSourcesOff();
  /*
   * In a correction round the screen already spends its width on three panes (sections,
   * form, resolution queue), so the source rail gives up its column and stays a sheet —
   * opened on request, exactly as it behaves below `xl` in the ordinary flow.
   */
  const wide = useSourceDock();
  const inCorrection = useInCorrection();
  const onDemand = useSourcesOnDemand();
  const docked = wide && !inCorrection && !onDemand;
  const roomy = useRoomForLabelledNav();
  const slot = useSourceRailSlot();
  const { foldNav } = useChrome();

  /**
   * A third column below `2xl` would leave the form too narrow to read. The nav gives up
   * its labels for it rather than the form its width — once, so a person who puts the
   * labels back is not overruled on the next render.
   */
  const crowded = docked && !roomy && !off;
  const wasCrowded = React.useRef(false);
  React.useEffect(() => {
    if (crowded && !wasCrowded.current) foldNav();
    wasCrowded.current = crowded;
  }, [crowded, foldNav]);

  if (off) return null;

  if (docked && slot) {
    return createPortal(
      <aside
        aria-label={
          props.field ? `Source for ${props.field}` : `Source document: ${props.title}`
        }
        style={{ top: TOP_BAR_HEIGHT, height: `calc(100svh - ${TOP_BAR_HEIGHT})` }}
        className="sticky flex w-(--source-panel-w) shrink-0 flex-col self-start overflow-y-auto border-l border-hairline bg-card"
      >
        <SourcePanelBody {...props} />
      </aside>,
      slot
    );
  }

  if (!props.open) return null;

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:w-full sm:max-w-md [&>[data-slot=sheet-close]]:z-20">
        <SheetHeader className="sr-only">
          <SheetTitle>
            {props.field ? `Source for ${props.field}` : `Source document: ${props.title}`}
          </SheetTitle>
          <SheetDescription>The uploaded document this value was read from.</SheetDescription>
        </SheetHeader>
        <SourcePanelBody {...props} />
      </SheetContent>
    </Sheet>
  );
}

/**
 * The rail with nothing behind it yet. It states the gap in the person's own terms —
 * this field could have been filled from a document — and carries the one action that
 * closes it. Nothing here pretends a document exists: no chip, no filename, no preview
 * frame standing in for a page that was never uploaded.
 */
function SourceEmptyState({ uploadHref }: { uploadHref: string }) {
  return (
    <Empty className="px-6 py-10">
      <EmptyHeader>
        {/* 32px is the DS default; in a 320px rail the mark carries the state, so it
            takes the next step up rather than reading as a stray glyph. */}
        <EmptyMedia variant="icon" className="mb-3 size-12 [&_svg]:size-6">
          <FileUpIcon aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-body font-semibold">
          Nothing uploaded yet
        </EmptyTitle>
        <EmptyDescription className="text-body-compact">
          Upload the document and we fill what we can read from it.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href={uploadHref}>
            <UploadIcon data-icon="inline-start" aria-hidden />
            Add documents
          </Link>
        </Button>

      </EmptyContent>
    </Empty>
  );
}

function SourcePanelBody(p: SourcePanelProps) {
  const [zoom, setZoom] = React.useState(false);
  const preview = useFilePreview(p.file);
  const imageUrl = preview.status === "ready" ? preview.imageUrl : null;
  const fileUrl = preview.status === "ready" ? preview.fileUrl : null;

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-hairline bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              p.file
                ? "bg-info-muted text-info-muted-foreground"
                : "bg-surface-sunken text-muted-foreground"
            )}
          >
            <FileTextIcon className="size-5" />
          </span>
          {/*
            The header answers what is in the rail. Until a field is asked about that is
            the document, so it says the document; naming a field nobody picked read as a
            hardcoded label sitting in the header (owner, 2026-09-23).
          */}
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground">
              {p.field ? "Source for" : (p.eyebrow ?? "Source document")}
            </p>
            <p className="text-body font-semibold text-foreground">
              {p.field ?? p.title}
            </p>
          </div>
        </div>
      </div>

      {!p.file ? (
        <SourceEmptyState uploadHref={p.uploadHref} />
      ) : (
      <div className="flex flex-col gap-6 px-6 py-6">
        {p.field && p.onValueChange !== undefined ? (
          <Field className="gap-2">
            <FieldLabel className="text-caption text-muted-foreground">
              Value used in this field
            </FieldLabel>
            <Input value={p.value ?? ""} onChange={(e) => p.onValueChange?.(e.target.value)} />
            <FieldDescription>
              Correct it here if we misread. This updates the form and clears the
              auto-filled marker.
            </FieldDescription>
          </Field>
        ) : null}

        {p.chips && p.chips.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-caption text-muted-foreground">Source documents</p>
            <div className="flex flex-wrap gap-2">
              {p.chips.map((c) => (
                <Button
                  key={c.label}
                  type="button"
                  size="sm"
                  variant={c.active ? "default" : "outline"}
                  aria-pressed={c.active}
                  onClick={c.onClick}
                >
                  {c.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {preview.status === "loading" ? (
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
        ) : imageUrl ? (
          <div className="group/img relative overflow-hidden rounded-xl bg-surface-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={p.imageAlt} className="block h-auto w-full" />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setZoom(true)}
              className="absolute right-2 top-2 shadow-overlay"
            >
              <MaximizeIcon data-icon="inline-start" aria-hidden />
              Enlarge
            </Button>
            {p.field && p.region ? (
              <div
                aria-hidden
                className="pointer-events-none absolute rounded-md border-2 border-primary bg-halo shadow-[0_0_0_9999px_var(--color-scrim)] transition-all"
                style={{
                  left: p.region.left,
                  top: p.region.top,
                  width: p.region.width,
                  height: p.region.height,
                }}
              />
            ) : null}
          </div>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg bg-surface-sunken text-muted-foreground">
            <FileTextIcon className="size-8" aria-hidden />
            <p className="text-body-compact">{p.file.name}</p>
            <p className="text-caption">No preview for this file type</p>
          </div>
        )}

        {p.note ? (
          <p className="text-caption text-muted-foreground">{p.note}</p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Button asChild variant="outline">
            <Link href={p.uploadHref}>
              Replace
              <UploadIcon data-icon="inline-end" aria-hidden />
            </Link>
          </Button>
          {fileUrl ? (
            <Button asChild variant="secondary">
              <a href={fileUrl} target="_blank" rel="noreferrer">
                Open original source document
                <ArrowUpRightIcon data-icon="inline-end" aria-hidden />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
      )}

      {imageUrl ? (
        <Lightbox open={zoom} onOpenChange={setZoom} src={imageUrl} alt={p.imageAlt} />
      ) : null}
    </div>
  );
}

/** Pill button that re-opens a closed source panel ("View source document"). */
export function ViewSourceButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  const off = useSourcesOff();
  if (off) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn("rounded-full text-primary max-sm:h-10 max-sm:w-full max-sm:rounded-lg max-sm:text-body-compact", className)}
    >
      <FileTextIcon data-icon="inline-start" aria-hidden />
      View source document
    </Button>
  );
}
