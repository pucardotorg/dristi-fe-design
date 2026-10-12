"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  CalendarDaysIcon,
  CalendarX2Icon,
  InboxIcon,
  PencilIcon,
  ScrollTextIcon,
  TrashIcon,
} from "lucide-react";

import { DocumentPreview } from "@/components/cases/document-preview";
import {
  RichTextField,
  type RichTextSuggestion,
  type RichTextValue,
} from "@/components/cases/rich-text-field";
import {
  StagedOverlay,
  useStagedFlow,
} from "@/components/chrome/staged-overlay";
import { ListingApplicationDialog } from "@/components/employee/listing-application-dialog";
import { OrderCaseFile } from "@/components/employee/order-case-file";
import { OrderDraftFacsimile } from "@/components/employee/order-draft-facsimile";
import { OrderSaveIndicator } from "@/components/employee/order-save-indicator";
import { OrderVariableDialog } from "@/components/employee/order-variable-dialog";
import { QueueSearchField } from "@/components/employee/queue-search-field";
import {
  SIGN_SCENES,
  SIGN_STAGES,
  SignatureActions,
  SignatureStage,
  type SignStage,
} from "@/components/employee/sign-method-stage";
import { useSignatureChoice } from "@/components/employee/sign-signature-fields";
import { useCourtToday } from "@/components/employee/use-court-today";
import { useHearingSession } from "@/components/employee/use-hearing-session";
import { useOrderSigning } from "@/components/employee/use-order-signing";
import { markOrderReady, markOrdersSigned } from "@/lib/employee/order-signing";
import { useOrderDraft } from "@/components/employee/use-order-draft";
import { PANEL_CLASS } from "@/components/shell/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Dialog } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  markHearingEnded,
  markHearingOngoing,
} from "@/lib/employee/hearing-session";
import {
  applicationsForListing,
  LISTING_APPLICATION_DECISIONS,
  listingApplicationLabel,
  listingApplicationSentence,
  type ListingApplication,
  type ListingApplicationDecision,
} from "@/lib/employee/listing-applications";
import {
  causeTitle,
  COURT_HEARING_PURPOSES,
  courtCaseStageLabel,
  courtHearingPurposeLabel,
  formatListingDate,
  hearingById,
  isoDay,
  parseIsoDay,
  withHearingSession,
  type CourtHearing,
  type CourtHearingPurposeId,
} from "@/lib/employee/hearings";
import { initialOrderDraft } from "@/lib/employee/order-demo";
import {
  appearancesFor,
  attendanceRecital,
  buildOrderDocument,
  nextListingRecital,
  nextUnhandledListing,
  orderTemplateFacts,
  type Appearance,
  type AttendanceMark,
  type OrderDocument,
  type ItemText,
  type OrderDraft,
} from "@/lib/employee/order-draft";
import {
  appendRichText,
  createOrderItem,
  nextOrderItemId,
  orderItemLabel,
  orderItemsInBody,
  replaceOrderItemText,
  richTextFromPlain,
  richTextWithoutItem,
  upsertRichTextFact,
  upsertRichTextSentence,
  type OrderItemDraft,
  type OrderItemTypeId,
} from "@/lib/employee/order-items";
import type { CaseMatter } from "@/lib/employee/case-people";
import {
  channelSummary,
  defaultProcessVariables,
  processParties,
  type ProcessTemplateId,
  type ProcessVariables,
} from "@/lib/employee/process-variables";
import {
  phraseCompletions,
  phraseRemainder,
  rankSuggestions,
  suggestCandidates,
} from "@/lib/employee/order-suggest";
import {
  applicationForOrder,
  cognizanceDueFor,
  noSuggestionsNote,
  orderSuggestions,
  suggestionCaption,
  type AttendanceSignal,
  type OrderSuggestion,
} from "@/lib/employee/order-suggestions";
import {
  ORDER_GROUPS,
  ORDER_TEMPLATES,
  fillGeneralVariables,
  fillPartyVariables,
  hasTemplateText,
  needsProcessVariables,
  openSlots,
  orderTemplate,
  unavailableReason,
  type OrderCatalogueContext,
  type OrderGroupId,
  type OrderTemplateId,
} from "@/lib/employee/order-templates";
import { Identifier } from "@/components/chrome/identifier";
import { useCourt, useCourtText } from "@/components/court/court-provider";
import { localizeDeep } from "@/lib/court/localize";

/**
 * The composer's own read-then-sign overlay — the shared two-stage flow the four signing
 * queues already use (`sign-method-stage.tsx`), reached here from **Preview** rather than
 * from the paper already standing on the page.
 *
 * It was a one-stage flow (owner, 2026-09-15: "there is nothing to read here and nothing
 * to go back to" — the order was always visible on the page beside it). That reasoning
 * held until Preview existed; now there is a document to read that is not simply "the
 * page", and the owner asked for the option to sign immediately from it (2026-09-26). So
 * this composer adopts the same `SIGN_STAGES`/`SIGN_SCENES` the queues share rather than
 * keeping a second, one-stage vocabulary — two signing overlays that behaved differently
 * would be the "two answers to what an order says" objection this codebase already states
 * elsewhere, applied to how it is signed instead of what it says.
 */

/**
 * Compose the order of one listing.
 *
 * Two regions under a band that names the matter. **The left panel is one open column**
 * (owner, 2026-09-15): the applications standing in the matter, the present and absent
 * rolls, when it is next listed, and the catalogue of what the court passed, all in view
 * at once with a rule between them. It was four accordion sections with one open, which
 * put a press between the typist and every part of a sitting they were already in the
 * middle of. The right column is the order itself, on paper: the court's own furniture
 * around one ruled band that the typist writes. A bar across the top carries the cause
 * and the way on to the next matter; a bar across the bottom carries the signature.
 *
 * **This build issues nothing.** The draft is held for this sitting and dies on a
 * reload. The paper on the page is the order as it will read. **Add to signing list**
 * (renamed from Send to sign order, owner, 2026-09-26 — the old name read as an order
 * already gone somewhere) marks the draft ready and stops there; it opens no overlay.
 * **Preview** opens the order as paper and offers Sign now from it — the same
 * Add-signature overlay the signing queues already run (e-sign or upload), and Submit
 * records that choice here only. Next hearing ends this listing and calls the next one on
 * the board — the same screen marks the cause list already makes. Nothing files,
 * notifies, or signs, and answering an application draws no order.
 */
/**
 * Which of the left column's section cards is open — at most one, which is the whole of
 * the mechanism the split into two cards (owner, 2026-09-16) left untouched.
 *
 * **Back to the four sections, and this is the second time the owner has asked for
 * them.** On 2026-09-14 they came back from a pair of tabs; on 2026-09-15 they came back
 * from one open column, which had scrolled all four regions into a single scroll on the
 * argument that the summaries were answering questions the typist could simply read.
 * What neither replacement carried is the reason the accordion exists: the sitting is a
 * **sequence** — the applications standing in the matter are disposed of, the roll is
 * called, the matter is posted on, and what the court passed is set down last. Tabs
 * present alternatives; a single column presents four regions at once and says nothing
 * about which is next. Only this shape walks the work, and it keeps the panel short
 * beside a page that is now as tall as the order on it.
 */
type SectionId = "applications" | "orders";

type SectionEntry = {
  id: SectionId;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * What a closed section says it got to.
 *
 * This is the part that makes one-at-a-time bearable. A section you cannot see is a
 * question you cannot answer, so every row states its own answer — and states it as the
 * fact, never as a tick. "Not marked" and "Not set" are real answers about a sitting; a
 * green check would claim the typist agreed to something they never touched.
 */
function sectionSummary(
  id: SectionId,
  /* What the order carries, not what was added to it — see `orderItemsInBody`. */
  addedCount: number,
  pendingCount: number,
  answeredCount: number,
): string {
  if (id === "applications") {
    if (pendingCount > 0) return `${pendingCount} pending`;
    /* Answered is not the same fact as none, and the row is the only place a closed
       section can say which (D53). */
    return answeredCount > 0 ? "All answered" : "None pending";
  }
  return addedCount > 0 ? `${addedCount} added` : "None yet";
}

/**
 * The panel's sections, in the order the bench works them.
 *
 * **No section gates the next.** An application can stand over, a roll can go unmarked, a
 * date can be left unset; all three genuinely happen, and the page says so in its muted
 * voice rather than the panel refusing to move. What a court record must not do is
 * quietly imply a fact nobody entered.
 */
const SECTIONS: SectionEntry[] = [
  { id: "applications", title: "Applications", icon: InboxIcon },
  { id: "orders", title: "Orders", icon: ScrollTextIcon },
];

/**
 * Has the matter been posted on?
 *
 * Both answers count: a date with the purpose it is for, or a decision not to list the
 * matter again. A date on its own is not a posting — it is half of one — which is why
 * setting the date first leaves the block open rather than setting it down over an
 * unanswered purpose.
 */
function postingSettled(
  draft: Pick<OrderDraft, "next" | "nextPurpose" | "nextDate">,
): boolean {
  if (draft.next === "none") return true;
  return Boolean(draft.nextPurpose && draft.nextDate);
}

/**
 * Which edges of a scrolled box have content past them.
 *
 * With no scrollbar there is nothing to say a region scrolls (owner, 2026-09-16), so the
 * box says it itself: the content fades out at an edge it continues past, and the fade is
 * gone at an edge it does not. That is the whole reason this is measured rather than
 * drawn permanently — a fade over the last row of a list that has ended is a lie about
 * there being more, which is worse than no affordance at all.
 *
 * Measured on three signals, because the box's content changes under all three: scrolling
 * it, filtering it (the search shortens the list), and opening a group inside it (the
 * `Collapsible` mounts rows). The `ResizeObserver` on the content covers the last two
 * without this needing to know what changed — it watches the *height*, which is the only
 * thing that matters here.
 *
 * `1` rather than `0` as the threshold: `scrollTop` is fractional on a trackpad and at
 * non-integer zoom, so an exact comparison leaves a 0.4px scroll reading as "scrolled"
 * and flickers the top fade on for the rest of the sitting.
 */
function useScrollEdges() {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ top: false, bottom: false });

  const measure = React.useCallback(() => {
    const box = boxRef.current;
    if (!box) return;
    const top = box.scrollTop > 1;
    const bottom = box.scrollTop + box.clientHeight < box.scrollHeight - 1;
    /* Same object back when nothing moved: this runs on every scroll frame, and a fresh
       object each time would re-render the whole catalogue as the reader scrolls it. */
    setEdges((current) =>
      current.top === top && current.bottom === bottom
        ? current
        : { top, bottom },
    );
  }, []);

  React.useEffect(() => {
    measure();
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [measure]);

  return { boxRef, contentRef, edges, measure };
}

/**
 * Bring a region that has just opened inside a scroll box into view — in that box, and
 * nowhere else.
 *
 * **Why this is needed at all.** A group at the foot of the catalogue opens *downwards*,
 * into the part of the box below its own bottom edge: the chevron turns and the rows
 * arrive off screen, so the press reads as having done nothing (owner, 2026-09-16: *when
 * I click on directives the icon moves up but the list doesn't show up on its own*).
 *
 * **Not `scrollIntoView`.** That walks every scrollable ancestor and satisfies the
 * alignment in each, so asking for the head of a group here would also scroll the
 * document — dragging the order sheet beside the panel along with it. This moves one
 * box's `scrollTop` and touches nothing above it.
 *
 * **The minimum that works.** Already in view: nothing moves, because a press that
 * needed no scroll should not produce one. Hanging past the bottom: scroll exactly far
 * enough to seat its last row, which is the reader's *content above moves up*. Taller
 * than the box, or hanging past the top: align its head, since no amount of scrolling
 * will show all of it and the head is the part that names it.
 *
 * Smooth, so the rows arrive as a movement the reader can follow rather than a jump —
 * and instant under `prefers-reduced-motion`, which is the DS's rule for any motion that
 * is not purely decorative (ACCESSIBILITY).
 */
function revealInBox(box: HTMLElement | null, region: HTMLElement | null) {
  if (!box || !region) return;
  const boxEdges = box.getBoundingClientRect();
  const edges = region.getBoundingClientRect();
  const above = edges.top < boxEdges.top;
  const below = edges.bottom > boxEdges.bottom;
  if (!above && !below) return;
  const delta =
    above || edges.height > boxEdges.height
      ? edges.top - boxEdges.top
      : edges.bottom - boxEdges.bottom;
  box.scrollTo({
    top: box.scrollTop + delta,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
}

/**
 * No bar at all — the region scrolls, and nothing draws a rail for it.
 *
 * Three passes at this. The platform default drew a full-height track with a grey thumb
 * flush inside the panel's rounded edge; thinning it and clearing the track left a
 * shorter, quieter rail, and the rail was still the wrong object (owner, 2026-09-15: make
 * the bar itself about 16px).
 *
 * **A 16px bar is not reachable through the platform scrollbar, and saying so is part of
 * the decision.** A thumb's *length* is not a CSS property: the browser sizes it as the
 * ratio of the visible box to the scrolled content, so the only ways to shorten it are to
 * shrink the box or lengthen the content, and neither is a design decision anyone would
 * make about a catalogue. A fixed 16px mark would mean drawing a scroll indicator of our
 * own — new UI, and a DS's job rather than a screen's. So the bar goes instead of being
 * miniaturised, which is the same end the ask was reaching for.
 *
 * This is the DS's own intent: `combobox`, `command` and `sidebar` all apply a
 * `no-scrollbar` class — which is defined nowhere in the DS or here, so those three draw
 * the platform bar in spite of it. The properties are held in this constant rather than
 * as a local utility of that name: the missing utility is the DS's to add, and a local
 * copy under the same name would be a second kit answering to no one.
 *
 * Nothing becomes unreachable. The region's content is rows and controls — suggestion
 * tiles, the search field, the group triggers — so a keyboard user moves through it by
 * Tab and the browser scrolls each one into view; wheel, trackpad and touch are
 * untouched; and the content is visibly cut off at the boundary, which is the affordance
 * a rail was adding little to.
 */
const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * A section that must read as its own unit inside a panel, and holds something the reader
 * works: the DS's own recipe for that is `surface-sunken` with a hairline, never a fill
 * difference alone and never an unbordered muted box (AGENTS.md, *Grouped content*).
 * Not a nested `Card` — the panel is already `shadow-raised`, and a raised box inside a
 * raised box flattens both.
 *
 * One const because the screen has three of them now — the sheet's attendance and next
 * posting, and the catalogue's shortcut list (owner, 2026-09-16) — and three hand-written
 * copies of a recipe drift. Each site adds its own layout classes on top.
 */
const WELL_CLASS = "rounded-lg border border-hairline bg-surface-sunken p-4";

export function OrderScreen({ hearingId }: { hearingId: string }) {
  // The order is written from this listing — its parties' names and places too — so it
  // is read in the selected court's terms (`CourtSwitch`).
  const { court } = useCourt();
  const hearing = localizeDeep(hearingById(hearingId), court);
  if (!hearing) return <OrderMissing />;
  /* Keyed on the listing so advancing to the next item opens a composer at the top of
     itself rather than inheriting this one's transient state. The draft is not in that
     state — it lives in `order-drafts.ts`, keyed by listing there. */
  return <OrderReady key={hearing.id} hearing={hearing} />;
}

function OrderMissing() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 p-6 md:p-8">
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarX2Icon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="text-title-s font-semibold">
            This listing is not on the board
          </EmptyTitle>
          <EmptyDescription className="text-body">
            The order composer opens a matter from today&rsquo;s cause list.
            This one is not there.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/employee/hearings">
              Back to today&rsquo;s hearings
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

function OrderReady({ hearing }: { hearing: CourtHearing }) {
  // Order text is filled in the selected court's names and numbers (`CourtSwitch`).
  const { court } = useCourt();
  const courtText = useCourtText();
  const router = useRouter();
  const session = useHearingSession();
  const today = useCourtToday();
  /* The sitting's own mark laid over the fixture, not the day's starting position: a
     matter the bench ended a moment ago is completed in the session and still scheduled
     in the data. */
  const status = withHearingSession([hearing], session)[0].status;
  /* What this listing opens on before anybody dictates — empty, until the sitting is
     over and the order it produced is already written (`order-demo.ts`). Memoised on
     primitives because it *is* the draft until the first edit, and a fresh object every
     render would restart the editor under the bench's hands. */
  const initial = React.useMemo(
    () => initialOrderDraft(hearing, status, today),
    [hearing, status, today],
  );
  const [draft, setDraft] = useOrderDraft(hearing.id, initial);
  /**
   * How many times the screen has written the order for the typist.
   *
   * **The editor reads its HTML once, on mount** (`rich-text-field.tsx`: rewriting
   * `innerHTML` while somebody is typing eats the caret), so `OrderBody` remounts it on a
   * new `key` whenever the words change from outside. That key used to be
   * `draft.items.length`, which was true while the catalogue was the only thing that
   * wrote: pulling a template changed the count, so the editor re-read.
   *
   * Answering an application writes a sentence too now, and it changes no count —
   * re-deciding one changes not even the number of answers — so the disposal landed in
   * `draft.body` and never reached the box (owner, 2026-09-16: the answers "are not
   * appearing in the text box"). The tests were green throughout, because what broke was
   * not the draft but the one place that does not read it continuously.
   *
   * So the key is a count of the writes themselves. Every programmatic write bumps it and
   * nothing else does — in particular `setBody`, which is the editor reporting its own
   * typing, must never touch it, or the box would remount under each keystroke.
   */
  const [bodyWrites, setBodyWrites] = React.useState(0);
  const [signOpen, setSignOpen] = React.useState(false);
  /**
   * Where the footer's own act stands. `"added"` is **Add to signing list**; `"signed"`
   * is Submit from the read-then-sign overlay Preview opens, which also counts as added.
   * Held in `order-signing.ts` rather than here, so today's hearings can sort the day's
   * orders into Drafts, Ready to sign and Signed — and, like the draft itself, it dies on
   * a reload because nothing here is issued.
   */
  const signed = useOrderSigning()[hearing.id];
  const signingStatus: "draft" | "added" | "signed" =
    signed === "signed" ? "signed" : signed === "ready" ? "added" : "draft";
  const [announcement, setAnnouncement] = React.useState("");
  /** A process order named through the editor's `/` search, awaiting its pop-up. */
  const [typedProcess, setTypedProcess] = React.useState<OrderItemTypeId | null>(null);
  /**
   * Reading the case file while writing the order.
   *
   * **Rearranges the screen rather than opening over it** (owner, 2026-09-22): the
   * sheet — attendance, next hearing, the passage itself — moves down into the left
   * column, under the applications and orders catalogue, and the right column turns
   * over to the case file's own index-plus-PDF pane (`order-case-file.tsx`). Nothing
   * is unmounted by the toggle: the draft, the open section and every mark on the
   * roll are exactly where they were when the typist switches back.
   */
  const [caseFileOpen, setCaseFileOpen] = React.useState(false);
  /**
   * Open a section and put the reader in it.
   *
   * Focus goes to the section's own heading rather than to the first control in it: the
   * heading says which section you are now in, and a keyboard user who has just been
   * moved needs to hear *where* before they hear *what*. The heading sits outside
   * `CollapsibleContent` and is therefore always mounted, so this needs no frame to wait
   * for — the element is there whether the section is open or shut.
   */
  function showSection(id: SectionId) {
    setSection(id);
    document.getElementById(`order-section-${id}`)?.focus();
  }
  const [openApplication, setOpenApplication] =
    React.useState<ListingApplication | null>(null);
  /** The button that opens the read-then-sign overlay — Preview — so focus returns to
   *  it, and not to the primary action beside it, when the overlay closes. */
  const signRef = React.useRef<HTMLButtonElement>(null);
  const signature = useSignatureChoice("order");
  const signFlow = useStagedFlow<SignStage>({
    order: SIGN_STAGES,
    scene: SIGN_SCENES,
  });

  /** Preview opens fresh on the paper, whatever stage a previous look left it on. */
  function openPreview() {
    signFlow.go("read");
    signature.reset();
    setSignOpen(true);
  }

  const appearances = React.useMemo(() => appearancesFor(hearing), [hearing]);
  /**
   * **Both blocks stay as their controls, for the whole sitting** (owner, 2026-09-16:
   * attendance and the next hearing should "stay as it is, even after filling up all the
   * details").
   *
   * They used to swap themselves for the lines they produce the moment they were
   * answered — the roll printing as *Present: …* with an **Edit** on its eyebrow, the
   * posting as its two labelled values. The reasoning was space: four rows of controls
   * print as two lines, and a sheet still wearing its form is a sheet that does not look
   * like a document.
   *
   * What retired it is where those lines now go. The roll recites itself into the order
   * as it is called and the posting closes it (`attendanceRecital`,
   * `nextListingRecital`, owner 2026-09-16), so the read-back on the sheet was a second
   * statement of a fact the passage below it already carried — and the controls are their
   * own read-back besides: a segment holding *Absent* says the accused is absent, and a
   * date field showing 30 Sept 2026 says the date. What went with the swap is the whole
   * **Edit** dance, which existed only to get back from it.
   *
   * The cost is stated rather than hidden: the sheet keeps ~180px of controls above the
   * writing for the rest of the sitting. That is the trade the owner asked for, and it is
   * one setting away from being reversed.
   *
   * One latch survives it. The walk moves the typist on when the roll is *first*
   * completed (`mark`), and with nothing in the render to read that off any more, the
   * press has to be recognised on its own: a ref, because it steers one event and must
   * never cause a render. A completed sitting arrives with its roll already called, so it
   * starts latched — the bench correcting an office on a finished order is not walked
   * forward again.
   */
  const walkedFromRoll = React.useRef(
    appearances.every((appearance) => draft.marks[appearance.id]),
  );
  const upNext = nextUnhandledListing(hearing, session);
  /* One document for the page and the preview. They print the same artefact, so they
     read it off the same object rather than each building their own. */
  const orderDocument = buildOrderDocument(hearing, draft, today);
  /* What the catalogue's own gates are read against. `longPending` is hard-coded false
     because `CourtHearing` does not carry the flag yet — `CaseRecord.longPending` exists
     on the advocate side and has never been threaded across. Recorded as a build gap in
     §11 of the brief: until it is, the two long-pending register orders answer to a
     matter that always says "not long pending". */
  /* **And read against this order, not only against the case as it was called** — the
     reading `cognizanceDueFor` carries, off DOC-ORD-001 of the court's own order pack:
     cognizance taken as an item of *this* draft puts the case on file for the rest of
     the order. */
  /**
   * **What the order still carries**, which is not the same as what was added to it
   * (owner, 2026-09-16). The list below, the count on the section row and the
   * catalogue's own gates all read this: a row whose passage the typist has deleted in
   * the page beside them is a claim that page contradicts, and a catalogue still saying
   * *Already item 1* would be offering the same reading. `draft.items` stays the record
   * of every add, so an id is never handed out twice in one draft.
   */
  const items = orderItemsInBody(draft.items, draft.body.html);
  const chosen = items.map((item) => item.type);
  const catalogue: OrderCatalogueContext = {
    cognizanceDue: cognizanceDueFor(hearing.stage, chosen),
    longPending: false,
    hearingOngoing: true,
  };

  /* What is still waiting on the bench. The reference labels every row "Pending — …",
     so an answered application does not belong under that heading. */
  const pending = React.useMemo(
    () =>
      applicationsForListing(hearing.id).filter(
        (application) => !draft.applications[application.id],
      ),
    [hearing.id, draft.applications],
  );

  /**
   * And what has been answered, which until 2026-09-14 left the panel without a trace.
   *
   * The old reading was that the answer is in the order and the order is where the bench
   * reads what it has done. That is true of the *sentence* and false of the *panel*: an
   * application answered — by a press here, or by `initialOrderDraft` answering all of
   * them the moment a listing is completed (D23) — took its row out of the strip, dropped
   * the count off the tab, and left "No application is standing in this matter." on a
   * matter where two had been standing a second earlier. Owner, 2026-09-14: *"why did the
   * pending applications got removed from the application tab."* Nothing had removed
   * them; answering them had, and a panel that erases the thing you just acted on is
   * indistinguishable from one that lost it.
   */
  const answered = React.useMemo(
    () =>
      applicationsForListing(hearing.id)
        .map((application) => ({
          application,
          decision: draft.applications[application.id],
        }))
        .filter(
          (
            row,
          ): row is {
            application: ListingApplication;
            decision: ListingApplicationDecision;
          } => row.decision !== undefined,
        ),
    [hearing.id, draft.applications],
  );

  /**
   * Where the panel opens: on Orders, always (owner, 2026-09-25).
   *
   * An earlier build opened on Applications whenever one stood pending, on the reasoning
   * that a pending application was the sitting's first unfinished step. The owner's
   * correction: the order is the work this screen exists for, and it is what a typist
   * reaches for on arrival whether or not an application happens to be standing —
   * applications are a click away in their own section, not a detour the screen picks
   * for the typist.
   *
   * Read once, on the first render of this listing's composer: it is where the panel
   * *opens*, not a rule about where it must be.
   */
  const [section, setSection] = React.useState<SectionId | null>("orders");

  /**
   * What this sitting is likely to produce, read off the sitting.
   *
   * Four facts the screen already holds and until now threw away: what it was listed
   * for, the applications standing in it, who the bench has marked absent, and what the
   * draft order already carries. `order-suggestions.ts` carries the ranking and the
   * grounding; this is only the wiring, and it is deliberately not memoised — the whole
   * point is that the shortcut moves as the sitting does, so marking the accused absent
   * re-ranks it under the bench's hand.
   */
  const attendance = appearances
    .map((appearance) => {
      const mark = draft.marks[appearance.id];
      return mark
        ? { side: appearance.side, kind: appearance.kind, mark }
        : null;
    })
    .filter((entry): entry is AttendanceSignal => entry !== null);
  /* Every application on the listing and how it has been answered — not `pending`, which
     is the strip's list. An allowed application is the strongest signal there is about the
     next order, and it has left the strip by the time it is one. Held in one place because
     both the ranking and the auto-fill pass read it. */
  const applicationSignals = applicationsForListing(hearing.id).map(
    (application) => ({
      number: application.number,
      type: application.type,
      decision: draft.applications[application.id],
    }),
  );
  const suggestions = orderSuggestions({
    purpose: hearing.purpose,
    catalogue,
    attendance,
    applications: applicationSignals,
    chosen,
  });

  /**
   * Add what the court passed, on its standing words.
   *
   * The words arrive with the item because that is the difference between the two seats
   * this screen serves: the bench dictates an order it is making, and the typist sets
   * down one the court already made, from the court's own form. Nothing is committed by
   * adding it — the paragraph is editable the moment it lands, and the whole draft still
   * dies on a reload (`order-drafts.ts`).
   */
  function addItem(
    type: OrderItemTypeId,
    /* Which application the order was reached from, when it was reached from one. A
       suggestion row knows this and a count cannot: two applications standing on one
       listing is exactly the case where "the only candidate" has no answer and the row
       still does. */
    application?: Pick<ListingApplication, "number" | "type">,
    /* Set only for a process type that has just been through the delivery-channel
       confirmation (`OrderItems`' own gate, below). Its presence is what tells
       `createOrderItem` to resolve `[Party Type]`/`[Party Name]` instead of leaving
       them standing — the same substitution as ever, run only once somebody has
       confirmed who it goes to. */
    variables?: ProcessVariables,
  ) {
    /* Pressed a suggestion row? It named the application. Searched the catalogue
       instead? `applicationForOrder` type-matches one, and finds nothing rather than
       reaching for whatever happens to be standing on the listing. */
    const context =
      application ?? applicationForOrder(type, applicationSignals);
    const item = createOrderItem(
      type,
      undefined,
      localizeDeep(orderTemplateFacts(hearing, draft, today, context), court),
      /* `variables` is only ever supplied for a process type — `needsProcessVariables`
         gates the row that collects it (`OrderItems`, below) — so `type` is never
         `"others"` on this branch. */
      variables
        ? (text) =>
            fillPartyVariables(text, type as OrderTemplateId, processParties(variables))
        : undefined,
    );
    const withVariables = variables ? { ...item, variables } : item;
    const open = openSlots(withVariables.text.text);
    /* **Appended, not added as a box** (owner, 2026-09-15). The template's words join
       what is already written and stop being a thing of their own; `items` keeps the
       record that it was pulled in, which is what the catalogue's gates read. */
    setDraft((current) => ({
      ...current,
      items: [...current.items, withVariables],
      body: appendRichText(current.body, withVariables.text),
    }));
    setBodyWrites((count) => count + 1);
    /* The announcement says what is left to do, because after the auto-fill pass that is
       the fact that changed: an order can now arrive part-written, and "its text is
       written" would tell a screen-reader user it is finished when three brackets are
       still standing in it. */
    setAnnouncement(
      withVariables.text.text
        ? open.length === 0
          ? `${orderItemLabel(type)} added to the order, complete. Its text is at the end of the order and can be edited.`
          : `${orderItemLabel(type)} added to the order with ${open.length === 1 ? "one detail" : `${open.length} details`} still to fill: ${open.join(", ")}.`
        : `${orderItemLabel(type)} added to the order. It has no standing text — write it in the order.`,
    );
  }

  /**
   * Reopen a process item's delivery-channel confirmation and rewrite its passage.
   *
   * Replaces the item's marked block in place (`replaceOrderItemText`) rather than
   * removing and re-appending it — the sentence stays where the drafter last read it,
   * which is what "open it up to edit it again" (owner, 2026-09-26) means for a passage
   * already sitting in the middle of an order the drafter may have written around.
   */
  function updateItemVariables(item: OrderItemDraft, variables: ProcessVariables) {
    /* Only ever called for a process item (`needsProcessVariables` gates the row that
       offers it), so the type is never `"others"` and this cast is safe. */
    const type = item.type as OrderTemplateId;
    const resolved = fillPartyVariables(
      fillGeneralVariables(orderTemplate(type).botd, localizeDeep(orderTemplateFacts(hearing, draft, today), court)),
      type,
      processParties(variables),
    );
    const text = richTextFromPlain(resolved, item.id);
    setDraft((current) => ({
      ...current,
      items: current.items.map((entry) =>
        entry.id === item.id ? { ...entry, text, variables } : entry,
      ),
      body: replaceOrderItemText(current.body, item.id, text),
    }));
    setBodyWrites((count) => count + 1);
    setAnnouncement(
      `${orderItemLabel(item.type)} updated with the confirmed addressee and delivery channels.`,
    );
  }

  /**
   * The order, as the typist is writing it.
   *
   * There is no per-item Remove any more and there is nothing for one to do: the words
   * are one passage, so taking a direction back out is deleting the sentence that says
   * it — which is what a typist does on paper and what the editor already does here.
   */
  function setBody(body: ItemText) {
    setDraft((current) => ({ ...current, body }));
  }

  /**
   * Where the walk points, and it points at the first step of the sitting that has no
   * answer yet.
   *
   * With the roll and the posting on the page, "walk the panel on" is no longer the
   * right description of this: the move is sometimes a focus on the sheet and sometimes
   * a section opening. Stated once, here, rather than at each call site — and it returns
   * the sentence the live region reads out, because the announcement and the move have to
   * agree about where the typist has just been sent.
   *
   * **It does not answer for the roll.** Every caller has a roll that has just been
   * called — `mark` on the press that completed it, `postNext` only after testing that
   * it is — so a branch sending the reader back up to attendance could only ever fire on
   * the press that had just finished with it, which is how this used to bounce focus back
   * onto the block it had just closed.
   *
   * Takes the posting as arguments rather than reading the draft: every caller is inside
   * the action that just changed it, where `draft` is still the value from the render
   * being replaced.
   */
  function walkOn(
    next: OrderDraft["next"],
    purpose: OrderDraft["nextPurpose"],
    nextDate: string | null,
  ): string {
    if (!postingSettled({ next, nextPurpose: purpose, nextDate })) {
      document.getElementById("order-next")?.focus();
      return "The next posting, on the order, is next.";
    }
    showSection("orders");
    return "What the court passed is now open.";
  }

  /**
   * Answer one application, from the row.
   *
   * The answer is a sentence in the draft order and nothing else — no bail is granted
   * and no hearing moves (`listing-applications.ts`). It is kept in the draft rather
   * than in this component's state for the same reason the marks and the item are: Next
   * hearing unmounts the composer, and an answer given on item 4 must still be there if
   * the bench comes back to it.
   */
  function decide(
    application: ListingApplication,
    decision: ListingApplicationDecision,
  ) {
    /* **The disposal is written into the order, not printed beside it** (owner,
       2026-09-15). It used to be a band of sentences above the editor, derived from the
       decisions and not editable — so the one part of the order the screen wrote for
       itself was the one part a typist could not correct, and the page carried two
       regions of prose where an order has one passage.

       `upsertRichTextSentence` is what makes changing an answer safe: re-deciding an
       application replaces the sentence it wrote rather than leaving the order carrying
       both, and pressing the same answer twice writes nothing new. */
    setDraft((current) => ({
      ...current,
      applications: { ...current.applications, [application.id]: decision },
      body: upsertRichTextSentence(
        current.body,
        listingApplicationSentence(hearing, application, decision),
        LISTING_APPLICATION_DECISIONS.map((earlier) =>
          listingApplicationSentence(hearing, application, earlier),
        ),
      ),
    }));
    setBodyWrites((count) => count + 1);
    setOpenApplication(null);

    /* **The sitting is a sequence, so the panel walks it** (owner, 2026-09-15): answering
       the last application opens the roll, and completing the roll opens the next posting.
       Edge-triggered inside the action, never derived in an effect — "is this section
       finished" is a *state*, and an effect reading it would re-open the next section on
       every render, pinning the typist out of the one they had just come back to. The
       question asked here is "did this press finish it", which only an event can answer.

       Guarded on `section`, so it only ever moves someone standing in the section that
       just finished. A typist who has gone back to Applications from Orders to change an
       answer is not asking to be marched forward again. */
    const remaining = pending.filter((entry) => entry.id !== application.id);
    const advancing = remaining.length === 0 && section === "applications";
    /* **The next step is on the sheet, so focus goes there rather than to a section.**
       With the roll on the page the walk still runs applications, roll, posting — only
       its middle step is no longer something to open. The panel stays where it is,
       showing what was just answered, and the reader is put on the roll's own heading;
       `PaperBlock` takes `focusable` for exactly this, which is the flow its own note
       said would one day want the tabindex.

       Every other answer moves focus to the section heading instead: Accept and Reject
       sit *inside* the row, answering takes the row off the strip, and a focus left on a
       destroyed button restarts the next Tab at the top of the page. Harmless on the
       overlay path either way — Radix restores focus after close and `onReturnFocus`
       lands on the same heading. */
    /* **The last answer closes this section and opens the order** (owner, 2026-09-15).
       One section is open at a time, so opening Orders folds Applications away by itself
       — and Applications has nothing left to do: the answers are in the passage, the
       answered list stays a row away behind its own summary, and the roll and the posting
       are on the sheet where they need no opening. What the panel is *for* from here is
       the catalogue.

       Every other answer keeps the section and moves focus to its heading, because
       Accept and Reject sit inside the row and answering takes the row off the strip —
       focus left on a removed button restarts the next Tab at the top of the page. */
    if (advancing) {
      showSection("orders");
    } else {
      document
        .getElementById(`order-section-${section ?? "applications"}`)
        ?.focus();
    }

    setAnnouncement(
      `${listingApplicationLabel(application)}, ${application.number}, is ${decision}. The sentence recording it is written into the order, where it can be edited.${
        advancing
          ? " Nothing is left pending. What the court passed is now open."
          : ""
      }`,
    );
  }

  /**
   * **What "/" reaches in the editor, and what accepting one does.**
   *
   * The owner's reading of the problem (2026-09-16): a typist dictating at speed writes
   * the same directions and the same three sentences every sitting, and the catalogue —
   * which holds the directions already — is a mouse trip away from the words they are
   * in the middle of. So the same corpus gets a second door that costs no hands: a
   * completion offered inline, accepted with Tab.
   *
   * **The corpus is one corpus.** `suggestCandidates` fills each template's words with
   * the same `orderTemplateFacts` pass the catalogue's own rows use, and gates the same
   * way, so a direction reached by typing and the same direction reached by pressing its
   * row put identical words in the order. Two doors onto one act is defensible; two
   * answers to what an order says is not.
   *
   * **A direction is recorded; a phrase is not.** Accepting a template mints its id
   * here and hands back a paragraph already marked with it
   * (`ORDER_ITEM_ATTRIBUTE`), so the row appears under *Pulled into this order*, the
   * count moves, the catalogue says *Already item 1*, and Remove works on it — exactly
   * as if the row had been pressed. A phrase lands as plain text and records nothing,
   * because nothing offers to take a sentence of the typist's own back out.
   *
   * The body itself is not written here: the field replaces the trigger with the
   * insertion and reports the new value through `onChange` like any other edit, which
   * is also what keeps the editor's caret and undo the browser's business rather than
   * this screen's.
   */
  const candidates = suggestCandidates(
    localizeDeep(orderTemplateFacts(hearing, draft, today), court),
    catalogue,
    suggestions.map((entry) => entry.template.id),
  );
  const suggestion: RichTextSuggestion = {
    /**
     * **Two questions, one corpus.**
     *
     * Writing a sentence, the sentence is the question and only the three phrases can
     * answer it, from the front (`phraseCompletions`) — a standing direction arriving
     * mid-sentence would put the court's brackets in the middle of somebody's writing.
     *
     * Naming a direction after the trigger, everything is in scope and the sitting's own
     * ranking breaks the ties. What is shown there is the direction's *name*: a passage
     * of three lines is not a completion, it is a paragraph appearing under the caret.
     */
    resolve: (query, mode) =>
      mode === "prose"
        ? phraseCompletions(query)
        : rankSuggestions(query, candidates).map((candidate) => ({
            key: candidate.key,
            label: candidate.label,
            ghost: candidate.label,
          })),
    accept: (key, query, mode) => {
      if (mode === "prose") {
        const remainder = phraseRemainder(key, query);
        if (!remainder) return null;
        setAnnouncement("Sentence completed in the order.");
        return { kind: "inline" as const, text: remainder };
      }
      const picked = candidates.find((candidate) => candidate.key === key);
      if (!picked) return null;
      if (picked.kind === "phrase") {
        setAnnouncement(`${picked.text} written into the order.`);
        return { kind: "inline" as const, text: picked.text };
      }
      const type = key.slice("template:".length) as OrderItemTypeId;
      /* A process named by typing opens the same pop-up its catalogue row does, and is
         written in once confirmed (`PRC-03`) — never straight into the order. The typed
         search is cleared; the confirmed passage is appended like any catalogue add. */
      if (needsProcessVariables(type)) {
        setTypedProcess(type);
        return { kind: "inline" as const, text: "" };
      }
      const item = createOrderItem(
        type,
        nextOrderItemId(),
        localizeDeep(orderTemplateFacts(hearing, draft, today), court),
      );
      setDraft((current) => ({ ...current, items: [...current.items, item] }));
      const open = openSlots(item.text.text);
      setAnnouncement(
        open.length === 0
          ? `${orderItemLabel(type)} written into the order, complete.`
          : `${orderItemLabel(type)} written into the order with ${open.length === 1 ? "one detail" : `${open.length} details`} still to fill: ${open.join(", ")}.`,
      );
      return { kind: "block" as const, html: item.text.html };
    },
  };

  /**
   * Take one pulled-in order back out of the draft.
   *
   * **This is the Remove the composer refused to have until 2026-09-16**, and the
   * refusal was not wrong on its own terms: the words become part of one passage the
   * moment they land, so a Remove that had to *guess* which sentences were once a
   * template's would either delete text the typist had written or leave text it claimed
   * to have removed. What changed is that it no longer guesses — the paragraph carries
   * the item's id (`ORDER_ITEM_ATTRIBUTE`), so this takes out exactly the passage that
   * row wrote and nothing beside it.
   *
   * **The whole passage, including words the typist has since put in it.** Editing
   * inside the paragraph keeps the row, because the direction is still in the order; so
   * a Remove after such an edit takes their sentence out with the court's. That is the
   * honest reading of *remove this direction from the order*, and the alternative —
   * stripping only the words that still match the template — would leave the order
   * carrying half a direction under no heading at all.
   *
   * No confirm step. This is a draft that dies with the sitting, the passage is on the
   * page beside the row, and the catalogue that put it there is directly above: the
   * whole act is visible and repeatable. The announcement is what carries it to a reader
   * who cannot see the page move.
   */
  function removeItem(item: OrderItemDraft) {
    setDraft((current) => ({
      ...current,
      body: richTextWithoutItem(current.body, item.id),
    }));
    setBodyWrites((count) => count + 1);
    setAnnouncement(
      `${orderItemLabel(item.type)} taken out of the order. Its passage is gone from the page beside you; everything else is as it was.`,
    );
  }

  /**
   * Mark one appearance, and hand over the moment the roll is complete.
   *
   * One mark per person — the control on the page is single-choice, so present and absent
   * cannot both be true of the same appearance, which is not a state a court record can
   * be in. Pressing the answer that is already given clears it, and the roll goes back to
   * being incomplete.
   *
   * **On the transition, not on the state.** It fires when this press *finishes* the roll
   * — incomplete before, complete after — and never again. The roll is on the page now,
   * so a mark can be corrected at any point in the sitting, including while the typist is
   * writing the order; re-firing there would take focus off the words under their hands.
   * This also retires a quirk the panel version accepted: untick, tick the other answer,
   * and the screen moved on a second time.
   */
  function mark(id: string, value: AttendanceMark | undefined) {
    /* The write goes through the updater so it merges into whatever the draft holds at
       the time it lands; the local copy below is only what the completeness test reads,
       and it never becomes the value written.

       **And the roll recites itself into the order** (owner, 2026-09-16). The recital is
       built from the marks the updater is about to hold, not from `draft.marks`, which
       is the value of the render being replaced — the line has to say what the roll says
       after this press. `upsertRichTextFact` writes over the previous recital rather
       than beside it, so correcting an office corrects the order instead of leaving it
       carrying two answers for the same person. */
    setDraft((current) => {
      const rolled = { ...current.marks, [id]: value };
      return {
        ...current,
        marks: rolled,
        body: upsertRichTextFact(
          current.body,
          "attendance",
          attendanceRecital(appearances, rolled),
        ),
      };
    });
    /* The box has to re-read: the editor takes its markup on mount and this is a write
       the typist did not make. Same reason answering an application bumps it. */
    setBodyWrites((count) => count + 1);

    const marks = { ...draft.marks, [id]: value };
    const complete = appearances.every((appearance) => marks[appearance.id]);
    /* **The press that finishes calling the roll walks the sitting on**, and only that
       one. The block no longer changes when the roll completes (owner, 2026-09-16), so
       there is nothing in the render to ask — `walkedFromRoll` is the latch, and it stays
       latched through every correction afterwards. A roll that is cleared and answered
       again is the same roll, already called; marching the typist forward a second time
       is how this used to take focus off work they had come back to. */
    if (complete && !walkedFromRoll.current) {
      walkedFromRoll.current = true;
      setAnnouncement(
        `Attendance is called on the order. ${walkOn(draft.next, draft.nextPurpose, draft.nextDate)}`,
      );
    }
  }

  /**
   * Post the matter on, or decide not to, from the page.
   *
   * The three writes are one region's worth of work, so they sit together: the purpose
   * alone settles nothing, while a date or a decision not to list is the last fact the
   * posting needs. When that lands and the roll is already called, the walk moves on to
   * the order — and when the roll is *not* called it stays where it is rather than
   * dragging the typist back up the sheet to a roll they have chosen to leave for later.
   */
  function postNext(
    change: Partial<Pick<OrderDraft, "next" | "nextPurpose" | "nextDate">>,
  ) {
    /* **The posting closes the order, so it is written into the passage too** (owner,
       2026-09-16). Read off the merged draft inside the updater for the same reason the
       roll is, and gated by `nextListingRecital`: a purpose with no date yet is half a
       fact, and half a fact is not a sentence a court order can carry. */
    setDraft((current) => {
      const merged = { ...current, ...change };
      return {
        ...merged,
        body: upsertRichTextFact(
          current.body,
          "next",
          nextListingRecital(merged),
        ),
      };
    });
    setBodyWrites((count) => count + 1);
    /* The posting as it stands *after* this change. `draft` is the value from the render
       being replaced, and `nextDate` can legitimately be set to `null`, so the merge
       tests for `undefined` rather than falling back on truthiness. */
    const posting = {
      next: change.next ?? draft.next,
      nextPurpose: change.nextPurpose ?? draft.nextPurpose,
      nextDate:
        change.nextDate !== undefined ? change.nextDate : draft.nextDate,
    };
    if (!postingSettled(posting)) return;
    /* Set down either way; the walk only moves when there is somewhere sensible to move
       to. A typist who has posted the matter before calling the roll is not dragged back
       up the sheet to the roll they chose to leave for later. */
    const rollCalled = appearances.every(
      (appearance) => draft.marks[appearance.id],
    );
    if (!rollCalled) return;
    setAnnouncement(
      walkOn(posting.next, posting.nextPurpose, posting.nextDate),
    );
  }

  /**
   * End this listing and call the next one on the board.
   *
   * Both marks already exist on the cause list, and the sitting holds a single ongoing
   * listing — so navigating without ending would land on a composer the sitting has
   * locked, and calling the next matter without ending this one would silently return
   * this one to scheduled. The pair is the act a bench actually performs.
   *
   * Neither mark files, signs or notifies anything (`hearing-session.ts`).
   */
  /**
   * **What the pinned panel has to clear, measured rather than guessed.**
   *
   * The section column is pinned to the viewport from `lg` up (owner, 2026-09-16), and
   * its height is the window less the two bands that overlay it: the cause header, which
   * is `sticky top-14` under the chrome's own 3.5rem bar, and the footer, which is
   * `sticky bottom-0`. Both are content-sized — the cause name wraps on a narrow column
   * and the footer's button wraps below `sm` — so neither can be written into a class as
   * a length. A wrong guess here is not a rounding error: too small and the catalogue
   * ends under the footer, which is the fault being fixed.
   *
   * Held in state rather than written straight onto the node with `setProperty`: the
   * values are read back as inline custom properties, and React re-applies its own
   * `style` on every render, which would undo a direct write the next time anything on
   * this screen changed. The observer fires once on mount and then only when a band
   * actually changes height, and the guard stops a resize from looping through state.
   */
  const headerRef = React.useRef<HTMLElement | null>(null);
  const footerRef = React.useRef<HTMLElement | null>(null);
  const [bands, setBands] = React.useState({ header: 0, footer: 0 });
  React.useEffect(() => {
    const header = headerRef.current;
    const footer = footerRef.current;
    if (!header || !footer) return;
    const measure = () => {
      const next = { header: header.offsetHeight, footer: footer.offsetHeight };
      setBands((current) =>
        current.header === next.header && current.footer === next.footer
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  function advance() {
    markHearingEnded(hearing.id);
    if (!upNext) {
      router.push("/employee/hearings");
      return;
    }
    markHearingOngoing(upNext.id);
    router.push(`/employee/hearings/${upNext.id}/order`);
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      /* The panel's pin and its height, derived here so the viewport arithmetic stays in
         CSS and only the two measured bands come from JS. `3.5rem` is the chrome bar,
         the same length the header below pins itself under. The last `2rem` is the
         canvas's own bottom padding, so the column ends clear of the footer on the same
         rhythm as everything else on the canvas. */
      style={
        {
          "--order-header-h": `${bands.header}px`,
          "--order-footer-h": `${bands.footer}px`,
          "--order-panel-top": "calc(3.5rem + var(--order-header-h))",
          "--order-panel-height":
            "calc(100svh - var(--order-panel-top) - var(--order-footer-h) - 2rem)",
        } as React.CSSProperties
      }
    >
      {/* The cause, and the way on. `top-14` rather than `top-0`: the chrome's own bar
          is `sticky top-0` and 3.5rem tall, so this comes to rest directly under it
          instead of sliding beneath its fill. */}
      {/* The cause, the matter it belongs to, and the way on — one header, not a title
          with a second band ruled off beneath it. The facts *are* the subtitle: they say
          which listing this is, and a rule between them and the name they qualify made
          them read as a separate region with its own business. */}
      <header
        ref={headerRef}
        className="sticky top-14 z-20 flex flex-col gap-3 border-b border-hairline bg-card px-6 py-4 sm:flex-row sm:items-start sm:justify-between md:px-8"
      >
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-title min-w-0 text-balance font-semibold">
            {/* No space before the colon — it was there, and it is the same fault the
                line below had in the other direction. */}
            Order: {causeTitle(hearing)}
          </h1>
          <MatterFacts hearing={hearing} />
        </div>
        {/* **Outline beside the primary, the same bargain `ViewCaseAction` makes on
            the overview page** (`hearing-overview-screen.tsx`): a promise and an act
            share a band, and the act keeps the one teal. Unlike that button this one
            is not dead — there is no case file to connect there, and there is one
            here, read straight off the tree the advocate's case file already uses. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="w-full shrink-0 sm:w-fit"
            onClick={() => {
              const next = !caseFileOpen;
              setCaseFileOpen(next);
              setAnnouncement(
                next
                  ? "Case file open. The order has moved below the applications and orders catalogue."
                  : "Case file closed. The order is back on its own page.",
              );
            }}
          >
            {caseFileOpen ? "Back to order" : "View Case"}
          </Button>
          <Button
            type="button"
            className="w-full shrink-0 sm:w-fit"
            onClick={advance}
          >
            {upNext ? "Next hearing" : "End hearing"}
          </Button>
        </div>
      </header>

      {/* The split the owner drew. Left: what the court did at this sitting and what it
          passed, one section at a time. Right: the order those entries make, on paper.

          **Thirds, and the page takes two of them** (owner, 2026-09-15). It was half and
          half for part of a day, to give an open column room for a roll four checkboxes
          across; the page won instead, because it is the artefact this screen exists to
          produce and the thing a typist reads back. The roll asks for no such width in
          this shape — one section is open at a time, and its two rolls are single columns
          of 40px rows. Below two columns the order of the DOM stands and the page sits
          under the panel.

          The column between the white header and footer is the scoped work canvas:
          `bg-muted` in light so the panels read against the same tone as the rail; dark
          stays `bg-background` because muted sits *above* card there (FilingMain). */}
      <div className="grid min-w-0 flex-1 gap-8 bg-muted p-6 md:p-8 lg:grid-cols-3 dark:bg-background">
        {/* Surfaces on the canvas, not one container holding two columns (owner,
            2026-09-14) — and since 2026-09-16 the left column is two of them rather than
            one. Every one is white and lifted, so the beige canvas is the ground and each
            reads as a thing lying on it — which is what the reference screen does and
            what a shared card was flattening into one object with an internal seam.

            `self-start` on the column and on the page: each surface is as tall as its own
            contents, and the two section cards stack from the top rather than dividing
            the column's height between them. The page held the canvas height while it
            carried a signature at its foot, which gave the sheet somewhere to end;
            without one it was just a long empty margin.

            The columns stay 1/3 and 2/3, as they were before the container was removed.
            Narrowing the panel *and* unwrapping it in one step moved both surfaces at
            once, and the layout stopped being recognisable (owner, 2026-09-14). Only one
            of those was asked for. */}
        {/* **One card per section, one open at a time, and the closed one says where it
            got to** — the sections as they were designed, restored on the owner's
            instruction (2026-09-15) after a day spent as one open column, and split into
            a card each on 2026-09-16. That is the whole reason this beat an icon rail: a
            rail can show you marks but not one fact, so the panel had nothing in it and
            the way on ended up below the fold. A row that reads "Orders — None yet" is
            the state and the way back to it in the same line.

            **The split is the surround, not the behaviour** (owner, 2026-09-16).
            Applications and Orders were two rows of one card, ruled apart by a hairline;
            they are now two surfaces on the canvas. Nothing about the interaction moved:
            `section` still holds at most one id, so opening one closes the other, and
            answering the last application still folds Applications shut and opens the
            order catalogue — see `decide`. What changes is that the fold is now a card
            closing to its own 56px row rather than half a panel collapsing inside a box
            that stays the same size either way.

            `Collapsible` and not `Accordion`: the DS `Accordion` renders its header as
            a fixed `h3`, which would skip a level under this page's `h1` (D16 on this
            screen made the same call for the same reason).

            Not D16's mechanism, which was reversed. That folded the roll *for you* once
            every appearance was marked, and bought nothing on arrival because the
            screen opens unmarked. This is the navigation itself: it moves when you
            move, never on its own.

            **The rows are the only way through, and they are enough.** A "Next" inside
            each open section was a second control doing what the row below it already
            did, on a column where both rows are always in view. Nothing gates the move
            either way: an application can stand over, a roll can go unmarked, a date can
            be left unset, and the page prints the gap rather than a card refusing to move
            on.

            `gap-0 p-2` on each card: the card's own 8px is what gives the trigger its
            air, so a closed section is a 56px list row on its own surface — the metric
            the rows already had when a hairline separated them. `gap-0` because the
            `Collapsible` is the card's only child and `Card`'s 24px default gap would
            otherwise open under a closed row as empty white. */}
        {/* **The column is pinned and fits the window** (owner, 2026-09-16: *I have to
            scroll the page instead of being able to scroll completely down within that
            orders container itself*).

            The catalogue has had its own scroll since 2026-09-15, but the box holding it
            was `50svh` measured from nowhere — so once the chrome bar, the cause header,
            the canvas padding, two section rows and the search field were counted, the
            bottom of that box sat below the fold. Scrolling it to its end still left
            *Directives* off screen, and the only way to it was the page: an inner scroll
            that runs out before its own content does, inside an outer one that owns the
            rest.

            `lg:h-(--order-panel-height)` is the correction — the window less the two
            bands that overlay it, so the column ends where the footer begins — and
            `lg:sticky` keeps it there while the sheet beside it is read down.

            **A height, not a `max-height`.** It was the latter for one build and the
            catalogue stopped scrolling: a `max-height`-clamped box is still an *auto*
            height box, and every flex child below it was asking for a share of a height
            that had not been decided. A definite height at the top of the chain is what
            lets `flex-1` mean the same thing at each of the six boxes beneath it. The
            cost is a card with slack in it when an open section is shorter than the
            column, which the catalogue almost never is — and nothing else on the canvas
            is stretched, since the column carries no fill of its own and the closed card
            beside it keeps its own 56px.

            `self-start` was already here and is what makes the pin possible: a stretched
            grid item has no slack to stick in. `lg:overflow-y-auto` is a net for the
            other section — the catalogue fills the clamp exactly, so this engages only if
            a long list of applications overruns the column, and a scroll there beats a
            row hidden under the footer.

            Below `lg` the columns are stacked and nothing is pinned or clamped: the page
            scroll is the right one on a phone, and the `50svh` cap still applies there.

            **Not pinned or clamped at any width once the case file is open.** The
            column now also carries the sheet (below), and the fixed height was sized
            for two section cards — the sheet's own well and passage want the page's
            scroll, not a second scroller nested inside this one. The catalogue's own
            `max-h-(--order-panel-height)` belt (`OrderItems`) is a plain CSS value, not
            dependent on this column's height, so it keeps the catalogue scrolling in
            place either way. */}
        <div
          className={cn(
            "flex min-w-0 flex-col gap-4 self-start",
            !caseFileOpen &&
              "lg:sticky lg:top-(--order-panel-top) lg:h-(--order-panel-height) lg:overflow-y-auto",
          )}
        >
          {SECTIONS.map((entry) => {
            const Icon = entry.icon;
            const open = entry.id === section;
            const headingId = `order-section-${entry.id}`;
            /* **Only the catalogue takes the leftover height, and only while it is
               open** — and only while the column is the one pinned to it. The
               applications are a short list, and a card stretched past its rows is the
               tall pale container with its content bunched at the top that the sheet
               itself was pulled out of (owner, 2026-09-15). The fill has to be declared
               at every box between the column and the scroller: a flex child cannot
               inherit a definite height through a box that has none — and with the case
               file open there is no such height to inherit. */
            const fills = !caseFileOpen && open && entry.id === "orders";
            const FILL = "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col";
            return (
              <Card
                key={entry.id}
                className={cn(PANEL_CLASS, "min-w-0 gap-0 p-2", fills && FILL)}
              >
                <Collapsible
                  open={open}
                  /* Opening one closes the other; closing the open one closes
                     everything. **Both shut is a real state and a useful one** — each row
                     carries its own answer, so two closed cards are the whole sitting at
                     a glance rather than an empty screen. An earlier revision refused the
                     last close on the grounds that it showed nothing; that was true of a
                     rail with no summaries on it and has not been true since the rows
                     started carrying them (owner, 2026-09-13). */
                  onOpenChange={(next) => setSection(next ? entry.id : null)}
                  className={cn("min-w-0", fills && FILL)}
                >
                  <h2 id={headingId} tabIndex={-1} className="min-w-0">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex min-h-10 w-full min-w-0 items-center gap-3 rounded-lg px-2 text-start transition-colors hover:bg-surface-sunken focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring"
                      >
                        {/* **A teal tile behind each section's icon** (owner,
                            2026-09-15), to separate the row's own identity from the
                            chrome around it.

                            Recorded as a **departure from Ration teal**, which lists
                            "decorative teal icons or fills" under Don't: four tinted
                            tiles are four marks that do not change with state, so they
                            are identity rather than emphasis. It is the owner's call and
                            the second one on this screen — the search buttons took the
                            same override — and the reading it answers is real: bare
                            muted glyphs left the four rows reading as one block of text.

                            `brand-muted` / `brand-muted-foreground`, never `primary`:
                            the sanctioned tint pair, contrast vetted in the DS and
                            inverting properly in dark (a deep teal plate under a bright
                            glyph). A solid `bg-primary` would have put four full-strength
                            brand blocks against the one primary action on the screen.

                            `size-8 rounded-lg` is the DS's own icon-tile metric
                            (`EmptyMedia variant="icon"`) and the same square the home
                            screen's list rows wear, so this is the app's existing tile at
                            the size a 40px row can carry — not a new one. `aria-hidden`
                            sits on the tile: the plate and the glyph are both decoration,
                            and the row is named by its text. */}
                        <span
                          aria-hidden
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand-muted-foreground"
                        >
                          <Icon className="size-4" />
                        </span>
                        <span
                          className={cn(
                            "text-body-compact min-w-0 flex-1",
                            open ? "font-semibold" : "font-medium",
                          )}
                        >
                          {entry.title}
                        </span>
                        {/* The fact, not a second name for the section. Closed, this is
                            the only thing the row is for. */}
                        <span className="text-caption shrink-0 text-muted-foreground">
                          {sectionSummary(
                            entry.id,
                            items.length,
                            pending.length,
                            answered.length,
                          )}
                        </span>
                        <ChevronDownIcon
                          aria-hidden
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                            open && "rotate-180",
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                  </h2>

                  <CollapsibleContent className={cn("min-w-0", fills && FILL)}>
                    {/* Symmetric. `pb-2` under `pt-4` left the last card 8px off the
                        rule below it while its own heading sat 16px clear above — so an
                        open section read as leaning into the next one rather than as a
                        body between two rows. */}
                    <div
                      className={cn(
                        "flex min-w-0 flex-col gap-6 px-2 pt-4 pb-4",
                        fills && "lg:min-h-0 lg:flex-1",
                      )}
                    >
                      <SectionBody
                        entry={entry}
                        draft={draft}
                        pending={pending}
                        answered={answered}
                        items={items}
                        purpose={hearing.purpose}
                        suggestions={suggestions}
                        catalogue={catalogue}
                        processMatter={hearing}
                        onOpen={setOpenApplication}
                        onDecide={decide}
                        onAdd={addItem}
                        onUpdateVariables={updateItemVariables}
                        onRemove={removeItem}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}

          {/* **The sheet, moved rather than hidden.** With the right column given
              over to the case file, attendance, the next hearing and the passage
              itself have nowhere else to be — they come to rest here, under the
              catalogue, in the same order the sitting already works them. Same
              component, same props, same draft: only its column changed. */}
          {caseFileOpen ? (
            <OrderPaper
              compact
              document={orderDocument}
              appearances={appearances}
              marks={draft.marks}
              draft={draft}
              bodyRevision={bodyWrites}
              onBody={setBody}
              suggestion={suggestion}
              onMark={mark}
              onSkip={(skip) => postNext({ next: skip ? "none" : "list" })}
              onPurpose={(nextPurpose) => postNext({ nextPurpose })}
              onDate={(nextDate) => postNext({ nextDate })}
            />
          ) : null}
        </div>

        {/* No surround. The page lies on the canvas directly and carries its own lift,
            which it could not do inside the old panel — a raised sheet inside a raised
            card flattens both. */}
        {caseFileOpen ? (
          <OrderCaseFile className="lg:sticky lg:top-(--order-panel-top) lg:col-span-2 lg:h-(--order-panel-height)" />
        ) : (
          <OrderPaper
            className="lg:col-span-2"
            document={orderDocument}
            appearances={appearances}
            marks={draft.marks}
            draft={draft}
            bodyRevision={bodyWrites}
            onBody={setBody}
            suggestion={suggestion}
            onMark={mark}
            onSkip={(skip) => postNext({ next: skip ? "none" : "list" })}
            onPurpose={(nextPurpose) => postNext({ nextPurpose })}
            onDate={(nextDate) => postNext({ nextDate })}
          />
        )}
      </div>

      <footer
        ref={footerRef}
        className="sticky bottom-0 z-30 border-t border-hairline bg-card px-6 py-3 md:px-8 md:py-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <OrderSaveIndicator />
          <Button
            ref={signRef}
            type="button"
            variant="outline"
            className="w-full sm:w-fit"
            onClick={openPreview}
          >
            Preview
          </Button>
          <Button
            type="button"
            className="w-full sm:w-fit"
            disabled={signingStatus !== "draft"}
            onClick={() => {
              markOrderReady(hearing.id);
              setAnnouncement(
                "Added to the signing list. Nothing has been filed or published.",
              );
            }}
          >
            {signingStatus === "signed"
              ? "Signed"
              : signingStatus === "added"
                ? "Added to signing list"
                : "Add to signing list"}
          </Button>
        </div>
      </footer>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <OrderVariableDialog
        open={typedProcess !== null}
        onOpenChange={(open) => {
          if (!open) setTypedProcess(null);
        }}
        dialogKey={typedProcess ? `typed:${typedProcess}` : null}
        label={typedProcess ? orderItemLabel(typedProcess) : ""}
        variables={
          typedProcess
            ? defaultProcessVariables(typedProcess as ProcessTemplateId, hearing)
            : null
        }
        onConfirm={(variables) => {
          if (typedProcess) addItem(typedProcess, undefined, variables);
          setTypedProcess(null);
        }}
      />

      <ListingApplicationDialog
        hearing={hearing}
        application={openApplication}
        onOpenChange={setOpenApplication}
        onAllow={(application) => decide(application, "allowed")}
        onDismiss={(application) => decide(application, "dismissed")}
        /* The row that opened the overlay is gone by the time it closes — answering takes
           it out of the strip — so focus goes to a heading rather than to a control that
           no longer exists. **Which heading is no longer fixed.** Answering the last
           application advances the panel, and this runs *after* that, because Radix
           restores focus on close: a hard-coded Applications heading would have dragged
           the reader straight back out of the section the answer had just opened. It
           follows the panel instead, and falls back to the strip's own heading when
           everything is shut. */
        onReturnFocus={() => {
          document
            .getElementById(`order-section-${section ?? "applications"}`)
            ?.focus();
        }}
      />

      {/* Preview: the order as paper, then the same signature choice the four signing
          queues offer after their own paper — one frame, the read stage travelling to
          the sign stage rather than a second dialog opening after the first closes
          (`sign-method-stage.tsx`). The window keeps the document's width and height
          across both stages, which is what let the header and footer hold still while
          the fields under them scroll — the old `overflow-y-auto` dialog could not do
          that; choosing upload used to scroll the title and Submit off the box. */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <StagedOverlay
          /* The width and height the *document* needs, for both stages — the read stage
             sizes the window and the sign stage keeps it rather than shrinking to its
             own narrower content, the same reasoning `SignOrderDialog` states. */
          className="h-[85dvh] sm:max-w-4xl"
          title={signFlow.stage === "read" ? orderDocument.title : "Add signature"}
          titleRef={signFlow.titleRef}
          description={`${causeTitle(hearing)} · ${courtText(hearing.caseNumber)}`}
          sceneKey={signFlow.sceneKey}
          motion={signFlow.motion}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            signRef.current?.focus();
          }}
          footer={
            signFlow.stage === "read" ? (
              <Button type="button" onClick={() => signFlow.go("sign")}>
                Sign now
              </Button>
            ) : (
              <SignatureActions
                choice={signature}
                onBack={() => signFlow.go("read")}
                onSubmit={() => {
                  setSignOpen(false);
                  markOrdersSigned([hearing.id]);
                  setAnnouncement(
                    "Signature recorded for this sitting. Nothing has been filed or published.",
                  );
                }}
              />
            )
          }
        >
          {signFlow.stage === "read" ? (
            <DocumentPreview
              className="min-h-0 flex-1"
              height="fill"
              title={orderDocument.title}
              source={{
                kind: "composed",
                content: <OrderDraftFacsimile document={orderDocument} />,
              }}
            />
          ) : (
            <SignatureStage
              noun="order"
              subject={`You are adding your signature to the order in ${courtText(hearing.caseNumber)}.`}
              warning="This records how the order is to be signed. Nothing is issued from this screen."
              choice={signature}
            />
          )}
        </StagedOverlay>
      </Dialog>
    </div>
  );
}

/**
 * One open section's contents.
 *
 * Split out so the four rows above stay readable as a list of four rows. Each branch is
 * the content the panel was holding when it ran as one column — nothing here was
 * rebuilt, it was moved back — with the two editors writing straight into the draft
 * rather than holding a local copy behind an Apply.
 *
 * **No heading inside a branch.** The section row *is* the heading: an `h2` carrying the
 * name, the state, and the way in. "Pending applications" over a list that already sits
 * under a row reading "Applications — 2 pending" is the same word twice.
 */
function SectionBody({
  entry,
  draft,
  pending,
  answered,
  items,
  purpose,
  suggestions,
  catalogue,
  processMatter,
  onOpen,
  onDecide,
  onAdd,
  onUpdateVariables,
  onRemove,
}: {
  entry: SectionEntry;
  purpose: CourtHearingPurposeId;
  suggestions: readonly OrderSuggestion[];
  catalogue: OrderCatalogueContext;
  draft: OrderDraft;
  pending: ListingApplication[];
  answered: readonly {
    application: ListingApplication;
    decision: ListingApplicationDecision;
  }[];
  items: readonly OrderItemDraft[];
  /** The case a process order's confirmation pre-selects from (`AUT-05`–`AUT-08`). */
  processMatter: CaseMatter;
  onOpen: (application: ListingApplication) => void;
  onDecide: (
    application: ListingApplication,
    decision: ListingApplicationDecision,
  ) => void;
  onAdd: (
    type: OrderItemTypeId,
    application?: Pick<ListingApplication, "number" | "type">,
    variables?: ProcessVariables,
  ) => void;
  onUpdateVariables: (item: OrderItemDraft, variables: ProcessVariables) => void;
  onRemove: (item: OrderItemDraft) => void;
}) {
  if (entry.id === "applications") {
    /* **A matter that never carried one.** The only case that wants a sentence, and it is
       still its own fact rather than the same empty as an answered matter (D53) — which
       is now told by showing what was answered. */
    if (pending.length === 0 && answered.length === 0) {
      return (
        <p className="text-body-compact text-muted-foreground">
          No application is standing in this matter.
        </p>
      );
    }

    /* **Everything answered: the list, and nothing else** (owner, 2026-09-15). This
       carried three pieces of chrome over one list — a *Pending applications* heading
       above an empty group, a sentence saying every application had been answered, and an
       *Answered in this sitting* heading under it — which between them said "all
       answered" three times and left the section reading as two groups, one of them
       missing. The section row already says it once, in the place built for exactly this:
       "Applications — All answered". A group heading earns its line when there are two
       groups to tell apart, and only then. */
    if (pending.length === 0) {
      return <AnsweredApplications rows={answered} onOpen={onOpen} />;
    }

    return (
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex min-w-0 flex-col gap-3">
          {/* The owner's own subheader, asked for twice (2026-09-14). It is not the same
              word as the section row above it: that row says **Applications** and how
              many are waiting, this names the group the rows in it belong to — which is
              what lets the second group, *Answered in this sitting*, sit under the same
              section without either list being ambiguous. Sentence case, like every other
              heading on this screen. Its other effect is the reason the rows could shrink:
              with the status stated once over the list, each card stops repeating it. */}
          <h3 className="text-caption font-semibold text-muted-foreground">
            Pending applications
          </h3>
          <PendingApplications
            applications={pending}
            onOpen={onOpen}
            onDecide={onDecide}
          />
        </div>

        {answered.length > 0 ? (
          <div className="flex min-w-0 flex-col gap-3">
            <h3 className="text-caption font-semibold text-muted-foreground">
              Answered in this sitting
            </h3>
            <AnsweredApplications rows={answered} onOpen={onOpen} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <OrderItems
      items={items}
      body={draft.body}
      onAdd={onAdd}
      onUpdateVariables={onUpdateVariables}
      onRemove={onRemove}
      purpose={purpose}
      suggestions={suggestions}
      catalogue={catalogue}
      processMatter={processMatter}
    />
  );
}

/**
 * The applications standing in this matter, and the bench's answer to each.
 *
 * The card is laid out as the owner set it (2026-09-14): the status as its own pill,
 * then what the application is and its own serial, then every act in one row — Accept,
 * Reject, and View beside them. The row decides them, and that is the point of putting
 * them here rather than in a review queue: an
 * interlocutory application is answered *in* the hearing it is pending on, by a
 * magistrate who has the file open in front of them. A modal per application is the
 * queue's workflow, and the queue is the work between sittings.
 *
 * **The status is a bar, not a fill** (owner, 2026-09-14). Waiting on this bench is a
 * status and it keeps the warning family, but as an inset rule down the leading edge
 * rather than a cream wash over the whole card — which is the ladder's own answer for a
 * persistent state cue: a fill *or* an inset bar, never the fill for something every row
 * in the strip shares. Two amber cards were the loudest objects in the panel for
 * information the tab beside them already gives as a figure. The row still says
 * "Pending", so the status is never colour alone (ACCESSIBILITY §3).
 *
 * `border-s`, not `border-l`: the bar is on the *leading* edge, so it moves to the right
 * of the card in a right-to-left rendering instead of staying on the wrong side.
 *
 * *A quieter row — no tint, no decisions, one Review, with the filer and the filing date
 * in their place — was built on 2026-09-13 and reverted the same day on the owner's
 * verdict. §5 D44 keeps the argument and the outcome; this is the shape that stands.*
 */
function PendingApplications({
  applications,
  onOpen,
  onDecide,
}: {
  applications: ListingApplication[];
  onOpen: (application: ListingApplication) => void;
  onDecide: (
    application: ListingApplication,
    decision: ListingApplicationDecision,
  ) => void;
}) {
  /* `gap-3` between cards, where the tiles in the Orders section keep `gap-2`: these are
     106px objects with three controls in them, and 8px between two of those reads as one
     block rather than as two decisions. Spacing between items scales with the items. */
  return (
    <ul className="flex min-w-0 flex-col gap-3">
      {applications.map((application) => (
        <li
          key={application.id}
          className="flex min-w-0 flex-col gap-2 rounded-lg border-s-4 border-warning bg-surface-sunken p-3"
        >
          {/* **The Pending chip is gone, and that is most of the height back** (owner,
              2026-09-14: the cards were "ridiculously huge"). It was a line of its own
              plus a gap — around a third of the card — to state a fact three other things
              already state: the heading over the list, the count on the section row, and
              the amber bar down this card's own leading edge. A status chip repeated on
              every row of a list *named* for that status is the alarm-fatigue failure, not
              a status. Nothing is lost to colour alone either (ACCESSIBILITY §3): the word
              "Pending" is still on the screen, once, where it belongs — over the group.

              It was on its own line at the owner's instruction, for a real reason:
              "Pending — Application to reschedule/adjournment" had been one run of text
              doing two jobs, wrapping the title under a word that was not part of it. That
              reason is satisfied better by removing the prefix than by giving it a row. */}
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-body-compact min-w-0 font-medium">
              {listingApplicationLabel(application)}
            </p>
            <p className="text-caption text-muted-foreground">
              <Identifier value={application.number} label="application number" />
            </p>
          </div>

          {/* All three acts in one row, as the owner set them out: Accept, Reject, and the
              way in beside them. Accept leads because it is the order the bench reaches
              for more often, and the destructive weight should not be the first control
              under the reader's hand.

              **One filled control per card now, where there were two.** `destructive` is
              a pink wash, and two washed buttons on every row of a list was the other half
              of what made this strip loud — the owner has objected to the colour here
              twice. `destructive-ghost` keeps Reject's word in destructive ink with no
              fill at rest, so the decision is still plainly the destructive one, and its
              hover *is* `destructive-muted` — which means it has a real hover on this
              sunken card, unlike plain `ghost` (1.03:1, ds-requests #21).

              `size="sm"` on all three: 36px controls under a 14px title, rather than the
              40px default that had the actions out-weighing the application they act on.
              Not `xs` — §8 cautions against it for a row's primary action, and Accept is
              exactly that. View stays `link`, the DS's text button, whose hover is an
              underline and so reads on any ground. */}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onDecide(application, "allowed")}
            >
              Accept
            </Button>
            <Button
              type="button"
              variant="destructive-ghost"
              size="sm"
              onClick={() => onDecide(application, "dismissed")}
            >
              Reject
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => onOpen(application)}
            >
              View
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * What this sitting has already answered.
 *
 * **Rows, not cards** (owner, 2026-09-15: the answered cards "look really weird"). They
 * were the pending card with its decisions taken out — a filled sunken box, 106px tall,
 * holding a status word on its own line, a title, a number, and one text button floating
 * where three controls used to be. A card is the right object for a decision the bench
 * has to make, and the wrong one for a decision it has already made: there is nothing to
 * act on here, so what the list owes the reader is *what was answered and how*, as
 * briefly as that can be said.
 *
 * So: the decision as a `Badge` in the DS's own status pair — `success` for allowed,
 * `destructive` for dismissed, muted fill against muted-foreground, never the ink alone —
 * then the application and its serial, then the way in. Hairline rules between rows
 * rather than four boxes on the panel's own white, which is the separation the section
 * rows above already use. The word is in the badge, so the status is never colour alone
 * (ACCESSIBILITY §3).
 *
 * `View` keeps `link`, the DS's text button, and the row centres it rather than aligning
 * it to the top (owner, 2026-09-15). At the top it sat level with the decision pill,
 * which read as a control *on* the badge — and the badge is a state, not something to
 * act on. Centred, it lands between the application and its serial: level with the pair
 * it opens, and it stays there whether the name takes one line or three, which an
 * alignment to any single line does not.
 */
function AnsweredApplications({
  rows,
  onOpen,
}: {
  rows: readonly {
    application: ListingApplication;
    decision: ListingApplicationDecision;
  }[];
  onOpen: (application: ListingApplication) => void;
}) {
  return (
    <ul className="flex min-w-0 flex-col divide-y divide-hairline">
      {rows.map(({ application, decision }) => (
        <li
          key={application.id}
          /* `py-3`, not `py-2`. A row here is two lines — the application over its
             serial — and 8px a side put 16px between one row's serial and the next row's
             badge while the pair inside a row sits 4px apart. Four to sixteen is not
             enough of a step for the eye to group by, so two answers read as one block of
             text with a line through it (owner, 2026-09-15: "cramped"). 12px makes it 4
             to 24, which is the same ratio the panel's own section rows use. */
          className="flex min-w-0 items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
        >
          {/* **The pill takes its own line, and the application sits under it** (owner,
              2026-09-15). Beside the chip, a short name like "Bail" read as one line and
              "Application to reschedule/adjournment" broke into a narrow two-line column
              next to its badge — the same list drawing rows of two different shapes,
              which is what looked broken. Above it, every row is the same three lines:
              the decision, the application, its serial. It costs a line per row and buys
              a list that can hold any length of name.

              `self-start` on the badge because a `Badge` is an inline-flex span, and a
              flex column stretches its children — without it the pill would run the full
              width of the row as a bar.

              Two gaps, not one: 6px under the decision, 2px between the application and
              its serial. The name and the number are one fact about one application; the
              decision is a different fact about it, so the spacing groups them that
              way. */}
          <div className="flex min-w-0 flex-col gap-1.5">
            <Badge
              variant={decision === "allowed" ? "success" : "destructive"}
              className="self-start"
            >
              {decision === "allowed" ? "Allowed" : "Dismissed"}
            </Badge>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-body-compact min-w-0 font-medium">
                {listingApplicationLabel(application)}
              </p>
              <p className="text-caption text-muted-foreground">
                <Identifier value={application.number} label="application number" />
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="link"
            size="sm"
            className="shrink-0"
            onClick={() => onOpen(application)}
          >
            View
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * One order in the catalogue.
 *
 * Shared so every category renders a row the same way. **A row the matter rules out
 * keeps its words and loses its button**: the reason goes where the caption would,
 * because a greyed row that still clicks teaches a typist to distrust the list.
 */
function CatalogueRow({
  label,
  caption,
  reason,
  onSelect,
}: {
  label: string;
  /** What the order sets in motion, or what the typist will have to write. */
  caption?: string;
  /** Why this matter cannot take it, or `null` when it can. */
  reason: string | null;
  onSelect: () => void;
}) {
  if (reason) {
    return (
      <li className="flex min-w-0 flex-col px-2 py-1.5">
        <span className="text-body-compact text-muted-foreground">{label}</span>
        <span className="text-caption text-muted-foreground">{reason}</span>
      </li>
    );
  }
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onSelect}
        className="flex min-h-10 w-full min-w-0 flex-col items-start justify-center gap-0.5 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-surface-sunken focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring"
      >
        <span className="text-body-compact">{label}</span>
        {caption ? (
          <span className="text-caption text-muted-foreground">{caption}</span>
        ) : null}
      </button>
    </li>
  );
}

/**
 * What the court passed today, chosen from the court's own catalogue.
 *
 * **Choosing the order is what writes it.** A typist is not composing a direction from
 * nothing; they are setting down one the court has already made, from the court's
 * standing form. So the catalogue is the instrument — the twenty-five templates of
 * `order-templates.ts`.
 *
 * Built to the owner's reference screen, in three parts:
 *
 * 1. **A search field over the categories**, which replaces the `Combobox` an earlier
 *    revision used. The trade is deliberate: a combobox is faster for a typist who knows
 *    the word and shows *nothing* to one who does not, because its list only exists while
 *    the menu is open. Standing rows say how much catalogue there is before anyone types.
 * 2. **Likely at this hearing** — ranked, and off the sitting rather than off the purpose
 *    alone (`order-suggestions.ts`, 2026-09-14). The source's purpose table is still the
 *    baseline, so an evidence listing still offers witness batta and a witness summons;
 *    what is new is that the applications standing in the matter, an absence the bench has
 *    just marked, and the orders already in this draft can each put something above them
 *    and say why. **The ordinary row stays uncaptioned and keeps its workflow line** — the
 *    heading already says why it is there, and a second sentence saying "usual at this
 *    hearing" under a list headed "Likely at this hearing" is a line of type carrying no
 *    information. A row a signal moved gets the signal instead: "Follows CMP/312/2026,
 *    allowed at this hearing". One per line rather than the reference's 2-up: its rail is
 *    wider than this column, and "Moving case out of long pending register" does not
 *    survive a 145px tile. It answers to no query — the sitting is what ranks it, not a
 *    word — so it stays put under the field while the categories below it filter.
 * 3. **Every order in its category, including the ones this matter cannot take**, each
 *    with the reason under it. The source gates several types on the state of the case,
 *    and a silently shorter list is the worse failure on a screen where the missing order
 *    is the one that mattered.
 *
 * **One unified, categorised list (owner, 2026-09-25), not two tabs.** An earlier build
 * split "system orders" (the twenty-five worded by the catalogue) from "custom orders"
 * (Judgement, which the source gives no words for, plus `others` — the one order that is
 * not the court's at all). That split is gone: Judgement now sits in its own **Judgment**
 * category like any other row, captioned "No template — opens empty" instead of the
 * workflow line, and "Something else" stands as its own row under the categories rather
 * than in a second tab.
 *
 * **The categories are the owner's own grouping (2026-09-25)** — the catalogue's
 * `Category` column, not the four provisional headings (`Process orders` / `Accept
 * Reject` / `Case progression` / `Directives`) an earlier build used as a placeholder.
 * See `ORDER_GROUPS` in `order-templates.ts` for why **Accept / Reject** still exists
 * outside that column: it is where this screen keeps the handful of types the source
 * marks *not in dropdown*, disabled rather than hidden, on the same reasoning as point 3
 * above — a type that used to be visible going silent is a worse failure than a greyed
 * row nobody can click.
 */
function OrderItems({
  items,
  body,
  onAdd,
  onUpdateVariables,
  onRemove,
  purpose,
  suggestions,
  catalogue,
  processMatter,
}: {
  items: readonly OrderItemDraft[];
  /** What the box actually says now — the only honest source for what is left to fill. */
  body: RichTextValue;
  onAdd: (
    type: OrderItemTypeId,
    application?: Pick<ListingApplication, "number" | "type">,
    variables?: ProcessVariables,
  ) => void;
  onUpdateVariables: (item: OrderItemDraft, variables: ProcessVariables) => void;
  onRemove: (item: OrderItemDraft) => void;
  /** Only to word the note when the court's table has nothing to suggest. */
  purpose: CourtHearingPurposeId;
  /** Ranked, most likely first, and already gated. Built by the screen. */
  suggestions: readonly OrderSuggestion[];
  catalogue: OrderCatalogueContext;
  /** The case a process order's confirmation pre-selects from (`AUT-05`–`AUT-08`). */
  processMatter: CaseMatter;
}) {
  const courtText = useCourtText();
  const [query, setQuery] = React.useState("");
  const [openGroup, setOpenGroup] = React.useState<OrderGroupId | null>(null);
  const { boxRef, contentRef, edges, measure } = useScrollEdges();

  /**
   * The delivery-channel confirmation, mid-flight — either a type about to be added or
   * an already-carried item being reopened. `null` closes the dialog either way.
   */
  const [pendingVariables, setPendingVariables] = React.useState<
    | { mode: "add"; type: OrderItemTypeId; application?: Pick<ListingApplication, "number" | "type"> }
    | { mode: "edit"; item: OrderItemDraft }
    | null
  >(null);

  const openCount = openSlots(body.text).length;

  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const matches = (label: string) =>
    !searching || label.toLowerCase().includes(needle);

  const groups = ORDER_GROUPS.map((group) => ({
    ...group,
    rows: ORDER_TEMPLATES.filter(
      (entry) => entry.group === group.id && matches(entry.label),
    ),
  }));

  /* The one order that is not the court's at all — its own row under the categories,
     not a second tab (see the doc comment above, 2026-09-25). */
  const othersRow = matches("Something else")
    ? {
        label: "Something else",
        caption: "Outside the court's twenty-five",
        reason: null as string | null,
        select: () => add("others"),
      }
    : null;

  /**
   * Choosing a process type opens the delivery-channel confirmation instead of writing
   * the template straight in (`PRC-03`, `ITM-11`) — the popup the owner asked for
   * (2026-09-26). Everything else still lands the moment it is pressed, as it always
   * has.
   */
  function add(
    type: OrderItemTypeId,
    application?: Pick<ListingApplication, "number" | "type">,
  ) {
    if (needsProcessVariables(type)) {
      setPendingVariables({ mode: "add", type, application });
      return;
    }
    onAdd(type, application);
    setQuery("");
  }

  function confirmVariables(variables: ProcessVariables) {
    if (!pendingVariables) return;
    if (pendingVariables.mode === "add") {
      onAdd(pendingVariables.type, pendingVariables.application, variables);
      setQuery("");
    } else {
      onUpdateVariables(pendingVariables.item, variables);
    }
    setPendingVariables(null);
  }

  const dialogLabel = pendingVariables
    ? pendingVariables.mode === "add"
      ? orderItemLabel(pendingVariables.type)
      : orderItemLabel(pendingVariables.item.type)
    : "";
  const dialogVariables = pendingVariables
    ? pendingVariables.mode === "add"
      ? defaultProcessVariables(pendingVariables.type as ProcessTemplateId, processMatter)
      : (pendingVariables.item.variables ??
        defaultProcessVariables(pendingVariables.item.type as ProcessTemplateId, processMatter))
    : null;

  return (
    /* **The catalogue scrolls, the panel does not** (owner, 2026-09-15). This region is
       the only thing in the panel with unbounded height — twenty-seven orders in nine
       groups, plus the shortcuts above them — so it was what pushed the panel past the
       viewport and made reading down the catalogue drag the whole surface, section rows
       and all, up off the screen. Capped and scrolled in place, the panel stays as tall
       as the screen can hold and the catalogue moves within it, which is what the reader
       is actually moving through.

       **The search field stands outside the box** (owner, 2026-09-16), which is why it is
       the one part of this region that cannot scroll away: it is a sibling above the
       scroller rather than its first child. A query is the instrument for a list this
       long, and an instrument that leaves the screen the moment you look down the list
       it filters has to be chased back before it can be corrected. Pinned by position
       rather than `sticky`: nothing then has to be layered over the fades, and the field
       needs no fill of its own to stop the rows travelling under it.

       **And the suggestions moved under it** (owner, 2026-09-16). *Likely at this
       hearing* was the first thing in the panel and the search was below it, which put a
       three-row shortcut list between the reader and the only control that reaches the
       other twenty-four. The shortcuts are still first in the scroller, so they are what
       a typist meets on arrival — they just no longer sit above the field.

       **The cap is the height that is left, not a fraction of the window** (owner,
       2026-09-16). `max-h-[50svh]` was half the viewport measured from nowhere: with the
       chrome bar, the cause header, the canvas padding, two section rows and the search
       field above it, the box itself ran past the fold — so the list could be scrolled to
       its end with its last group still off screen, reachable only by scrolling the page.
       From `lg` up the box is a flex child of a column that is pinned and clamped to the
       window, which states the same rule against the height that actually remains.

       **Flex, never a percentage** (2026-09-16). This was `h-full` for one build and the
       region stopped scrolling altogether: a percentage height resolves against the
       parent's, the parent's came from a `max-height` clamp and so was never decided, and
       `height: 100%` against an undecided height computes to `auto` — the box grew to its
       own content and had nothing left to scroll. `flex-1` with `min-h-0` at every box
       between here and the column asks for the leftover in the one language that has a
       definite answer, and the column now states a height rather than a ceiling.

       The `max-h-(--order-panel-height)` beside it is a belt, not the mechanism: it is
       looser than the flex result — the field and the shortcuts sit above this box inside
       the same card — so it never binds while the fill works, and it keeps this region
       scrollable rather than endless if it ever stops working.

       The `svh` cap stays for the stacked layout below `lg`, where the page scroll is the
       right one — and `svh` rather than `vh` because on a phone `vh` is the viewport with
       the browser's chrome *hidden*, so a `vh` box is taller than anything anyone can see
       until they scroll (RESPONSIVE.md). `overscroll-contain` stops the page taking over
       when the list reaches its end — a scroll that jumps to the document the moment a
       list bottoms out is the same fault as the panel moving in the first place.

       `NO_SCROLLBAR` takes the bar away; with no thumb over the words, the `pe-1` that
       kept them apart goes with it. What says the region scrolls instead is the fade at
       whichever edge it continues past — see `useScrollEdges`. The fades are laid over
       the box rather than inside it, so they stay at its edges while the content moves
       under them, and they run from `card` to `card/0` because the panel they sit on is
       `card`: a fade has to end in the colour behind it or it reads as a band of its own.
       `card/0` rather than `transparent` — CSS interpolates a gradient towards
       `transparent` through transparent *black*, which greys the middle of a fade on a
       light panel; the same colour at zero alpha fades in the one hue it should.

       `aria-hidden` and `pointer-events-none`: it is a shadow of the content, not content
       of its own, and a scroll region you cannot click through is worse than one with no
       fade. */
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      {/* The panel's label voice, not the filter-bar default. See the prop's own note:
          even 14px here was louder than the captions of the sections it stands over. */}
      <QueueSearchField
        label="Search orders"
        value={query}
        onChange={setQuery}
        placeholder="Search the catalogue"
        className="w-full"
        labelClassName="text-caption font-semibold text-muted-foreground"
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-card to-card/0 transition-opacity motion-reduce:transition-none",
            edges.top ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-card to-card/0 transition-opacity motion-reduce:transition-none",
            edges.bottom ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          ref={boxRef}
          onScroll={measure}
          className={cn(
            "flex max-h-[50svh] min-w-0 flex-col gap-6 overflow-y-auto overscroll-contain lg:min-h-0 lg:max-h-(--order-panel-height) lg:flex-1",
            NO_SCROLLBAR,
          )}
        >
          <div ref={contentRef} className="flex min-w-0 flex-col gap-6">
            {/* **A recess of its own** (owner, 2026-09-16), so three ranked shortcuts
                read as one offer rather than as the top of the catalogue. It is the
                first thing under the field and the first thing in the scroller, and on
                a bare panel that put it at the same depth as the groups it is a
                shortcut *past* — the hierarchy the well states is that this is a
                different kind of thing, not a different part of the same list.

                The rows lift off it for free: `variant="outline"` is `bg-card`, so three
                white tiles now sit on a recessed ground instead of on the same white as
                the panel, which is the reading the sheet's blocks already get from the
                same recipe. */}
            <div className={cn("flex min-w-0 flex-col gap-3", WELL_CLASS)}>
              <p className="text-caption font-semibold text-muted-foreground">
                Likely at this hearing
              </p>
              {suggestions.length === 0 ? (
                <p className="text-body-compact text-muted-foreground">
                  {noSuggestionsNote(purpose)}
                </p>
              ) : (
                /* An `ol`, because the order is the answer. The list is ranked by how strongly
               the sitting argues for each row — an application the bench has allowed above
               an order the purpose table merely mentions — so position carries meaning and
               a `ul` would have thrown it away. The numbers stay off: a typist chooses one
               of these, they do not work down them. */
                <ol className="flex min-w-0 flex-col gap-2">
                  {suggestions.map((suggestion) => {
                    const raw = suggestionCaption(suggestion);
                    const caption = raw === null ? null : courtText(raw);
                    return (
                      <li key={suggestion.template.id} className="min-w-0">
                        <Button
                          type="button"
                          variant="outline"
                          /* `h-auto` so a wrapped label and its caption both fit, and
                         `min-h-10` because `h-auto` alone let an uncaptioned row —
                         Cognizance, Judgement, and the others the source gives no workflow
                         — render at 36px, under the DS floor of 40×40 for a touch target
                         (ACCESSIBILITY §8). The floor is the control metric, so it is
                         `min-h-10` and not a spacing value. */
                          className="h-auto min-h-10 w-full flex-col items-start gap-0.5 px-3 py-2 text-start whitespace-normal"
                          onClick={() =>
                            add(
                              suggestion.template.id,
                              suggestion.fromApplication,
                            )
                          }
                        >
                          <span className="text-body-compact font-medium">
                            {suggestion.template.label}
                          </span>
                          {caption ? (
                            <span className="text-caption text-muted-foreground">
                              {caption}
                            </span>
                          ) : null}
                        </Button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="flex min-w-0 flex-col divide-y divide-hairline">
              {groups.map((group) => {
                /* A search opens whatever it found and leaves the rest shut, so the result
                 is on screen without the typist opening every category to look for it. */
                const open = searching
                  ? group.rows.length > 0
                  : openGroup === group.id;
                return (
                  <Collapsible
                    key={group.id}
                    id={`order-group-${group.id}`}
                    open={open}
                    /* The reveal runs in the next frame, not here: the rows this press
                       mounts do not exist yet while the handler is running, and closing
                       the group that was open takes content out from above this one, so
                       both edges of what has to be measured move in the same commit.
                       One frame later the box is settled and the measurement is real.

                       Only on opening, and only from a press. A search opens groups by
                       itself (`open` is computed from the query above), and scrolling
                       the box under a reader who is typing would be the page moving on
                       its own. */
                    onOpenChange={(next) => {
                      setOpenGroup(next ? group.id : null);
                      if (!next) return;
                      requestAnimationFrame(() =>
                        revealInBox(
                          boxRef.current,
                          document.getElementById(`order-group-${group.id}`),
                        ),
                      );
                    }}
                    className="min-w-0 py-1"
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        disabled={searching && group.rows.length === 0}
                        className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-start transition-colors hover:bg-surface-sunken focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:opacity-50"
                      >
                        <ChevronDownIcon
                          aria-hidden
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                            open && "rotate-180",
                          )}
                        />
                        <span className="text-body-compact min-w-0 flex-1 font-medium">
                          {group.label}
                        </span>
                        <span className="text-caption shrink-0 text-muted-foreground tabular-nums">
                          {group.rows.length}
                        </span>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="min-w-0">
                      <ul className="flex min-w-0 flex-col gap-0.5 ps-8 pt-1 pb-2">
                        {group.rows.map((template) => (
                          <CatalogueRow
                            key={template.id}
                            label={template.label}
                            caption={
                              hasTemplateText(template)
                                ? template.workflow
                                : "No template — opens empty"
                            }
                            reason={unavailableReason(template, catalogue)}
                            onSelect={() => add(template.id)}
                          />
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

              {othersRow ? (
                <ul className="flex min-w-0 flex-col gap-0.5 py-1">
                  <CatalogueRow
                    label={othersRow.label}
                    caption={othersRow.caption ? courtText(othersRow.caption) : othersRow.caption}
                    reason={othersRow.reason}
                    onSelect={othersRow.select}
                  />
                </ul>
              ) : null}
            </div>

            {/* **Nothing pulled in says nothing** (owner, 2026-09-16). The empty state
                here was a paragraph explaining what choosing an order would do — how the
                court's standing words land in the page, that they can be corrected, and
                what to do where the catalogue gives none. It is a heading and four lines
                of instruction over an absence, on a panel whose whole job is the
                catalogue directly above it; the act it describes is the one the reader is
                already standing in front of. The block appears when there is something to
                record, and the heading arrives with its list rather than in front of one
                that does not exist yet. */}
            {items.length > 0 ? (
              <div className="flex min-w-0 flex-col gap-3">
                <p className="text-caption font-semibold text-muted-foreground">
                  Pulled into this order
                </p>
                {/* **A record of what the order carries, and the way back out of it.**
                    This list had no Remove until 2026-09-16, on the reading that a
                    direction is deleted by deleting the sentence that carries it, in the
                    box, the way it is done on paper — and that a Remove here would have
                    to guess which sentences were once this template's. The guess is what
                    went: the passage carries the item's id, so the row can take out
                    exactly what it wrote, and the same mark answers the question in the
                    other direction — delete the passage in the page beside this and the
                    row goes with it, because the row is a record of a passage that no
                    longer exists (owner, 2026-09-16).

                    The control is the app's own row-removal recipe, as the task screens'
                    document slots wear it (`components/tasks/act/shared.tsx`): a ghost
                    trash at `icon-xs`, whose `size-8` is grown by `after:-inset-1` to the
                    40×40 the Laws require of an icon-sized target (ACCESSIBILITY §8).
                    Named for the order it removes rather than "Remove", so a reader
                    moving down the list hears which direction each button would take
                    out. */}
                <ol className="flex min-w-0 flex-col gap-2">
                  {items.map((item, index) => {
                    /* A process type still carries the delivery-channel confirmation
                       as its own row fact, whether or not it has been given one yet —
                       added through the catalogue it always has one by the time it
                       lands here (`add`, above); the "/" inline suggestion has no such
                       gate, so a row it wrote can still be missing one. Either way the
                       row says so rather than reading as finished. */
                    const needsConfirmation = needsProcessVariables(item.type);
                    return (
                      <li
                        key={item.id}
                        className="flex min-h-10 min-w-0 items-center gap-3 rounded-lg bg-surface-sunken px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-body-compact min-w-0">
                            <span className="tabular-nums">{index + 1}.</span>{" "}
                            {orderItemLabel(item.type)}
                          </p>
                          {needsConfirmation ? (
                            <p className="text-caption text-muted-foreground">
                              {item.variables
                                ? `Delivery: ${channelSummary(item.variables)}`
                                : "Delivery channels not confirmed"}
                            </p>
                          ) : null}
                        </div>
                        {needsConfirmation ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Confirm delivery for ${orderItemLabel(item.type)}`}
                            onClick={() =>
                              setPendingVariables({ mode: "edit", item })
                            }
                            className="relative shrink-0 after:absolute after:-inset-1"
                          >
                            <PencilIcon aria-hidden />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Take ${orderItemLabel(item.type)} out of the order`}
                          onClick={() => onRemove(item)}
                          className="relative shrink-0 after:absolute after:-inset-1"
                        >
                          <TrashIcon aria-hidden />
                        </Button>
                      </li>
                    );
                  })}
                </ol>
                {/* What the auto-fill pass could not resolve, **read off the box rather
                    than off the templates**. It used to be a count per row, taken from the
                    words each template arrived with — which went stale the moment the
                    typist filled one in, the row still claiming a hole that was no longer
                    there. One count, measured on what the order actually says now. The
                    brackets themselves are visible in the page beside this, so this
                    carries the number and the document carries the places. */}
                {openCount > 0 ? (
                  <p className="text-caption tabular-nums text-muted-foreground">
                    {openCount === 1
                      ? "1 detail still to fill in the order"
                      : `${openCount} details still to fill in the order`}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <OrderVariableDialog
        open={pendingVariables !== null}
        onOpenChange={(open) => {
          if (!open) setPendingVariables(null);
        }}
        dialogKey={
          pendingVariables
            ? pendingVariables.mode === "add"
              ? `add:${pendingVariables.type}`
              : `edit:${pendingVariables.item.id}`
            : null
        }
        label={dialogLabel}
        variables={dialogVariables}
        onConfirm={confirmVariables}
      />
    </div>
  );
}

/**
 * Which listing this is — the line under the cause name.
 *
 * The screen used to open on a cause title and nothing else: no serial, no case number,
 * no stage, no purpose. A typist just handed the file needs those four before they can
 * set anything down, and the stage in particular is not decoration — the court's
 * catalogue makes several orders available only once the case is on file and others only
 * on a long-pending one, so hiding it leaves the typist unable to see why a form is
 * offered here and not on the matter before it.
 *
 * It sits **inside** the header, under the name it qualifies (owner, 2026-09-13). It was
 * a band of its own with a rule above and below it, and that gave a subtitle the weight
 * of a region — two horizontal rules stacked four rows apart, for one line of text that
 * belongs to the heading.
 *
 * No fill and no stroke of its own: the header it lives in is already chrome.
 */
function MatterFacts({ hearing }: { hearing: CourtHearing }) {
  /* `figures` is not styling for its own sake: the serial and the case number sit in a
     row the eye runs along, and a stage or a purpose is a word. Lining figures on a word
     buys nothing and costs the shape of it. */
  const rows: {
    label: string;
    value: string;
    figures: boolean;
    /** The value is an identifier, not a figure — it takes the product's own treatment. */
    id?: true;
  }[] = [
    { label: "Item", value: String(hearing.item), figures: true },
    { label: "Case", value: hearing.caseNumber, figures: true, id: true },
    {
      label: "Stage",
      value: courtCaseStageLabel(hearing.stage),
      figures: false,
    },
    {
      /* **"Purpose", not "Today for".** The colons are what forced it: "Today for:
         Evidence of complainant" is a preposition wearing a label's punctuation, and the
         row cannot have three label:value pairs and one sentence fragment. Nothing is
         lost with "today" — the composer only opens on a listing from today's board, and
         the page beside it prints the date in its own masthead. */
      label: "Purpose",
      value: courtHearingPurposeLabel(hearing.purpose),
      figures: false,
    },
  ];
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-6 gap-y-1">
      {rows.map((row) => (
        <p
          key={row.label}
          className="flex min-w-0 items-baseline gap-2 text-body-compact"
        >
          {/* The colon is in the markup, not in the label, because the label is the
              *name of a fact* and the punctuation is how this line chooses to show it —
              the same split the next-listing block on the page already makes. Without it
              the pair read as two loose words: "Case ST/241/2026" makes the reader work
              out that the first is a heading for the second (owner, 2026-09-15). `gap-2`
              stays, matching that block, and the pairs keep `gap-x-6` between them, so
              the 3:1 ratio is what groups a label with its own value. */}
          <span className="font-medium text-muted-foreground">{`${row.label}:`}</span>
          {row.id ? (
            <Identifier value={row.value} label={row.label.toLowerCase()} />
          ) : (
            <span className={cn(row.figures && "tabular-nums")}>{row.value}</span>
          )}
        </p>
      ))}
    </div>
  );
}

/**
 * The order, on paper, as the thing the typist is actually making.
 *
 * This replaces a panel of three labelled boxes — an attendance box, an item box and a
 * next-hearing box — that described an order without ever being one. The owner's
 * reference puts the document itself in this column and it is right to: the typist is
 * setting down a page a court will read, and a page is the only honest preview of a
 * page. The furniture around the writing is the court's own — the title, attendance,
 * the next posting, the signature — and none of it is typed, because every one of those
 * facts is already known to the listing.
 *
 * **No cause block.** The page opened on a printed heading held back to 60% — the court,
 * the case number, the matter, the date, a roll of the parties with their counsel, and
 * the offence. It came out (owner, 2026-09-15). All of it is already on screen: the
 * strip above this column names the case and the matter, and the column beside it
 * carries the item and the purpose. The copy that leaves this court is not short of a
 * cause title either — the signing queue renders the same document with its own heading,
 * from the same `court`, `matter` and `dated` fields. Repeating it here spent a third of
 * the sheet before the first line of what the court actually passed.
 *
 * `paper` is the DS family for exactly this and for nothing else: a fixed facsimile that
 * does not invert in dark, because a printed page does not change colour with the
 * product palette. It is the same treatment the signing queue uses on the same artefact,
 * so what the bench reads back here is what it will see when it comes to sign.
 *
 * **One writable region, ruled off at the top, and always there.** Below attendance
 * and the next posting sits the one part of the page that is composed rather than known:
 * a single editor holding the whole of what the court passed. It was a band carrying one
 * bordered well per template, which grew the page a box at a time and made a document
 * read as a stack of forms (owner, 2026-09-15) — so the wells collapsed into one editor.
 * The top rule stayed: it is the reference's own, and it says where the court's standing
 * furniture stops and the typist's work begins. The matching rule below did not: with
 * nothing under the writing, it was a leftover divider (owner, 2026-09-15).
 */
function OrderPaper({
  className,
  document: order,
  appearances,
  marks,
  draft,
  bodyRevision,
  onBody,
  suggestion,
  onMark,
  onSkip,
  onPurpose,
  onDate,
  compact,
}: {
  className?: string;
  document: OrderDocument;
  appearances: Appearance[];
  marks: OrderDraft["marks"];
  draft: OrderDraft;
  /** Bumped by every write the screen makes to the order — see `bodyWrites`. */
  bodyRevision: number;
  onBody: (value: RichTextValue) => void;
  /** What "/" completes from in the writable region — see the screen's own note. */
  suggestion: RichTextSuggestion;
  onMark: (id: string, mark: AttendanceMark | undefined) => void;
  onSkip: (skip: boolean) => void;
  onPurpose: (purpose: CourtHearingPurposeId | "") => void;
  onDate: (day: string | null) => void;
  /**
   * The sheet at a third of the page rather than two-thirds — the width it gets in
   * the left column once the case file has taken the right one. `md:grid-cols-2`
   * reads the *viewport*, not this column: at a desktop width it fired anyway and
   * paired Attendance with Next hearing in a track too narrow for either, which is
   * what wrapped every office's name one letter to a line. This keeps the pair
   * stacked regardless of viewport, which is what the column's own width actually
   * calls for here.
   */
  compact?: boolean;
}) {
  return (
    <article
      className={cn(
        PANEL_CLASS,
        /* `self-start`, as the panel beside it has: with the signature gone from the
           foot (owner, 2026-09-15) there is nothing left to hold down there, and a sheet
           stretched to the canvas was a tall pale container with its writing bunched at
           the top. The page is now as tall as the order on it, and the writable region's
           own minimum height is what keeps it reading as a page rather than a slip. */
        "flex min-w-0 flex-col gap-4 self-start rounded-xl bg-card p-6 text-card-foreground md:p-8",
        className,
      )}
      aria-labelledby="order-paper"
    >
      <h2
        id="order-paper"
        tabIndex={-1}
        className="text-body-compact font-semibold uppercase tracking-wide"
      >
        {order.title}
      </h2>

      {/* **A well, and the controls inside it, for the whole sitting** (owner,
          2026-09-16). The blocks were framed only while they were still forms, then
          framed in both states, and now they have only one state: what the typist
          answered stays on screen exactly as they answered it. The read-back they used to
          swap themselves for said nothing the controls do not already say — a segment
          holding *Absent* is a record of absence — and the order below now carries the
          same facts in its own words, where they can be corrected. */}
      {/* **The sitting's two facts, side by side** (owner, 2026-09-15). The posting used
          to sit at the foot of the sheet, below the writing, which put the two things a
          typist settles before composing anything at opposite ends of the page — and cost
          the sheet two full-width blocks of form where one row of two would do.

          Two columns from `md` up and one below it: each block holds a label beside a
          control, and at a phone's width there is no room for two of those across.

          **One height across the row** (owner, 2026-09-16: match attendance to next
          hearing). It was `items-start`, so each block was exactly as tall as its own
          contents and the shorter one left a step in the row — now that neither block
          ever swaps itself for a shorter read-back, that step is permanent. The grid's own
          `stretch` is what closes it: the row is as tall as the taller block and both
          wells fill it, so the pair reads as one band of the sheet's furniture rather
          than as two boxes that happen to be adjacent. Nothing is stretched *inside*
          them — the controls keep their own sizes and sit at the top. */}
      <div className={cn("grid min-w-0 gap-4", !compact && "md:grid-cols-2")}>
        <PaperBlock id="order-attendance" label="Attendance">
          <PaperAttendance
            appearances={appearances}
            marks={marks}
            onMark={onMark}
          />
        </PaperBlock>

        <PaperBlock id="order-next" label="Next hearing" focusable>
          <PaperNextHearing
            draft={draft}
            onSkip={onSkip}
            onPurpose={onPurpose}
            onDate={onDate}
          />
        </PaperBlock>
      </div>

      {/* The composed region: one box, always here, whether or not a template has been
          pulled into it, and **ruled at the top**.

          The top rule is what makes the editor read as the passage this document is for
          rather than a control that has landed on the sheet. The matching rule below was
          dropped (owner, 2026-09-15): with the next posting now beside attendance, nothing
          sits under the writing, so a bottom hairline was a leftover divider over empty
          card. The editor's own border already closes the writable region. */}
      <div className="flex min-w-0 flex-col border-t border-hairline py-6">
        <OrderBody
          value={draft.body}
          revision={bodyRevision}
          onChange={onBody}
          suggestion={suggestion}
        />
      </div>
    </article>
  );
}

/**
 * The roll, called on the sheet itself.
 *
 * **An exploration, opened on the owner's ask (2026-09-15):** can attendance live on the
 * paper rather than in the panel? It has been tried once — D45 put the roll and the next
 * posting on the page as inline editors on 2026-09-14 and the owner reversed it the same
 * day, because two editors on the sheet met the typist with ~400px of form before the
 * first line of the order. What answers that objection here is not the size of the
 * control: the form is how the roll is *called*, and the moment every office has an
 * answer the block is two printed lines again.
 *
 * **Rebuilt after the first attempt looked, in the owner's words, poorly made
 * (2026-09-15).** Three faults, all of them layout rather than primitive:
 *
 * 1. `justify-between` in a column of its own stranded each control in the middle of a
 *    two-thirds-wide sheet, tethered to its label by 200px of nothing. It is a grid now —
 *    one column for the offices, one for their answers — sized `w-fit`, so the answers
 *    line up directly after the longest office and the pair reads as a row of a table.
 *    That is what an attendance roll is, and it is why the roll needed no second change
 *    when the block moved into half the sheet's width: a table that hugs its content fits
 *    whatever column it is given.
 * 2. Four full-height wells stacked down the page were the loudest objects on a sheet
 *    whose whole point is the writing. `size="compact"` is the DS's answer for exactly
 *    this — a 32px well that keeps its 40px hit target — so the wells stop being slabs
 *    without any of them becoming a smaller target than the Laws allow.
 * 3. Nothing ended it, so the controls read as furniture rather than as work with an
 *    end. The last answer closes the block now: four offices answered is the whole of
 *    the question, and the printed lines are what the sheet shows from then on.
 *
 * `SegmentedControl`, not the panel's two checkbox rolls: one question per person with
 * one answer, so *Present | Absent* beside the office is the shortest true form of it,
 * and a person cannot be ticked into both rolls at once. It carries state as weight
 * rather than as brand colour, which is what keeps four of them quiet on paper.
 */
function PaperAttendance({
  appearances,
  marks,
  onMark,
}: {
  appearances: Appearance[];
  marks: OrderDraft["marks"];
  onMark: (id: string, mark: AttendanceMark | undefined) => void;
}) {
  const rollId = React.useId();
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* **The answers are pinned to the right edge of the block** (owner, 2026-09-16:
          "the present and absent can be aligned right rather than being in the middle").
          The table was `w-fit`, so it hugged its two columns and sat at the left of a
          block wider than itself — which left every control stranded mid-block, in a
          column whose position was decided by the length of the longest office rather
          than by anything on the page.

          `minmax(0,1fr)` for the offices and `auto` for the answers: the roll now spans
          the block, the answers line up on its right edge, and the slack between the two
          is on the side where nothing is reading. The narrow-screen behaviour the `w-fit`
          note was protecting is *better* here, not worse — the slack is explicitly the
          office column's, so a long or translated role label takes the squeeze by
          wrapping, and `auto` means the answers can never be compressed or pushed off the
          sheet. The `minmax` floor rather than a bare `1fr` because a grid track's
          implicit minimum is its content, which an unbreakable label would overflow. */}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1">
        {appearances.map((appearance) => {
          const labelId = `${rollId}-${appearance.id}`;
          const mark = marks[appearance.id];
          return (
            <React.Fragment key={appearance.id}>
              {/* The office, and it names the control beside it rather than labelling it
                  twice: the segments say *Present* and *Absent*, which are the answers,
                  and this says whose. `wrap-break-word` because this app ships per state
                  and a Malayalam role label is longer than the English one. */}
              <span
                id={labelId}
                className="text-body-compact min-w-0 wrap-break-word"
              >
                {rollLabel(appearance, appearances)}
              </span>
              <SegmentedControl
                type="single"
                size="compact"
                value={mark ?? ""}
                /* Pressing the answer that is already given clears it — Radix hands back
                   an empty string — and the roll goes back to incomplete. A court record
                   with no answer for a person is a real state; one that cannot be
                   corrected is not. */
                onValueChange={(next) =>
                  onMark(
                    appearance.id,
                    next === "present" || next === "absent" ? next : undefined,
                  )
                }
                aria-labelledby={labelId}
                className="justify-self-end"
              >
                <SegmentedControlItem value="present">
                  Present
                </SegmentedControlItem>
                <SegmentedControlItem value="absent">
                  Absent
                </SegmentedControlItem>
              </SegmentedControl>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The order, as one box.
 *
 * **One editor, not one per template** (owner, 2026-09-15). The page grew a second
 * bordered well every time an order was pulled from the catalogue, which is not how a
 * sheet of paper behaves and made the paper read as a form stack rather than a document.
 * The templates are now where words *come from*: pressing one appends its direction to
 * the end of this box and the typist shapes the result — joining two into a sentence,
 * splitting one, numbering them with the editor's own list marks, deleting what the
 * court did not pass.
 *
 * **It is here whether or not anything has been added**, which is the other half of the
 * owner's instruction. A bench that wants to write the order straight out, without
 * touching the catalogue at all, can: the box does not have to be summoned into being
 * first, and there is no empty-state sentence standing where the writing goes.
 *
 * `RichTextField` rather than a plain `Textarea`: an order carries emphasis and numbered
 * directions, the editor already exists for exactly this (`rich-text-field.tsx`), and the
 * catalogue's own text arrives as markup. `labelId` is the page's `ORDER` heading — a
 * contentEditable region cannot be labelled by a `<label>`, and the sheet already names
 * this: a second eyebrow over the box would say "Order" twice.
 *
 * **`revision` is load-bearing.** The editor keeps the markup it opened on and never
 * rewrites its own DOM while it is mounted — that is what stops it eating the caret
 * mid-word — so an append from the panel would otherwise land in the draft and never
 * appear on the page. Keying it on how many templates have been pulled in remounts it on
 * exactly those events and on no others: typing does not change the count, so the caret
 * is safe, and what the typist has already written is preserved because it is in `value`
 * by then.
 */
function OrderBody({
  value,
  revision,
  onChange,
  suggestion,
}: {
  value: RichTextValue;
  revision: number;
  onChange: (value: RichTextValue) => void;
  suggestion: RichTextSuggestion;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <RichTextField
        key={revision}
        value={value}
        onChange={onChange}
        labelId="order-paper"
        /* **A blank line between the order's blocks, drawn rather than typed** (owner,
           2026-09-16: every section added "needs to have spacing", or it "reads like one
           information, which is not true").

           The passage has always been a list of blocks — the roll, the disposals, each
           direction, the posting — and the plain side already joins them on a blank line
           (`plainTextOfRichText`). Only the box collapsed them: a `<p>` carries no margin
           here, so a direction written in by the catalogue landed flush under the
           typist's own sentence and the two read as one paragraph.

           **Drawn, so it cannot be consumed.** The alternative was to insert empty
           paragraphs between the blocks, and it fails on exactly the flow that reported
           this: the typist writes *into* the blank line — that is what it invites — and
           the gap it was holding is gone by the time the next section arrives. A rule
           about the blocks holds however they are edited, and it spaces every seam,
           including the two directions the catalogue adds back to back.

           24px, which is the line this box would have added — the same gap the owner's
           own two presses of Enter produced. Scoped to the direct children of the
           writable region and to nothing else: `>*+*` leaves the first block without a
           leading gap, and `>` keeps the list items inside an `<ol>` on their own
           rhythm rather than pushing a numbered direction apart. */
        className="[&_[data-slot=input-group-control]]:min-h-48 [&_[data-slot=input-group-control]>*+*]:mt-6"
        suggestion={suggestion}
      />
      {/* **A completion nobody knows about is not a feature.** The trigger is invisible
          by design — that is what keeps it out of the way of a typist who does not want
          it — so one muted line under the box carries the whole of it: what opens it,
          how to reach the next answer, and the key that takes one. `text-caption` and
          `muted-foreground`: this is chrome about the instrument, not part of the
          document, and it sits under the writable region rather than on the paper above
          it. */}
      {/* `{" "}` at every join: JSX drops the space where a text node meets an element
          across a line break, and the rendered line read "Type /for the court's". */}
      <p className="text-caption text-muted-foreground">
        <span className="font-semibold">Tab</span>{" "}
        finishes a sentence as you write it.{" "}
        <span className="font-semibold">/</span>{" "}
        then a word names one of the court&rsquo;s standing orders;{" "}
        <span className="font-semibold">↓</span> for the next.
      </p>
    </div>
  );
}

/**
 * Where the matter is posted to, settled on the sheet.
 *
 * **The second half of the same exploration** (owner, 2026-09-15): the two lines this
 * block printed — *Purpose of next hearing* and *Date of next hearing* — are the labels
 * of the controls that set them, and once both are answered they are those lines again.
 *
 * **The labels sit above their controls, and the controls fill the column.** They were
 * a label beside a `w-48` control while this block had the sheet's whole width; in half
 * of it, a long label and a fixed control wrapped into an accidental stack — the same
 * layout, arrived at by running out of room, which is how a field ends up with its
 * control in a different place on every row. Stated instead: two full-width fields, and
 * the pair reads down the column rather than across it.
 *
 * **The exception keeps its own line and its own polarity.** *List it again* is the
 * ordinary end of a §138 listing and the reference's "Skip scheduling next hearing"
 * asked it backwards; the panel's version fixed that and this keeps the fix. It sits
 * above the two rows because unticking it takes them away — a control that removes what
 * is under it does not belong beneath them.
 *
 * **The calendar is owned here rather than taken from `DatePicker`** (owner, 2026-09-15:
 * the date "dropdown is not working properly"; open it upward so the whole month is
 * visible). `DatePicker` renders its own `Popover` and hardcodes `align="start"` with no
 * side, no collision padding and no way to close the surface when a day is chosen — a
 * screen using it cannot reach any of that, in props or in CSS, which is `ds-requests`
 * 19 and the same reason the bulk-reschedule filter owns its own popover. Owning it buys
 * three things this block needs:
 *
 * - `side="top"`. This block is the last thing on a long sheet, so a calendar opening
 *   downward opens into the sticky footer and the viewport edge. Above the trigger it has
 *   the whole page to sit in. `collisionPadding` keeps it off the edge if it does flip,
 *   and the available-width ceiling keeps it from hanging off a narrow screen
 *   (RESPONSIVE.md 9).
 * - **It closes when a day is chosen.** The primitive leaves the surface standing over
 *   the sheet after the answer has been given, which is most of what "not working
 *   properly" was: the date *was* set, underneath a calendar still covering the page.
 * - The trigger is named by the printed label beside it rather than by a repeated one.
 */
function PaperNextHearing({
  draft,
  onSkip,
  onPurpose,
  onDate,
}: {
  draft: OrderDraft;
  onSkip: (skip: boolean) => void;
  onPurpose: (purpose: CourtHearingPurposeId | "") => void;
  onDate: (day: string | null) => void;
}) {
  const fieldId = React.useId();
  const listing = draft.next === "list";
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const chosen = draft.nextDate ? parseIsoDay(draft.nextDate) : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-10 min-w-0 items-center gap-2">
        <Checkbox
          id={`${fieldId}-list`}
          /* As on the panel's own checkboxes: the box would otherwise be the one
             arrow-cursor spot in a row the label has made a pointer. */
          className="cursor-pointer"
          checked={listing}
          onCheckedChange={(checked) => onSkip(checked !== true)}
        />
        <Label
          htmlFor={`${fieldId}-list`}
          className="text-body-compact min-h-10 min-w-0 flex-1 cursor-pointer font-normal"
        >
          List it again
        </Label>
      </div>

      {listing ? (
        <>
          <div className="flex min-w-0 flex-col gap-1">
            {/* The printed label, naming the control rather than being repeated inside
                it: `SelectValue`'s placeholder asks for the answer ("Choose a purpose")
                and this says what the answer is about. */}
            <span
              id={`${fieldId}-purpose`}
              className="text-body-compact min-w-0 wrap-break-word"
            >
              Purpose of next hearing
            </span>
            <Select
              value={draft.nextPurpose || undefined}
              onValueChange={(value) =>
                onPurpose(value as CourtHearingPurposeId)
              }
            >
              <SelectTrigger
                aria-labelledby={`${fieldId}-purpose`}
                className="w-full"
              >
                {/* The label, rendered rather than left to the primitive. `SelectValue`
                    resolves its own text from the mounted item on the client, so a
                    trigger with a value server-renders empty and fills in on hydration.
                    In the panel that flash never showed — the section arrived collapsed,
                    and by the time anyone opened it the page had hydrated. On the sheet
                    the control is always mounted, and a completed listing arrives with a
                    purpose already chosen (`order-demo.ts`), so the first paint would
                    have been an empty box on a page that does have an answer. Children
                    win over the primitive's lookup; the placeholder still shows when
                    there is no value, which is what `|| undefined` on the value is
                    for. */}
                <SelectValue placeholder="Choose a purpose">
                  {draft.nextPurpose
                    ? courtHearingPurposeLabel(draft.nextPurpose)
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {COURT_HEARING_PURPOSES.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <span
              id={`${fieldId}-date`}
              className="text-body-compact min-w-0 wrap-break-word"
            >
              Date of next hearing
            </span>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                {/* Named by the label beside it *and* by its own content, the way a
                    combobox is: "Date of next hearing, October 6th, 2026". The label
                    alone would drop the date; the content alone would drop what the date
                    is of. */}
                <Button
                  id={`${fieldId}-date-trigger`}
                  variant="outline"
                  aria-labelledby={`${fieldId}-date ${fieldId}-date-trigger`}
                  className={cn(
                    "w-full justify-start gap-2 text-left font-normal",
                    !chosen && "text-muted-foreground",
                  )}
                >
                  <CalendarDaysIcon data-icon="inline-start" aria-hidden />
                  <span className="truncate">
                    {draft.nextDate
                      ? formatListingDate(draft.nextDate)
                      : "Pick a date"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                collisionPadding={16}
                className="w-auto max-w-(--radix-popover-content-available-width) gap-0 p-0"
              >
                <Calendar
                  mode="single"
                  autoFocus
                  selected={chosen}
                  onSelect={(day) => {
                    onDate(day ? isoDay(day) : null);
                    /* The answer given, the surface goes. Leaving it standing over the
                       sheet is what made choosing a date feel like nothing had
                       happened. */
                    if (day) setCalendarOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * One region of the sheet the court's own furniture occupies, named.
 *
 * The roll and the posting: the two facts a sitting settles before anything is composed.
 * Each is answered here and recites itself into the order below (`attendanceRecital`,
 * `nextListingRecital`), so the block is where the question is asked and the passage is
 * where the answer is recorded. Its heading is what lets a screen reader land here and
 * hear which part of the order it has landed in.
 */
function PaperBlock({
  id,
  label,
  focusable,
  children,
}: {
  id: string;
  label: string;
  /** Sends focus here from elsewhere on the screen — see the note below. */
  focusable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      /* The DS's rule for content that must read as its own unit inside a card (FAQ, form
         section, case facts) is a hairline edge, never a fill difference — and for
         something nested *inside* a card, `surface-sunken` with a hairline, because it
         holds interactive content: the form while the block is being answered, **Edit**
         once it has been. Not a second `Card`: the sheet is already `shadow-raised`, and
         a raised box inside a raised box flattens both, which is the same reading that
         took the page out of its old panel.

         The recess also does the control states a favour. A `SegmentedControl`'s own well
         is `surface-sunken` too, so inside this it reads by its hairline rather than by
         its fill — and the selected pill, which is `card` plus a raised shadow, lifts off
         a recessed ground instead of sitting on the same white. Marked and unmarked are
         further apart here than they were on the bare sheet. */
      className={cn("flex min-w-0 flex-col gap-2", WELL_CLASS)}
    >
      {/* An eyebrow and nothing else. It carried a teal **Mark attendance** / **Set next
          hearing** text button until 2026-09-14, when the editors it opened went back to
          the panel on the owner's instruction, and an **Edit** until 2026-09-16, when the
          blocks stopped having a second state to go back from.

          **`tabIndex` only where something focuses the heading**, which is the next
          hearing block and nothing else: completing the roll walks the typist on to the
          posting (`walkOn`), and the posting is on this page. Every other block leaves
          the attribute off — the `id` is there to name the region through
          `aria-labelledby`, and naming wants no tabindex. A focusable element nothing
          focuses is a claim the next reader has to disprove before they dare move
          anything near it. */}
      {/* **The eyebrow carries nothing but the name of the region.** It held an **Edit**
          text button while the block swapped itself for its own read-back; both went on
          2026-09-16, when the owner asked the blocks to stay as they are. A block with
          one state needs no way back into it. */}
      <h3
        id={id}
        tabIndex={focusable ? -1 : undefined}
        className="text-caption font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </h3>
      {children}
    </section>
  );
}

/**
 * What one roll calls each appearance.
 *
 * A side with no vakalat has no advocate row at all; the list is built from the
 * appearances rather than from the owner's four, so it cannot offer a box for counsel who
 * do not exist.
 */
function rollLabel(appearance: Appearance, appearances: Appearance[]): string {
  /* Off `side` and `kind`, never by reading `role` — which is copy, will be translated,
     and is the reason `Appearance` carries both fields explicitly. */
  const side = appearance.side === "complainant" ? "Complainant" : "Accused";
  if (appearance.kind === "party") return side;
  const label = `${side}'s advocate`;
  const counsel = appearances.filter(
    (entry) => entry.side === appearance.side && entry.kind === "counsel",
  );
  return counsel.length > 1 ? `${label} — ${appearance.name}` : label;
}
