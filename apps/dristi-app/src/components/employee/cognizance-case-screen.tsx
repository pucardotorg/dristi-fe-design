"use client";

import * as React from "react";
import Link from "next/link";
import {
  ExternalLinkIcon,
  EyeIcon,
  FileQuestionIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { ARRIVAL } from "@/components/chrome/motion";
import { COGNIZANCE_PATH } from "@/components/employee/cognizance-table";
import { DocumentScroller } from "@/components/employee/document-scroller";
import { LabelTip } from "@/components/filing/form-field";
import { TooltipProvider } from "@/components/ui/tooltip";
import { markArrival, useArrival } from "@/components/employee/use-arrival";
import { useCourtToday } from "@/components/employee/use-court-today";
import { useCourt } from "@/components/court/court-provider";
import { courtProfile } from "@/lib/court/profiles";
import { rememberCognizanceTab } from "@/components/employee/cognizance-return";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionRow,
  DescriptionTerm,
} from "@/components/ui/description-list";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  chainFor,
  cnrFor,
  COGNIZANCE_ACTS,
  cognizanceDocumentsFor,
  cognizanceCaseById,
  findingsFor,
  actsFor,
  tabFor,
  summaryChunksFor,
  type CognizanceAct,
  type CognizanceCase,
  type CognizanceChunk,
  type CognizanceField,
  type CognizanceFinding,
} from "@/lib/employee/cognizance";
import { zoneFor } from "@/lib/employee/document-zones";
import { causeTitle } from "@/lib/employee/hearings";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";

/**
 * One registered complaint, as the magistrate reads it before deciding whether the case
 * goes ahead — the reference's Case Summary, in our design language.
 *
 * The left column is the reference's own: a Case Summary block of the case's numbers, then
 * a single column of labelled fields in the reference's order, each date shown directly and
 * each critical check surfaced as an alert inline against the field it comes from (owner,
 * 2026-09-14). The right column is the documents, as one long scroll (`DocumentScroller`):
 * clicking a field brings its document to the top and marks the region the value was read
 * from — the scrutiny bundle's interaction, shared with Register cases.
 *
 * The acts are the PRD's two — Dismiss, and Take cognizance, which becomes Issue notice on
 * a late complaint in Kerala. Each settles in place and names the order it would draw up;
 * none is performed, and the trip into the order composer is not wired
 * (`lib/employee/cognizance.ts`).
 */
export function CognizanceCaseScreen({ caseId }: { caseId: string }) {
  const arrival = useArrival();
  const matter = cognizanceCaseById(caseId);

  if (!matter) return <CaseMissing />;

  return (
    /* No `overflow-x-clip` here: in this browser `overflow: clip` makes the sticky
       documents panel pin to the clip box rather than the viewport, which was the scroll
       artifact the owner saw (owner, 2026-09-16). The case screen only ever arrives
       "next" — a vertical slide — so there is no sideways entrance to clip; the "back"
       slide plays on the queue it returns to, not here. */
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        arrival && ARRIVAL[arrival],
      )}
    >
      <CaseBody key={matter.id} matter={matter} />
    </div>
  );
}

/** Section labels above a surface — scaffolding, so it reads as scaffolding. */
const EYEBROW = "text-caption font-semibold text-muted-foreground";

/**
 * Where an act goes: the order it would draw up, on this complaint.
 *
 * The act rides in the query string because it is not a second thing the URL names —
 * one complaint has one order being drawn at a time (`cognizance/[caseId]/order`).
 */
function orderHref(matter: CognizanceCase, act: CognizanceAct): string {
  return `${COGNIZANCE_PATH}/${matter.id}/order?act=${act}`;
}

/** Forward, so the order slides in the way the complaint did. */
function openOrder(): void {
  markArrival("next");
}

/** A lifted white panel whose children draw their own padding and dividers. */
const SHEET = "gap-0 overflow-hidden py-0";

/* ────────────────────── the resizable document panel ─────────────────────── */

/** A media query as a boolean, `false` until mounted — the DS `useIsMobile` pattern. */
function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The panel is drag-resizable only where it exists: a mouse on a wide screen. */
const DESKTOP_PANEL = "(min-width: 1280px) and (pointer: fine)";

const DOC_PANEL_MIN = 320;
const DOC_PANEL_DEFAULT = 384;
const DOC_PANEL_STORE_KEY = "cognizance:doc-panel-width";

const clampWidth = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/** The widest the panel may grow — never so wide the reading cannot live beside it. */
function docPanelMax(): number {
  if (typeof window === "undefined") return 640;
  return Math.min(720, Math.round(window.innerWidth * 0.6));
}

/**
 * The grab strip on the panel's docked edge — drag it to read the documents bigger (owner,
 * 2026-09-15). It rides the aside's left border, so it moves as the panel grows; pointer
 * capture keeps the drag alive while the cursor is over the facsimiles, and the arrow keys
 * widen it a rung at a time, so it is a `separator` a keyboard can work too.
 */
function PanelResizeHandle({
  width,
  onResize,
  onCommit,
}: {
  width: number;
  onResize: (width: number) => void;
  onCommit: () => void;
}) {
  const drag = React.useRef<{ x: number; w: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, w: width };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onResize(
      clampWidth(
        drag.current.w + (drag.current.x - event.clientX),
        DOC_PANEL_MIN,
        docPanelMax(),
      ),
    );
  };
  const end = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    onCommit();
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16;
    if (event.key === "ArrowLeft") {
      onResize(clampWidth(width + step, DOC_PANEL_MIN, docPanelMax()));
      onCommit();
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      onResize(clampWidth(width - step, DOC_PANEL_MIN, docPanelMax()));
      onCommit();
      event.preventDefault();
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the documents panel"
      aria-valuenow={Math.round(width)}
      aria-valuemin={DOC_PANEL_MIN}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={onKeyDown}
      className="group/resize absolute inset-y-0 left-0 z-10 flex w-3 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center focus-visible:outline-none"
    >
      {/* A quiet grip that answers to the pointer and the keyboard, so the edge reads as
          draggable without drawing a second border down the panel at rest. */}
      <span
        aria-hidden
        className="h-8 w-1 rounded-full bg-hairline transition-colors group-hover/resize:bg-primary group-focus-visible/resize:bg-primary group-focus-visible/resize:h-12"
      />
    </div>
  );
}

function CaseBody({ matter }: { matter: CognizanceCase }) {
  /* The day is the reader's, not the server's — the whole chain is worked backwards from
     how long this complaint has waited, so the clock that matters is the one in the room
     (`use-court-today.ts`). */
  const today = useCourtToday();
  const chain = React.useMemo(() => chainFor(matter, today), [matter, today]);
  const chunks = React.useMemo(
    () => summaryChunksFor(matter, chain),
    [matter, chain],
  );
  const findings = React.useMemo(() => findingsFor(matter), [matter]);
  /* A cheque and a memo per cheque, then the notice (cheat sheet §5). */
  const { court: documentsCourt } = useCourt();
  const documents = React.useMemo(
    () => cognizanceDocumentsFor(matter, documentsCourt),
    [matter, documentsCourt],
  );

  /* The recommended act first, then the rest the deployment offers: two under the delay
     split, all three under Gujarat's case-type split (`actsFor`). */
  const { court } = useCourt();
  const [recommended, ...alternatives] = actsFor(matter, court);
  const caseTypeSplit = courtProfile(court).cognizanceSplit === "case-type";
  /* Back to the queue by any way — the trail included — lands on this complaint's tab. */
  React.useEffect(() => rememberCognizanceTab(tabFor(matter, court)), [matter, court]);

  /* Which field is lit, and the document and region it opened. `fieldId` is what lights
     the row — keyed on the field, not its document, so two fields that share a document
     (the cheque date and the branch both come off the cheque) do not light together. The
     scroller reads only `doc` and `zone`. `null` leaves everything at rest. */
  const [active, setActive] = React.useState<{
    fieldId: string;
    doc: string;
    zone: ReturnType<typeof zoneFor>;
  } | null>(null);

  const openField = (field: CognizanceField) => {
    const doc = field.source
      ? documents.find((entry) => entry.key === field.source)
      : undefined;
    if (!doc) return;
    /* A second click on the field that is already lit puts it out again — the mark is a
       toggle, not a one-way latch (owner, 2026-09-15). Clicking a different field moves the
       mark to it. */
    setActive((current) =>
      current?.fieldId === field.id
        ? null
        : { fieldId: field.id, doc: doc.key, zone: zoneFor(doc.kind, field.term) },
    );
  };

  /* The docked panel's width, in px, remembered across visits. It is only live where the
     panel is — a mouse on a wide screen — so `desktopPanel` also gates the inline column
     width, or a hidden aside would still reserve a track on a touch tablet. A ref shadows
     the state so the pointer-up that saves reads the width the last move set, not a value a
     batched render has not flushed yet. */
  const desktopPanel = useMediaQuery(DESKTOP_PANEL);
  const [docWidth, setDocWidthState] = React.useState(DOC_PANEL_DEFAULT);
  const docWidthRef = React.useRef(DOC_PANEL_DEFAULT);
  const setDocWidth = React.useCallback((width: number) => {
    docWidthRef.current = width;
    setDocWidthState(width);
  }, []);
  const commitDocWidth = React.useCallback(() => {
    try {
      window.localStorage.setItem(
        DOC_PANEL_STORE_KEY,
        String(Math.round(docWidthRef.current)),
      );
    } catch {
      /* private mode, blocked storage — the width just does not persist. */
    }
  }, []);
  /* Hydrate the remembered width on mount, not in a lazy `useState` initialiser: the
     server has no `localStorage`, so reading it during render would hand the client a
     different first width than the server drew and trip a hydration mismatch. Setting it
     once, after mount, is the SSR-safe shape — the one place the set-state-in-effect rule
     is the right call rather than the wrong one. */
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DOC_PANEL_STORE_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- see the note above: client-only hydration
        setDocWidth(clampWidth(parseInt(saved, 10), DOC_PANEL_MIN, docPanelMax()));
      }
    } catch {
      /* nothing saved, or storage blocked — keep the default. */
    }
  }, [setDocWidth]);

  /* The scroller cares only which document and region — not which field opened it. */
  const documentActive = active ? { doc: active.doc, zone: active.zone } : null;

  const documentsHeader = (
    <div className="flex shrink-0 items-baseline justify-between gap-3 border-b border-hairline px-8 py-4">
      <h2 className="text-body font-semibold">Documents</h2>
      <span className="text-body-compact tabular-nums text-muted-foreground">
        {documents.length} filed
      </span>
    </div>
  );

  return (
    <>
      {/*
       * An app frame, not a scrolling page: a fixed height, the title bar and the decision
       * footer pinned to it, and the middle scrolling inside. The screen used to scroll the
       * page with a *sticky* documents panel, but a fixed-height panel sticky inside a short
       * facts column gets shoved up under the title bar at the end of the scroll — the
       * artifact the owner saw (owner, 2026-09-16). As a frame, the panel is a plain pane
       * that never moves and the footer never overlaps it — the shape Scrutiny uses.
       * Subtracting the chrome bar's `h-14` is the same coupling `case-workbench` carries.
       */}
      <div className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col overflow-hidden">
        {/* The cause and the two acts on the frame's own bar — the decision stays on top
            and always in view, which the owner preferred to a footer (owner, 2026-09-16).
            The frame keeps this bar pinned while the reading and the documents scroll
            inside. */}
        <div className="shrink-0 border-b border-hairline bg-muted px-6 md:px-8 dark:bg-background">
          {/* Gujarat: 16px above and below the 40px buttons — at h-14 they had 8, and the
              bar read cramped against the title (owner, 2026-10-13). Others keep h-14. */}
          <div
            className={cn(
              "flex items-center justify-between gap-4",
              caseTypeSplit ? "py-4" : "h-14",
            )}
          >
            <h1 className="min-w-0 truncate font-semibold text-title-s">
              {causeTitle(matter)}
            </h1>
            {/* Each act opens the order it would draw up, with its items already
                loaded — the PRD's own shape (§6): an act is never performed from here,
                it is composed, read and sent. They were confirmation dialogs naming the
                items in words; a list of item names is a worse version of the order
                itself, which is one click away and editable. */}
            <div className="flex shrink-0 items-center gap-3">
              {/* View case sits on the case summary in Gujarat (owner, 2026-10-13). */}
              {/* PRD §6: View case opens the full case file and changes nothing on the
                  case. Quiet and apart from the two acts, and in a tab of its own so this
                  screen stays exactly where the magistrate left it (owner, 2026-10-13).
                  The case view is the advocate's, read as the court
                  (`components/cases/case-detail.tsx`). */}
              {caseTypeSplit ? null : (
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <a href={`/employee/cases/${matter.id}`} target="_blank" rel="noopener">
                    View case
                    <span className="sr-only"> (opens in a new tab)</span>
                    <ExternalLinkIcon data-icon="inline-end" aria-hidden />
                  </a>
                </Button>
              )}
              {/* The alternatives quiet, Dismiss outermost; the recommendation is the
                  one filled button, last, where the eye ends (owner, 2026-10-13). */}
              {[...alternatives].reverse().map((act) => (
                <Button
                  key={act}
                  asChild
                  /* Dismissing is the rare act, so in Gujarat it is tertiary — a ghost
                     button, not a second outline beside the alternative (owner,
                     2026-10-13). */
                  variant={act === "dismiss" && caseTypeSplit ? "ghost" : "outline"}
                >
                  <Link href={orderHref(matter, act)} onClick={openOrder}>
                    {COGNIZANCE_ACTS[act].label}
                  </Link>
                </Button>
              ))}
              <Button asChild>
                <Link href={orderHref(matter, recommended)} onClick={openOrder}>
                  {COGNIZANCE_ACTS[recommended].label}
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* The reading and the documents. **Two panes only for a mouse on a wide screen**
            (`xl:pointer-fine`): the panel scrolls inside itself, and a second scroll box
            beside the page's own is a scroll-in-a-scroll on a touch screen (owner,
            2026-09-15). Every touch device drops to one scrolling column with the documents
            at its foot; only a fine pointer gets the docked pane. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto xl:pointer-fine:flex-row xl:pointer-fine:overflow-hidden">
          {/* The reading. Its own scroll beside the pane on a wide screen; part of the one
              page scroll on touch. It keeps the screen-edge padding on the left and a
              gutter to the pane on the right.

              `[&>*]:shrink-0` is load-bearing: this is a fixed-height `flex-col`, and the
              case summary and the facts sheet are `overflow-hidden` cards — without it a
              tall, findings-heavy case would let flex shrink those cards to fit the column
              and clip their last rows (the jurisdiction check went missing under the fold)
              rather than overflow and scroll (owner, 2026-09-16). Held at their own height,
              they overflow and the column scrolls. */}
          <div className="flex min-w-0 flex-col gap-6 px-6 pt-6 pb-8 md:px-8 md:pt-8 xl:pointer-fine:min-h-0 xl:pointer-fine:flex-1 xl:pointer-fine:overflow-y-auto [&>*]:shrink-0">
            <CaseSummaryPanel matter={matter} viewCase={caseTypeSplit} />
            <CaseFactsPanel
              chunks={chunks}
              findings={findings}
              active={active}
              onOpen={openField}
            />

            {/* Touch, and every screen below `xl`: the documents flow at the foot of the one
                page scroll rather than a docked pane — never a box within a box. */}
            <section
              aria-label="Documents"
              className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-hairline bg-card shadow-raised xl:pointer-fine:hidden"
            >
              {documentsHeader}
              <DocumentScroller docs={documents} active={documentActive} />
            </section>
          </div>

          {/* The docked documents pane: a plain flex pane that fills the frame's height and
              scrolls inside itself — no sticky, so nothing shoves it. Its width is the CSS
              default until the panel mounts, then the remembered, draggable width takes over
              (inline, so it can be dragged live), and only on `desktopPanel` so a touch
              tablet never reserves a track for a pane it does not show. */}
          <aside
            aria-label="Documents"
            className="relative hidden min-h-0 shrink-0 flex-col border-l border-hairline bg-card xl:pointer-fine:flex"
            style={desktopPanel ? { width: docWidth } : undefined}
          >
            {desktopPanel ? (
              <PanelResizeHandle
                width={docWidth}
                onResize={setDocWidth}
                onCommit={commitDocWidth}
              />
            ) : null}
            {documentsHeader}
            <DocumentScroller docs={documents} active={documentActive} />
          </aside>
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────── case summary ──────────────────────────────── */

/**
 * The case's numbers, as a proper Case Summary block rather than a metadata line (owner,
 * 2026-09-14) — the reference's own header row.
 *
 * Three cells, divided like the synopsis sheet: the register number the complaint carries
 * before cognizance (`CMP/…`), the filing number it came in as, and the CNR the registry
 * assigned. The post-cognizance `ST/…` number is not shown — it does not exist until this
 * very act is taken.
 */
function CaseSummaryPanel({
  matter,
  viewCase = false,
}: {
  matter: CognizanceCase;
  /** Carry View case on the summary's own heading, off the decision bar. */
  viewCase?: boolean;
}) {
  /* All three are registry identifiers, so all three take the identifier treatment. */
  const cells = [
    { label: "Case number", value: matter.caseNumber, idLabel: "case number" },
    { label: "Filing number", value: matter.filingNumber, idLabel: "filing number" },
    { label: "CNR", value: cnrFor(matter), idLabel: "CNR" },
  ];
  return (
    <section aria-labelledby="case-summary" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-6 items-center justify-between gap-3">
        {/* With View case beside it the heading has to outrank a button, so it takes the
            Documents panel's heading — body, semibold, full ink — not the eyebrow
            (owner, 2026-10-13). */}
        <h2
          id="case-summary"
          className={viewCase ? "text-body font-semibold text-foreground" : EYEBROW}
        >
          Case summary
        </h2>
        {/* The case's identity is what View case opens in full, so it rides here rather
            than among the acts on the bar — a plain tertiary button, still opening the
            case in a tab of its own (owner, 2026-10-13). */}
        {viewCase ? (
          <Button asChild variant="ghost" className="-my-2.5">
            <a href={`/employee/cases/${matter.id}`} target="_blank" rel="noopener">
              View case
              <span className="sr-only"> (opens in a new tab)</span>
              <ExternalLinkIcon data-icon="inline-end" aria-hidden />
            </a>
          </Button>
        ) : null}
      </div>
      <Card variant="raised" className={cn(SHEET, "@container")}>
        <dl className="grid gap-px bg-hairline @md:grid-cols-3">
          {cells.map((cell) => (
            <div key={cell.label} className="flex min-w-0 flex-col gap-1 bg-card p-6">
              <dt className="text-caption text-muted-foreground">{cell.label}</dt>
              <dd className="text-body-compact font-medium break-words">
                <Identifier value={cell.value} label={cell.idLabel} />
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </section>
  );
}

/* ──────────────────────────────── the fields ────────────────────────────────── */

/** The mark and DS status pair each finding weight wears. One colour, one meaning. */
const FINDING_LOOK = {
  critical: { variant: "destructive" as const, Icon: TriangleAlertIcon },
  note: { variant: "info" as const, Icon: InfoIcon },
};

/**
 * The complaint's fields, one single column, in the reference's order (owner, 2026-09-14).
 *
 * A field the value was read off a document is a control: clicking it marks the region on
 * that document. A field a check bears on carries that finding as an alert directly beneath
 * it — the reference's inline red boxes, in the DS status pairs (a late-filing note reads
 * informational, a bad notice or a wrong court reads destructive).
 */
function CaseFactsPanel({
  chunks,
  findings,
  active,
  onOpen,
}: {
  chunks: CognizanceChunk[];
  findings: CognizanceFinding[];
  active: { fieldId: string } | null;
  onOpen: (field: CognizanceField) => void;
}) {
  return (
    // One sheet, not five. Each chunk was a card with its own 49px banded header, and for
    // eleven fields that chrome — five bands, four gaps between cards — was most of the
    // column's height. The chunks are now sections inside a single sheet, divided by a
    // hairline under a quiet label, so the grouping the owner wanted kept for scanning
    // survives at a fraction of the height (owner, 2026-09-15). `@container` so the rows
    // below can turn horizontal on the sheet's own width, not the viewport's.
    <Card variant="raised" className={cn(SHEET, "@container min-w-0")}>
      {chunks.map((chunk, index) => (
        // Register cases' synopsis grammar (`register-case-screen.tsx`): the label above the
        // value, and two facts across where the sheet is wide enough — so the reading uses
        // the room the desktop column has instead of a single ribbon of pairs down the left
        // (owner, 2026-09-15). Chunks stay in the §138 order, divided by a hairline, unnamed.
        // Two kinds of field break the two-up rhythm and take the whole width instead: one a
        // check bears on (its alert wants the room) and one whose value is a sentence, not a
        // date — see `Fact`.
        <DescriptionList
          key={chunk.id}
          className={cn(
            "grid grid-cols-1 gap-x-6 gap-y-4 px-4 py-4 @md:grid-cols-2",
            index > 0 && "border-t border-hairline",
          )}
        >
          {chunk.caption ? (
            <p className={cn(EYEBROW, "px-2 @md:col-span-2")}>{chunk.caption}</p>
          ) : null}
          {chunk.fields.map((field) => {
            const finding = findings.find((entry) => entry.term === field.term);
            return (
              <FieldRow
                key={field.id}
                field={field}
                finding={finding}
                wide={!!finding || field.value.length > 24}
                active={active?.fieldId === field.id}
                onOpen={onOpen}
              />
            );
          })}
        </DescriptionList>
      ))}
    </Card>
  );
}

/**
 * One field — its label over its value, ruled from the next, an alert beneath when a check
 * bears on it. Clickable when a document states it, with a quiet eye and the tables' hover
 * fill; the row it opened stays lit while its region is marked on the page.
 */
function FieldRow({
  field,
  finding,
  wide,
  active,
  onOpen,
}: {
  field: CognizanceField;
  finding: CognizanceFinding | undefined;
  /** Take the whole width instead of one of the two columns — a flagged or free-text field. */
  wide: boolean;
  active: boolean;
  onOpen: (field: CognizanceField) => void;
}) {
  const open = field.source ? () => onOpen(field) : undefined;
  return (
    // Register cases' synopsis `Fact`: the label above the value, no rule under it. It sits
    // in one of the grid's two columns — unless it is `wide`, when it spans both: a check's
    // alert wants the full width beneath it, and a sentence read at half-width wraps to a
    // ragged stack (owner, 2026-09-15).
    <DescriptionRow
      className={cn(
        "flex flex-col items-stretch gap-0 border-0 py-0",
        wide && "@md:col-span-2",
      )}
    >
      <div
        className={cn(
          "group/field relative flex min-w-0 flex-col gap-0.5 rounded-lg px-2 py-1.5 transition-colors",
          open && "cursor-pointer pr-8 hover:bg-surface-sunken",
          active && "bg-accent hover:bg-accent",
        )}
        onClick={open}
      >
        <DescriptionTerm className="text-body-compact">
          {field.term}
          {/* The PRD's tooltip, where it gives one (cheat sheet §4). Its own click must not
              also open the field's document. */}
          {field.tooltip ? (
            <span className="ml-1" onClick={(event) => event.stopPropagation()}>
              <TooltipProvider>
                <LabelTip>{field.tooltip}</LabelTip>
              </TooltipProvider>
            </span>
          ) : null}
        </DescriptionTerm>
        <DescriptionDetails className="min-w-0 text-body-compact text-pretty">
          <span className="font-medium">{field.value}</span>
          {field.note ? (
            <span className="text-muted-foreground"> · {field.note}</span>
          ) : null}
        </DescriptionDetails>
        {open ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Show ${field.term} in the documents`}
            className={cn(
              "absolute top-1 right-1 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover/field:opacity-100 [@media(hover:none)]:opacity-100",
              active && "opacity-100",
            )}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(field);
            }}
          >
            <EyeIcon aria-hidden />
          </Button>
        ) : null}
      </div>
      {finding ? (
        <div className="px-2 pt-1.5">
          <FindingAlert finding={finding} />
        </div>
      ) : null}
    </DescriptionRow>
  );
}

/** One check, inline beneath the field it bears on — the reference's red box, in the DS. */
function FindingAlert({ finding }: { finding: CognizanceFinding }) {
  const look = FINDING_LOOK[finding.weight];
  return (
    <Alert variant={look.variant}>
      <look.Icon aria-hidden />
      <AlertTitle className="text-body-compact text-pretty">
        {finding.statement}
      </AlertTitle>
      <AlertDescription className="text-body-compact text-pretty">
        {finding.consequence}
      </AlertDescription>
    </Alert>
  );
}

/* ─────────────────────────────────── the miss ───────────────────────────────── */

/** An id this queue does not hold — a stale link, a typed URL, a complaint decided. */
function CaseMissing() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col p-6 md:p-8">
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="font-semibold text-title-s">
            This complaint is not waiting for cognizance
          </EmptyTitle>
          <EmptyDescription className="text-body">
            A complaint opens from the list of those on the register waiting for
            cognizance. This one is not on it.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href={COGNIZANCE_PATH}>Back to take cognizance</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
