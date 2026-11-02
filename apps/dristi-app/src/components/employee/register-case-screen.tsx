"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDownIcon,
  CircleArrowLeftIcon,
  CircleCheckIcon,
  FileQuestionIcon,
} from "lucide-react";

import { ChromeDialogContent } from "@/components/chrome/app-chrome";
import { CaseFileView } from "@/components/employee/register-case-file";
import { ARRIVAL, OVERLAY_RISE } from "@/components/chrome/motion";
import { markArrival, useArrival } from "@/components/employee/use-arrival";
import { useCourtToday } from "@/components/employee/use-court-today";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Timeline, TimelineItem } from "@/components/ui/timeline";
import {
  CASE_REVIEW_STATUS,
  caseReviewFor,
  caseSummaryFor,
  SCRUTINY_MODES,
  SUMMARY_TERMS,
  SYNOPSIS_FIELDS,
  type CaseReview,
  type CaseScrutiny,
  type CaseSummary,
  type CaseSummaryWindow,
} from "@/lib/employee/case-review";
import { causeTitle } from "@/lib/employee/hearings";
import {
  REGISTER_QUEUE,
  registerCaseById,
  type RegisterCase,
} from "@/lib/employee/register-cases";
import { cn } from "@/lib/utils";
import { Identifier } from "@/components/chrome/identifier";

/**
 * Register cases — one waiting complaint, as the magistrate reads it before taking it on
 * the register or sending it back to scrutiny.
 *
 * The third build, and the only one: the first two are deleted (owner, 2026-09-12). The
 * second was a column of eight identical cards, three screens tall, every date stated
 * twice, forty per cent of the canvas empty. This one is composed around two questions
 * the owner put — *what does the complaint say*, and *how did it get here* — across the
 * full width, in two tiers on one column grid (brief §0).
 *
 * - **Synopsis** is one sheet of six compartments in the owner's order — parties, cheque,
 *   dishonour, demand notice, cause of action, prayer — divided by hairlines, each fact a
 *   label over its value. No dates: those are the timeline's.
 * - **Scrutiny** — who cleared it, how many rounds, how long; the rounds themselves open
 *   as a timeline of send-backs, so a file that went round four times costs no room here.
 * - **Timeline** — the dates, directly: the §138 chain, then the court's steps under it,
 *   one rail after another, each row a step, what it means, and the day it closed.
 *
 * Every value comes from `lib/employee/case-review.ts` through one slot; every term from
 * its declared lists. Colour appears only where the file is outside a limit or another
 * complaint is pending. 14px throughout; 12px only for the three panel eyebrows.
 *
 * Two acts and no third (owner, 2026-09-11). Both progress in place — the body gives way
 * to one card, the header stays, and confirming settles that same card into its outcome.
 * Nothing is performed, and the settled state says so once.
 */
export function RegisterCaseScreen({ caseId }: { caseId: string }) {
  const today = useCourtToday();
  const complaint = registerCaseById(caseId);
  const summary = caseSummaryFor(caseId, today);
  const review = caseReviewFor(caseId, today);

  if (!complaint || !summary || !review) return <ComplaintMissing />;

  /* Keyed on the complaint, so "Next complaint" opens a fresh page rather than the
     previous complaint's settled act. */
  return (
    <ComplaintPage key={caseId} complaint={complaint} summary={summary} review={review} />
  );
}

/** Where this queue lives — its rows open beneath it. */
const QUEUE_HREF = "/employee/register-cases";

/** The employee shell's own bar, which the tab row sticks under (`top-14`). */
const CHROME_HEIGHT = 56;

/** Section labels above a surface — scaffolding, so it reads as scaffolding. */
const EYEBROW = "text-caption font-semibold text-muted-foreground";

/* ─────────────────────────────── the page ───────────────────────────────── */

type Act = "register" | "send-back";
type Stage = { act: Act; settled: boolean };

/**
 * The frame: warm canvas, the header naming the complaint and holding the two acts, then
 * either the tabs or the act in progress.
 *
 * `bg-muted` in light, `dark:bg-background` in dark — the canvas under lifted white
 * panels that the registrations queue set as the default. `overflow-x-clip` keeps the
 * sideways entrance from flashing a scrollbar; it clips without becoming a scroll
 * container, so the sticky tab row still sticks.
 *
 * Both tabs are pages that scroll; the tab row sticks under the chrome bar on either.
 */
function ComplaintPage({
  complaint,
  summary,
  review,
}: {
  complaint: RegisterCase;
  summary: CaseSummary;
  review: CaseReview;
}) {
  const [tab, setTab] = useComplaintTab();
  /* The act in progress, in the overlay over this page — `null` while there is none. */
  const [stage, setStage] = React.useState<Stage | null>(null);
  /* The act the overlay was opened from: its button takes focus again when the overlay
     closes, rather than focus falling to the page. */
  const [returnFocus, setReturnFocus] = React.useState<Act | null>(null);
  /* The acts ride along in the sticky tab bar once the header's own pair has scrolled
     off — the owner had to scroll back to the top of a three-screen file to act on it
     (2026-09-12). The header's pair stays in place so nothing reflows under the reader,
     but goes `inert` while the bar carries them: one Register in the tab order, always. */
  const actsRef = React.useRef<HTMLDivElement>(null);
  const actsOffScreen = useScrolledPast(actsRef);
  /* Arrived from "Next complaint" or from the queue: the page rises into place, so a
     complaint that replaced another is visibly a new one. */
  const arrival = useArrival();

  const act = (next: Act) => setStage({ act: next, settled: false });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip">
      <div
        className={cn(
          "flex w-full min-w-0 flex-1 flex-col gap-8 px-6 pt-6 pb-16 md:px-8 md:pt-8",
          arrival && ARRIVAL[arrival],
        )}
      >
        <ComplaintHeader
          complaint={complaint}
          actsRef={actsRef}
          offScreen={actsOffScreen}
          returnFocus={returnFocus}
          onAct={act}
        />

        <div className="min-w-0">
          <ComplaintTabs
            tab={tab}
            setTab={setTab}
            summary={summary}
            review={review}
            acts={actsOffScreen ? <HeaderActs returnFocus={null} onAct={act} /> : null}
          />
        </div>
      </div>

      {/* The act happens over the page, not instead of it (owner, 2026-09-12): whichever
          tab the magistrate decided on stays behind the overlay, so the decision is taken
          against the thing that was read. One overlay, carrying its own stages — the
          registrations queue's grammar, on a page. */}
      <ActDialog
        stage={stage}
        complaint={complaint}
        next={nextInQueue(complaint.id)}
        onClose={() => {
          setReturnFocus(stage?.act ?? null);
          setStage(null);
        }}
        onConfirm={() => setStage((current) => (current ? { ...current, settled: true } : null))}
      />
    </div>
  );
}

/** The complaint after this one, in the queue's own order — or none at the end. */
function nextInQueue(id: string): RegisterCase | null {
  const index = REGISTER_QUEUE.findIndex((complaint) => complaint.id === id);
  return index >= 0 ? (REGISTER_QUEUE[index + 1] ?? null) : null;
}

/**
 * Which complaint, and what can be done with it. The number above the cause, the two
 * acts opposite: send back is outline, register the page's one primary. They stay put
 * while an act is in progress — the act is an overlay over this page, and the page it
 * covers is the one the magistrate was reading.
 */
function ComplaintHeader({
  complaint,
  actsRef,
  offScreen,
  returnFocus,
  onAct,
}: {
  complaint: RegisterCase;
  actsRef: React.RefObject<HTMLDivElement | null>;
  /** The header's acts have scrolled under the sticky bar, which now carries them. */
  offScreen: boolean;
  returnFocus: Act | null;
  onAct: (act: Act) => void;
}) {
  return (
    <header
      aria-labelledby="complaint-title"
      /* The acts sit beside the title only once there is room for both: a long cause
         title — two Malayalam names and a company's full style — squeezed the title
         column to 141px at 768px wide while the buttons kept theirs, so the heading came
         down the page one word at a time (measured 2026-09-12). Below 1024px the acts
         take their own line under the title, and the title column grows to the width the
         header has. */
      className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Identifier
          value={complaint.filingNumber}
          label="filing number"
          className="self-start text-body-compact text-muted-foreground"
        />
        <h1
          id="complaint-title"
          className="text-balance font-semibold text-title"
        >
          {causeTitle(complaint)}
        </h1>
      </div>
      <HeaderActs
          ref={actsRef}
          /* Scrolled past, this pair is the one in the sticky bar's shadow: left in
             place so nothing reflows, but taken out of the tab order and off the
             accessibility tree, so the page never offers two Registers. */
          offScreen={offScreen}
          returnFocus={returnFocus}
          onAct={onAct}
        />
    </header>
  );
}

/**
 * The two acts. Mounting again after Back, they hand focus to the one backed out of.
 *
 * The same component carries the pair in the sticky tab bar, at the same size: the act is
 * never more than a glance away on a long file, and never a smaller button.
 */
function HeaderActs({
  ref,
  offScreen,
  returnFocus,
  onAct,
}: {
  ref?: React.RefObject<HTMLDivElement | null>;
  offScreen?: boolean;
  returnFocus: Act | null;
  onAct: (act: Act) => void;
}) {
  const sendBackRef = React.useRef<HTMLButtonElement>(null);
  const registerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (returnFocus === "send-back") sendBackRef.current?.focus();
    if (returnFocus === "register") registerRef.current?.focus();
    // On mount only: this is the moment the acts come back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      inert={offScreen || undefined}
      aria-hidden={offScreen || undefined}
      className="flex shrink-0 flex-wrap gap-3"
    >
      <Button
        ref={sendBackRef}
        type="button"
        variant="outline"
        onClick={() => onAct("send-back")}
      >
        Send back to scrutiny
      </Button>
      <Button ref={registerRef} type="button" onClick={() => onAct("register")}>
        Register
      </Button>
    </div>
  );
}

/**
 * Whether an element has scrolled off the top of the page, under the sticky chrome.
 *
 * The margin is the chrome's own height — the 56px bar and the 44px tab row — so the
 * acts are considered gone exactly when the tab bar covers them, and the pair that
 * replaces them appears in the same motion.
 */
function useScrolledPast(ref: React.RefObject<HTMLElement | null>): boolean {
  const [past, setPast] = React.useState(false);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) {
      setPast(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setPast(!entry.isIntersecting),
      { rootMargin: "-100px 0px 0px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return past;
}

/* ─────────────────────────────── the tabs ───────────────────────────────── */

type ComplaintTab = "summary" | "file";

/** Which tab is open, held in the URL as `?file=1` so the browser's Back closes it. */
function useComplaintTab(): [ComplaintTab, (next: ComplaintTab) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab: ComplaintTab = params.get("file") === "1" ? "file" : "summary";

  const setTab = React.useCallback(
    (next: ComplaintTab) => {
      const query = new URLSearchParams(params.toString());
      if (next === "file") query.set("file", "1");
      else query.delete("file");
      const search = query.toString();
      router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return [tab, setTab];
}

/**
 * The DS trigger at the page's one size, keeping its width.
 *
 * **The underline sits on the row's rule, and spans the label.** The primitive hangs its
 * mark at `bottom: -5px` for a padded track, under a selector scoped to the horizontal
 * group — so a plain `after:-bottom-px` loses on specificity and the mark rendered 3px
 * below the rule, as a second line (measured: rule at 211px, mark at 214–216px). The
 * override has to carry the same scope to replace it, which is how every other tab row
 * in the app writes it (`case-section-tabs.tsx`). `px-0` takes the primitive's side
 * padding off, so the mark is the label's width and the first label lines up with the
 * cause title above it.
 */
const TRIGGER =
  "h-full flex-none group-data-[variant=line]/tabs-list:px-0 text-body-compact";

function ComplaintTabs({
  tab,
  setTab,
  summary,
  review,
  acts,
}: {
  tab: ComplaintTab;
  setTab: (next: ComplaintTab) => void;
  summary: CaseSummary;
  review: CaseReview;
  /** The acts, once the header's own pair has scrolled away — else nothing. */
  acts: React.ReactNode;
}) {
  /* Where the tab row sits in the page, as opposed to where it has stuck. The ref goes
     on the Tabs root — its own top *is* the row's layout position, and an anchor element
     of its own was a flex child of this stack, buying 32px of gap above the tabs that
     read as a hole between the title and them (owner, 2026-09-12). */
  const anchorRef = React.useRef<HTMLDivElement>(null);

  /* The two tabs are two documents of different lengths, and switching kept the scroll
     offset: leaving the summary half way down landed the reader half way into the case
     file, and coming back from deep in the file landed them at the foot of a summary
     they had not scrolled (owner, 2026-09-12 — "something about the scroll here is
     broken"). Switching now winds back to the tab row when the reader is below it, and
     leaves the page alone when they are not. */
  const toTabRow = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const top = anchor.getBoundingClientRect().top + window.scrollY - CHROME_HEIGHT;
    if (window.scrollY > top) window.scrollTo({ top });
  };

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        setTab(value as ComplaintTab);
        toTabRow();
      }}
      className="gap-8"
      ref={anchorRef}
    >
      {/* Sticky under the 56px bar, on the canvas's own fill and bled to the page edge
          so what scrolls beneath is covered cleanly. The rule is the band's, full width,
          as a sticky bar's edge is. */}
      <div className="sticky top-14 z-20 -mx-6 border-b border-hairline bg-muted px-6 md:-mx-8 md:px-8 dark:bg-background">
        {/* The acts sit at the far end of the tab row, at the size they are in the header
            — a button that shrinks as it crosses into the bar reads as a glitch, not as a
            transition (owner, 2026-09-12). The **tabs keep their own height**: stretching
            the list to fill a taller bar pushed the labels 20px off their underline, and
            that underline is the tab component's, not this screen's to move. The bar
            takes its room above instead, and both sit on its foot — the acts' bottom edge
            on the same line as the tabs', which is the rule. The height does not change
            when the acts arrive, so nothing moves as they fade in. On a phone the row
            cannot hold both, so they take a line of their own above the tabs, where the
            underline still meets the rule. */}
        <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <TabsList
            variant="line"
            className="w-full justify-start gap-6 rounded-none p-0 group-data-horizontal/tabs:h-11"
          >
            <TabsTrigger value="summary" className={TRIGGER}>
              Summary
            </TabsTrigger>
            <TabsTrigger value="file" className={TRIGGER}>
              Case file
            </TabsTrigger>
          </TabsList>
          {acts ? (
            /* Centred in the band, not sitting on its rule: the tabs are bottom-aligned
               because their underline *is* the rule, and a button has no such reason
               (owner, 2026-09-12). */
            <div className="shrink-0 pt-2 animate-in fade-in-0 slide-in-from-top-1 duration-300 ease-out motion-reduce:animate-none sm:-mt-3 sm:flex sm:items-center sm:self-stretch sm:pt-0">
              {acts}
            </div>
          ) : null}
        </div>
      </div>

      <TabsContent value="summary" className="text-body-compact">
        <ComplaintSummary summary={summary} />
      </TabsContent>

      <TabsContent value="file" className="text-body-compact">
        <CaseFileView review={review} />
      </TabsContent>
    </Tabs>
  );
}

/* ─────────────────────────────── the summary ────────────────────────────── */

/**
 * The summary in two tiers, across the full width.
 *
 * On top, the **synopsis** — the complaint's own account, the owner's six heads. Below it,
 * the court's record of the file: **scrutiny** in the first third and the **timeline** in
 * the other two, so the gap between them falls on the synopsis's first column divider and
 * the page keeps one column grid from top to bottom. Below 1280px the tiers stack.
 *
 * Every surface is the approved grammar — an eyebrow over a lifted white panel on the
 * warm canvas — and every fact inside is a label over its value, at 14px.
 */
function ComplaintSummary({ summary }: { summary: CaseSummary }) {
  return (
    <div className="grid items-start gap-x-8 gap-y-12 xl:grid-cols-3">
      <SynopsisPanel summary={summary} />
      <ScrutinyPanel scrutiny={summary.scrutiny} />
      <TimelinePanel summary={summary} />
    </div>
  );
}

/** A lifted white panel whose children draw their own padding and dividers. */
const SHEET = "gap-0 overflow-hidden py-0";

/** An eyebrow over the surface it names. */
function Panel({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <h2 id={id} className={EYEBROW}>
        {label}
      </h2>
      {children}
    </section>
  );
}

/**
 * The synopsis as one sheet of six compartments.
 *
 * Each head is a cell, and the cells are divided by 1px hairlines drawn as the grid's own
 * gap over a hairline fill — so the dividers are exact at every column count and never
 * double up where two cells meet. The sheet is its own container and chooses its columns
 * by the room it has: three from 896px, two from 576px, one on a phone. Six heads divide
 * evenly into all three, so no cell is ever left empty.
 *
 * **No dates here.** Each date is stated once, on the timeline. The owner's synopsis
 * format lists them under each head; moving them is the one deviation from it, and it is
 * logged (brief §0, D2).
 */
function SynopsisPanel({ summary }: { summary: CaseSummary }) {
  const { synopsis, cheque } = summary;

  return (
    <Panel id="synopsis-heading" label={SUMMARY_TERMS.synopsis} className="xl:col-span-3">
      <Card variant="raised" className={cn(SHEET, "@container")}>
        <div className="grid gap-px bg-hairline @xl:grid-cols-2 @4xl:grid-cols-3">
          <SynopsisSection label={SUMMARY_TERMS.parties}>
            <Fact term={SYNOPSIS_FIELDS.complainant} note={summary.complainant.type}>
              {summary.complainant.name}
            </Fact>
            {/* No type under the accused: every accused in the queue is a company, and a
                value identical on every file is not a fact. */}
            <Fact term={SYNOPSIS_FIELDS.accused}>{summary.accused.name}</Fact>
            <Fact term={SYNOPSIS_FIELDS.advocate}>
              {summary.advocate ?? <Absent>None on record</Absent>}
            </Fact>
          </SynopsisSection>

          <SynopsisSection label={SUMMARY_TERMS.cheque}>
            <Fact
              term={SYNOPSIS_FIELDS.amount}
              format="figure"
              note={cheque.partPaid ? `${cheque.partPaid} paid before filing` : undefined}
            >
              {cheque.amount}
            </Fact>
            <Fact term={SYNOPSIS_FIELDS.chequeNumber}>
              <Identifier value={cheque.number} label="cheque number" />
            </Fact>
            <Fact term={SYNOPSIS_FIELDS.drawnOn} note={synopsis.cheque.drawerBranch}>
              {synopsis.cheque.drawerBank}
            </Fact>
          </SynopsisSection>

          <SynopsisSection label={SUMMARY_TERMS.dishonour}>
            <Fact term={SYNOPSIS_FIELDS.presentedAt} note={synopsis.dishonour.payeeBranch}>
              {synopsis.dishonour.payeeBank}
            </Fact>
            <Fact term={SYNOPSIS_FIELDS.returnReason}>{cheque.returnReason}</Fact>
          </SynopsisSection>

          <SynopsisSection label={SUMMARY_TERMS.notice}>
            <Fact term={SYNOPSIS_FIELDS.mode}>{synopsis.notice.mode}</Fact>
            <Fact term={SYNOPSIS_FIELDS.tracking}>
              <Identifier value={synopsis.notice.tracking} label="tracking number" />
            </Fact>
            <Fact term={SYNOPSIS_FIELDS.replied}>
              {synopsis.notice.replied ? "Received" : <Absent>None</Absent>}
            </Fact>
          </SynopsisSection>

          <SynopsisSection label={SUMMARY_TERMS.causeOfAction}>
            {/* The branch alone: the basis beside it read "Complainant's bank branch" on
                every complaint in the queue, which is a caption, not a fact. */}
            <Fact term={SYNOPSIS_FIELDS.jurisdiction}>
              {synopsis.causeOfAction.jurisdiction}
            </Fact>
            <Fact
              term={SYNOPSIS_FIELDS.otherPending}
              tone={synopsis.causeOfAction.otherPending ? "warning" : undefined}
            >
              {synopsis.causeOfAction.otherPending ? "One pending" : <Absent>None</Absent>}
            </Fact>
          </SynopsisSection>

          <SynopsisSection label={SUMMARY_TERMS.prayer}>
            <Fact term={SYNOPSIS_FIELDS.compensation} format="figure">
              {synopsis.prayer.compensation}
            </Fact>
            <Fact term={SYNOPSIS_FIELDS.interim} format="figure">
              {synopsis.prayer.interim}
            </Fact>
          </SynopsisSection>
        </div>
      </Card>
    </Panel>
  );
}

/**
 * One compartment of the synopsis: the head's name, then its particulars. White on the
 * hairline fill, so its edges are the dividers.
 */
function SynopsisSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4 bg-card p-6 md:p-8">
      <h3 id={id} className="text-body font-semibold">
        {label}
      </h3>
      {/* Each particular is its own row, ruled off from the next: three parties stacked
          with nothing between them read as one lump (owner, design review). The rule is
          drawn from the list with a child selector rather than `divide-y`: the DS row
          resets its own border, and `divide-y`'s zero-specificity rule lost to that reset
          on the render — padding, and no line. */}
      <DescriptionList className="[&>*]:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-hairline">
        {children}
      </DescriptionList>
    </section>
  );
}

/**
 * How a value is set: plain, or as a figure that lines up. An identifier is not a format
 * here — it composes `Identifier`, which owns that treatment for the whole product.
 */
const FORMAT = {
  text: "",
  figure: "tabular-nums",
} as const;

type FactFormat = keyof typeof FORMAT;

/**
 * One particular — its label above its value, and an optional second line beneath.
 *
 * **Three levels, three treatments** (owner, design review: *"Drawn on and Chinnakada are
 * exactly the same hierarchy… the typographic hierarchy is very broken"*). The label is
 * scaffolding and takes the 12px caption role; the value is what is read and takes 14px
 * at medium weight; a second line — a branch, a party's type — stays 14px in the muted
 * ink, so it is quieter than the value and plainly not a label. `tone` is the one colour
 * a value can take, and only where the file needs the reader's attention.
 */
function Fact({
  term,
  format = "text",
  tone,
  note,
  className,
  children,
}: {
  term: string;
  format?: FactFormat;
  tone?: "warning";
  note?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    /* Two lines, always: the label, then the value with its second part after a dot on
       the same line — "Federal Bank · Thevally", not a third line (owner, 2026-09-11).
       Every particular the same height is what lets the compartments' rows line up
       across the sheet instead of reading jagged. Labels 14px muted, no 12px. */
    <DescriptionRow className={cn("flex min-w-0 flex-col gap-1 border-0 py-0", className)}>
      <DescriptionTerm className="text-body-compact">{term}</DescriptionTerm>
      <DescriptionDetails className="min-w-0 text-body-compact">
        <span
          className={cn(
            "font-medium",
            FORMAT[format],
            tone === "warning" && "text-warning-ink",
          )}
        >
          {children}
        </span>
        {note ? <span className="text-muted-foreground"> · {note}</span> : null}
      </DescriptionDetails>
    </DescriptionRow>
  );
}

/** A value that is an absence — said in words, in the quiet voice. */
function Absent({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

/* ─────────────────────────────── scrutiny ───────────────────────────────── */

/**
 * How scrutiny went — who cleared it, how many rounds, how long, and what each round
 * before the last was sent back for: the kind of defect, never the officer's remark.
 *
 * The two figures sit side by side because they are read together ("three rounds, a
 * month"); the officer and the defects take the full width because they are words. A
 * complaint cleared first time has nothing to list, and the round count already says so.
 */
function ScrutinyPanel({ scrutiny }: { scrutiny: CaseScrutiny | undefined }) {
  const [open, setOpen] = React.useState(false);

  if (!scrutiny) {
    return (
      <Panel id="scrutiny-heading" label={SUMMARY_TERMS.scrutiny}>
        <Card variant="raised" className={cn(SHEET, "@container")}>
          <div className="p-6 md:p-8">
            <p className="text-body-compact text-muted-foreground">Not recorded</p>
          </div>
        </Card>
      </Panel>
    );
  }

  return (
    <Panel id="scrutiny-heading" label={SUMMARY_TERMS.scrutiny}>
      <Card variant="raised" className={cn(SHEET, "@container")}>
        <Collapsible open={open} onOpenChange={setOpen}>
          {/* Three facts, not four: what each round was sent back for is now the
              disclosure below, so the row at rest holds only figures and reads across in
              one glance. Two columns in a third of the page, three once the panel has
              the width. */}
          {/* Two bands with the card's own hairline between them, as the case file's
              cards are ruled and as the rounds below already were — three facts loose in
              one box read as floating (owner, 2026-09-12). */}
          <DescriptionList className="px-6 py-6 md:px-8">
            <Fact term={SYNOPSIS_FIELDS.clearedBy}>{SCRUTINY_MODES[scrutiny.mode]}</Fact>
          </DescriptionList>
          <DescriptionList className="grid grid-cols-2 gap-x-8 border-t border-hairline px-6 py-6 md:px-8">
            <Fact term={SYNOPSIS_FIELDS.rounds} format="figure">
              {scrutiny.rounds}
            </Fact>
            <Fact term={SYNOPSIS_FIELDS.took} format="figure">
              {days(scrutiny.days)}
            </Fact>
          </DescriptionList>

          {scrutiny.returns.length > 0 ? (
            <>
              <CollapsibleContent className="border-t border-hairline animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none">
                <div className="p-6 md:p-8">
                  {/* The loop itself: taken up, each round with the day it went back and
                      what for, and the pass that cleared it. A file that went round four
                      times adds rows here and nothing to the card at rest, which is what
                      the owner asked the disclosure to buy (2026-09-12). */}
                  <Timeline className="text-body-compact">
                    <Step
                      label="Taken up"
                      date={
                        <time dateTime={scrutiny.takenUpOn}>
                          {scrutiny.takenUpOnShortLabel}
                        </time>
                      }
                    />
                    {scrutiny.returns.map((sendBack) => (
                      <Step
                        key={sendBack.round}
                        label={`Round ${sendBack.round}`}
                        note={sendBack.label}
                        date={
                          <time dateTime={sendBack.sentBackOn}>
                            {sendBack.sentBackOnShortLabel}
                          </time>
                        }
                      />
                    ))}
                    <Step
                      label="Cleared"
                      date={
                        <time dateTime={scrutiny.clearedOn}>
                          {scrutiny.clearedOnShortLabel}
                        </time>
                      }
                    />
                  </Timeline>
                </div>
              </CollapsibleContent>

              <div className="flex justify-center border-t border-hairline p-2">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="text-body-compact">
                    {open ? "Hide rounds" : "Show rounds"}
                    <ChevronDownIcon
                      aria-hidden
                      className={cn(
                        "text-muted-foreground transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </>
          ) : null}
        </Collapsible>
      </Card>
    </Panel>
  );
}

/* ─────────────────────────────── the timeline ───────────────────────────── */

/**
 * When everything happened — the dates themselves, shown directly.
 *
 * **The measures are gone** (owner, 2026-09-12: *"I'm not understanding what the 84 days
 * means. Like was it 84 days ago?… we just show the timeline directly"*). A span stated as
 * a number of days is a figure the reader has to re-anchor to two events before it means
 * anything, and on the render three of them sat in a row with nothing to anchor to. The
 * dates are the anchor, so the dates are what the panel shows: the §138 chain in one
 * column, the court's own steps in the other.
 *
 * **The limit is stated on the step it governs**, under it: *within 3 months of the cheque
 * date* on the day it was presented, *beyond 1 month of the cause of action · condonation
 * sought* on the day it was filed. The reader can check either by eye against the two
 * dates either side of it, which is the point of showing them. Warning ink appears only
 * where the file is outside a window, so the norm stays quiet and nothing is hidden behind
 * a disclosure any more.
 */
function TimelinePanel({ summary }: { summary: CaseSummary }) {
  const { scrutiny } = summary;
  const beforeFiling = summary.steps.filter((step) => step.id !== "filed");
  const filed = summary.steps.find((step) => step.id === "filed");
  /* Each window is read off the step that closes it, so a step carries its own limit. */
  const limits = new Map(summary.windows.map((window) => [window.to, windowNote(window)]));

  return (
    <Panel id="timeline-heading" label={SUMMARY_TERMS.timeline} className="xl:col-span-2">
      <Card variant="raised" className={cn(SHEET, "@container")}>
        {/* One column, not two. Side by side, each phase had 278px to write in: the
            dates ended in a ragged column, every limit wrapped across two lines under
            one, and the shorter phase left a third of the card blank. Stacked, the two
            phases read in the order they happened, one rail under another, and every row
            has the panel's full width for a label, its note and a date that lines up. */}
        <div className="flex flex-col gap-8 p-6 md:p-8">
          <StepGroup heading="Before filing">
            {beforeFiling.map((step) => (
              <Step
                key={step.id}
                label={step.label}
                date={<time dateTime={step.on}>{step.onShortLabel}</time>}
                {...limits.get(step.id)}
              />
            ))}
          </StepGroup>
          <StepGroup heading="In court">
            {filed ? (
              <Step
                label={filed.label}
                date={<time dateTime={filed.on}>{filed.onShortLabel}</time>}
                {...limits.get(filed.id)}
              />
            ) : null}
            {scrutiny ? (
              /* The date column holds the day a step closed, one date to a row, so the
                 column has one edge. Scrutiny's other end is its note. */
              <Step
                label={SUMMARY_TERMS.scrutiny}
                date={
                  <time dateTime={scrutiny.clearedOn}>{scrutiny.clearedOnShortLabel}</time>
                }
                note={`taken up ${scrutiny.takenUpOnShortLabel}`}
              />
            ) : null}
            {/* The one step with no date of its own: it is still happening. How long it
                has been happening is the note, because that is the wait the magistrate is
                deciding whether to end. */}
            <Step
              status="current"
              label={CASE_REVIEW_STATUS}
              date="Today"
              note={
                scrutiny === undefined
                  ? undefined
                  : scrutiny.daysWaiting === 0
                    ? "cleared by scrutiny today"
                    : `${days(scrutiny.daysWaiting)} since scrutiny cleared it`
              }
            />
          </StepGroup>
        </div>
      </Card>
    </Panel>
  );
}

/**
 * Where the window that closes on a step sits against the limit the law sets, in the
 * statute's own terms and anchored to the day it is counted from — never a bare figure.
 */
function windowNote(window: CaseSummaryWindow): {
  note: string;
  aside?: string;
  tone?: "warning";
} {
  const limit = `${window.limitLabel} of ${WINDOW_COUNTED_FROM[window.id]}`;
  switch (window.status) {
    case "within":
      return { note: `within ${limit}` };
    case "outside":
      return { note: `beyond ${limit}`, tone: "warning" };
    case "condonation-sought":
      /* Two facts, so two lines rather than one that wraps: the file is late, and there
         is an application on record asking the court to excuse it. */
      return { note: `beyond ${limit}`, aside: "condonation sought", tone: "warning" };
    case "early":
      return { note: "before the cause of action arose", tone: "warning" };
  }
}

/** The day each statutory window is counted from — the `from` step, in words. */
const WINDOW_COUNTED_FROM: Record<CaseSummaryWindow["id"], string> = {
  presentation: "the cheque date",
  notice: "the return",
  filing: "the cause of action",
};

/** One column of dated steps, under the phase it belongs to. */
function StepGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h3 className="text-body-compact font-semibold text-muted-foreground">{heading}</h3>
      <Timeline className="text-body-compact">{children}</Timeline>
    </div>
  );
}

/**
 * One step: its name, and its date against the far edge where dates line up. Composed as
 * the item's children because the DS item's own title slot takes a string, and a step's
 * date is a `<time>`.
 *
 * **The spacing between steps lives inside the step, not under it.** The DS item spaces
 * itself with `pb-6` on the `li`, and its rail stretches only to the item's content box —
 * so on the render the line stopped at every step and the gap between them was blank.
 * Moving the spacing into the content makes the rail run through it to the next dot.
 * Upstream DS feedback: the rail should span the item's padding (brief §0.5).
 */
function Step({
  status = "past",
  label,
  date,
  note,
  aside,
  tone,
}: {
  status?: "past" | "current";
  label: string;
  date: React.ReactNode;
  /** What the step means for the decision — a statutory limit, or the wait so far. */
  note?: string;
  /** A second fact about the same step, always quiet — "condonation sought". */
  aside?: string;
  tone?: "warning";
}) {
  return (
    <TimelineItem status={status} className="pb-0">
      {/* Three columns once the panel is wide: the step, what it means, and the day it
          closed. The date column is fixed, so every date in the chain shares one edge
          and one right margin however long the step's name runs. Narrow, the note drops
          to a line of its own under the step and the date keeps the far corner. */}
      <div className="pb-4 group-last/timeline-item:pb-0">
        <div className="-mx-3 -my-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 rounded-lg px-3 py-2 transition-colors hover:bg-surface-sunken @xl:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_6.5rem]">
        {/* Regular weight: the group's heading is the one semibold line in the column, and
            the date's muted ink is what separates it from the step's name. */}
        <span className="col-start-1 row-start-1 min-w-0">{label}</span>
        <span className="col-start-2 row-start-1 shrink-0 text-right tabular-nums text-muted-foreground @xl:col-start-3">
          {date}
        </span>
        {note ? (
          <span
            className={cn(
              "col-span-2 col-start-1 row-start-2 min-w-0 @xl:col-span-1 @xl:col-start-2 @xl:row-start-1",
              tone === "warning" ? "text-warning-ink" : "text-muted-foreground",
            )}
          >
            {note}
            {aside ? (
              <span className={cn("block", tone === "warning" && "text-muted-foreground")}>
                {aside}
              </span>
            ) : null}
          </span>
        ) : null}
        </div>
      </div>
    </TimelineItem>
  );
}

function days(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

/* ─────────────────────────────── the acts ───────────────────────────────── */

/**
 * The act, as one overlay over the page it was decided on.
 *
 * **The registrations queue's grammar, on a page** (owner, 2026-09-12: *"similar to how
 * we had done the flow in approve registration, a modal should just come up on the
 * current screen"*). The summary or the case file stays behind it, so the decision is
 * taken against the thing that was read; nothing navigates, and no second modal ever
 * opens over this one (`ui-craft` §7).
 *
 * Two acts, one shape. Send back asks for the reason the magistrate is returning it —
 * the one gate, because a file going back with no reason is a file the registry cannot
 * act on. Register asks for nothing but the consequence, stated once. Confirming does
 * not close the overlay: the same card resolves in place, its strip taking the outcome's
 * own tone, and the footer changes from *Cancel / the act* to where to go next.
 */
function ActDialog({
  stage,
  complaint,
  next,
  onClose,
  onConfirm,
}: {
  stage: Stage | null;
  complaint: RegisterCase;
  /** The complaint after this one, offered when the act has settled. */
  next: RegisterCase | null;
  onClose: () => void;
  /** Settle the act in place. Must **not** close the overlay — the outcome renders here. */
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={stage !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {stage ? (
        <ActBody
          stage={stage}
          complaint={complaint}
          next={next}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      ) : null}
    </Dialog>
  );
}

/** What the header says at each step of each act. */
const ACT_TITLE: Record<Act, { asking: string; settled: string }> = {
  "send-back": {
    asking: "Send back to scrutiny?",
    settled: "Sent back to scrutiny",
  },
  register: { asking: "Register this complaint?", settled: "Complaint registered" },
};

/**
 * What the complaint is, at each step of the act — one chip, in one place, all the way
 * through. Neutral while it is a question, the outcome's own muted pair once it is
 * answered, and the words are on the chip so the state is never colour alone.
 */
const ACT_BADGE: Record<
  "waiting" | "sent-back" | "registered",
  { variant: "secondary" | "success" | "warning"; label: string }
> = {
  waiting: { variant: "secondary", label: CASE_REVIEW_STATUS },
  "sent-back": { variant: "warning", label: "Sent back to scrutiny" },
  registered: { variant: "success", label: "Registered" },
};

function ActBody({
  stage,
  complaint,
  next,
  onClose,
  onConfirm,
}: {
  stage: Stage;
  complaint: RegisterCase;
  next: RegisterCase | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { act, settled } = stage;
  const sending = act === "send-back";
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const empty = reason.trim() === "";
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const reasonRef = React.useRef<HTMLTextAreaElement>(null);
  const settledBefore = React.useRef(settled);

  /* Into the reason box, because writing it is the only thing that step is for; onto the
     title on every other step, because the title has just changed to say what happened
     and a keyboard reader should hear it. Not on the first frame: the dialog's own
     landing place handles the opening. */
  React.useEffect(() => {
    if (settledBefore.current === settled) return;
    settledBefore.current = settled;
    titleRef.current?.focus();
  }, [settled]);

  const badge = ACT_BADGE[settled ? (sending ? "sent-back" : "registered") : "waiting"];

  function confirm() {
    if (sending && empty) {
      setTouched(true);
      reasonRef.current?.focus();
      return;
    }
    onConfirm();
  }

  return (
    <ChromeDialogContent
      className={cn(
        "flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
        OVERLAY_RISE,
      )}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        if (sending) reasonRef.current?.focus();
        else titleRef.current?.focus();
      }}
    >
      {/* **One surface, and the outcome said once.** This was a white card on a tinted
          stage inside a white dialog — a box in a box in a box, and the owner read it as
          exactly that (2026-09-12). The dialog is the panel now: the question is its
          header, the answer is its body.

          Settled, the header itself takes the outcome's muted pair and an icon, rather
          than a chip and a band repeating the title's own words underneath it. One
          statement, in colour, with the words and a mark — never colour alone. */}
      <DialogHeader className="shrink-0 items-start gap-2 border-b border-hairline p-6 pr-16">
        {/* **The tag is the state, before and after.** It was a neutral chip that vanished
            on the act and a tinted header band that replaced it — two treatments for one
            fact, and a layout that jumped between them. The chip stays where it is and
            becomes the outcome: its fill crosses to the outcome's muted pair, a mark
            appears, and the words change under them (owner, 2026-09-12). Nothing else in
            the header moves. */}
        <Badge
          variant={badge.variant}
          className="gap-1.5 transition-colors duration-500 motion-reduce:transition-none"
        >
          {settled ? (
            sending ? (
              <CircleArrowLeftIcon
                aria-hidden
                className="size-3.5 shrink-0 animate-in fade-in-0 zoom-in-50 duration-500 motion-reduce:animate-none"
              />
            ) : (
              <CircleCheckIcon
                aria-hidden
                className="size-3.5 shrink-0 animate-in fade-in-0 zoom-in-50 duration-500 motion-reduce:animate-none"
              />
            )
          ) : null}
          <span
            key={settled ? "settled" : "asking"}
            role={settled ? "status" : undefined}
            className="animate-in fade-in-0 slide-in-from-bottom-1 duration-500 motion-reduce:animate-none"
          >
            {badge.label}
          </span>
        </Badge>
        <DialogTitle
          ref={titleRef}
          tabIndex={-1}
          className="text-title-s font-semibold outline-none"
        >
          <span
            key={settled ? "settled" : "asking"}
            className="inline-block animate-in fade-in-0 slide-in-from-bottom-1 duration-500 motion-reduce:animate-none"
          >
            {settled ? ACT_TITLE[act].settled : ACT_TITLE[act].asking}
          </span>
        </DialogTitle>
        <DialogDescription className="text-body-compact text-muted-foreground">
          {/* No copy control inside the dialog's accessible description. */}
          <Identifier value={complaint.filingNumber} label="filing number" copyable={false} />
          {" · "}
          {causeTitle(complaint)}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        {sending ? (
          settled ? (
            /* The reason as it was written, quiet now that it has gone: the well is the
               same height the box was, so nothing collapses as the act settles. */
            <p className="min-h-32 rounded-lg bg-surface-sunken p-3 text-body-compact whitespace-pre-line text-pretty">
              {reason}
            </p>
          ) : (
            <Field data-invalid={touched && empty}>
              <FieldLabel htmlFor="send-back-reason" className="text-body-compact font-medium">
                Why are you sending this back?
              </FieldLabel>
              <Textarea
                id="send-back-reason"
                ref={reasonRef}
                className="min-h-32 text-body-compact"
                placeholder="e.g. The affidavit is not attested. Please ask the advocate to file an attested copy."
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setTouched(true);
                }}
              />
              {touched && empty ? <FieldError>Write a reason first.</FieldError> : null}
            </Field>
          )
        ) : (
          <p className="text-body-compact text-pretty">
            {settled
              ? "The complaint is on the register. It appears in the court's case list from today."
              : "Registering puts the complaint on the register and gives it a number. Taking cognizance is a separate act, and it comes after. It cannot be undone from this screen."}
          </p>
        )}

      </div>

      <DialogFooter className="mx-0 mb-0 shrink-0 border-hairline bg-card">
        {settled ? (
          <>
            <Button asChild variant={next ? "ghost" : "default"}>
              <Link href={QUEUE_HREF} onClick={() => markArrival("back")}>
                Back to register cases
              </Link>
            </Button>
            {next ? (
              <Button asChild>
                <Link
                  href={`${QUEUE_HREF}/${next.id}`}
                  onClick={() => markArrival("next")}
                >
                  Next complaint
                </Link>
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={confirm}>
              {sending ? "Send back" : "Confirm registration"}
            </Button>
          </>
        )}
      </DialogFooter>
    </ChromeDialogContent>
  );
}

/* ─────────────────────────────── the miss ───────────────────────────────── */

/** An id this queue does not hold — a stale link, a typed URL, a complaint gone. */
function ComplaintMissing() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col p-6 md:p-8">
      <Empty className="border-0 p-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestionIcon aria-hidden />
          </EmptyMedia>
          <EmptyTitle className="font-semibold text-title-s">
            This complaint is not in the register queue
          </EmptyTitle>
          <EmptyDescription className="text-body">
            A complaint opens from the list of those waiting to be registered. This one
            is not on it.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href={QUEUE_HREF}>Back to register cases</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
