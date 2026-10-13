"use client";

import * as React from "react";
import {
  ClockIcon,
  FilesIcon,
  PencilIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { useRoomInRem } from "@/hooks/use-min-width";
import { nextFilingAfter } from "@/lib/employee/scrutiny/queue";
import type { AiMode } from "@/lib/court/profiles";
import type { Rect, ScrutinyCase } from "@/lib/employee/scrutiny/types";
import { useScrutinyState } from "@/lib/employee/scrutiny/use-scrutiny-state";
import { ScrutinyCaseProvider } from "@/components/employee/scrutiny/scrutiny-case-context";
import { Identifier } from "@/components/chrome/identifier";
import { ARRIVAL } from "@/components/chrome/motion";
import { useArrival } from "@/components/employee/use-arrival";
import { cn } from "@/lib/utils";
import {
  BundleView,
  type BundleHandle,
} from "@/components/employee/scrutiny/bundle-view";
import { ChecksPopover } from "@/components/employee/scrutiny/checks-popover";
import {
  FieldsPanel,
  type FieldsPanelHandle,
} from "@/components/employee/scrutiny/fields-panel";
import { HistorySheet } from "@/components/employee/scrutiny/history-sheet";
import {
  ReviewDialog,
  type Decision,
} from "@/components/employee/scrutiny/review-dialog";
import {
  IndexRail,
  IndexSheet,
} from "@/components/employee/scrutiny/index-rail";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useSidebar } from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCourt, useCourtText } from "@/components/court/court-provider";

/**
 * The case review: filed fields on the left, the bundle in the centre, the document
 * index on the right, and the decision along the bottom.
 *
 * The three panes are one `ResizablePanelGroup` rather than the hand-rolled pointer
 * dividers the prototype used — the DS ships that primitive, and it brings the keyboard
 * resize and the ARIA separator semantics with it. `horizontal` is the group's default
 * orientation, so it is not restated here. Note that v4 of the underlying library
 * dropped `autoSaveId`: pane widths reset on reload, where the prototype persisted them
 * to localStorage. Worth restoring behind `onLayoutChange` if officers miss it.
 *
 * **Three panes are a claim about width, so the width is measured.** Percentage sizes
 * alone gave a 135px index rail and a 270px fields pane on a 800px screen — labels
 * clipped to "ails" and "1 Sy…". Every pane now has a floor in `rem`, and below the room
 * for three the workbench stops pretending: fields and bundle become a two-view switch
 * in the case bar (fields first, because the filed values are what scrutiny is), and the
 * index becomes a sheet off that same bar. `useRoomInRem` rather than a media query,
 * because at 200% text zoom a 1280px viewport holds forty rem, not eighty
 * (`ACCESSIBILITY.md` §10).
 */
export function CaseWorkbench({
  caseData,
  ai = "on",
}: {
  caseData: ScrutinyCase;
  /** Without AI the workbench still works; it just stops asserting readings (`AiMode`). */
  ai?: AiMode;
}) {
  const aiOn = ai === "on";
  const arrival = useArrival();

  /*
   * The court rail folds to its icon strip while the workbench is open, then restores what
   * it was on the way out — three panes need the width, and the DS rail animates the fold,
   * so landing here reads as the sidebar quietly collapsing rather than a jump (owner,
   * 2026-09-15). It stays retractable: ⌘B or the rail toggle reopens it, and leaving the
   * case gives the bench back the rail state it had before.
   *
   * **Run once, from refs.** The DS `setOpen` is re-created whenever `open` changes, so an
   * effect that depends on it re-fires the moment the reader reopens the rail — and
   * re-collapses it, which read as the sidebar being stuck shut (owner, 2026-09-15). The
   * setter and the entry state are captured in refs and the effect has no deps, so it
   * collapses on mount, restores on unmount, and never fights a reopen in between. A stale
   * `setOpen` is safe here: called with a boolean, it ignores the `open` it closed over.
   */
  const { open, setOpen } = useSidebar();
  const setOpenRef = React.useRef(setOpen);
  const wasOpen = React.useRef(open);
  React.useEffect(() => {
    const setSidebar = setOpenRef.current;
    const restore = wasOpen.current;
    setSidebar(false);
    return () => setSidebar(restore);
  }, []);

  const { party, allFields, fieldById, historyRound } = caseData;
  const filingNo = caseData.filing.no;
  const controller = useScrutinyState(caseData);
  const bundle = React.useRef<BundleHandle>(null);
  const fields = React.useRef<FieldsPanelHandle>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [decision, setDecision] = React.useState<Decision | null>(null);

  /* 64rem is `lg` at a default root size: the three panes' own floors (18 + 22 + 11rem)
     plus the court rail beside them need about that much before any of them is readable.
     False before mount, so the narrow layout renders first and never claims room it has
     not measured. */
  const threePane = useRoomInRem(64);
  const [pane, setPane] = React.useState<"fields" | "bundle">("fields");
  const [indexOpen, setIndexOpen] = React.useState(false);

  // The case title is the officer's to correct (a mis-spelt party name is exactly the
  // kind of thing scrutiny exists to catch). Local until a case service owns it.
  // The editable title starts as the heading shows it (Settings' court switch).
  const courtText = useCourtText();
  const { profile } = useCourt();
  const [title, setTitle] = React.useState(() => ({
    complainant: courtText(party.complainant),
    accused: courtText(party.accused),
  }));
  const [editingTitle, setEditingTitle] = React.useState(false);

  const goToDoc = React.useCallback(
    (docId: string) => bundle.current?.goToDoc(docId),
    [],
  );

  /** Selecting a field scrolls the bundle to the page it was read from. */
  React.useEffect(() => {
    const field = controller.selectedId
      ? fieldById[controller.selectedId]
      : null;
    const target = field?.doc ?? field?.thumb ?? field?.docrow;
    if (target) goToDoc(target);
  }, [controller.selectedId, goToDoc, fieldById]);

  const selected = controller.selectedId
    ? fieldById[controller.selectedId]
    : null;
  const relatedDocId = selected
    ? (selected.doc ?? selected.thumb ?? selected.docrow ?? null)
    : null;
  const spot: { doc: string; rect: Rect } | null =
    selected?.region && relatedDocId
      ? { doc: relatedDocId, rect: selected.region }
      : null;

  /**
   * A history item is a way back into the work, not a dead record.
   *
   * It also names which surface the work is on, which matters at the widths where the
   * two share one slot: landing on a field means the fields pane, whether the officer
   * arrived from the history sheet or the review dialog.
   */
  const goToItem = React.useCallback(
    (fieldId: string) => {
      if (!fieldById[fieldId]) return;
      setPane("fields");
      controller.selectField(fieldId);
      requestAnimationFrame(() => fields.current?.scrollToRow(fieldId));
    },
    [controller, fieldById],
  );

  /** The mirror of `goToItem`: a document is read on the bundle. */
  const showDoc = React.useCallback(
    (docId: string) => {
      setPane("bundle");
      requestAnimationFrame(() => goToDoc(docId));
    },
    [goToDoc],
  );

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (controller.composeField) controller.closeComposer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [controller]);

  const raised = allFields.filter((f) => controller.flags[f.id]).length;

  const tally = raised ? [`${raised} flag${raised > 1 ? "s" : ""}`] : [];

  return (
    /*
     * The court chrome scopes its `TooltipProvider` to the rail, so a screen that uses
     * tooltips brings its own. The bundle's zoom controls are the ones that need it.
     */
    <ScrutinyCaseProvider value={caseData}>
    <TooltipProvider>
    {/*
     * A bounded height, not a floor. The court page is `min-h-svh` (app-chrome's
     * `ChromePage`), which is right for a document that grows — but this screen is an
     * app frame: the case bar and the decision bar are meant to stay put while the
     * three panes scroll inside themselves. Under a floor, `flex-1` panes grow to their
     * tallest content and the whole document scrolls instead (measured: 5,835px against
     * a 900px viewport). Subtracting the chrome bar's `h-14` is a real coupling to
     * `BAR` in `components/chrome/app-chrome.tsx`; if that bar's height changes, this
     * follows. And no `flex-1` alongside it: in a flex column `flex: 1 1 0%` overrides
     * an explicit height, which is why the first attempt still measured 5,780px.
     */}
    <div
      className={cn(
        "flex h-[calc(100svh-3.5rem)] min-h-0 flex-col overflow-hidden",
        // The workbench rises when it is opened from the queue — the file laid on the
        // desk, the same arrival Register cases and Take cognizance use (`motion.ts`).
        arrival && ARRIVAL[arrival],
      )}
    >
      {/* The page's own bar, on the page's own ladder: `py-2.5` is a micro step and
          micro steps belong inside controls, not under a screen's title. */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-hairline bg-card px-6 py-4 md:px-8">
        {/* `basis-full` until `lg`: below the room for the title and its controls on one
            line, the controls drop to their own line rather than squeezing the cause into
            a four-line stack beside them — the registry reads this on a tablet. From `lg`
            they share the line again. */}
        <div className="flex min-w-0 flex-1 basis-full flex-col gap-2 lg:basis-auto">
          {/* The eyebrow, above the title and as one sentence: three spans with `·`
              between them stranded the separators at the head of a wrapped line. The
              trail stops at the queue, so the filing number is named here — it is how
              the officer knows which of the queue's rows they are inside. */}
          {/* The filing number and when it came in — the two facts that place this file.
              The advocate is in the fields and on the queue row; it does not need a third
              home in the eyebrow. */}
          <p className="text-body-compact font-medium text-muted-foreground">
            <Identifier value={filingNo} label="filing number" />
            {` · ${party.submitted}`}
          </p>
          {editingTitle ? (
            <TitleEditor
              value={title}
              onCancel={() => setEditingTitle(false)}
              onSave={(next) => {
                setTitle(next);
                setEditingTitle(false);
              }}
            />
          ) : (
            /* `items-start` and a `shrink-0` button: on a long cause the title wraps to
               two lines and a centred pencil floated in the middle of them. */
            <div className="flex items-start gap-1">
              <h1 className="text-title font-semibold">
                {title.complainant}{" "}
                <span className="font-normal text-muted-foreground">v.</span>{" "}
                {title.accused}
              </h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground"
                    aria-label="Edit case title"
                    onClick={() => setEditingTitle(true)}
                  >
                    <PencilIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit case title</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
        <div className="ms-auto flex shrink-0 flex-wrap items-center gap-3">
          {/* Below the room for three panes the two document surfaces share one slot,
              and the switch between them lives in the bar that already owns this case —
              rather than a second chrome band above a pane that has its own. */}
          {threePane ? null : (
            <>
              <ToggleGroup
                type="single"
                value={pane}
                onValueChange={(value) =>
                  value && setPane(value as "fields" | "bundle")
                }
                spacing={0}
                variant="outline"
                className="bg-surface-sunken"
                aria-label="What to read"
              >
                {/* These only exist at the widths a tablet is held at, so they take the
                    touch floor rather than the toggle's own 32px. */}
                <ToggleGroupItem
                  value="fields"
                  className="[@media(pointer:coarse)]:h-10"
                >
                  Fields
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="bundle"
                  className="[@media(pointer:coarse)]:h-10"
                >
                  Bundle
                </ToggleGroupItem>
              </ToggleGroup>
              <Button variant="outline" onClick={() => setIndexOpen(true)}>
                <FilesIcon />
                Documents
              </Button>
            </>
          )}
          {/* The round count does triage work at rest; the button opens the detour. */}
          <Button variant="outline" onClick={() => setHistoryOpen(true)}>
            <ClockIcon />
            Case history · round {historyRound}
          </Button>
          <ChecksPopover />
        </div>
      </div>

      {/* A standing condition, not feedback on an action → Banner. */}
      {ai === "unavailable" ? (
        <Banner variant="warning">
          <TriangleAlertIcon />
          <div className="min-w-0 flex-1 leading-snug">
            AI assistance unavailable — no document readings or consistency checks
            on this file.
          </div>
        </Banner>
      ) : null}

      {threePane ? (
        /* The floors are in `rem`, not percentages: a percentage floor is a floor on
           nothing, which is how the index rail reached 135px.
 
           **Full bleed, no side inset.** A `px-4` here left a 16px strip of the page's
           warm canvas down both edges of the screen, between white bars that run the
           whole width — and against the panes' own `surface-sunken` that strip measured a
           1.5% step, close enough to read as a smudge rather than as an edge (owner,
           2026-09-17: *"what is this slight difference of color… shouldn't it look
           seamless?"*). The panes carry their own insets, so the frame wants none. */
        <ResizablePanelGroup className="min-h-0 flex-1">
          <ResizablePanel
            defaultSize="34%"
            minSize="18rem"
            className="flex flex-col"
          >
            <FieldsPanel
              ref={fields}
              controller={controller}
              aiOn={aiOn}
              onGoToItem={goToItem}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="52%" minSize="22rem">
            <BundleView ref={bundle} aiOn={aiOn} spot={spot} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          {/* A document index is a short list, so it takes a rail's width, not a pane's:
              the room it does not need goes to the bundle, which is the thing being read. */}
          <ResizablePanel defaultSize="14%" minSize="10rem" maxSize="20rem">
            <IndexRail
              relatedDocId={aiOn ? relatedDocId : null}
              aiOn={aiOn}
              onGoToDoc={goToDoc}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        /* One surface at a time. Only the chosen pane is mounted — both would put two
           copies of every `doc-*` anchor in the document and the bundle's own scrolling
           would land on whichever came first. */
        <div className="flex min-h-0 flex-1 flex-col">
          {pane === "fields" ? (
            <FieldsPanel
              ref={fields}
              controller={controller}
              aiOn={aiOn}
              onGoToItem={goToItem}
            />
          ) : (
            <BundleView ref={bundle} aiOn={aiOn} spot={spot} />
          )}
        </div>
      )}

      {/* The house sticky band: hairline top rule, card fill, no shadow of its own. */}
      <div className="flex shrink-0 items-center gap-4 border-t border-hairline bg-card px-6 py-3 md:px-8 md:py-4">
        {/*
         * The one place the raised count lives (the section tabs no longer carry
         * numbers). Red because it is the officer's own error tally, and it has to
         * be findable from anywhere on the screen.
         */}
        <span className="text-body-compact text-muted-foreground">
          {tally.length > 0 ? (
            <>
              {tally.map((t, i) => (
                <React.Fragment key={t}>
                  {i > 0 ? " · " : null}
                  <b className="font-semibold text-destructive-ink">{t}</b>
                </React.Fragment>
              ))}
              {` for ${party.advocate}`}
            </>
          ) : null}
        </span>
        <span className="flex-1" />
        {raised > 0 ? (
          <Button variant="outline" onClick={() => setDecision("send-back")}>
            Send back to advocate
          </Button>
        ) : null}
        {/* Forward or Register, by who registers in this state (`SCR-06`, `SCR-11`). */}
        {profile.registrationPoint === "magistrate" ? (
          <Button onClick={() => setDecision("forward")}>
            Forward to magistrate
          </Button>
        ) : (
          <Button onClick={() => setDecision("register")}>Register case</Button>
        )}
      </div>

      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        aiOn={aiOn}
        onGoToItem={goToItem}
      />
      {/* The index, as a detour, only where there is no room for it as a column. */}
      {threePane ? null : (
        <IndexSheet
          open={indexOpen}
          onOpenChange={setIndexOpen}
          relatedDocId={aiOn ? relatedDocId : null}
          aiOn={aiOn}
          onGoToDoc={(docId) => {
            setIndexOpen(false);
            showDoc(docId);
          }}
        />
      )}
      <ReviewDialog
        decision={decision}
        flags={controller.flags}
        onGoToItem={goToItem}
        onOpenChange={(open) => !open && setDecision(null)}
        /* The settled stage offers the next file rather than the queue, and navigates
           with a `Link` of its own — so nothing is pushed from here. */
        nextFiling={nextFilingAfter(filingNo) ?? null}
      />
    </div>
    </TooltipProvider>
    </ScrutinyCaseProvider>
  );
}

/**
 * Inline edit of the two party names. Enter saves, Escape cancels, and the fields are
 * plain DS inputs — no dialog for a two-word change.
 */
function TitleEditor({
  value,
  onSave,
  onCancel,
}: {
  value: { complainant: string; accused: string };
  onSave: (next: { complainant: string; accused: string }) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = React.useState(value);
  const complainantRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    complainantRef.current?.focus();
    complainantRef.current?.select();
  }, []);

  function commit() {
    const complainant = draft.complainant.trim();
    const accused = draft.accused.trim();
    if (!complainant || !accused) return onCancel();
    onSave({ complainant, accused });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        ref={complainantRef}
        aria-label="Complainant"
        className="w-56"
        value={draft.complainant}
        onChange={(event) =>
          setDraft((d) => ({ ...d, complainant: event.target.value }))
        }
        onKeyDown={onKeyDown}
      />
      <span className="text-body-compact text-muted-foreground">v.</span>
      <Input
        aria-label="Accused"
        className="w-56"
        value={draft.accused}
        onChange={(event) =>
          setDraft((d) => ({ ...d, accused: event.target.value }))
        }
        onKeyDown={onKeyDown}
      />
      <Button onClick={commit}>Save title</Button>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
