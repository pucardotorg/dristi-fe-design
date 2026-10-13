"use client";

import { type ReactNode } from "react";
import { DownloadIcon, FileTextIcon, Maximize2Icon } from "lucide-react";

import { FlowDialogContent } from "@/components/chrome/flow-dialog";

import {
  FilePreviewImage,
  formatFileSize,
  isPreviewableImage,
} from "@/components/cases/filing-form-shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DOCUMENT_GROUND } from "@/components/cases/document-ground";

import { PdfViewer, isPdfSrc, parsePdfSrc } from "./pdf-viewer";

/**
 * The one document preview in the product: a well, and the two things anyone
 * looking at a document immediately wants from it — a copy, and a bigger
 * read. Defined once so a filed order, a generated application and a file
 * still sitting on the filer's disk all offer the same affordances in the
 * same place under the same labels.
 *
 * Three content shapes, because the product genuinely has three:
 * a document the server can serve, a document composed in the browser with no
 * file behind it, and a file the filer picked that has not been uploaded yet.
 */
export type DocumentPreviewSource =
  /** A served file — the browser's own viewer renders it in an iframe. */
  | { kind: "src"; src: string }
  /** Chosen locally and not uploaded. Images render; PDFs cannot here. */
  | { kind: "file"; file: File }
  /** Markup with no file behind it, e.g. the generated application. */
  | { kind: "composed"; content: ReactNode };

/**
 * Where Download points. A served document is an anchor; a document composed
 * in the browser has to be written by whoever knows how to compose it.
 */
export type DocumentDownload =
  | { href: string; filename?: string; label?: string }
  | { onDownload: () => void; label?: string };

/**
 * A document composed in the browser has nothing to download unless the
 * caller says how, so the button is omitted rather than shipped dead. A
 * served file always has its own URL, and a locally chosen file always has an
 * object URL, so both default to something that actually works.
 */
function resolveDownload(
  source: DocumentPreviewSource,
  download: DocumentDownload | undefined
): DocumentDownload | undefined {
  if (download) return download;
  if (source.kind === "src") return { href: source.src };
  if (source.kind === "file") {
    const { file } = source;
    return { onDownload: () => downloadLocalFile(file) };
  }
  return undefined;
}

/**
 * The object URL is released straight after the synthetic click, which is
 * when the browser has already taken the blob — the same pairing the
 * generated application's text download uses.
 */
function downloadLocalFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Full view only promises what it can deliver. A PDF chosen locally is not
 * rendered anywhere in the filing flow, so offering to enlarge it would open
 * a full-screen dialog onto the same "not previewed here" placard.
 */
function canExpand(source: DocumentPreviewSource): boolean {
  return source.kind !== "file" || isPreviewableImage(source.file);
}

const wellHeight = {
  /** The standard well — a document among other facts. */
  default: "h-96",
  /** Viewport-relative, for a record where the document *is* the record. */
  tall: "h-[60svh]",
  /** Takes the height its container can spare. */
  fill: "min-h-64 flex-1",
} as const;

/**
 * Preview well plus its action row, for any surface that shows one document.
 *
 * Surfaces that cannot hang their actions off this header — the case file,
 * whose PDF and digital reads share one grid cell — compose
 * `DocumentPreviewActions` directly instead.
 *
 * `variant="quiet"` is the third shape: no header band at all, and the two
 * actions as 40×40 icon buttons on the well itself. It exists for a surface
 * where the document *is* the column and the dialog's own title already names
 * it — a titled band 100px under a DialogTitle is two headings competing for
 * one job, and its sub-line repeats a date the record already carries. The
 * region keeps its accessible name, so nothing is lost to a screen reader,
 * only to an eye that did not need it. Opt-in: every existing caller renders
 * exactly as before.
 */
export function DocumentPreview({
  title,
  description,
  source,
  download,
  height = "default",
  actions,
  header,
  variant = "default",
  surface = "sunken",
  className,
}: {
  /** The document's own name. Heads the section and names both actions. */
  title: string;
  /** Optional sub-label, e.g. which file of how many is on screen. Not shown when quiet. */
  description?: ReactNode;
  source: DocumentPreviewSource;
  download?: DocumentDownload;
  height?: keyof typeof wellHeight;
  /** Surface-specific controls, placed ahead of Download in the same row. */
  actions?: ReactNode;
  /**
   * Something to put in the frame's title strip **instead of** the document's name —
   * `quiet` + `card` only.
   *
   * Added 2026-09-11 for the court-side pane, whose strip carries a tab per document in
   * the group being read (`register-cases` brief D26). Without it the active tab and the
   * `h3` name the same document twice, eight pixels apart. The strip drops its own
   * padding when a header is given so a caller can run tabs the full height of it and
   * land the active underline exactly on the strip's rule — two parallel horizontal
   * lines being the thing `ui-craft` §2 forbids here.
   *
   * The region keeps its accessible name from `title` either way, so what the header
   * replaces is a visible heading and never a spoken one.
   */
  header?: ReactNode;
  /** `quiet` drops the header band and puts the actions on the well as icons. */
  variant?: "default" | "quiet";
  /**
   * What the well is painted on. `sunken` is the Laws' nested media well and the default
   * everywhere. `card` is for a well that sits on a tinted stage rather than on a white
   * panel — there a sunken fill is the same tone as the stage and the well has no edge,
   * so it becomes a white sheet with a hairline instead (the stage's own card recipe).
   */
  surface?: WellSurface;
  className?: string;
}) {
  if (variant === "quiet" && surface === "card") {
    /*
      A framed well: a title strip with the two actions in it, a hairline, and the
      document below. Added 2026-09-11 for the approve-registrations overlay, where the
      owner read floating icons over a mostly empty white sheet as unresolved — *"the
      download and enlarge icon also looks like it's floating… maybe it should have a
      slight line to separate those as action items of the section"*.

      It is deliberately not the default variant's header, which sits *above* the well
      and restates a date: this one is inside the frame, carries the title at caption
      weight, and lets the document take everything under the rule however tall or wide
      it is. That is the scaling question in the same note answered structurally — the
      frame is fixed, the content area is what varies.
    */
    return (
      <section
        aria-label={title}
        className={cn(
          "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-hairline bg-card",
          className
        )}
      >
        <div
          className={cn(
            "flex shrink-0 gap-2 border-b border-hairline pr-1.5",
            // A header owns the strip's full height so its own rule can be the strip's.
            header
              ? "items-stretch justify-between"
              : "items-center justify-between py-1.5 pl-4"
          )}
        >
          {header ?? (
            <h3 className="min-w-0 truncate text-caption font-semibold text-muted-foreground">
              {title}
            </h3>
          )}
          <DocumentPreviewActions
            iconOnly
            title={title}
            source={source}
            download={download}
            className={header ? "self-center" : undefined}
          >
            {actions}
          </DocumentPreviewActions>
        </div>
        <DocumentWell
          title={title}
          source={source}
          surface="bare"
          className={cn(wellHeight[height], "max-md:overflow-visible")}
        />
      </section>
    );
  }

  if (variant === "quiet") {
    return (
      /*
        aria-label carries the heading the eye lost: the region is still named,
        and the well and the image beneath it name themselves too.
      */
      <section
        aria-label={title}
        className={cn("flex min-h-0 min-w-0 flex-col", className)}
      >
        <DocumentWell
          title={title}
          source={source}
          surface={surface}
          /*
            A sticky child pins to the nearest scrollport, and the well is one:
            fine above `md`, where the well is what scrolls and the actions stay
            at the top of a tall scan. Below it the *body* scrolls and the well
            is merely tall, so a well that keeps its own overflow would carry
            the actions off the top of the screen with it. Handing the scrolling
            back to the body at that size is what keeps them pinned. Scoped to
            this variant — no other caller has a toolbar to pin.
          */
          className={cn(wellHeight[height], "max-md:overflow-visible")}
          toolbar={
            <DocumentPreviewActions
              iconOnly
              title={title}
              source={source}
              download={download}
            >
              {actions}
            </DocumentPreviewActions>
          }
        />
      </section>
    );
  }

  return (
    <section className={cn("flex min-h-0 min-w-0 flex-col", className)}>
      {/*
        The header sticks to the top of whatever scrolls it, so Download and
        Full view stay reachable while a tall document scrolls past — the
        reason the record dialogs used to pin a footer, answered without
        spending each dialog's one primary on Download.

        bg-popover because a sticky bar has to be opaque against the surface
        sliding under it, and every caller is inside a Dialog. The gap under
        the title lives inside the sticky box as padding: as a flex gap it
        would be a transparent seam for the well to show through.
      */}
      <div className="sticky top-0 z-10 flex flex-col gap-2 bg-popover pb-3 sm:flex-row sm:items-center sm:justify-between">
        {/*
          Wraps rather than truncates. A document title runs long — longer
          again once it is translated — and cropping the only thing naming
          what you are about to download is not a trade worth making.
        */}
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-body font-medium break-words text-foreground">
            {title}
          </h3>
          {description ? (
            <p className="text-body-compact text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <DocumentPreviewActions
          title={title}
          source={source}
          download={download}
          className="shrink-0"
        >
          {actions}
        </DocumentPreviewActions>
      </div>
      <DocumentWell
        title={title}
        source={source}
        surface={surface}
        className={wellHeight[height]}
      />
    </section>
  );
}

/**
 * Download and Full view on their own, for a surface whose layout cannot put
 * them in a preview header.
 */
export function DocumentPreviewActions({
  title,
  source,
  download,
  iconOnly = true,
  className,
  children,
}: {
  title: string;
  source: DocumentPreviewSource;
  download?: DocumentDownload;
  /**
   * Drop the words and keep the icons, at the 40×40 floor with a tooltip and an
   * accessible name carrying the same sentence. For a surface that has no room
   * for a header band — see `DocumentPreview`'s quiet variant.
   */
  iconOnly?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const resolved = resolveDownload(source, download);

  const cluster = (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
      {resolved ? (
        <DownloadAction title={title} download={resolved} iconOnly={iconOnly} />
      ) : null}
      {canExpand(source) ? (
        <FullViewDialog
          title={title}
          source={source}
          download={resolved}
          iconOnly={iconOnly}
        />
      ) : null}
    </div>
  );

  /* Its own provider rather than an app-wide one: this component is dropped into
     dialogs and panels that have no idea a tooltip is coming, and the pattern the
     product already uses (`join/download-case-file-button.tsx`) is a local
     provider. Nesting inside another provider is harmless. */
  return iconOnly ? <TooltipProvider>{cluster}</TooltipProvider> : cluster;
}

/**
 * An icon action that says what it does in three places at once — the tooltip,
 * the accessible name and the same words — so a voice user can speak what a
 * sighted user reads (ACCESSIBILITY §9, §12).
 */
function IconAction({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Ghost, not primary: these dialogs are for reading, and the teal each one
 * has left to spend belongs to whatever act the dialog exists to complete —
 * Add signature, Submit — or to nothing at all on a read-only record (Laws
 * ration teal; they cap primaries, they do not require one).
 *
 * The visible label stays "Download" and the accessible name extends it with
 * the document's name, so the spoken name still starts with what is written
 * on the button (WCAG 2.5.3).
 */
function DownloadAction({
  title,
  download,
  iconOnly = false,
}: {
  title: string;
  download: DocumentDownload;
  iconOnly?: boolean;
}) {
  const label = download.label ?? `Download ${title}`;

  if ("href" in download) {
    const anchor = (
      <Button
        variant="ghost"
        size={iconOnly ? "icon" : "default"}
        className="shrink-0"
        asChild
      >
        <a
          href={download.href}
          download={download.filename ?? true}
          aria-label={label}
        >
          {iconOnly ? null : "Download"}
          <DownloadIcon
            data-icon={iconOnly ? undefined : "inline-end"}
            aria-hidden
          />
        </a>
      </Button>
    );
    return iconOnly ? <IconAction label={label}>{anchor}</IconAction> : anchor;
  }

  const button = (
    <Button
      type="button"
      variant="ghost"
      size={iconOnly ? "icon" : "default"}
      className="shrink-0"
      aria-label={label}
      onClick={download.onDownload}
    >
      {iconOnly ? null : "Download"}
      <DownloadIcon
        data-icon={iconOnly ? undefined : "inline-end"}
        aria-hidden
      />
    </Button>
  );
  return iconOnly ? <IconAction label={label}>{button}</IconAction> : button;
}

/**
 * The same document, near the size of the window.
 *
 * A dialog rather than a new tab: the generated application is composed in
 * the browser with no file behind it, so there is nothing for a tab to load —
 * and one behaviour on every surface beats a tab here and a dialog there.
 *
 * On the record dialogs this opens inside an already-open Dialog. Radix
 * stacks dismissable layers, so Escape closes this viewer and leaves the
 * record behind it open; DialogTrigger wires aria-haspopup / aria-expanded
 * and returns focus to the trigger on close without any help from us.
 */
function FullViewDialog({
  title,
  source,
  download,
  iconOnly = false,
}: {
  title: string;
  source: DocumentPreviewSource;
  download: DocumentDownload | undefined;
  iconOnly?: boolean;
}) {
  const label = `Full view of ${title}`;
  const trigger = (
    <DialogTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size={iconOnly ? "icon" : "default"}
        className="shrink-0"
        aria-label={label}
      >
        {iconOnly ? null : "Full view"}
        <Maximize2Icon
          data-icon={iconOnly ? undefined : "inline-end"}
          aria-hidden
        />
      </Button>
    </DialogTrigger>
  );

  return (
    <Dialog>
      {iconOnly ? <IconAction label={label}>{trigger}</IconAction> : trigger}
      {/* The primitive parks its close button 8px from the corner, which left
          the title row hard against the top edge. Here it moves in to 16px and
          the row follows it (owner, Sept 18). */}
      <FlowDialogContent outsideCloses className="flex h-[92svh] flex-col gap-4 overflow-hidden sm:max-w-[calc(100%-4rem)] [&>[data-slot=dialog-close]]:top-4 [&>[data-slot=dialog-close]]:right-4">
        {/* One plane: title, then the download icon, then the close button.
            The row's centre is the close button's (34px down), and `pr-8`
            leaves the download icon 4px short of it, so the two read as a
            pair. The description is for screen readers only; on screen the
            close button already says how to go back. */}
        <div className="-mt-2.5 -mb-1.5 flex min-h-10 shrink-0 items-center justify-between gap-2 pr-8">
          <DialogHeader className="min-w-0">
            <DialogTitle className="text-title-s font-semibold break-words">
              {title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Full view. Close to go back.
            </DialogDescription>
          </DialogHeader>
          {download ? (
            <DownloadAction title={title} download={download} iconOnly />
          ) : null}
        </div>
        {/* Near window size the page is mostly white, so it takes the darker
            document ground wherever it opens from. */}
        <DocumentWell
          title={title}
          source={source}
          surface="ground"
          className="min-h-0 flex-1"
        />
      </FlowDialogContent>
    </Dialog>
  );
}

/**
 * The well itself. surface-sunken with no border and no shadow — a document
 * preview is the nested media well the Laws name, and depth here is fill
 * (Elevation: the box-in-box ban).
 */
type WellSurface = "sunken" | "ground" | "card" | "bare";

/**
 * The two fills a well can take, and the sticky strip that has to match whichever one
 * is under it. `card` carries a hairline because a white sheet on a tinted stage has no
 * other edge; the sunken well has none, because its fill is its edge (the box-in-box ban).
 */
const wellSurface: Record<WellSurface, { well: string; strip: string }> = {
  sunken: { well: "bg-surface-sunken", strip: "bg-surface-sunken" },
  /** View Case's darker document ground; see `document-ground.ts`. */
  ground: { well: DOCUMENT_GROUND, strip: DOCUMENT_GROUND },
  card: { well: "border border-hairline bg-card", strip: "bg-card" },
  /** Inside a frame that already draws the edge and the fill — see the quiet+card path. */
  bare: { well: "rounded-none", strip: "bg-card" },
};

function DocumentPdf({ src, title }: { src: string; title: string }) {
  const { url, page } = parsePdfSrc(src);
  return (
    <PdfViewer
      key={src}
      src={url}
      title={title}
      initialPage={page}
      className="absolute inset-0 rounded-none bg-transparent"
    />
  );
}

function DocumentWell({
  title,
  source,
  toolbar,
  surface = "sunken",
  className,
}: {
  title: string;
  source: DocumentPreviewSource;
  surface?: WellSurface;
  /**
   * Controls that belong **on** the well rather than above it — the quiet
   * variant's two icons. In flow at the well's top-right, so they sit on the
   * sunken fill and never on the document: a ghost button over a pale scan is
   * fill on fill, and the well's own tone is the surface that answers it.
   */
  toolbar?: ReactNode;
  className?: string;
}) {
  const fill = wellSurface[surface];

  if (source.kind === "src") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-xl",
          fill.well,
          className
        )}
      >
        {/* Keyed on the src so switching documents rebuilds the viewer
            rather than leaving the previous one's scroll position behind. */}
        {isPdfSrc(source.src) ? (
          <DocumentPdf src={source.src} title={title} />
        ) : (
          <iframe
            key={source.src}
            title={title}
            src={source.src}
            className="absolute inset-0 size-full border-0 bg-paper"
          />
        )}
        {/* An iframe fills its well edge to edge, so there is no flow to put
            the toolbar in — it floats, and the page under it is a document. */}
        {toolbar ? (
          <div className="absolute top-2 right-2 z-10">{toolbar}</div>
        ) : null}
      </div>
    );
  }

  // A well the browser does not scroll for us has to be focusable, or its
  // content is unreachable without a pointer.
  const scrollableWell = cn(
    "flex overflow-auto overscroll-contain rounded-xl p-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
    fill.well,
    toolbar && "flex-col gap-2",
    className
  );

  if (source.kind === "composed") {
    return (
      <div
        tabIndex={0}
        aria-label={`Preview of ${title}`}
        className={cn(scrollableWell, "flex-col")}
      >
        {toolbar ? (
        /*
          Sticky for the same reason the header band is: a tall scan pushes the
          well past the viewport, and Download has to still be there when it
          does — at 375 the whole overlay body is what scrolls. It carries the
          well's own fill so it is invisible at rest and opaque when the
          document passes under it; a ghost icon over a pale card scan is fill
          on fill, and this is the surface that answers it.
        */
        <div className={cn("sticky top-0 z-10 flex justify-end", fill.strip)}>
          {toolbar}
        </div>
      ) : null}
        {/* Capped so full view buys a bigger document, not a longer line —
            past about 90 characters a paragraph gets harder to read, not
            easier. Inert at the widths the inline well ever reaches. */}
        <div className="mx-auto w-full max-w-4xl">{source.content}</div>
      </div>
    );
  }

  const { file } = source;

  return (
    <div
      tabIndex={0}
      aria-label={`Preview of ${title}`}
      className={scrollableWell}
    >
      {toolbar ? (
        /*
          Sticky for the same reason the header band is: a tall scan pushes the
          well past the viewport, and Download has to still be there when it
          does — at 375 the whole overlay body is what scrolls. It carries the
          well's own fill so it is invisible at rest and opaque when the
          document passes under it; a ghost icon over a pale card scan is fill
          on fill, and this is the surface that answers it.
        */
        <div className={cn("sticky top-0 z-10 flex justify-end", fill.strip)}>
          {toolbar}
        </div>
      ) : null}
      {/*
        Centred with margin auto rather than items-center: a flex-centred
        child that outgrows a scroll container has its top edge clipped away,
        and a document is exactly the thing you cannot afford to crop.
      */}
      {isPreviewableImage(file) ? (
        <FilePreviewImage
          file={file}
          className="m-auto block h-auto max-w-full rounded-md"
        />
      ) : (
        <div className="m-auto flex flex-col items-center gap-3 py-8 text-center">
          <FileTextIcon className="size-10 text-muted-foreground" aria-hidden />
          <p className="text-body font-medium">{file.name}</p>
          <p className="text-body-compact text-muted-foreground">
            {formatFileSize(file.size)} · PDF pages are not previewed here.
          </p>
        </div>
      )}
    </div>
  );
}
